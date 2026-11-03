// ─── Vision · what it's worth ──────────────────────────────────────────────────
// Pass rates don't pay rent. This follows an account's whole life in dollars:
// fees, renewals, activation, failures, the funded stretch and each payout, so
// plans and firms can be ranked by what actually reaches the trader. The rest of
// the file asks whether the result can be trusted: stress tests, a luck test,
// a health check, news days, several accounts at once, and the trader's own hands.
// ───────────────────────────────────────────────────────────────────────────────

import type { FirmProgram } from "@/lib/proving/firms";
import { traderShare } from "@/lib/proving/career";
import { rollingOdds, simulate, toUnitDays, type Odds, type Pricing, type SizingPlan, type UnitDay, type UnitTrade } from "./lab";

export interface FirmExtras {
  /** Paid on passing an evaluation. null = not known; treated as nothing and flagged. */
  activation: number | null;
  /** Largest single payout. null = not modelled. */
  payoutCap: number | null;
  /** Where the number came from and how far to trust it. */
  note: string;
}

const EXTRAS: Record<string, FirmExtras> = {
  topstep: { activation: 149, payoutCap: 3000, note: "Third-party guides report a one-time $149 activation on the standard path and about $3,000 maximum per payout at 50K; they disagree on details. Confirm in Topstep's Help Center." },
  "lucid-pro": { activation: 0, payoutCap: null, note: "One comparison site lists no activation fee on Lucid's 50K accounts. Unconfirmed." },
  "lucid-flex": { activation: 0, payoutCap: null, note: "One comparison site lists no activation fee on Lucid's 50K accounts. Unconfirmed." },
  "lucid-direct": { activation: 0, payoutCap: null, note: "Instant account: no evaluation to activate." },
  "futures-elite": { activation: 0, payoutCap: 1000, note: "Firm's pricing table, Sep 30, 2026: no activation fee, payout caps $1K to $3K by size." },
};

export const firmExtras = (p: Pick<FirmProgram, "firmId" | "model">): FirmExtras => EXTRAS[p.firmId] ?? (p.model === "instant" ? { activation: 0, payoutCap: null, note: "Instant account: no evaluation to activate." } : { activation: null, payoutCap: null, note: "Activation fee not known here. Counted as $0, so the real cost may be higher." });

const MIN_PAYOUT = 500;

export interface Life {
  spent: number;
  paid: number;
  net: number;
  attempts: number;
  passes: number;
  blowups: number;
  payouts: number;
  /** Sessions and dollars spent up to the first payout, if there was one. */
  sessionsToPayout: number | null;
  spentToPayout: number | null;
}

/**
 * One life at a firm over `horizon` sessions: buy the eval, pay renewals, trade
 * it, pay activation, trade funded, withdraw what sits above a drawdown of
 * cushion, buy another when one dies. Instant accounts start at the funded part.
 */
export function life(days: UnitDay[], p: FirmProgram, evalPlan: SizingPlan, fundedPlan: SizingPlan, evalPrice: Pricing, fundedPrice: Pricing, o: { from: number; horizon?: number; fundedConsistencyPct?: number }): Life {
  const end = Math.min(days.length, o.from + (o.horizon ?? 252));
  const extras = firmExtras(p);
  const out: Life = { spent: 0, paid: 0, net: 0, attempts: 0, passes: 0, blowups: 0, payouts: 0, sessionsToPayout: null, spentToPayout: null };
  const funded: FirmProgram = { ...p, target: 1e12, minDays: 0, consistencyPct: 100 };
  const rule = p.model === "instant" ? p.consistencyPct : Math.min(p.consistencyPct, o.fundedConsistencyPct ?? 100);
  let k = o.from;
  while (k < end) {
    if (p.model !== "instant") {
      out.spent += p.cost;
      out.attempts++;
      const att = simulate(days, p, evalPlan, evalPrice, { from: k, horizon: end - k });
      if (p.costCadence === "monthly" && att.days.length) {
        const span = (Date.parse(att.days[att.days.length - 1].date) - Date.parse(att.days[0].date)) / (30 * 86_400_000);
        out.spent += Math.floor(Math.max(0, span)) * p.cost;
      }
      k += Math.max(1, att.days.length);
      if (att.end !== "passed") continue;
      out.passes++;
      out.spent += extras.activation ?? 0;
    } else {
      out.spent += p.cost;
      out.attempts++;
    }
    // The funded stretch, a session at a time so payouts can come out of it.
    let seed = { balance: p.size, peak: p.size, threshold: p.size - p.drawdown, bestDay: 0, daysTraded: 0 };
    let cycleStart = p.size;
    let grossPaid = 0;
    let alive = true;
    while (k < end && alive) {
      const step = simulate(days, funded, fundedPlan, fundedPrice, { from: k, horizon: 1, seed });
      k++;
      if (step.end === "floor") {
        alive = false;
        out.blowups++;
        break;
      }
      seed = { balance: step.balance, peak: step.peak, threshold: step.floor, bestDay: step.bestDay, daysTraded: step.daysTraded };
      const profit = seed.balance - cycleStart;
      const consistent = rule >= 100 || seed.bestDay <= (rule / 100) * Math.max(profit, 0) + 0.01;
      const can = seed.balance - (p.size + p.drawdown);
      if (seed.daysTraded >= Math.max(1, p.minDays) && can >= MIN_PAYOUT && consistent) {
        const gross = extras.payoutCap ? Math.min(can, extras.payoutCap) : can;
        out.paid += traderShare(gross, grossPaid, p);
        grossPaid += gross;
        out.payouts++;
        if (out.sessionsToPayout == null) {
          out.sessionsToPayout = k - o.from;
          out.spentToPayout = out.spent;
        }
        seed = { ...seed, balance: seed.balance - gross, bestDay: 0, daysTraded: 0 };
        cycleStart = seed.balance;
      }
    }
  }
  out.net = out.paid - out.spent;
  return out;
}

export interface Worth {
  key: string;
  label: string;
  model: "eval" | "instant";
  /** Dollars after a year: average, typical, and the bad and good cases. */
  meanNet: number;
  medianNet: number;
  p10: number;
  p90: number;
  /** Share of years with a payout, and with more paid than spent. */
  pPayout: number;
  pProfit: number;
  /** Among years with a payout. */
  medianDaysToPayout: number | null;
  medianCostToPayout: number | null;
  meanSpent: number;
  meanAttempts: number;
  lives: number;
}

const q = (xs: number[], f: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.round(f * (s.length - 1)))];
};

/** Every start through history: what a year at this firm tends to pay. Years are cut off where the data ends. */
export function worth(days: UnitDay[], p: FirmProgram, evalPlan: SizingPlan, fundedPlan: SizingPlan, evalPrice: Pricing, fundedPrice: Pricing, o: { label?: string; cap?: number; horizon?: number; fundedConsistencyPct?: number } = {}): Worth {
  const horizon = o.horizon ?? 252;
  const last = Math.max(0, days.length - horizon);
  const step = Math.max(1, Math.ceil(last / (o.cap ?? 24)));
  const lives: Life[] = [];
  for (let k = 0; k <= last; k += step) lives.push(life(days, p, evalPlan, fundedPlan, evalPrice, fundedPrice, { from: k, horizon, fundedConsistencyPct: o.fundedConsistencyPct }));
  const nets = lives.map((l) => l.net);
  const hit = lives.filter((l) => l.sessionsToPayout != null);
  const n = Math.max(1, lives.length);
  return {
    key: p.key,
    label: o.label ?? `${p.firm} ${p.program}`,
    model: p.model,
    meanNet: nets.reduce((a, b) => a + b, 0) / n,
    medianNet: q(nets, 0.5),
    p10: q(nets, 0.1),
    p90: q(nets, 0.9),
    pPayout: hit.length / n,
    pProfit: lives.filter((l) => l.net > 0).length / n,
    medianDaysToPayout: hit.length ? q(hit.map((l) => l.sessionsToPayout!), 0.5) : null,
    medianCostToPayout: hit.length ? q(hit.map((l) => l.spentToPayout!), 0.5) : null,
    meanSpent: lives.reduce((a, l) => a + l.spent, 0) / n,
    meanAttempts: lives.reduce((a, l) => a + l.attempts, 0) / n,
    lives: lives.length,
  };
}

// ── Today's game plan ──────────────────────────────────────────────────────────

export interface GamePlan {
  room: number;
  /** Largest size at a typical stop under the trader's limit, and the firm's cap. */
  maxContracts: number;
  firmCap: number;
  riskAtMax: number;
  maxRiskUsd: number;
  stopFor: number;
  /** Most to make today before the best-day rule starts to bite; null = no rule. */
  bestDayLimit: number | null;
  /** Full-risk losses left before the floor. */
  lossesLeft: number;
  toTarget: number | null;
  /** Good days at the limit needed to reach the target. */
  daysAtLimit: number | null;
  warning: string | null;
}

export function gamePlan(s: { program: FirmProgram; balance: number; threshold: number; profit: number; bestDay: number; daysTraded: number }, o: { cap: number; stopPoints: number; pointValue: number; micro: boolean; fee: number; phase: "eval" | "funded" | "live"; margin?: number; livePct?: number; fundedConsistencyPct?: number }): GamePlan {
  const p = s.program;
  const room = Math.max(0, s.balance - s.threshold);
  const maxRiskUsd = o.phase === "live" ? (s.balance * (o.livePct ?? 2)) / 100 : Math.min(p.drawdown * o.cap, room);
  const per = o.stopPoints * o.pointValue + o.fee;
  const firmCap = o.micro ? p.maxMicros : p.maxMinis;
  const marginCap = o.margin ? Math.floor(s.balance / o.margin) : firmCap;
  const maxContracts = Math.max(0, Math.min(firmCap, marginCap, Math.floor(maxRiskUsd / per)));
  const riskAtMax = maxContracts * per;
  const stopFor = Math.min(p.dll ? p.dll * 0.7 : Infinity, room * 0.4);
  const pct = o.phase === "funded" ? Math.min(p.consistencyPct, o.fundedConsistencyPct ?? 100) : p.consistencyPct;
  const bestDayLimit = pct >= 100 || o.phase === "live" ? null : p.consistencyBasis === "profitTarget" ? (pct / 100) * p.target : (pct / 100) * Math.max(p.target, s.profit);
  const toTarget = o.phase === "eval" ? Math.max(0, p.target - s.profit) : null;
  return {
    room,
    maxContracts,
    firmCap,
    riskAtMax,
    maxRiskUsd,
    stopFor,
    bestDayLimit,
    lossesLeft: riskAtMax > 0 ? Math.floor(room / riskAtMax) : 0,
    toTarget,
    daysAtLimit: toTarget != null && bestDayLimit ? Math.ceil(toTarget / bestDayLimit) : null,
    warning: maxContracts === 0 ? `One contract at a ${o.stopPoints}-point stop is more risk than your limit allows. Use a tighter stop or a smaller contract.` : null,
  };
}

// ── Can the result be trusted? ─────────────────────────────────────────────────

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const worsen = (days: UnitDay[], points: number): UnitDay[] => days.map((d) => ({ ...d, trades: d.trades.map((t) => ({ ...t, points: t.points - points, worst: t.worst - points })) }));

export interface StressReport {
  base: number;
  /** Pass rate with more slippage against every trade. */
  slippage: { ticks: number; passRate: number }[];
  /** Pass rate with one winner in ten turned into a full stop, as missed fills do. */
  missedFills: number;
  /** Pass rates with the same days dealt in other orders. */
  shuffled: { low: number; median: number; high: number };
  /** Pass rates when each trade's result gets a random sign: what the same sizes earn with no skill. */
  noSkill: { median: number; high: number };
  /** Share of no-skill worlds that did at least as well. */
  luck: number;
  verdict: string;
}

export function stressTest(days: UnitDay[], p: FirmProgram, plan: SizingPlan, price: Pricing, tick: number, o: { runs?: number; cap?: number } = {}): StressReport {
  const cap = o.cap ?? 60;
  const runs = o.runs ?? 40;
  const rate = (d: UnitDay[]) => rollingOdds(d, p, plan, price, { cap }).passRate;
  const base = rate(days);
  const slippage = [1, 2, 4].map((ticks) => ({ ticks, passRate: rate(worsen(days, ticks * tick * 2)) }));
  const r = rng(17);
  const missedFills = rate(days.map((d) => ({ ...d, trades: d.trades.map((t) => (t.points > 0 && r() < 0.1 ? { ...t, points: -t.risk, worst: -t.risk, best: Math.min(t.best, t.risk * 0.3) } : t)) })));
  const shuffles: number[] = [];
  for (let k = 0; k < runs; k++) {
    const order = days.map((d) => d.trades);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    shuffles.push(rate(days.map((d, i) => ({ date: d.date, trades: order[i] }))));
  }
  const nulls: number[] = [];
  for (let k = 0; k < runs; k++)
    nulls.push(rate(days.map((d) => ({ ...d, trades: d.trades.map((t) => {
      if (r() < 0.5) return t;
      return { ...t, points: -t.points, worst: -t.best, best: -t.worst };
    }) }))));
  const luck = nulls.filter((x) => x >= base).length / Math.max(1, nulls.length);
  const verdict = luck > 0.05 ? "Random trades of the same sizes often do this well. This looks like luck, not skill." : slippage[1].passRate < base * 0.6 ? "It beats random, but a little extra slippage takes most of it away. The edge is thin." : "It beats random and survives worse fills. This is the kind of result worth trusting more.";
  return { base, slippage, missedFills, shuffled: { low: q(shuffles, 0.1), median: q(shuffles, 0.5), high: q(shuffles, 0.9) }, noSkill: { median: q(nulls, 0.5), high: q(nulls, 0.9) }, luck, verdict };
}

export interface Health {
  status: "normal" | "watch" | "alarm" | "unknown";
  /** Recent trades judged, and their average R. */
  n: number;
  recentR: number;
  historyR: number;
  /** Share of past stretches this long that were worse. */
  percentile: number;
  streak: number;
  worstStreak: number;
  text: string;
}

/** Are the latest results inside what this strategy's own history calls normal? */
export function healthCheck(rs: number[], window = 40): Health {
  if (rs.length < window * 3) return { status: "unknown", n: rs.length, recentR: 0, historyR: 0, percentile: 0.5, streak: 0, worstStreak: 0, text: `Needs ${window * 3} trades to judge; it has ${rs.length}.` };
  const history = rs.slice(0, -window);
  const recent = rs.slice(-window);
  const avg = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
  const windows: number[] = [];
  let sum = history.slice(0, window).reduce((a, b) => a + b, 0);
  windows.push(sum / window);
  for (let i = window; i < history.length; i++) {
    sum += history[i] - history[i - window];
    windows.push(sum / window);
  }
  const recentR = avg(recent);
  // A tie counts as half, so a strategy that never changes reads as average, not as its worst.
  const percentile = (windows.filter((w) => w < recentR - 1e-9).length + windows.filter((w) => Math.abs(w - recentR) <= 1e-9).length / 2) / windows.length;
  let run = 0;
  let worstStreak = 0;
  for (const x of history) {
    run = x <= 0 ? run + 1 : 0;
    worstStreak = Math.max(worstStreak, run);
  }
  let streak = 0;
  for (let i = rs.length - 1; i >= 0 && rs[i] <= 0; i--) streak++;
  const status = percentile < 0.05 || streak > worstStreak ? "alarm" : percentile < 0.2 ? "watch" : "normal";
  const text = status === "alarm" ? `The last ${window} trades are worse than ${Math.round((1 - percentile) * 100)}% of its past stretches${streak > worstStreak ? `, and the current losing run of ${streak} is its longest ever` : ""}. It may have stopped working.` : status === "watch" ? `The last ${window} trades are in the weak end of normal. Worth watching.` : `The last ${window} trades are inside what its history calls normal.`;
  return { status, n: window, recentR, historyR: avg(history), percentile, streak, worstStreak, text };
}

export interface NewsRow {
  key: string;
  label: string;
  trades: number;
  winRate: number;
  avgR: number;
}

export interface NewsReport {
  rows: NewsRow[];
  /** Pass rate if those days are skipped, one at a time and together. */
  skip: { key: string; label: string; passRate: number }[];
  base: number;
}

export function newsDays(days: UnitDay[], p: FirmProgram, plan: SizingPlan, price: Pricing, dates: { cpi: string[]; jobs: string[]; fomc: string[] }): NewsReport {
  const sets = { cpi: new Set(dates.cpi), jobs: new Set(dates.jobs), fomc: new Set(dates.fomc) };
  const LABEL = { cpi: "CPI days", jobs: "Jobs report days", fomc: "FOMC days" } as const;
  const stats = (d: UnitDay[]) => {
    const rs = d.flatMap((x) => x.trades.map((t) => (t.risk ? t.points / t.risk : 0)));
    return { trades: rs.length, winRate: rs.filter((r) => r > 0).length / Math.max(1, rs.length), avgR: rs.reduce((a, b) => a + b, 0) / Math.max(1, rs.length) };
  };
  const isNews = (date: string) => sets.cpi.has(date) || sets.jobs.has(date) || sets.fomc.has(date);
  const rows: NewsRow[] = [...(["cpi", "jobs", "fomc"] as const).map((key) => ({ key, label: LABEL[key], ...stats(days.filter((d) => sets[key].has(d.date))) })), { key: "normal", label: "Every other day", ...stats(days.filter((d) => !isNews(d.date))) }];
  const rate = (d: UnitDay[]) => rollingOdds(d, p, plan, price, { cap: 200 }).passRate;
  return {
    rows,
    base: rate(days),
    skip: [...(["cpi", "jobs", "fomc"] as const).map((key) => ({ key, label: `Skip ${LABEL[key]}`, passRate: rate(days.filter((d) => !sets[key].has(d.date))) })), { key: "all", label: "Skip all three", passRate: rate(days.filter((d) => !isNews(d.date))) }],
  };
}

// ── The trader against the machine ─────────────────────────────────────────────

type Manual = { entryT: number; exitT: number; session: string; side: "long" | "short"; qty: number; entry: number; exit: number; stop: number; target: number; pnl: number; r: number; worst: number; best: number; source: string };

export interface Versus {
  days: number;
  you: { trades: number; pnl: number; winRate: number; avgR: number };
  machine: { trades: number; pnl: number; winRate: number; avgR: number };
  gap: number;
  /** What each habit made or cost, in dollars. */
  leaks: { id: string; title: string; detail: string; dollars: number; count: number }[];
  /** Same-side trades within 15 minutes of a machine signal. */
  matched: number;
}

export function youVsMachine(manual: Manual[], machineDays: UnitDay[], price: Pricing, o: { contracts: number; capUsd: number; machineLabel: string }): Versus {
  const mine = manual.filter((t) => t.source === "manual");
  const sessions = new Set(mine.map((t) => t.session));
  const machine = machineDays.filter((d) => sessions.has(d.date)).flatMap((d) => d.trades);
  const pnlOf = (t: UnitTrade) => t.points * price.pointValue * o.contracts - price.fee * o.contracts;
  const sum = (x: number[]) => x.reduce((a, b) => a + b, 0);
  const near = (a: number, b: number) => Math.abs(a - b) <= 15 * 60;
  const matchedMine = mine.filter((t) => machine.some((m) => m.side === t.side && near(m.entryT, t.entryT)));
  const offPlan = mine.filter((t) => !matchedMine.includes(t));
  const skipped = machine.filter((m) => !mine.some((t) => t.side === m.side && near(m.entryT, t.entryT)));
  const early = mine.filter((t) => {
    const reach = Math.abs(t.target - t.entry) * price.pointValue * t.qty;
    return t.pnl > 0 && t.best >= reach * 0.999 && t.pnl < reach * 0.9;
  });
  const leftEarly = sum(early.map((t) => Math.abs(t.target - t.entry) * price.pointValue * t.qty - t.pnl));
  const oversized = mine.filter((t) => Math.abs(t.entry - t.stop) * price.pointValue * t.qty > o.capUsd);
  const overCost = sum(oversized.map((t) => {
    const fit = Math.floor(o.capUsd / Math.max(0.01, Math.abs(t.entry - t.stop) * price.pointValue));
    return t.pnl - (t.pnl * Math.min(fit, t.qty)) / t.qty;
  }));
  const bad = mine.filter((t) => Math.abs(t.exit - t.entry) > Math.abs(t.entry - t.stop) * 1.05 && t.pnl < 0);
  const stopCost = sum(bad.map((t) => t.pnl + Math.abs(t.entry - t.stop) * price.pointValue * t.qty));
  const leaks: Versus["leaks"] = [
    { id: "offplan", title: "Trades the strategy didn't take", detail: `${offPlan.length} trade${offPlan.length === 1 ? "" : "s"} had no signal from ${o.machineLabel} within 15 minutes.`, dollars: sum(offPlan.map((t) => t.pnl)), count: offPlan.length },
    { id: "skipped", title: "Signals you passed on", detail: `${skipped.length} setup${skipped.length === 1 ? "" : "s"} fired on days you traded and you didn't take ${skipped.length === 1 ? "it" : "them"}. This is what ${skipped.length === 1 ? "it" : "they"} would have made or lost.`, dollars: sum(skipped.map(pnlOf)), count: skipped.length },
    { id: "early", title: "Exited before the target", detail: `${early.length} winner${early.length === 1 ? "" : "s"} reached the target, and you took less.`, dollars: -leftEarly, count: early.length },
    { id: "size", title: "Bigger than your limit", detail: `${oversized.length} trade${oversized.length === 1 ? "" : "s"} risked more than your limit of $${Math.round(o.capUsd).toLocaleString("en-US")}. The dollars are what the extra size added to the result.`, dollars: overCost, count: oversized.length },
    { id: "stop", title: "Past your stop", detail: `${bad.length} loser${bad.length === 1 ? "" : "s"} closed beyond the planned stop.`, dollars: stopCost, count: bad.length },
  ];
  const side = (rs: number[], pnls: number[]) => ({ trades: rs.length, pnl: sum(pnls), winRate: rs.filter((x) => x > 0).length / Math.max(1, rs.length), avgR: sum(rs) / Math.max(1, rs.length) });
  const you = side(mine.map((t) => t.r), mine.map((t) => t.pnl));
  const mach = side(machine.map((t) => (t.risk ? t.points / t.risk : 0)), machine.map(pnlOf));
  return { days: sessions.size, you, machine: mach, gap: you.pnl - mach.pnl, leaks: leaks.filter((l) => l.count > 0).sort((a, b) => a.dollars - b.dollars), matched: matchedMine.length };
}

// ── Several accounts ───────────────────────────────────────────────────────────

export interface Book {
  label: string;
  legs: string[];
  starts: number;
  /** Share of starts where every account failed, and where at least one passed. */
  allFail: number;
  anyPass: number;
  avgPasses: number;
  cost: number;
  costPerPass: number | null;
}

export interface Portfolio {
  books: Book[];
  /** How often markets' daily results moved together, -1 to 1. */
  correlation: { a: string; b: string; value: number }[];
}

export function bookOdds(legs: { label: string; days: UnitDay[]; plan: SizingPlan; price: Pricing }[], p: FirmProgram, label: string, o: { cap?: number; horizon?: number } = {}): Book {
  const dates = [...new Set(legs.flatMap((l) => l.days.map((d) => d.date)))].sort();
  const step = Math.max(1, Math.ceil(dates.length / (o.cap ?? 80)));
  let starts = 0;
  let allFail = 0;
  let anyPass = 0;
  let passes = 0;
  for (let k = 0; k < dates.length - 20; k += step) {
    const date = dates[k];
    const results = legs.map((l) => {
      const from = l.days.findIndex((d) => d.date >= date);
      return from < 0 ? "unfinished" : simulate(l.days, p, l.plan, l.price, { from, horizon: o.horizon ?? 120 }).end;
    });
    starts++;
    const n = results.filter((r) => r === "passed").length;
    passes += n;
    if (n) anyPass++;
    if (results.every((r) => r === "floor")) allFail++;
  }
  const cost = legs.length * p.cost;
  const avgPasses = passes / Math.max(1, starts);
  return { label, legs: legs.map((l) => l.label), starts, allFail: allFail / Math.max(1, starts), anyPass: anyPass / Math.max(1, starts), avgPasses, cost, costPerPass: avgPasses > 0 ? cost / avgPasses : null };
}

export function dailyCorrelation(a: UnitDay[], b: UnitDay[]) {
  const sumDay = (d: UnitDay) => d.trades.reduce((s, t) => s + (t.risk ? t.points / t.risk : 0), 0);
  const mb = new Map(b.map((d) => [d.date, sumDay(d)]));
  const xs: number[] = [];
  const ys: number[] = [];
  for (const d of a) {
    const y = mb.get(d.date);
    if (y != null) {
      xs.push(sumDay(d));
      ys.push(y);
    }
  }
  if (xs.length < 30) return 0;
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const mx = mean(xs);
  const my = mean(ys);
  let c = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < xs.length; i++) {
    c += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  return vx && vy ? c / Math.sqrt(vx * vy) : 0;
}

// ── Live money ─────────────────────────────────────────────────────────────────

export interface LiveRow {
  capital: number;
  riskPct: number;
  /** A year from every start: typical and bad-case return, in dollars. */
  medianEnd: number;
  p10End: number;
  p90End: number;
  /** Worst fall from a high, as a share of the balance, typical. */
  medianDrawdown: number;
  /** Share of years that hit the stop-out. */
  ruin: number;
  /** Share of signals skipped because even one contract was too much risk. */
  skipped: number;
}

/** Trading your own balance: risk a percent of what's there, fewer contracts as it falls. */
export function liveYear(days: UnitDay[], capital: number, riskPct: number, price: Pricing, o: { from: number; horizon?: number; stopAt?: number }) {
  let bal = capital;
  let peak = capital;
  let dd = 0;
  let taken = 0;
  let skipped = 0;
  let ruined = false;
  const stopAt = o.stopAt ?? capital * 0.5;
  const end = Math.min(days.length, o.from + (o.horizon ?? 252));
  outer: for (let k = o.from; k < end; k++) {
    for (const t of days[k].trades) {
      const per = t.risk * price.pointValue + price.fee;
      const byMargin = price.margin ? Math.floor(bal / price.margin) : Infinity;
      const qty = Math.min(byMargin, Math.floor((bal * riskPct) / 100 / per));
      if (qty <= 0) {
        skipped++;
        continue;
      }
      taken++;
      bal += (t.points * price.pointValue - price.fee) * qty;
      peak = Math.max(peak, bal);
      dd = Math.max(dd, (peak - bal) / peak);
      if (bal <= stopAt) {
        ruined = true;
        break outer;
      }
    }
  }
  return { end: bal, drawdown: dd, taken, skipped, ruined };
}

export function liveTable(days: UnitDay[], price: Pricing, o: { capitals?: number[]; risks?: number[]; cap?: number; horizon?: number } = {}): LiveRow[] {
  const horizon = o.horizon ?? 252;
  const last = Math.max(0, days.length - horizon);
  const step = Math.max(1, Math.ceil(last / (o.cap ?? 40)));
  const rows: LiveRow[] = [];
  for (const capital of o.capitals ?? [1000, 5000, 10_000, 25_000, 50_000])
    for (const riskPct of o.risks ?? [0.5, 1, 2, 3]) {
      const years = [];
      for (let k = 0; k <= last; k += step) years.push(liveYear(days, capital, riskPct, price, { from: k, horizon }));
      const ends = years.map((y) => y.end);
      const taken = years.reduce((a, y) => a + y.taken, 0);
      const skipped = years.reduce((a, y) => a + y.skipped, 0);
      rows.push({ capital, riskPct, medianEnd: q(ends, 0.5), p10End: q(ends, 0.1), p90End: q(ends, 0.9), medianDrawdown: q(years.map((y) => y.drawdown), 0.5), ruin: years.filter((y) => y.ruined).length / Math.max(1, years.length), skipped: skipped / Math.max(1, taken + skipped) });
    }
  return rows;
}

/** The smallest balance where a typical stop fits inside the risk limit at one contract. */
export function minimumCapital(days: UnitDay[], riskPct: number, price: Pricing) {
  const risks = days.flatMap((d) => d.trades.map((t) => t.risk * price.pointValue + price.fee)).sort((a, b) => a - b);
  const typical = risks.length ? risks[risks.length >> 1] : 0;
  return { typicalRisk: typical, capital: Math.max((typical * 100) / riskPct, price.margin ?? 0) };
}

export const unitsFrom = toUnitDays;
export type { Odds };
