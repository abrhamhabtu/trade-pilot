// ─── Vision · the prop firm lab ────────────────────────────────────────────────
// A firm's rules are a game with a house edge. This file measures that edge and
// looks for the sizing that beats it, using nothing but arithmetic on trades that
// were already run (see lib/server/library/lab.ts), so thousands of what-ifs
// take a moment:
//
//   coinFlipOdds   what the rules alone do to a trader with no edge at all
//   simulate       one attempt, trade by trade, with a sizing plan and day stops
//   sizingStudy    every plan, started on every day, pass odds with honest error bars
//   autopsy        why an attempt died, and which change would have saved it
//   walkForward    attempts in date order, each plan chosen only from earlier data
//
// `simulate` must agree with the firm evaluator in lib/proving/firms.ts to the
// cent, since that evaluator grades the real accounts; tests/prop-lab.test.mjs
// holds them together. Where a bar's order is unknown it assumes the worse one.
// ───────────────────────────────────────────────────────────────────────────────

import type { DaySim, SimTrade } from "@/lib/proving/engine";
import { evaluate, openAccount, walkDay, type FirmProgram } from "@/lib/proving/firms";
import type { Side } from "./analyze";

/** One trade per contract, in price points, so any size and either contract can be priced later. */
export interface UnitTrade {
  entryT: number;
  exitT: number;
  session: string;
  side: Side;
  entry: number;
  stop: number;
  target: number;
  exit: number;
  /** Stop distance, the worst and best open move, and the result: all points, slippage included. */
  risk: number;
  worst: number;
  best: number;
  points: number;
  outcome: string;
  reader: string;
  /** The size it was really traded at, on an account's own trades. */
  qty?: number;
}

export interface UnitDay {
  date: string;
  trades: UnitTrade[];
}

export const toUnitDays = (trades: UnitTrade[]): UnitDay[] => {
  const days: UnitDay[] = [];
  for (const t of [...trades].sort((a, b) => a.entryT - b.entryT)) {
    const last = days[days.length - 1];
    if (last?.date === t.session) last.trades.push(t);
    else days.push({ date: t.session, trades: [t] });
  }
  return days;
};

// ── Sizing plans ───────────────────────────────────────────────────────────────

export interface SizingPlan {
  /** fixed: the same size always. room: risk a share of the dollars left above the floor, so size shrinks as the floor closes in and grows once it locks. actual: the size each trade really was. */
  kind: "fixed" | "room" | "actual";
  /** Contracts for fixed; share of the room (0.2 = 20%) for room. */
  amount: number;
  /** Stop for the day at this share of the room, lost in the day. 0 = no stop. */
  dayStop: number;
  /** Stop for the day near the firm's best-day limit, so one good day can't trap the account. */
  dayCap: boolean;
  /** At the target with rules still open, trade one contract until they are met. */
  coast: boolean;
}

export const planLabel = (p: SizingPlan, contract: string) => {
  const base = p.kind === "actual" ? "The sizes you traded" : p.kind === "fixed" ? `${p.amount} ${contract}` : `Risk ${Math.round(p.amount * 100)}% of the room left`;
  const extra = [p.dayStop ? `stop the day at ${Math.round(p.dayStop * 100)}% of room` : "", p.dayCap ? "stop at the best-day limit" : ""].filter(Boolean);
  return extra.length ? `${base}, ${extra.join(", ")}` : base;
};

export const planKey = (p: SizingPlan) => `${p.kind}:${p.amount}:${p.dayStop}:${p.dayCap ? 1 : 0}:${p.coast ? 1 : 0}`;

/** The plans worth testing at a firm: flat sizes as the baseline, then room-based ones with the guards. */
export function planGrid(p: FirmProgram, micro: boolean, maxRisk?: number): SizingPlan[] {
  const cap = micro ? p.maxMicros : p.maxMinis;
  const flat = (micro ? [1, 2, 3, 5, 8, 10, 15, 20, 30] : [1, 2, 3, 5, 8]).filter((q) => q <= cap);
  const out: SizingPlan[] = flat.map((amount) => ({ kind: "fixed", amount, dayStop: 0, dayCap: false, coast: false }));
  const guards = [
    { dayStop: 0, dayCap: false },
    { dayStop: 0.4, dayCap: false },
    { dayStop: 0.4, dayCap: p.consistencyPct < 100 },
  ];
  // A room plan above the limit would only be clamped back to it, under a label that says otherwise.
  for (const amount of [0.08, 0.12, 0.16, 0.22, 0.3].filter((x) => !maxRisk || x <= maxRisk + 1e-9)) for (const g of guards) out.push({ kind: "room", amount, coast: true, ...g });
  for (const amount of flat) out.push({ kind: "fixed", amount, dayStop: 0.4, dayCap: p.consistencyPct < 100, coast: true });
  const seen = new Set<string>();
  return out.filter((x) => !seen.has(planKey(x)) && !!seen.add(planKey(x)));
}

// ── One attempt ────────────────────────────────────────────────────────────────

export interface Pricing {
  /** Dollars per point per contract. */
  pointValue: number;
  /** Dollars per contract, round trip. */
  fee: number;
  micro: boolean;
  /** Most a trade may risk, as a share of the account's drawdown. A trade too big at one contract is skipped. */
  maxRisk?: number;
  /** Broker's day margin per contract; live accounts can't hold more than the balance covers. */
  margin?: number;
}

export interface PricedTrade {
  t: UnitTrade;
  qty: number;
  pnl: number;
  worst: number;
  best: number;
}

export interface AttemptDay {
  date: string;
  pnl: number;
  low: number;
  high: number;
  balance: number;
  floor: number;
  trades: PricedTrade[];
  /** Why the day ended early, if it did. */
  halted: "" | "day-stop" | "day-cap" | "dll" | "floor";
}

export type EndReason = "passed" | "floor" | "unfinished";

export interface Attempt {
  end: EndReason;
  days: AttemptDay[];
  balance: number;
  profit: number;
  peak: number;
  floor: number;
  daysTraded: number;
  bestDay: number;
  /** Target reached while rules were still open, in trading days spent waiting. */
  stuckDays: number;
  /** The most profit the attempt ever held. */
  peakProfit: number;
  fees: number;
  /** Times the firm's daily limit ended a day. */
  dllHits: number;
}

const consistencyOk = (p: FirmProgram, bestDay: number, profit: number) => {
  if (p.consistencyPct >= 100) return true;
  const lim = p.consistencyBasis === "profitTarget" ? (p.consistencyPct / 100) * p.target : (p.consistencyPct / 100) * Math.max(profit, 0);
  return bestDay <= lim + 0.01;
};

/** The size a plan calls for on this trade, given where the account stands. */
function sizeFor(plan: SizingPlan, t: UnitTrade, room: number, atTarget: boolean, price: Pricing, cap: number, drawdown: number, balance: number) {
  const perContract = t.risk * price.pointValue + price.fee;
  const limit = Math.min(cap, price.maxRisk ? Math.floor((drawdown * price.maxRisk) / perContract) : cap, price.margin ? Math.floor(balance / price.margin) : cap);
  if (plan.coast && atTarget) return Math.min(1, limit);
  if (plan.kind === "actual") return t.qty ?? plan.amount;
  if (plan.kind === "fixed") return Math.min(plan.amount, limit);
  // Never below one contract: shrinking to nothing would leave an account parked above its floor for ever, still paying fees.
  return Math.min(limit, Math.max(1, Math.floor((room * plan.amount) / perContract)));
}

/**
 * Trades the days in order under a plan until the attempt passes, hits the floor
 * or runs out. Mirrors walkDay and evaluate: the high lifts a trailing floor before
 * the low is checked, the daily limit ends the day, a pass is only graded at the close.
 */
export function simulate(days: UnitDay[], p: FirmProgram, plan: SizingPlan, price: Pricing, opts: { from?: number; horizon?: number; seed?: { balance: number; peak: number; threshold: number; bestDay: number; daysTraded: number } } = {}): Attempt {
  const from = opts.from ?? 0;
  const end = Math.min(days.length, from + (opts.horizon ?? 120));
  const cap = price.micro ? p.maxMicros : p.maxMinis;
  const a = openAccount(p);
  if (opts.seed) Object.assign(a, { balance: opts.seed.balance, peak: opts.seed.peak, threshold: opts.seed.threshold });
  const out: AttemptDay[] = [];
  let daysTraded = opts.seed?.daysTraded ?? 0;
  let bestDay = opts.seed?.bestDay ?? 0;
  let stuckDays = 0;
  let peakProfit = 0;
  let fees = 0;
  let dllHits = 0;
  let result: EndReason = "unfinished";
  for (let k = from; k < end; k++) {
    const day = days[k];
    const open = a.balance;
    let realized = 0;
    let low = open;
    let high = open;
    const startRoom = a.balance - a.threshold;
    const atTarget = open - p.size >= p.target;
    const taken: PricedTrade[] = [];
    let halted: AttemptDay["halted"] = "";
    for (const t of day.trades) {
      const room = open + realized - a.threshold;
      const qty = sizeFor(plan, t, room, atTarget, price, cap, p.drawdown, open + realized);
      if (qty <= 0) continue;
      const fee = price.fee * qty;
      const pnl = t.points * price.pointValue * qty - fee;
      const worst = t.worst * price.pointValue * qty;
      const best = t.best * price.pointValue * qty;
      taken.push({ t, qty, pnl, worst, best });
      fees += fee;
      const lo = realized + Math.min(worst, pnl, 0);
      const hi = realized + Math.max(best, pnl, 0);
      if (p.dll != null && lo <= -p.dll) {
        realized = -p.dll;
        low = Math.min(low, open - p.dll);
        dllHits++;
        halted = "dll";
        if (open - p.dll <= a.threshold) halted = "floor";
        break;
      }
      if (p.ddType === "trailing-intraday") {
        a.peak = Math.max(a.peak, open + hi);
        a.threshold = Math.min(a.peak - p.drawdown, a.cap);
      }
      low = Math.min(low, open + lo);
      high = Math.max(high, open + hi);
      if (open + lo <= a.threshold) {
        halted = "floor";
        break;
      }
      realized += pnl;
      if (plan.dayStop && realized <= -startRoom * plan.dayStop) {
        halted = "day-stop";
        break;
      }
      if (plan.dayCap && p.consistencyPct < 100) {
        // On a share-of-profit rule the true limit moves; a share of the target is the day that can't trap the pass.
        if (realized >= (p.consistencyPct / 100) * p.target * 0.85) {
          halted = "day-cap";
          break;
        }
      }
    }
    if (halted === "floor") {
      a.balance = a.threshold;
      out.push({ date: day.date, pnl: a.balance - open, low, high, balance: a.balance, floor: a.threshold, trades: taken, halted });
      if (taken.length) daysTraded++;
      result = "floor";
      break;
    }
    a.balance = open + realized;
    if (p.ddType === "trailing-eod") {
      a.peak = Math.max(a.peak, a.balance);
      a.threshold = Math.min(a.peak - p.drawdown, a.cap);
    }
    if (taken.length) daysTraded++;
    bestDay = Math.max(bestDay, realized);
    const profit = a.balance - p.size;
    peakProfit = Math.max(peakProfit, profit);
    out.push({ date: day.date, pnl: realized, low, high, balance: a.balance, floor: a.threshold, trades: taken, halted });
    if (profit >= p.target) {
      if (daysTraded >= p.minDays && consistencyOk(p, bestDay, profit)) {
        result = "passed";
        break;
      }
      stuckDays++;
    }
  }
  return { end: result, days: out, balance: a.balance, profit: a.balance - p.size, peak: a.peak, floor: a.threshold, daysTraded, bestDay, stuckDays, peakProfit, fees, dllHits };
}

/** An attempt as Proving Ground sessions, so the real evaluator can grade it. */
export function attemptToSims(att: Attempt): DaySim[] {
  return att.days
    .filter((d) => d.trades.length)
    .map((d) => {
      let realized = 0;
      const path: [number, number, number][] = [];
      for (const x of d.trades) {
        path.push([realized + Math.min(x.worst, x.pnl, 0), realized + Math.max(x.best, x.pnl, 0), realized + x.pnl]);
        realized += x.pnl;
      }
      const trades = d.trades.map((x, i) => ({ id: `${d.date}-${i}`, date: d.date, side: x.t.side, entryT: x.t.entryT, entryPx: x.t.entry, exitT: x.t.exitT, exitPx: x.t.exit, stopPx: x.t.stop, targetPx: x.t.target, qty: x.qty, pnl: x.pnl, r: x.t.risk ? x.t.points / x.t.risk : 0, exit: "time", why: x.t.outcome, mfe: x.best, mae: x.worst }) as unknown as SimTrade);
      return { date: d.date, trades, pnl: realized, path, t0: d.trades[0].t.entryT, step: 60, partial: false };
    });
}

// ── Odds with honest error bars ────────────────────────────────────────────────

export interface Odds {
  starts: number;
  passed: number;
  failed: number;
  unfinished: number;
  passRate: number;
  failRate: number;
  /** Lower bound of the 90% range, counting overlapping starts as what they are: fewer independent tries. */
  low: number;
  high: number;
  /** Roughly independent attempts behind the number. */
  independent: number;
  medianDays: number | null;
  costPerPass: number | null;
  stuckRate: number;
}

/** Wilson interval at 90%. */
export function wilson(k: number, n: number) {
  if (!n) return { low: 0, high: 1 };
  const z = 1.645;
  const ph = k / n;
  const d = 1 + (z * z) / n;
  const c = ph + (z * z) / (2 * n);
  const s = z * Math.sqrt((ph * (1 - ph)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, (c - s) / d), high: Math.min(1, (c + s) / d) };
}

export function rollingOdds(days: UnitDay[], p: FirmProgram, plan: SizingPlan, price: Pricing, o: { cap?: number; horizon?: number; lo?: number; hi?: number } = {}): Odds {
  const lo = o.lo ?? 0;
  const hi = o.hi ?? days.length;
  const horizon = o.horizon ?? 120;
  const span = Math.max(0, hi - lo);
  const step = Math.max(1, Math.ceil(span / (o.cap ?? 120)));
  let passed = 0;
  let failed = 0;
  let unfinished = 0;
  let stuck = 0;
  const lengths: number[] = [];
  const toPass: number[] = [];
  const sub = hi < days.length ? days.slice(0, hi) : days;
  for (let k = lo; k < hi; k += step) {
    const att = simulate(sub, p, plan, price, { from: k, horizon });
    lengths.push(att.days.length);
    if (att.stuckDays) stuck++;
    if (att.end === "passed") {
      passed++;
      toPass.push(att.daysTraded);
    } else if (att.end === "floor") failed++;
    else unfinished++;
  }
  const total = passed + failed + unfinished;
  const avgLen = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  const independent = Math.max(1, Math.min(total, Math.round(span / Math.max(1, avgLen))));
  const passRate = total ? passed / total : 0;
  const w = wilson(passRate * independent, independent);
  toPass.sort((a, b) => a - b);
  return { starts: total, passed, failed, unfinished, passRate, failRate: total ? failed / total : 0, low: w.low, high: w.high, independent, medianDays: toPass.length ? toPass[toPass.length >> 1] : null, costPerPass: passRate > 0 ? p.cost / passRate : null, stuckRate: total ? stuck / total : 0 };
}

// ── What the rules alone do ────────────────────────────────────────────────────

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pass odds for a trader with no edge at all: every trade a coin flip at 1:1,
 * risking a tenth of the drawdown, three a day, before fees. A losing trade can
 * still run in profit first, as real ones do, which is what a trailing floor feeds on.
 * The gap between this and 50% of the gap to the target is the rules' house edge.
 */
export function coinFlipOdds(p: FirmProgram, o: { runs?: number; seed?: number; horizon?: number } = {}) {
  const runs = o.runs ?? 400;
  const horizon = o.horizon ?? 120;
  const rnd = mulberry(o.seed ?? 11);
  const risk = p.drawdown / 10;
  let passed = 0;
  let days = 0;
  for (let r = 0; r < runs; r++) {
    const sims: DaySim[] = [];
    for (let d = 0; d < horizon; d++) {
      let realized = 0;
      const path: [number, number, number][] = [];
      for (let k = 0; k < 3; k++) {
        const win = rnd() < 0.5;
        const pnl = win ? risk : -risk;
        const best = win ? risk : rnd() * risk * 0.8;
        const worst = win ? -rnd() * risk * 0.8 : -risk;
        path.push([realized + worst, realized + best, realized + pnl]);
        realized += pnl;
      }
      sims.push({ date: `d${String(d).padStart(4, "0")}`, trades: [{}, {}, {}] as unknown as SimTrade[], pnl: realized, path, t0: 0, step: 60, partial: false });
    }
    const e = evaluate(sims, p, { contracts: 1, micro: false });
    if (e.verdict === "passed") {
      passed++;
      days += e.daysTraded;
    }
  }
  const rate = passed / runs;
  return { rate, medianDays: passed ? Math.round(days / passed) : null, costPerPass: rate > 0 ? p.cost / rate : null, fair: p.drawdown / (p.drawdown + p.target) };
}

export interface FirmTrap {
  id: "trail" | "eod" | "dll" | "consistency" | "ratio" | "days" | "fee" | "lock";
  title: string;
  how: string;
  answer: string;
  /** How hard it bites, 0 to 1. */
  bite: number;
}

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

/** The ways this program's rules tilt the game, each with the numbers and the counter. */
export function firmTraps(p: FirmProgram): FirmTrap[] {
  const out: FirmTrap[] = [];
  const ratio = p.target / Math.max(1, p.drawdown);
  if (p.model !== "instant") out.push({ id: "ratio", title: `You must make ${ratio.toFixed(1)}× what you may lose`, how: `${usd(p.target)} up before ${usd(p.drawdown)} down. With no edge you'd reach it ${Math.round((p.drawdown / (p.drawdown + p.target)) * 100)}% of the time, even on a floor that never moved.`, answer: "Only an edge beats this. Size can't. Check the strategy's own odds before paying.", bite: Math.min(1, ratio / 3) });
  if (p.ddType === "trailing-intraday") out.push({ id: "trail", title: "Open profit you never banked raises your floor", how: `A trade up ${usd(p.drawdown / 2)} that comes back to flat costs you ${usd(p.drawdown / 2)} of room, with no loss on your statement.`, answer: "Take profit at fixed targets, avoid giving back open gains, and size down until the floor locks.", bite: 0.95 });
  if (p.ddType === "trailing-eod") out.push({ id: "eod", title: "Every good close lifts the floor for good", how: `Each new high close moves the floor up. Finish a day ${usd(p.drawdown / 2)} up and half your room is gone by morning unless the next day adds to it.`, answer: "Open profit doesn't count until the close, so trades may breathe intraday. Avoid huge closes you can't repeat.", bite: 0.6 });
  if (p.lock != null && p.ddType !== "static") out.push({ id: "lock", title: `The floor stops rising at ${usd(p.size + p.lock)}`, how: `Until the balance clears ${usd(p.size + p.lock + p.drawdown)}, every dollar made is partly given back to the floor. After that, room grows with each win.`, answer: "This is the firm's soft spot: stay small until the floor locks, then size with the room. Room-based sizing does it for you.", bite: 0.35 });
  if (p.dll != null) out.push({ id: "dll", title: `A ${usd(p.dll)} day ends your day`, how: `${Math.round((p.dll / p.drawdown) * 100)}% of the drawdown in one session. One oversized stop can use it, and open losses count.`, answer: `Stop yourself first, at about ${usd(p.dll * 0.7)}. Keep each trade's risk under a quarter of the limit.`, bite: Math.min(1, p.drawdown / p.dll / 4) });
  if (p.consistencyPct < 100) {
    const lim = (p.consistencyPct / 100) * p.target;
    out.push({ id: "consistency", title: `A great day can hold your pass hostage`, how: p.consistencyBasis === "profitTarget" ? `No day may exceed ${usd(lim)}. Your best day decides.` : `No day may exceed ${p.consistencyPct}% of total profit. A ${usd(lim * 1.5)} day means ${usd(lim * 1.5 / (p.consistencyPct / 100))} total before you can pass, past the target, with the floor still behind you.`, answer: `Stop for the day around ${usd(lim * 0.85)} and take the rest tomorrow. Being stuck over the target is where accounts die.`, bite: Math.min(1, 40 / p.consistencyPct) });
  }
  if (p.minDays > 3) out.push({ id: "days", title: `${p.minDays} trading days, even if you hit it in two`, how: "Every extra day at size is more risk after the work is done.", answer: "Once at target, one contract a day until the count is met.", bite: Math.min(0.7, p.minDays / 14) });
  if (p.costCadence === "monthly") out.push({ id: "fee", title: `The clock charges ${usd(p.cost)} a month`, how: "Slow passes cost more, and the fee renews whether you trade or not.", answer: "Compare cost per pass, not sticker price. A faster plan can be cheaper than a safer one.", bite: 0.3 });
  return out.sort((a, b) => b.bite - a.bite);
}

// ── Sizing study ───────────────────────────────────────────────────────────────

export interface PlanRow {
  plan: SizingPlan;
  /** Odds on the older part of the history, where plans get compared. */
  train: Odds;
  /** Odds on the newer part, which played no role in choosing. */
  test: Odds;
  all: Odds;
}

export interface SizingStudy {
  rows: PlanRow[];
  best: PlanRow | null;
  /** The best flat size, to show what the plan adds. */
  flat: PlanRow | null;
  splitDate: string | null;
}

export function sizingStudy(days: UnitDay[], p: FirmProgram, price: Pricing, o: { cap?: number } = {}): SizingStudy {
  const split = Math.floor(days.length * 0.7);
  const rows: PlanRow[] = planGrid(p, price.micro, price.maxRisk).map((plan) => ({
    plan,
    train: rollingOdds(days, p, plan, price, { lo: 0, hi: split, cap: o.cap ?? 60 }),
    test: rollingOdds(days, p, plan, price, { lo: split, hi: days.length, cap: o.cap ?? 60 }),
    all: rollingOdds(days, p, plan, price, { cap: o.cap ?? 80 }),
  }));
  const byTrain = [...rows].sort((a, b) => b.train.low - a.train.low || b.train.passRate - a.train.passRate);
  const flat = byTrain.find((r) => r.plan.kind === "fixed" && !r.plan.coast) ?? null;
  return { rows: byTrain, best: byTrain[0] ?? null, flat, splitDate: days[split]?.date ?? null };
}

// ── Autopsy ────────────────────────────────────────────────────────────────────

export type CauseId = "trail" | "oversize" | "one-day" | "streak" | "bleed" | "stuck" | "stalled" | "over-limit";

export interface Cause {
  id: CauseId;
  title: string;
  detail: string;
}

export interface Rescue {
  change: string;
  plan: SizingPlan;
  result: EndReason;
  days: number;
  profit: number;
}

export interface Autopsy {
  result: EndReason;
  headline: string;
  causes: Cause[];
  rescues: Rescue[];
  /** Dollars of floor raised by open profit that was never banked. */
  phantom: number;
  /** Largest number of straight losers before the end. */
  streak: number;
  /** Typical risk per trade as a share of the drawdown. */
  riskShare: number;
  /** The closest the attempt came to the target. */
  closest: number;
}

const dayNice = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Reads one attempt: what killed it, in order of how much it mattered, and what would have saved it. */
export function autopsy(days: UnitDay[], from: number, att: Attempt, p: FirmProgram, plan: SizingPlan, price: Pricing, contract: string): Autopsy {
  const trades = att.days.flatMap((d) => d.trades);
  const causes: Cause[] = [];
  const riskShare = trades.length ? trades.reduce((a, x) => a + x.t.risk * price.pointValue * x.qty, 0) / trades.length / p.drawdown : 0;
  let streak = 0;
  let run = 0;
  for (const x of trades) {
    run = x.pnl <= 0 ? run + 1 : 0;
    streak = Math.max(streak, run);
  }
  // Floor raised by open profit: the peak beyond anything ever banked at a close.
  const closes = att.days.reduce((m, d) => Math.max(m, d.balance), p.size);
  const phantom = p.ddType === "trailing-intraday" ? Math.max(0, att.peak - closes) : 0;
  const worstDay = att.days.reduce((m, d) => Math.min(m, d.pnl), 0);
  const last = att.days[att.days.length - 1];

  if (att.end === "floor") {
    if (phantom > p.drawdown * 0.15) causes.push({ id: "trail", title: "The trailing floor took it", detail: `Open profit you never banked pushed the floor up ${usd(phantom)} before the end. That was ${Math.round((phantom / p.drawdown) * 100)}% of your room, gone with no loss on the statement.` });
    if (worstDay <= -p.drawdown * 0.5) {
      const d = att.days.find((x) => x.pnl === worstDay)!;
      causes.push({ id: "one-day", title: "One day did most of it", detail: `${dayNice(d.date)} lost ${usd(worstDay)} across ${d.trades.length} trade${d.trades.length === 1 ? "" : "s"}, ${Math.round((-worstDay / p.drawdown) * 100)}% of the drawdown. A day stop would have ended it sooner.` });
    }
    if (riskShare > 0.2) causes.push({ id: "oversize", title: "Too big for the room", detail: `Each trade risked about ${Math.round(riskShare * 100)}% of the drawdown, so ${Math.max(1, Math.ceil(1 / riskShare))} losers in a row ends the account. A loss streak of ${streak} happened here.` });
    else if (streak >= 5) causes.push({ id: "streak", title: `${streak} losers in a row`, detail: "The size was reasonable and the streak still won. Look at when it happened: a session or a regime this strategy should sit out." });
    if (att.peakProfit > p.target * 0.5) causes.push({ id: "bleed", title: "It was winning, then gave it back", detail: `Peak profit was ${usd(att.peakProfit)}, ${Math.round((att.peakProfit / p.target) * 100)}% of the target. Size didn't come down as the floor closed in.` });
    if (!causes.length) causes.push({ id: "bleed", title: "A slow bleed", detail: `No one trade or day did it: ${trades.length} trades simply lost ${usd(att.profit)} overall. That points at the strategy in this period, not the sizing.` });
  } else if (att.end === "unfinished") {
    if (att.stuckDays) causes.push({ id: "stuck", title: "Stuck over the target", detail: `It held the target for ${att.stuckDays} day${att.stuckDays === 1 ? "" : "s"} and couldn't pass: the best day of ${usd(att.bestDay)} broke the consistency rule or the day count wasn't met.` });
    else causes.push({ id: "stalled", title: "Ran out of road", detail: `After ${att.days.length} sessions it was ${att.profit >= 0 ? "up" : "down"} ${usd(att.profit)} of a ${usd(p.target)} target: no blow-up, not enough edge at this size.` });
  } else if (att.stuckDays) {
    causes.push({ id: "stuck", title: "It passed, late", detail: `The target was reached ${att.stuckDays} day${att.stuckDays === 1 ? "" : "s"} before the pass, waiting on the day count or the consistency rule.` });
  }

  // Replays the same trades under other plans. Only what changes the result is shown.
  const rescues: Rescue[] = [];
  if (att.end !== "passed") {
    const horizon = Math.max(att.days.length + 40, 120);
    const tries: { change: string; plan: SizingPlan }[] = [];
    const typical = trades.length ? Math.max(1, Math.round(trades.reduce((a, x) => a + x.qty, 0) / trades.length)) : 1;
    for (const q of [Math.ceil(typical / 2), Math.ceil(typical / 3), Math.ceil(typical / 5)]) if (q < typical) tries.push({ change: `${q} ${contract} instead of ${typical}`, plan: { ...plan, kind: "fixed", amount: q } });
    tries.push({ change: "Risk 12% of the room left on each trade", plan: { kind: "room", amount: 0.12, dayStop: plan.dayStop, dayCap: plan.dayCap, coast: true } });
    tries.push({ change: "Stop for the day after losing 40% of the room", plan: { ...plan, dayStop: 0.4, coast: true } });
    if (p.consistencyPct < 100) tries.push({ change: "Stop for the day at the best-day limit", plan: { ...plan, dayCap: true, coast: true } });
    for (const t of tries) {
      const r = simulate(days, p, t.plan, price, { from, horizon });
      const better = att.end === "floor" ? r.end !== "floor" : r.end === "passed";
      if (better) rescues.push({ change: t.change, plan: t.plan, result: r.end, days: r.daysTraded, profit: r.profit });
    }
  }
  rescues.sort((a, b) => Number(b.result === "passed") - Number(a.result === "passed") || a.days - b.days);
  const headline =
    att.end === "passed"
      ? `Passed in ${att.daysTraded} trading days`
      : att.end === "floor"
        ? `Hit the floor on ${last ? dayNice(last.date) : "the first day"}`
        : att.stuckDays
          ? "Reached the target but couldn't pass"
          : "Never reached the target";
  return { result: att.end, headline, causes, rescues: rescues.slice(0, 4), phantom, streak, riskShare, closest: att.peakProfit };
}

// ── Learning in date order ─────────────────────────────────────────────────────

/** A strategy variant's trades: one entry per reader, session, timeframe and exit style that was run. */
export interface Variant {
  id: string;
  label: string;
  trades: UnitTrade[];
}

export interface WalkStep {
  n: number;
  /** The history this choice was allowed to see ended here. */
  trainedTo: string;
  variant: string;
  variantLabel: string;
  plan: SizingPlan;
  /** What the choice looked like on the data it saw, and the cautious end of that range. */
  expected: number;
  expectedLow: number;
  start: string;
  end: string;
  result: EndReason;
  profit: number;
  days: number;
  autopsy: Autopsy;
  /** What changed from the attempt before, and the reason. */
  change: string;
  /** The trades, while the run is in memory; dropped before a study is saved. */
  attempt?: Attempt;
}

export interface WalkResult {
  steps: WalkStep[];
  attempts: number;
  passed: number;
  failed: number;
  unfinished: number;
  /** Passes over decided attempts; every attempt was chosen without seeing its own future. */
  passRate: number;
  range: { low: number; high: number };
  spent: number;
  costPerPass: number | null;
  /** The plan the latest data favours, the one to use next. */
  current: { variant: string; variantLabel: string; plan: SizingPlan; expected: number; odds: Odds } | null;
  baseline: { label: string; passRate: number; attempts: number } | null;
}

const MIN_TRAIN_DAYS = 120;

function expectancy(days: UnitDay[]) {
  const rs = days.flatMap((d) => d.trades.map((t) => (t.risk ? t.points / t.risk : 0)));
  if (rs.length < 30) return { n: rs.length, mean: 0, t: -9 };
  const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
  const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / (rs.length - 1)) || 1;
  return { n: rs.length, mean, t: (mean / sd) * Math.sqrt(rs.length) };
}

const before = (d: UnitDay[], date: string) => {
  let lo = 0;
  let hi = d.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (d[m].date < date) lo = m + 1;
    else hi = m;
  }
  return lo;
};

/** Chooses the variant and plan with the best worst-case odds, looking only at what came before `date`. */
export function choose(pool: { v: Variant; days: UnitDay[] }[], date: string, p: FirmProgram, price: Pricing, o: { shortlist?: number; lookback?: number } = {}) {
  const lookback = o.lookback ?? 750;
  const scored = pool
    .map((x) => {
      const hi = before(x.days, date);
      const lo = Math.max(0, hi - lookback);
      return { ...x, lo, hi, e: expectancy(x.days.slice(lo, hi)) };
    })
    .filter((x) => x.hi - x.lo >= 30)
    .sort((a, b) => b.e.t - a.e.t)
    .slice(0, o.shortlist ?? 4);
  let best: { v: Variant; plan: SizingPlan; odds: Odds } | null = null;
  for (const x of scored)
    for (const plan of planGrid(p, price.micro, price.maxRisk)) {
      const odds = rollingOdds(x.days, p, plan, price, { lo: x.lo, hi: x.hi, cap: 24 });
      if (!best || odds.low > best.odds.low || (odds.low === best.odds.low && odds.passRate > best.odds.passRate)) best = { v: x.v, plan, odds };
    }
  return best;
}

/**
 * Attempts one after another through history. Before each, the variant and plan
 * are chosen from earlier data only; afterwards the attempt is read and the next
 * choice sees it. Its pass rate is the closest a backtest gets to what the
 * process would have done live, without having known the future.
 */
export function walkForward(variants: Variant[], p: FirmProgram, price: Pricing, contract: string, o: WalkOptions = {}): WalkResult {
  const it = walkSteps(variants, p, price, contract, o);
  let x = it.next();
  while (!x.done) x = it.next();
  return x.value;
}

export interface WalkOptions {
  from?: string;
  maxAttempts?: number;
  horizon?: number;
  /** End at the first pass, as a trader would. */
  stopAtPass?: boolean;
}

/** walkForward one attempt at a time, so a long run can let other work through between them. */
export function* walkSteps(variants: Variant[], p: FirmProgram, price: Pricing, contract: string, o: WalkOptions = {}): Generator<WalkStep, WalkResult, void> {
  const pool = variants.map((v) => ({ v, days: toUnitDays(v.trades) })).filter((x) => x.days.length > 30);
  const horizon = o.horizon ?? 120;
  const all = [...new Set(pool.flatMap((x) => x.days.map((d) => d.date)))].sort();
  const steps: WalkStep[] = [];
  let k = Math.min(all.length, MIN_TRAIN_DAYS);
  if (o.from) k = Math.max(k, all.findIndex((d) => d >= o.from!));
  let prev: { v: Variant; plan: SizingPlan } | null = null;
  const max = o.maxAttempts ?? 200;
  while (k < all.length - 1 && steps.length < max) {
    const date = all[k];
    const pick = choose(pool, date, p, price);
    if (!pick) break;
    const days = pool.find((x) => x.v.id === pick.v.id)!.days;
    const from = before(days, date);
    if (from >= days.length) break;
    const att = simulate(days, p, pick.plan, price, { from, horizon });
    const report = autopsy(days, from, att, p, pick.plan, price, contract);
    const lastDay = att.days[att.days.length - 1]?.date ?? date;
    const changed: string[] = [];
    if (prev && prev.v.id !== pick.v.id) changed.push(`Moved to ${pick.v.label}: its record over the past ${Math.round(750 / 252)} years is now stronger than ${prev.v.label}.`);
    if (prev && planKey(prev.plan) !== planKey(pick.plan)) changed.push(`Sizing is now: ${planLabel(pick.plan, contract)}.`);
    const step: WalkStep = { n: steps.length + 1, trainedTo: all[k - 1], variant: pick.v.id, variantLabel: pick.v.label, plan: pick.plan, expected: pick.odds.passRate, expectedLow: pick.odds.low, start: date, end: lastDay, result: att.end, profit: att.profit, days: att.daysTraded, autopsy: report, change: changed.join(" ") || (prev ? "Kept the same plan: nothing earlier argued for changing it." : "First attempt."), attempt: att };
    steps.push(step);
    prev = pick;
    yield step;
    if (o.stopAtPass && att.end === "passed") break;
    const next = all.findIndex((d) => d > lastDay);
    if (next < 0) break;
    k = next;
  }
  const passed = steps.filter((s) => s.result === "passed").length;
  const failed = steps.filter((s) => s.result === "floor").length;
  const unfinished = steps.length - passed - failed;
  const decided = passed + failed;
  const spent = steps.length * p.cost;
  const last = all[all.length - 1];
  const now = last ? choose(pool, `${last}~`, p, price) : null;
  return {
    steps,
    attempts: steps.length,
    passed,
    failed,
    unfinished,
    passRate: decided ? passed / decided : 0,
    range: wilson(passed, decided),
    spent,
    costPerPass: passed ? spent / passed : null,
    current: now ? { variant: now.v.id, variantLabel: now.v.label, plan: now.plan, expected: now.odds.passRate, odds: now.odds } : null,
    baseline: null,
  };
}

/** The same dates with one plan held still from the first day: what the process adds over never changing anything. */
export function baselineWalk(v: Variant, p: FirmProgram, plan: SizingPlan, price: Pricing, horizon = 120) {
  const days = toUnitDays(v.trades);
  let k = Math.min(days.length, MIN_TRAIN_DAYS);
  let passed = 0;
  let failed = 0;
  while (k < days.length - 1) {
    const att = simulate(days, p, plan, price, { from: k, horizon });
    if (att.end === "passed") passed++;
    else if (att.end === "floor") failed++;
    k += Math.max(1, att.days.length);
  }
  return { passed, failed, passRate: passed + failed ? passed / (passed + failed) : 0, attempts: passed + failed };
}

// ── Which firm, and whether to start at all ───────────────────────────────────

export interface FirmRow {
  key: string;
  firm: string;
  program: string;
  cost: number;
  plan: SizingPlan;
  odds: Odds;
  /** The same rules for a trader with no edge. */
  coin: number;
  /** Points of pass rate this strategy adds over no edge at these rules. */
  edge: number;
}

/** The same trades at every firm's account of this size, each with the sizing that suits its rules. */
export function firmShootout(days: UnitDay[], programs: FirmProgram[], price: Pricing): FirmRow[] {
  return programs
    .map((p) => {
      let best: { plan: SizingPlan; odds: Odds } | null = null;
      for (const plan of planGrid(p, price.micro, price.maxRisk)) {
        const odds = rollingOdds(days, p, plan, price, { cap: 30 });
        if (!best || odds.low > best.odds.low || (odds.low === best.odds.low && odds.passRate > best.odds.passRate)) best = { plan, odds };
      }
      const coin = coinFlipOdds(p, { runs: 800 }).rate;
      return { key: p.key, firm: p.firm, program: p.program, cost: p.cost, plan: best!.plan, odds: best!.odds, coin, edge: best!.odds.passRate - coin };
    })
    .sort((a, b) => b.edge - a.edge);
}

export interface GoNoGo {
  /** Attempts whose cautious expected odds, known beforehand, cleared the no-edge number. */
  taken: { attempts: number; passed: number; failed: number; passRate: number; costPerPass: number | null };
  skipped: { attempts: number; passed: number; failed: number; passRate: number };
  saved: number;
}

/** Attempts split by a rule fixed in advance: start only when even the cautious estimate beats no edge. */
export function goNoGo(steps: Pick<WalkStep, "expectedLow" | "result">[], coin: number, cost: number): GoNoGo {
  const tally = (xs: typeof steps) => {
    const passed = xs.filter((x) => x.result === "passed").length;
    const failed = xs.filter((x) => x.result === "floor").length;
    return { attempts: xs.length, passed, failed, passRate: passed + failed ? passed / (passed + failed) : 0 };
  };
  const yes = tally(steps.filter((x) => (x.expectedLow ?? 0) >= coin));
  const no = tally(steps.filter((x) => (x.expectedLow ?? 0) < coin));
  return { taken: { ...yes, costPerPass: yes.passed ? (yes.attempts * cost) / yes.passed : null }, skipped: no, saved: no.attempts * cost };
}

// ── A real account, as units ───────────────────────────────────────────────────

type AccountLike = { entryT: number; exitT: number; session: string; side: Side; qty: number; entry: number; exit: number; stop: number; target: number; pnl: number; worst: number; best: number; reason: string; strategy?: string };

/** An account's own trades per contract, so an autopsy can replay what actually happened at other sizes. */
export function accountUnits(trades: AccountLike[], price: Pricing): UnitDay[] {
  return toUnitDays(
    trades.map((t) => {
      const q = Math.max(1, t.qty);
      const per = q * price.pointValue;
      return { entryT: t.entryT, exitT: t.exitT, session: t.session, side: t.side, entry: t.entry, stop: t.stop, target: t.target, exit: t.exit, risk: Math.abs(t.entry - t.stop), worst: t.worst / per, best: t.best / per, points: (t.pnl + price.fee * q) / per, outcome: t.reason, reader: t.strategy ?? "By hand", qty: q };
    }),
  );
}

// ── Day by day ─────────────────────────────────────────────────────────────────

export interface LedgerDay {
  date: string;
  weekday: string;
  trades: number;
  wins: number;
  pnl: number;
  r: number;
  best: number;
  worst: number;
  /** Lowest and highest balance through the day. */
  low: number;
  high: number;
  balance: number;
  floor: number;
  /** Dollars above the floor at the close, and at the day's tightest point. */
  room: number;
  tightest: number;
  /** Share of the daily loss limit used at the worst point, if the firm has one. */
  dllUsed: number | null;
  /** This day's share of the firm's best-day limit. */
  bestDayShare: number | null;
  /** Running profit as a share of the target. */
  progress: number;
  flags: string[];
  items: DaySim["trades"];
}

export interface LedgerSummary {
  days: number;
  green: number;
  red: number;
  flat: number;
  avgGreen: number;
  avgRed: number;
  bestDay: number;
  worstDay: number;
  longestGreen: number;
  longestRed: number;
  tradesPerDay: number;
  tightest: number;
  dllDays: number;
  byWeekday: { key: string; days: number; green: number; pnl: number }[];
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Every traded session against the firm's rules, the numbers a risk desk would look at. */
export function dayLedger(days: DaySim[], p: FirmProgram, context?: { fomc?: string[]; vix?: Record<string, number> }): { rows: LedgerDay[]; summary: LedgerSummary } {
  const a = openAccount(p);
  const rows: LedgerDay[] = [];
  const fomc = new Set(context?.fomc ?? []);
  const limit = p.consistencyPct < 100 ? (p.consistencyPct / 100) * p.target : null;
  for (const d of [...days].sort((x, y) => x.date.localeCompare(y.date))) {
    const open = a.balance;
    const w = walkDay(a, d, p);
    const ts = d.trades;
    const pnls = ts.map((t) => t.pnl);
    const flags: string[] = [];
    if (w.failedAt !== null) flags.push("Hit the floor");
    else if (p.dll != null && w.pnl <= -p.dll + 0.01) flags.push("Daily limit");
    if (limit && w.pnl > limit) flags.push("Over best-day limit");
    if (fomc.has(d.date)) flags.push("FOMC");
    const vix = context?.vix?.[d.date];
    if (vix != null && vix >= 25) flags.push(`VIX ${Math.round(vix)}`);
    rows.push({
      date: d.date,
      weekday: WD[new Date(`${d.date}T12:00:00Z`).getUTCDay()],
      trades: ts.length,
      wins: pnls.filter((x) => x > 0).length,
      pnl: w.pnl,
      r: ts.reduce((s, t) => s + (t.r ?? 0), 0),
      best: pnls.length ? Math.max(...pnls) : 0,
      worst: pnls.length ? Math.min(...pnls) : 0,
      low: w.low,
      high: w.high,
      balance: a.balance,
      floor: a.threshold,
      room: a.balance - a.threshold,
      tightest: w.low - a.threshold,
      dllUsed: p.dll != null ? Math.min(1, Math.max(0, (open - w.low) / p.dll)) : null,
      bestDayShare: limit ? w.pnl / limit : null,
      progress: p.target ? (a.balance - p.size) / p.target : 0,
      flags,
      items: ts,
    });
    if (w.failedAt !== null) break;
  }
  const green = rows.filter((r) => r.pnl > 0);
  const red = rows.filter((r) => r.pnl < 0);
  let longestGreen = 0;
  let longestRed = 0;
  let g = 0;
  let b = 0;
  for (const r of rows) {
    g = r.pnl > 0 ? g + 1 : 0;
    b = r.pnl < 0 ? b + 1 : 0;
    longestGreen = Math.max(longestGreen, g);
    longestRed = Math.max(longestRed, b);
  }
  const avg = (xs: LedgerDay[]) => (xs.length ? xs.reduce((s, r) => s + r.pnl, 0) / xs.length : 0);
  const byWeekday = WD.slice(1, 6).map((key) => {
    const xs = rows.filter((r) => r.weekday === key);
    return { key, days: xs.length, green: xs.filter((r) => r.pnl > 0).length, pnl: xs.reduce((s, r) => s + r.pnl, 0) };
  });
  return {
    rows,
    summary: {
      days: rows.length,
      green: green.length,
      red: red.length,
      flat: rows.length - green.length - red.length,
      avgGreen: avg(green),
      avgRed: avg(red),
      bestDay: rows.length ? Math.max(...rows.map((r) => r.pnl)) : 0,
      worstDay: rows.length ? Math.min(...rows.map((r) => r.pnl)) : 0,
      longestGreen,
      longestRed,
      tradesPerDay: rows.length ? rows.reduce((s, r) => s + r.trades, 0) / rows.length : 0,
      tightest: rows.length ? Math.min(...rows.map((r) => r.tightest)) : p.drawdown,
      dllDays: rows.filter((r) => r.flags.includes("Daily limit")).length,
      byWeekday,
    },
  };
}

export function ledgerCsv(rows: LedgerDay[]) {
  const head = "date,weekday,trades,wins,pnl,r,best_trade,worst_trade,low,high,balance,floor,room,tightest,dll_used,best_day_share,target_progress,flags";
  return [head, ...rows.map((r) => [r.date, r.weekday, r.trades, r.wins, r.pnl.toFixed(2), r.r.toFixed(2), r.best.toFixed(2), r.worst.toFixed(2), r.low.toFixed(2), r.high.toFixed(2), r.balance.toFixed(2), r.floor.toFixed(2), r.room.toFixed(2), r.tightest.toFixed(2), r.dllUsed?.toFixed(3) ?? "", r.bestDayShare?.toFixed(3) ?? "", r.progress.toFixed(3), r.flags.join("; ")].join(","))].join("\n");
}
