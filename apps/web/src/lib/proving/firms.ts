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
    notes: f.notes,
  })),
);

export const programByKey = (key: string) => FIRM_PROGRAMS.find((p) => p.key === key) ?? null;

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
  const cap = p.lock == null ? Infinity : start + p.lock;
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

  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const open = balance;
    let dayLow = open;
    let dayHigh = open;
    let dayPnl = d.pnl;
    let failedAt: number | null = null;
    for (let i = 0; i < d.path.length; i++) {
      const [lo, hi] = d.path[i];
      if (p.dll != null && lo <= -p.dll) {
        // The firm flattens you at the daily limit and the day ends there. It
        // only costs the account if that level is also through the drawdown.
        dayPnl = -p.dll;
        dayLow = Math.min(dayLow, open - p.dll);
        if (open - p.dll <= threshold) failedAt = i;
        break;
      }
      if (p.ddType === "trailing-intraday") {
        peak = Math.max(peak, open + hi);
        threshold = Math.min(peak - p.drawdown, cap);
      }
      dayLow = Math.min(dayLow, open + lo);
      dayHigh = Math.max(dayHigh, open + hi);
      if (open + lo <= threshold) {
        failedAt = i;
        break;
      }
    }

    if (failedAt !== null) {
      const at = new Date((d.t0 + failedAt * d.step) * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
      balance = threshold;
      marks.push({ date: d.date, balance, low: dayLow, high: dayHigh, threshold, pnl: balance - open, partial: d.partial });
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

    balance = open + dayPnl;
    if (d.trades.length) daysTraded++;
    if (!d.partial) bestDay = Math.max(bestDay, dayPnl);
    if (p.ddType === "trailing-eod" && !d.partial) {
      peak = Math.max(peak, balance);
      threshold = Math.min(peak - p.drawdown, cap);
    }
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
