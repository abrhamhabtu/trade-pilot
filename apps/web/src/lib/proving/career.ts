// ─── Proving Ground · account life ─────────────────────────────────────────────
// A pass/fail grade answers "can this strategy pass once?". A trader's real
// question is "does running this strategy at this firm make me money?". That
// means paying for every eval, buying another when one blows, trading the
// funded account and taking payouts out of it, over and over.
//
// Payout policy, kept deliberately plain and stated in the UI:
//   • A funded account can pay out once it has traded the firm's minimum days
//     since its last payout and holds more than one drawdown of cushion above
//     its starting balance.
//   • It withdraws everything above that cushion, at the firm's split.
//   • Instant-funding programs also have to meet their consistency rule for
//     the profit being withdrawn.
// Activation fees, payout caps and per-firm payout calendars are not modelled.
// ───────────────────────────────────────────────────────────────────────────────

import type { DaySim } from "./engine";
import { openAccount, walkDay, type AccountState, type FirmProgram } from "./firms";

export type CareerEventKind = "bought" | "renewed" | "eval-failed" | "passed" | "blown" | "payout";

export interface CareerEvent {
  date: string;
  kind: CareerEventKind;
  /** Dollars: a cost for bought/renewed, the trader's share for a payout. */
  amount: number;
}

export interface Career {
  events: CareerEvent[];
  spent: number;
  paidOut: number;
  net: number;
  accountsBought: number;
  passes: number;
  payouts: number;
  firstPayout: string | null;
  /** Trading sessions from the first purchase to the first payout. */
  sessionsToFirstPayout: number | null;
  sessions: number;
  /** Where the account stands at the end: in an eval, funded, just blown with the next one queued, or never allowed to trade. */
  status: "eval" | "funded" | "reset" | "over-size";
  /** Live balance above (or below) the start of the account in play now. */
  openProfit: number;
  /** The account in play now, or null between accounts. */
  account: { start: number; balance: number; threshold: number; traded: number } | null;
}

export interface CareerOptions {
  /** Smallest withdrawal worth requesting. */
  minPayout?: number;
}

/** The trader's share of a gross payout, given what has been paid out before. */
export function traderShare(gross: number, paidBefore: number, p: Pick<FirmProgram, "split" | "keep100Upto">) {
  const full = Math.max(0, Math.min(gross, p.keep100Upto - paidBefore));
  return full + (gross - full) * (p.split / 100);
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

export function career(
  days: DaySim[],
  p: FirmProgram,
  size: { contracts: number; micro: boolean },
  options: CareerOptions = {},
): Career {
  const minPayout = options.minPayout ?? 500;
  const sorted = [...days].filter((d) => !d.partial).sort((a, b) => a.date.localeCompare(b.date));
  const out: Career = {
    events: [],
    spent: 0,
    paidOut: 0,
    net: 0,
    accountsBought: 0,
    passes: 0,
    payouts: 0,
    firstPayout: null,
    sessionsToFirstPayout: null,
    sessions: sorted.length,
    status: p.model === "instant" ? "funded" : "eval",
    openProfit: 0,
    account: null,
  };
  const limit = size.micro ? p.maxMicros : p.maxMinis;
  if (size.contracts > limit || !sorted.length) {
    if (size.contracts > limit) out.status = "over-size";
    return out;
  }

  let phase: "eval" | "funded" = p.model === "instant" ? "funded" : "eval";
  let acct: AccountState | null = null;
  let boughtOn = "";
  let renewals = 0;
  let traded = 0;
  let bestDay = 0;
  let cycleStart = 0;
  let grossPaid = 0;

  const buy = (date: string) => {
    out.spent += p.cost;
    out.accountsBought++;
    out.events.push({ date, kind: "bought", amount: p.cost });
    boughtOn = date;
    renewals = 0;
  };
  const fresh = () => {
    acct = openAccount(p);
    traded = 0;
    bestDay = 0;
    cycleStart = acct.balance;
  };

  sorted.forEach((d, i) => {
    if (!acct) {
      // A blown or brand-new account: an eval (or instant account) is bought,
      // a passed eval moves on to its funded account for free.
      if (phase === "eval" || p.model === "instant") buy(d.date);
      fresh();
    }
    const a = acct!;
    // Monthly evals keep billing until they pass or fail.
    if (phase === "eval" && p.costCadence === "monthly") {
      const due = Math.floor(daysBetween(boughtOn, d.date) / 30);
      while (renewals < due) {
        renewals++;
        out.spent += p.cost;
        out.events.push({ date: d.date, kind: "renewed", amount: p.cost });
      }
    }

    const w = walkDay(a, d, p);
    if (w.failedAt !== null) {
      out.events.push({ date: d.date, kind: phase === "eval" ? "eval-failed" : "blown", amount: 0 });
      acct = null;
      phase = p.model === "instant" ? "funded" : "eval";
      return;
    }
    if (d.trades.length) traded++;
    bestDay = Math.max(bestDay, w.pnl);

    if (phase === "eval") {
      const profit = a.balance - a.start;
      const lim = p.consistencyBasis === "profitTarget" ? (p.consistencyPct / 100) * p.target : (p.consistencyPct / 100) * Math.max(profit, 0);
      const consistent = p.consistencyPct >= 100 || bestDay <= lim + 0.01;
      if (profit >= p.target && traded >= p.minDays && consistent) {
        out.passes++;
        out.events.push({ date: d.date, kind: "passed", amount: 0 });
        phase = "funded";
        acct = null;
      }
      return;
    }

    // Funded: withdraw what sits above one drawdown of cushion.
    const withdrawable = a.balance - (a.start + p.drawdown);
    const cycleProfit = a.balance - cycleStart;
    const consistent =
      p.model !== "instant" || p.consistencyPct >= 100 || bestDay <= (p.consistencyPct / 100) * Math.max(cycleProfit, 0) + 0.01;
    if (traded >= Math.max(1, p.minDays) && withdrawable >= minPayout && consistent) {
      const share = traderShare(withdrawable, grossPaid, p);
      grossPaid += withdrawable;
      a.balance -= withdrawable;
      out.paidOut += share;
      out.payouts++;
      out.events.push({ date: d.date, kind: "payout", amount: share });
      if (!out.firstPayout) {
        out.firstPayout = d.date;
        out.sessionsToFirstPayout = i + 1;
      }
      traded = 0;
      bestDay = 0;
      cycleStart = a.balance;
    }
  });

  out.net = out.paidOut - out.spent;
  const live = acct as AccountState | null;
  const last = out.events[out.events.length - 1]?.kind;
  out.status = !live && (last === "eval-failed" || last === "blown") ? "reset" : phase;
  out.openProfit = live ? live.balance - live.start : 0;
  out.account = live ? { start: live.start, balance: live.balance, threshold: live.threshold, traded } : null;
  return out;
}

// ─── Many lives ────────────────────────────────────────────────────────────────
// One window of history is one ordering of luck. Re-dealing the strategy's own
// finished sessions into many account lives shows what usually happens: the
// typical result, the bad case, and how often there is a payout at all. Days
// are drawn independently, so streaks are not preserved; the UI says so.

export interface CareerOdds {
  runs: number;
  horizon: number;
  meanNet: number;
  medianNet: number;
  p10: number;
  p90: number;
  /** Share of lives that ended with more paid out than spent. */
  pProfit: number;
  /** Share of lives with at least one payout. */
  pPayout: number;
  medianSpent: number;
  /** Median sessions to the first payout, among lives that had one. */
  medianFirstPayout: number | null;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const quantile = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))] : 0);

/** Session dates for a synthetic life: five sessions to every seven calendar days. */
const syntheticDate = (i: number) => new Date(Date.UTC(2000, 0, 3) + Math.floor((i * 7) / 5) * 86_400_000).toISOString().slice(0, 10);

export function careerOdds(
  days: DaySim[],
  p: FirmProgram,
  size: { contracts: number; micro: boolean },
  opts: { runs?: number; horizon?: number; seed?: number } = {},
): CareerOdds {
  const runs = opts.runs ?? 300;
  const horizon = opts.horizon ?? 63;
  const pool = days.filter((d) => !d.partial);
  const empty: CareerOdds = { runs: 0, horizon, meanNet: 0, medianNet: 0, p10: 0, p90: 0, pProfit: 0, pPayout: 0, medianSpent: 0, medianFirstPayout: null };
  if (!pool.length) return empty;
  const rnd = mulberry32(opts.seed ?? 7);
  const nets: number[] = [];
  const spent: number[] = [];
  const firsts: number[] = [];
  let profit = 0;
  let paid = 0;
  for (let r = 0; r < runs; r++) {
    const life = Array.from({ length: horizon }, (_, i) => ({ ...pool[Math.floor(rnd() * pool.length)], date: syntheticDate(i) }));
    const c = career(life, p, size);
    if (c.status === "over-size") return empty;
    nets.push(c.net);
    spent.push(c.spent);
    if (c.net > 0) profit++;
    if (c.payouts) {
      paid++;
      firsts.push(c.sessionsToFirstPayout!);
    }
  }
  nets.sort((a, b) => a - b);
  spent.sort((a, b) => a - b);
  firsts.sort((a, b) => a - b);
  return {
    runs,
    horizon,
    meanNet: nets.reduce((a, b) => a + b, 0) / runs,
    medianNet: quantile(nets, 0.5),
    p10: quantile(nets, 0.1),
    p90: quantile(nets, 0.9),
    pProfit: profit / runs,
    pPayout: paid / runs,
    medianSpent: quantile(spent, 0.5),
    medianFirstPayout: firsts.length ? quantile(firsts, 0.5) : null,
  };
}
