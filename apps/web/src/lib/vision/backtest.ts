// ─── Vision · backtest ─────────────────────────────────────────────────────────
// Runs the same readers the live chart uses, or the trader's own rules, over
// history, one position at a time, the way a disciplined trader would take them.
//
// Fill rules, stated in the UI:
//   • Entry at the confirming bar's close, plus slippage against you.
//   • Stop and target sit on whole ticks.
//   • A bar that touches the stop exits at the stop, minus slippage; the stop
//     wins a bar that touches both.
//   • The target is a resting limit: filled at the target, no slippage.
//   • Break-even moves the stop to the fill from the bar after the trade
//     reaches the trigger, never on the same bar.
//   • No exit within `maxHold` bars: out at that bar's close.
//   • Commission per contract, round trip (per trade when sizing crypto by risk).
// VIX filters use the last close before the trade's date, never that day's.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import { sessionOf } from "@/lib/pilot/market";
import { READER_ORDER, _internal, isReader, type Anchor, type ReaderChoice, type ReaderId, type Side } from "./analyze";
import { customDetector, type CustomRules } from "./custom";

export interface BacktestContext {
  fomc: string[];
  early: string[];
  vix: Record<string, number>;
}

export interface BacktestOptions {
  reader: ReaderChoice;
  /** The trader's own rules; when set, they replace `reader`. */
  custom?: CustomRules | null;
  anchor: Anchor;
  side: "both" | Side;
  /** Dollars per 1.0 price move per contract (or per coin for crypto). */
  pointValue: number;
  contracts: number;
  /** Size each trade to risk this many dollars at the stop instead. */
  riskDollars?: number;
  /** Futures: risk sizing rounds down to whole contracts and skips a trade that can't take one. */
  integer?: boolean;
  /** Most contracts a risk-sized trade may use. */
  maxUnits?: number;
  /** Starting balance, for returns and drawdown as a share of the account. */
  balance?: number;
  commission: number;
  slippageTicks: number;
  tick: number;
  maxHold: number;
  /** Move the stop to the fill once the trade is this many R in profit. */
  breakEvenR?: number | null;
  /** Most entries per session. */
  maxPerDay?: number | null;
  skipFomc: boolean;
  skipEarly: boolean;
  vix: "any" | "low" | "mid" | "high";
  /** Only take entries inside these New York minutes of the day, [from, to); from > to wraps past midnight. */
  hours?: readonly [number, number] | null;
  context: BacktestContext;
}

export interface BacktestTrade {
  n: number;
  reader: ReaderId | "custom";
  side: Side;
  entryIndex: number;
  exitIndex: number;
  entryT: number;
  exitT: number;
  entry: number;
  stop: number;
  target: number;
  exit: number;
  outcome: "target" | "stop" | "breakeven" | "time";
  r: number;
  pnl: number;
  /** Contracts (or coins) traded. */
  units: number;
  /** Dollars at risk at the stop. */
  riskUsd: number;
  /** Worst and best open excursion, in R. */
  mae: number;
  mfe: number;
  hold: number;
  minutes: number;
  date: string;
  /** The futures session (trading day) the entry belongs to. */
  session: string;
  hour: number;
  /** Entry time to the half hour, "09:30". */
  slot: string;
  weekday: number;
  vix: number | null;
  fomc: boolean;
}

export interface Group {
  key: string;
  n: number;
  wins: number;
  netR: number;
  pnl: number;
}

export interface DayPnl {
  date: string;
  pnl: number;
  trades: number;
}

export interface BacktestStats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netR: number;
  expectancyR: number;
  expectancyUsd: number;
  pnl: number;
  returnPct: number;
  profitFactor: number;
  avgWinR: number;
  avgLossR: number;
  avgWin: number;
  avgLoss: number;
  payoff: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxDrawdownR: number;
  longestLosing: number;
  longestWinning: number;
  avgHold: number;
  avgMinutes: number;
  best: number;
  worst: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  /** Days with a trade, and how many of them made money. */
  days: number;
  greenDays: number;
  bestDay: number;
  worstDay: number;
  avgMae: number;
  avgMfe: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  bars: number;
  from: number;
  to: number;
  balance: number;
  skipped: { fomc: number; early: number; vix: number; side: number; hours: number; day: number; size: number };
  stats: BacktestStats;
  equity: { t: number; pnl: number; r: number }[];
  daily: DayPnl[];
  by: { hour: Group[]; slot: Group[]; weekday: Group[]; reader: Group[]; side: Group[]; vix: Group[]; fomc: Group[]; month: Group[]; outcome: Group[] };
}

export const VIX_BANDS = { low: [0, 15], mid: [15, 25], high: [25, Infinity] } as const;
const vixBand = (v: number | null) => (v == null ? "No VIX data" : v < 15 ? "VIX under 15" : v < 25 ? "VIX 15–25" : "VIX 25+");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function lastVixBefore(vix: Record<string, number>, dates: string[], date: string) {
  // dates sorted ascending; binary search for the last date < `date`.
  let lo = 0;
  let hi = dates.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] < date) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best >= 0 ? vix[dates[best]] : null;
}

function group(trades: BacktestTrade[], key: (t: BacktestTrade) => string, order?: string[]): Group[] {
  const m = new Map<string, Group>();
  for (const t of trades) {
    const k = key(t);
    const g = m.get(k) ?? { key: k, n: 0, wins: 0, netR: 0, pnl: 0 };
    g.n++;
    if (t.r > 0) g.wins++;
    g.netR += t.r;
    g.pnl += t.pnl;
    m.set(k, g);
  }
  const out = [...m.values()];
  return order ? out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : out.sort((a, b) => a.key.localeCompare(b.key));
}

export const inHours = (minute: number, h: readonly [number, number]) => (h[0] <= h[1] ? minute >= h[0] && minute < h[1] : minute >= h[0] || minute < h[1]);

export function runBacktest(bars: Bar[], o: BacktestOptions, onProgress?: (done: number, total: number) => void): BacktestResult {
  const custom = o.custom ? customDetector(bars, o.anchor, o.custom, o.tick) : null;
  const ctx = custom ? null : _internal.context(bars, o.anchor);
  const readers = o.reader === "auto" ? READER_ORDER : [o.reader as ReaderId];
  const fomc = new Set(o.context.fomc);
  const early = new Set(o.context.early);
  const vixDates = Object.keys(o.context.vix).sort();
  const slip = o.slippageTicks * o.tick;
  const balance = o.balance ?? 50_000;
  const trades: BacktestTrade[] = [];
  const skipped = { fomc: 0, early: 0, vix: 0, side: 0, hours: 0, day: 0, size: 0 };
  const perDay = new Map<string, number>();
  // Orders rest on whole ticks: for a long both round down (stop a touch wider,
  // target a touch nearer), for a short both round up.
  const onTick = (p: number, dir: 1 | -1) => +((dir > 0 ? Math.floor(p / o.tick + 1e-9) : Math.ceil(p / o.tick - 1e-9)) * o.tick).toFixed(10);
  let busyUntil = -1;
  const n = bars.length;
  for (let i = 30; i < n - 1; i++) {
    if (onProgress && i % 5000 === 0) onProgress(i, n);
    // Custom rules keep their own state, so they see every bar even mid-trade.
    const f = custom ? custom(i) : i > busyUntil ? _internal.detectAt(ctx!, i, readers) : null;
    if (!f || i <= busyUntil) continue;
    if (o.side !== "both" && f.side !== o.side) {
      skipped.side++;
      continue;
    }
    const s = sessionOf(bars[i].t);
    const date = s.date;
    if (o.hours && !inHours(s.minute, o.hours)) {
      skipped.hours++;
      continue;
    }
    if (o.skipFomc && fomc.has(date)) {
      skipped.fomc++;
      continue;
    }
    if (o.skipEarly && early.has(date)) {
      skipped.early++;
      continue;
    }
    if (o.maxPerDay && (perDay.get(s.session) ?? 0) >= o.maxPerDay) {
      skipped.day++;
      continue;
    }
    const vix = vixDates.length ? lastVixBefore(o.context.vix, vixDates, date) : null;
    if (o.vix !== "any") {
      const [lo, hi] = VIX_BANDS[o.vix];
      if (vix == null || vix < lo || vix >= hi) {
        skipped.vix++;
        continue;
      }
    }
    const dir: 1 | -1 = f.side === "long" ? 1 : -1;
    const entry = f.entry + dir * slip;
    const stop0 = onTick(f.stop, dir);
    const target = onTick(f.target, dir);
    const risk = Math.abs(f.entry - stop0);
    if (!(risk > 0) || (target - entry) * dir <= 0) continue;
    let units = o.contracts;
    if (o.riskDollars) {
      units = o.riskDollars / (risk * o.pointValue);
      if (o.integer) units = Math.min(o.maxUnits ?? Infinity, Math.floor(units + 1e-9));
      if (units <= 0) {
        skipped.size++;
        continue;
      }
    }
    let stop = stop0;
    let moved = false;
    let exit = NaN;
    let exitIndex = -1;
    let outcome: BacktestTrade["outcome"] = "time";
    let mae = 0;
    let mfe = 0;
    const end = Math.min(n - 1, i + o.maxHold);
    for (let k = i + 1; k <= end; k++) {
      const x = bars[k];
      if (f.side === "long" ? x.l <= stop : x.h >= stop) {
        exit = stop - dir * slip;
        exitIndex = k;
        outcome = moved ? "breakeven" : "stop";
        mae = Math.min(mae, ((stop - entry) * dir) / risk);
        break;
      }
      if (f.side === "long" ? x.h >= target : x.l <= target) {
        exit = target;
        exitIndex = k;
        outcome = "target";
        mae = Math.min(mae, (((f.side === "long" ? x.l : x.h) - entry) * dir) / risk);
        mfe = Math.max(mfe, ((target - entry) * dir) / risk);
        break;
      }
      mae = Math.min(mae, (((f.side === "long" ? x.l : x.h) - entry) * dir) / risk);
      mfe = Math.max(mfe, (((f.side === "long" ? x.h : x.l) - entry) * dir) / risk);
      if (o.breakEvenR && !moved && mfe >= o.breakEvenR) {
        stop = entry;
        moved = true;
      }
    }
    if (exitIndex < 0) {
      // Not decided inside the data: a trade still open at the end is not counted.
      if (end === n - 1 && end - i < o.maxHold) break;
      exitIndex = end;
      exit = bars[end].c;
    }
    const fee = o.commission * (o.riskDollars && !o.integer ? 1 : units);
    const pnl = (exit - entry) * dir * o.pointValue * units - fee;
    const slot = Math.floor(s.minute / 30) * 30;
    trades.push({
      n: trades.length + 1,
      // Backtest rows name only the five readers; anything else is "your rules".
      reader: isReader(f.reader) ? f.reader : "custom",
      side: f.side,
      entryIndex: i,
      exitIndex,
      entryT: bars[i].t,
      exitT: bars[exitIndex].t,
      entry,
      stop: stop0,
      target,
      exit,
      outcome,
      r: ((exit - entry) * dir) / risk,
      pnl,
      units,
      riskUsd: risk * o.pointValue * units,
      mae,
      mfe,
      hold: exitIndex - i,
      minutes: Math.round((bars[exitIndex].t - bars[i].t) / 60),
      date,
      session: s.session,
      hour: Math.floor(s.minute / 60),
      slot: `${String(Math.floor(slot / 60)).padStart(2, "0")}:${String(slot % 60).padStart(2, "0")}`,
      weekday: new Date(`${date}T12:00:00Z`).getUTCDay(),
      vix,
      fomc: fomc.has(date),
    });
    perDay.set(s.session, (perDay.get(s.session) ?? 0) + 1);
    busyUntil = exitIndex;
  }
  onProgress?.(n, n);

  // ── Equity, drawdown and streaks ──
  let eq = 0;
  let eqR = 0;
  let peak = 0;
  let peakR = 0;
  let maxDd = 0;
  let maxDdPct = 0;
  let maxDdR = 0;
  let lose = 0;
  let win = 0;
  let longestL = 0;
  let longestW = 0;
  const equity = trades.map((t) => {
    eq += t.pnl;
    eqR += t.r;
    peak = Math.max(peak, eq);
    peakR = Math.max(peakR, eqR);
    maxDd = Math.max(maxDd, peak - eq);
    maxDdPct = Math.max(maxDdPct, (peak - eq) / (balance + peak));
    maxDdR = Math.max(maxDdR, peakR - eqR);
    lose = t.r <= 0 ? lose + 1 : 0;
    win = t.r > 0 ? win + 1 : 0;
    longestL = Math.max(longestL, lose);
    longestW = Math.max(longestW, win);
    return { t: t.exitT, pnl: eq, r: eqR };
  });

  // ── Daily P&L over every session in the data, traded or not ──
  const byDay = new Map<string, DayPnl>();
  for (let i = 0; i < n; i++) {
    const d = sessionOf(bars[i].t).session;
    if (!byDay.has(d)) byDay.set(d, { date: d, pnl: 0, trades: 0 });
  }
  for (const t of trades) {
    const d = byDay.get(t.session) ?? { date: t.session, pnl: 0, trades: 0 };
    d.pnl += t.pnl;
    d.trades++;
    byDay.set(t.session, d);
  }
  const daily = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  const rets = daily.map((d) => d.pnl / balance);
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const sd = rets.length > 1 ? Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)) : 0;
  const down = rets.length > 1 ? Math.sqrt(rets.reduce((a, b) => a + Math.min(0, b) ** 2, 0) / (rets.length - 1)) : 0;
  const years = Math.max(1 / 252, daily.length / 252);
  const traded = daily.filter((d) => d.trades);

  const wins = trades.filter((t) => t.r > 0);
  const losses = trades.filter((t) => t.r <= 0);
  const gross = wins.reduce((a, t) => a + t.pnl, 0);
  const lost = -losses.reduce((a, t) => a + t.pnl, 0);
  const netR = trades.reduce((a, t) => a + t.r, 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const avgWin = avg(wins.map((t) => t.pnl));
  const avgLoss = avg(losses.map((t) => t.pnl));
  return {
    trades,
    bars: n,
    from: bars[0]?.t ?? 0,
    to: bars[n - 1]?.t ?? 0,
    balance,
    skipped,
    stats: {
      trades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: trades.length ? wins.length / trades.length : 0,
      netR,
      expectancyR: trades.length ? netR / trades.length : 0,
      expectancyUsd: trades.length ? eq / trades.length : 0,
      pnl: eq,
      returnPct: eq / balance,
      profitFactor: lost ? gross / lost : wins.length ? Infinity : 0,
      avgWinR: avg(wins.map((t) => t.r)),
      avgLossR: avg(losses.map((t) => t.r)),
      avgWin,
      avgLoss,
      payoff: avgLoss ? avgWin / -avgLoss : avgWin ? Infinity : 0,
      maxDrawdown: maxDd,
      maxDrawdownPct: maxDdPct,
      maxDrawdownR: maxDdR,
      longestLosing: longestL,
      longestWinning: longestW,
      avgHold: avg(trades.map((t) => t.hold)),
      avgMinutes: avg(trades.map((t) => t.minutes)),
      best: trades.length ? Math.max(...trades.map((t) => t.pnl)) : 0,
      worst: trades.length ? Math.min(...trades.map((t) => t.pnl)) : 0,
      sharpe: sd ? (mean / sd) * Math.sqrt(252) : 0,
      sortino: down ? (mean / down) * Math.sqrt(252) : 0,
      calmar: maxDdPct ? eq / balance / years / maxDdPct : 0,
      days: traded.length,
      greenDays: traded.filter((d) => d.pnl > 0).length,
      bestDay: traded.length ? Math.max(...traded.map((d) => d.pnl)) : 0,
      worstDay: traded.length ? Math.min(...traded.map((d) => d.pnl)) : 0,
      avgMae: avg(trades.map((t) => t.mae)),
      avgMfe: avg(trades.map((t) => t.mfe)),
    },
    equity,
    daily,
    by: {
      hour: group(trades, (t) => String(t.hour).padStart(2, "0")),
      slot: group(trades, (t) => t.slot),
      weekday: group(trades, (t) => WEEKDAYS[t.weekday], WEEKDAYS),
      reader: group(trades, (t) => t.reader),
      side: group(trades, (t) => (t.side === "long" ? "Long" : "Short"), ["Long", "Short"]),
      vix: group(trades, (t) => vixBand(t.vix), ["VIX under 15", "VIX 15–25", "VIX 25+", "No VIX data"]),
      fomc: group(trades, (t) => (t.fomc ? "FOMC days" : "Other days"), ["FOMC days", "Other days"]),
      month: group(trades, (t) => t.date.slice(0, 7)),
      outcome: group(trades, (t) => t.outcome, ["target", "stop", "breakeven", "time"]),
    },
  };
}

/** The trades as CSV, for a spreadsheet or another journal. */
export function tradesCsv(r: BacktestResult) {
  const head = "n,strategy,side,entry_time,exit_time,entry,stop,target,exit,outcome,r,pnl,units,risk_usd,mae_r,mfe_r,hold_bars,minutes,date,vix,fomc";
  const rows = r.trades.map((t) =>
    [t.n, t.reader, t.side, new Date(t.entryT * 1000).toISOString(), new Date(t.exitT * 1000).toISOString(), t.entry, t.stop, t.target, t.exit, t.outcome, t.r.toFixed(3), t.pnl.toFixed(2), +t.units.toFixed(4), t.riskUsd.toFixed(2), t.mae.toFixed(2), t.mfe.toFixed(2), t.hold, t.minutes, t.date, t.vix ?? "", t.fomc ? 1 : 0].join(","),
  );
  return [head, ...rows].join("\n");
}
