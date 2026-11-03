// ─── Proving Ground · prop-firm rules ──────────────────────────────────────────
// Grades a stream of simulated sessions against one firm program, walking the
// equity path bar by bar the way a risk desk would.
//
// Where the order of a bar's high and low is unknown, the evaluator assumes the
// worse one: the high sets a new trailing peak first, then the low is checked
// against the raised threshold. A strategy that passes here passes with room.
// ───────────────────────────────────────────────────────────────────────────────

import { PROP_FIRMS, type DrawdownType } from "@/components/payout/propFirmData";
import type { DaySim } from "./engine";

export interface FirmProgram {
  key: string;
  firmId: string;
  tierId: string;
  firm: string;
  program: string;
  size: number;
  sizeLabel: string;
  target: number;
  drawdown: number;
  ddType: DrawdownType;
  /** Profit above start at which the threshold stops trailing. null = never. */
  lock: number | null;
  dll: number | null;
  consistencyPct: number;
  consistencyBasis: "totalProfit" | "profitTarget";
  minDays: number;
  maxMinis: number;
  maxMicros: number;
  model: "eval" | "instant";
  cost: number;
  costCadence: "monthly" | "one-time";
  /** % of each payout the trader keeps. */
  split: number;
  /** Lifetime payout dollars kept at 100% before the split applies. 0 = none. */
  keep100Upto: number;
  notes: string;
}

export const FIRM_PROGRAMS: FirmProgram[] = PROP_FIRMS.filter((f) => f.id !== "custom").flatMap((f) =>
  f.tiers.map((t) => ({
    key: `${f.id}:${t.id}`,
    firmId: f.id,
    tierId: t.id,
    firm: f.name,
    program: f.program,
    size: t.accountSize,
    sizeLabel: t.label,
    target: t.profitTarget,
    drawdown: t.drawdown,
    ddType: f.drawdownType,
    lock: f.drawdownLockProfit,
    dll: t.dailyLossLimit,
    consistencyPct: f.consistencyPercent,
    consistencyBasis: f.consistencyBasis,
    minDays: f.minTradingDays,
    maxMinis: t.maxContracts,
    maxMicros: t.maxMicros,
    model: f.payoutModel,
    cost: t.cost,
    costCadence: f.costCadence,
    split: f.profitSplit,
    keep100Upto: f.keep100Upto,
    notes: f.notes,
  })),
);

/**
 * Your own money at a broker, as a program: no target and no firm's rules, only
 * the point where you said you'd stop. Keys read live:<balance>:<stop % of balance>.
 */
export function liveProgram(balance: number, stopPct: number): FirmProgram {
  return { key: `live:${balance}:${stopPct}`, firmId: "live", tierId: "live", firm: "Live money", program: "Your broker account", size: balance, sizeLabel: `$${balance.toLocaleString("en-US")}`, target: 1e12, drawdown: (balance * stopPct) / 100, ddType: "static", lock: null, dll: null, consistencyPct: 100, consistencyBasis: "totalProfit", minDays: 0, maxMinis: 1000, maxMicros: 1000, model: "instant", cost: 0, costCadence: "one-time", split: 100, keep100Upto: 0, notes: "" };
}

export const isLive = (key: string) => key.startsWith("live:");

export const programByKey = (key: string): FirmProgram | null => {
  if (isLive(key)) {
    const [, b, stop] = key.split(":");
    return Number(b) > 0 && Number(stop) > 0 ? liveProgram(Number(b), Number(stop)) : null;
  }
  return FIRM_PROGRAMS.find((p) => p.key === key) ?? null;
};

/** One program per firm at the requested size, for side-by-side grading. */
export function programsAtSize(size: number) {
  return FIRM_PROGRAMS.filter((p) => p.size === size);
}

export const DD_LABEL: Record<DrawdownType, string> = {
  "trailing-intraday": "Intraday trailing",
  "trailing-eod": "End-of-day trailing",
  static: "Static",
};

export type Verdict = "passed" | "failed" | "active" | "pending";

export interface DayMark {
  date: string;
  /** Balance at the close. */
  balance: number;
  /** Lowest intraday balance. */
  low: number;
  high: number;
  /** Threshold in force at the close. */
  threshold: number;
  pnl: number;
  partial: boolean;
}

export interface Evaluation {
  verdict: Verdict;
  headline: string;
  detail: string;
  on: string | null;
  balance: number;
  profit: number;
  threshold: number;
  buffer: number;
  bestDay: number;
  consistencyLimit: number;
  consistencyOk: boolean;
  daysTraded: number;
  marks: DayMark[];
}

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export function evaluate(
  days: DaySim[],
  p: FirmProgram,
  size: { contracts: number; micro: boolean },
): Evaluation {
  const start = p.size;
  let balance = start;
  let peak = start;
  let threshold = start - p.drawdown;
  let bestDay = 0;
  let daysTraded = 0;
  const marks: DayMark[] = [];
  const base = { balance, profit: 0, threshold, buffer: balance - threshold, bestDay, consistencyLimit: 0, consistencyOk: true, daysTraded, marks };

  const limit = size.micro ? p.maxMicros : p.maxMinis;
  if (size.contracts > limit)
    return {
      ...base,
      verdict: "failed",
      headline: "Over the firm's size limit",
      detail: `${size.contracts} ${size.micro ? "micros" : "minis"} is above ${p.firm}'s ${limit}-contract cap for this account.`,
      on: days[0]?.date ?? null,
    };

  const consistency = (profit: number) => {
    const lim = p.consistencyBasis === "profitTarget" ? (p.consistencyPct / 100) * p.target : (p.consistencyPct / 100) * Math.max(profit, 0);
    return { lim, ok: p.consistencyPct >= 100 || bestDay <= lim + 0.01 };
  };

  const acct = openAccount(p);
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const w = walkDay(acct, d, p);
    ({ balance, peak, threshold } = acct);
    const { low: dayLow, high: dayHigh, pnl: dayPnl } = w;

    if (w.failedAt !== null) {
      const failedAt = w.failedAt;
      const at = new Date((d.t0 + failedAt * d.step) * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
      marks.push({ date: d.date, balance, low: dayLow, high: dayHigh, threshold, pnl: dayPnl, partial: d.partial });
      return {
        ...base,
        verdict: "failed",
        headline: `Drawdown hit on ${short(d.date)} at ${at}`,
        detail: `Balance touched ${usd(threshold)}, the ${DD_LABEL[p.ddType].toLowerCase()} threshold. Peak was ${usd(peak)}.`,
        on: d.date,
        balance,
        profit: balance - start,
        threshold,
        buffer: 0,
        bestDay,
        daysTraded: daysTraded + 1,
        marks,
      };
    }

    if (d.trades.length) daysTraded++;
    if (!d.partial) bestDay = Math.max(bestDay, dayPnl);
    marks.push({ date: d.date, balance, low: dayLow, high: dayHigh, threshold, pnl: dayPnl, partial: d.partial });

    const profit = balance - start;
    const c = consistency(profit);
    if (!d.partial && profit >= p.target && daysTraded >= p.minDays && c.ok)
      return {
        verdict: "passed",
        headline: p.model === "instant" ? `Payout-eligible on ${short(d.date)}` : `Passed on ${short(d.date)}`,
        detail: `${usd(profit)} profit in ${daysTraded} trading days. Best day ${usd(bestDay)}, inside the ${p.consistencyPct}% rule.`,
        on: d.date,
        balance,
        profit,
        threshold,
        buffer: balance - threshold,
        bestDay,
        consistencyLimit: c.lim,
        consistencyOk: true,
        daysTraded,
        marks,
      };
  }

  const profit = balance - start;
  const c = consistency(profit);
  const toGo = p.target - profit;
  const detail =
    toGo > 0
      ? `${usd(toGo)} to the ${usd(p.target)} target with ${usd(balance - threshold)} of drawdown left.`
      : !c.ok
        ? `Target reached, but the best day (${usd(bestDay)}) is over the ${p.consistencyPct}% consistency limit (${usd(c.lim)}). Keep trading to even it out.`
        : `Target reached. ${p.minDays - daysTraded} more trading day${p.minDays - daysTraded === 1 ? "" : "s"} needed.`;
  return {
    verdict: days.length ? "active" : "pending",
    headline: days.length ? (toGo > 0 ? "In progress" : "Target hit, rules pending") : "Waiting for the first session",
    detail: days.length ? detail : "The first trades appear once a session has data.",
    on: null,
    balance,
    profit,
    threshold,
    buffer: balance - threshold,
    bestDay,
    consistencyLimit: c.lim,
    consistencyOk: c.ok,
    daysTraded,
    marks,
  };
}

const short = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** A fresh account on a program: balance, trailing peak and the threshold in force. */
export interface AccountState {
  start: number;
  balance: number;
  peak: number;
  threshold: number;
  cap: number;
}

export function openAccount(p: FirmProgram): AccountState {
  return { start: p.size, balance: p.size, peak: p.size, threshold: p.size - p.drawdown, cap: p.lock == null ? Infinity : p.size + p.lock };
}

/**
 * Walk one session's equity path against the account, the way a risk desk
 * would, and update the account. `failedAt` is the bar index that breached the
 * threshold, or null if the account survived the day.
 */
export function walkDay(a: AccountState, d: DaySim, p: FirmProgram) {
  const open = a.balance;
  let low = open;
  let high = open;
  let pnl = d.pnl;
  let failedAt: number | null = null;
  for (let i = 0; i < d.path.length; i++) {
    const [lo, hi] = d.path[i];
    if (p.dll != null && lo <= -p.dll) {
      // The firm flattens you at the daily limit and the day ends there. It
      // only costs the account if that level is also through the drawdown.
      pnl = -p.dll;
      low = Math.min(low, open - p.dll);
      if (open - p.dll <= a.threshold) failedAt = i;
      break;
    }
    if (p.ddType === "trailing-intraday") {
      a.peak = Math.max(a.peak, open + hi);
      a.threshold = Math.min(a.peak - p.drawdown, a.cap);
    }
    low = Math.min(low, open + lo);
    high = Math.max(high, open + hi);
    if (open + lo <= a.threshold) {
      failedAt = i;
      break;
    }
  }
  if (failedAt !== null) {
    a.balance = a.threshold;
    return { failedAt, low, high, pnl: a.balance - open };
  }
  a.balance = open + pnl;
  if (p.ddType === "trailing-eod" && !d.partial) {
    a.peak = Math.max(a.peak, a.balance);
    a.threshold = Math.min(a.peak - p.drawdown, a.cap);
  }
  return { failedAt: null, low, high, pnl };
}
