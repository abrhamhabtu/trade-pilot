// ─── Vision · prop backtest accounts ───────────────────────────────────────────
// A named, saved practice account at one firm: the trader picks the firm, size
// and a start date, then fills it with trades from manual replay, automated
// strategy runs, or both. Everything else (balance, the trailing floor, daily
// P&L, consistency, passed or blown) is derived from the trades with Proving
// Ground's evaluator, so a manual session and a strategy run are graded the same.
// ───────────────────────────────────────────────────────────────────────────────

import type { Side } from "./analyze";
import type { DaySim, SimTrade } from "@/lib/proving/engine";
import { DD_LABEL, evaluate, openAccount, programByKey, walkDay, type Evaluation, type FirmProgram } from "@/lib/proving/firms";

export interface AccountTrade {
  id: string;
  /** Unix seconds. */
  entryT: number;
  exitT: number;
  /** The futures session (trading day), YYYY-MM-DD. */
  session: string;
  side: Side;
  qty: number;
  entry: number;
  exit: number;
  stop: number;
  target: number;
  pnl: number;
  r: number;
  /** Worst and best open P&L the trade saw, in dollars. */
  worst: number;
  best: number;
  reason: string;
  source: "manual" | "auto";
  strategy?: string;
}

export interface AccountEvent {
  at: number;
  kind: "created" | "session" | "run" | "passed" | "blown" | "reset" | "funded" | "note";
  text: string;
}

export interface PropAccount {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  program: string;
  phase: "eval" | "funded" | "live";
  /** The evaluation this funded account came from. */
  parentId?: string;
  symbol: string;
  tf: "1m" | "5m" | "15m" | "1h" | "4h";
  micro: boolean;
  sizing: "fixed" | "risk";
  contracts: number;
  riskPct: number;
  /** How the trader means to test it; sets the main button. */
  mode: "manual" | "auto" | "both";
  startDate: string;
  /** Where replay or the last run stopped, unix seconds. */
  cursorT: number | null;
  trades: AccountTrade[];
  events: AccountEvent[];
  /** Attempts before the current one, kept for the record. */
  history: { at: number; result: string; trades: number; pnl: number }[];
  resets: number;
}

/** Who placed the trades: split so each side's record stands on its own. */
export function splitBySource(trades: AccountTrade[]) {
  const side = (xs: AccountTrade[]) => ({ trades: xs.length, days: new Set(xs.map((t) => t.session)).size, pnl: xs.reduce((a, t) => a + t.pnl, 0), r: xs.reduce((a, t) => a + t.r, 0), winRate: xs.length ? xs.filter((t) => t.pnl > 0).length / xs.length : 0 });
  return { you: side(trades.filter((t) => t.source === "manual")), auto: side(trades.filter((t) => t.source === "auto")) };
}

export const ACCOUNT_COLORS = ["#5AC8FA", "#BF5AF2", "#30D158", "#FF9F0A", "#FF375F", "#64D2FF", "#FFD60A", "#AC8E68"];

export interface AccountState {
  program: FirmProgram;
  days: DaySim[];
  balance: number;
  profit: number;
  peak: number;
  threshold: number;
  /** Dollars above the floor. */
  buffer: number;
  status: "active" | "passed" | "blown";
  headline: string;
  detail: string;
  daysTraded: number;
  bestDay: number;
  consistency: { limit: number; ok: boolean; applies: boolean };
  /** Balance and floor at each day's close, for the chart. */
  curve: { date: string; balance: number; floor: number; pnl: number }[];
  lastDay: string | null;
  lastDayPnl: number;
  /** Funded: enough profit and days to ask for a payout. */
  payoutReady: boolean;
  fees: number;
  wins: number;
  netR: number;
  eval: Evaluation | null;
}

/** The trades grouped into sessions, each trade one step of the equity path. */
export function toDaySims(trades: AccountTrade[]): DaySim[] {
  const by = new Map<string, AccountTrade[]>();
  for (const t of [...trades].sort((a, b) => a.entryT - b.entryT)) by.set(t.session, [...(by.get(t.session) ?? []), t]);
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, ts]) => {
      let realized = 0;
      const path: [number, number, number][] = [];
      for (const t of ts) {
        path.push([realized + Math.min(t.worst, t.pnl, 0), realized + Math.max(t.best, t.pnl, 0), realized + t.pnl]);
        realized += t.pnl;
      }
      return {
        date,
        trades: ts.map((t) => ({ id: t.id, date, side: t.side, entryT: t.entryT, entryPx: t.entry, exitT: t.exitT, exitPx: t.exit, stopPx: t.stop, targetPx: t.target, qty: t.qty, pnl: t.pnl, r: t.r, exit: "time", why: t.reason, mfe: t.best, mae: t.worst, who: t.source }) as SimTrade),
        pnl: realized,
        path,
        t0: ts[0].entryT,
        step: ts.length > 1 ? Math.max(60, Math.round((ts[ts.length - 1].exitT - ts[0].entryT) / ts.length)) : 60,
        partial: false,
      };
    });
}

export function accountState(a: PropAccount): AccountState | null {
  const p = programByKey(a.program);
  if (!p) return null;
  const days = toDaySims(a.trades);
  const size = { contracts: a.contracts, micro: a.micro };
  // Walk every day for the curve and the live floor.
  const acct = openAccount(p);
  const curve: AccountState["curve"] = [];
  let blownOn: string | null = null;
  for (const d of days) {
    const w = walkDay(acct, d, p);
    curve.push({ date: d.date, balance: acct.balance, floor: acct.threshold, pnl: w.pnl });
    if (w.failedAt !== null) {
      blownOn = d.date;
      break;
    }
  }
  const traded = days.filter((d) => d.trades.length);
  const bestDay = traded.reduce((m, d) => Math.max(m, d.pnl), 0);
  const profit = acct.balance - p.size;
  const applies = p.consistencyPct < 100;
  const limit = p.consistencyBasis === "profitTarget" ? (p.consistencyPct / 100) * p.target : (p.consistencyPct / 100) * Math.max(profit, 0);
  const consistency = { limit, ok: !applies || bestDay <= limit + 0.01 || profit <= 0, applies };
  const ev = a.phase === "eval" ? evaluate(days, p, size) : null;
  const status: AccountState["status"] = blownOn || ev?.verdict === "failed" ? "blown" : ev?.verdict === "passed" ? "passed" : "active";
  const months = days.length ? Math.max(1, Math.ceil((Date.parse(days[days.length - 1].date) - Date.parse(days[0].date)) / (30 * 86_400_000))) : 1;
  const fees = (p.costCadence === "monthly" ? p.cost * months : p.cost) * (a.phase === "eval" ? 1 : 0) + a.resets * p.cost;
  const last = days[days.length - 1];
  const payoutReady = a.phase === "funded" && profit >= 500 && traded.length >= p.minDays && consistency.ok;
  const headline =
    status === "blown"
      ? ev?.headline ?? `Drawdown hit on ${blownOn}`
      : status === "passed"
        ? ev!.headline
        : a.phase === "live"
          ? traded.length
            ? `${profit >= 0 ? "Up" : "Down"} ${usd(profit)}, ${((profit / p.size) * 100).toFixed(1)}%`
            : "Ready for its first trade"
        : a.phase === "funded"
          ? payoutReady
            ? "Payout-eligible"
            : profit > 0
              ? `${usd(profit)} up, building to a payout`
              : "Funded and trading"
          : traded.length
            ? `${usd(Math.max(0, p.target - profit))} to the target`
            : "Ready for its first trade";
  const detail = status === "blown" ? (ev?.detail ?? (a.phase === "live" ? "It reached the loss you said you'd stop at." : `Balance touched the ${DD_LABEL[p.ddType].toLowerCase()} floor.`)) : a.phase === "live" && status === "active" ? `Stops at $${Math.round(acct.threshold).toLocaleString("en-US")}, the loss you set. ${traded.length} days traded.` : status === "passed" ? ev!.detail : ev?.detail ?? `Floor $${Math.round(acct.threshold).toLocaleString("en-US")}; ${traded.length} of ${p.minDays} minimum days.`;
  return {
    program: p,
    days,
    balance: acct.balance,
    profit,
    peak: acct.peak,
    threshold: acct.threshold,
    buffer: acct.balance - acct.threshold,
    status,
    headline,
    detail,
    daysTraded: traded.length,
    bestDay,
    consistency,
    curve,
    lastDay: last?.date ?? null,
    lastDayPnl: last?.pnl ?? 0,
    payoutReady,
    fees,
    wins: a.trades.filter((t) => t.pnl > 0).length,
    netR: a.trades.reduce((s, t) => s + t.r, 0),
    eval: ev,
  };
}

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function newAccount(p: Omit<PropAccount, "id" | "createdAt" | "updatedAt" | "trades" | "events" | "history" | "resets" | "cursorT" | "phase">): PropAccount {
  const now = Date.now();
  return { ...p, id: uid(), createdAt: now, updatedAt: now, phase: "eval", cursorT: null, trades: [], events: [{ at: now, kind: "created", text: `Opened on ${p.startDate}` }], history: [], resets: 0 };
}

/** Start the account over, as a firm reset would: the attempt goes into the record. */
export function resetAccount(a: PropAccount, s: AccountState | null): PropAccount {
  const now = Date.now();
  return {
    ...a,
    updatedAt: now,
    trades: [],
    cursorT: null,
    resets: a.resets + 1,
    history: [...a.history, { at: now, result: s ? s.status : "active", trades: a.trades.length, pnl: s?.profit ?? 0 }],
    events: [...a.events, { at: now, kind: "reset", text: `Reset after ${a.trades.length} trades (${s?.status ?? "active"})` }],
  };
}

export function accountCsv(a: PropAccount) {
  const head = "id,source,strategy,session,side,qty,entry_time,exit_time,entry,stop,target,exit,pnl,r,worst,best,reason";
  return [head, ...a.trades.map((t) => [t.id, t.source, t.strategy ?? "", t.session, t.side, t.qty, new Date(t.entryT * 1000).toISOString(), new Date(t.exitT * 1000).toISOString(), t.entry, t.stop, t.target, t.exit, t.pnl.toFixed(2), t.r.toFixed(3), t.worst.toFixed(2), t.best.toFixed(2), t.reason].join(","))].join("\n");
}
