// ─── Payout Math ───────────────────────────────────────────────────────────────
// Pure, framework-free calculations for the Payout page. No React, no stores —
// just deterministic functions so the logic is testable and reusable.
// ───────────────────────────────────────────────────────────────────────────────

import { MICRO_POINT_VALUE } from './propFirmData';

export const TRADING_DAYS_PER_WEEK = 5;

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export const formatCurrencyCents = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

// ─── Risk / sizing ─────────────────────────────────────────────────────────────

/** Dollar risk for a futures position: contracts × $/pt × stop points. */
export const riskPerTradeFor = (symbol: string, contracts: number, stopPts: number) =>
  contracts * (MICRO_POINT_VALUE[symbol] ?? 2) * stopPts;

export const dollarsPerPoint = (symbol: string, contracts: number) =>
  contracts * (MICRO_POINT_VALUE[symbol] ?? 2);

// ─── Consistency ─────────────────────────────────────────────────────────────

/**
 * The daily ceiling implied by a consistency rule. To keep a best day at or below
 * `consistency%` of the basis, the single-day profit cap is basis × consistency%.
 *  - basis = totalProfit  → cap = target × c%  (the eventual ceiling at pass)
 *  - basis = profitTarget → cap = target × c%
 * Both reduce to target × c% at pass, which is the planning number traders use.
 */
export const consistencyDailyCeiling = (profitTarget: number, consistencyPercent: number) =>
  profitTarget * (consistencyPercent / 100);

/** Current consistency score: best day as a % of total profit (lower is safer). */
export const consistencyScore = (bestDay: number, totalProfit: number) =>
  totalProfit > 0 ? (bestDay / totalProfit) * 100 : 0;

/**
 * Minimum total profit you must reach so a given best day stays within the rule.
 * e.g. a $900 best day at a 15% rule needs $6,000 total before it qualifies.
 */
export const profitNeededForConsistency = (bestDay: number, consistencyPercent: number) =>
  consistencyPercent > 0 ? bestDay / (consistencyPercent / 100) : 0;

// ─── Expectancy ────────────────────────────────────────────────────────────────

export interface DailyExpectancy {
  winDayPnL: number;
  lossDayPnL: number;
  expectedDailyPnL: number;
}

export const dailyExpectancy = (params: {
  riskPerTrade: number;
  rewardToRisk: number;
  tradesPerDay: number;
  winRatePercent: number;
  dailyCap: number;
}): DailyExpectancy => {
  const { riskPerTrade, rewardToRisk, tradesPerDay, winRatePercent, dailyCap } = params;
  const winRate = Math.min(Math.max(winRatePercent, 1), 99) / 100;
  const rawWinDay = riskPerTrade * rewardToRisk * tradesPerDay;
  const winDayPnL = dailyCap > 0 ? Math.min(rawWinDay, dailyCap) : rawWinDay;
  const lossDayPnL = -riskPerTrade * tradesPerDay;
  const expectedDailyPnL = winRate * winDayPnL + (1 - winRate) * lossDayPnL;
  return { winDayPnL, lossDayPnL, expectedDailyPnL };
};

// ─── Path simulation ─────────────────────────────────────────────────────────

export interface SimulatedDay {
  day: number;
  result: 'win' | 'loss';
  pnl: number;
  cumulative: number;
  cushionLeft: number;
  highWaterMark: number;
}

export interface PathProjection {
  days: SimulatedDay[];
  totalDays: number;
  winDays: number;
  lossDays: number;
  reachedTarget: boolean;
  blownAccount: boolean;
  expectedDailyPnL: number;
  calendarWeeks: number;
  lossStreakToFail: number;
  usedExpectancyEstimate: boolean;
}

/** Simulate trading days, spreading wins by win rate, until payout or blow-up. */
export const simulatePath = (params: {
  startProfit: number;
  target: number;
  dailyCap: number;
  drawdownLimit: number;
  riskPerTrade: number;
  rewardToRisk: number;
  tradesPerDay: number;
  winRatePercent: number;
  consistencyPercent: number;
  highestDaySoFar: number;
  maxDays?: number;
}): PathProjection => {
  const {
    startProfit,
    target: initialTarget,
    dailyCap,
    drawdownLimit,
    riskPerTrade,
    rewardToRisk,
    tradesPerDay,
    winRatePercent,
    consistencyPercent,
    highestDaySoFar,
    maxDays = 180,
  } = params;

  const winRate = Math.min(Math.max(winRatePercent, 1), 99) / 100;
  const { winDayPnL, lossDayPnL, expectedDailyPnL } = dailyExpectancy({
    riskPerTrade,
    rewardToRisk,
    tradesPerDay,
    winRatePercent,
    dailyCap,
  });
  const lossStreakToFail =
    lossDayPnL < 0 ? Math.ceil(drawdownLimit / Math.abs(lossDayPnL)) : maxDays;

  let cumulative = startProfit;
  let highWaterMark = startProfit;
  let highestDay = highestDaySoFar;
  let effectiveTarget = initialTarget;
  const days: SimulatedDay[] = [];

  const finish = (
    totalDays: number,
    reachedTarget: boolean,
    blownAccount: boolean,
    usedExpectancyEstimate: boolean
  ): PathProjection => ({
    days,
    totalDays,
    winDays: days.filter((d) => d.result === 'win').length,
    lossDays: days.filter((d) => d.result === 'loss').length,
    reachedTarget,
    blownAccount,
    expectedDailyPnL,
    calendarWeeks: Math.ceil((totalDays / TRADING_DAYS_PER_WEEK) * 10) / 10,
    lossStreakToFail,
    usedExpectancyEstimate,
  });

  for (let day = 1; day <= maxDays; day++) {
    const isWin = Math.floor(day * winRate) > Math.floor((day - 1) * winRate);
    const pnl = isWin ? winDayPnL : lossDayPnL;

    cumulative += pnl;
    if (cumulative > highWaterMark) highWaterMark = cumulative;
    if (isWin && pnl > highestDay) {
      highestDay = pnl;
      effectiveTarget = Math.max(initialTarget, highestDay / (consistencyPercent / 100));
    }

    const cushionLeft = cumulative - (highWaterMark - drawdownLimit);
    days.push({ day, result: isWin ? 'win' : 'loss', pnl, cumulative, cushionLeft, highWaterMark });

    if (cushionLeft < 0) return finish(day, false, true, false);
    if (cumulative >= effectiveTarget) return finish(day, true, false, false);
  }

  const remaining = Math.max(0, effectiveTarget - cumulative);
  const estimatedDays =
    expectedDailyPnL > 0 ? Math.ceil(remaining / expectedDailyPnL) + days.length : maxDays;
  return finish(estimatedDays, false, false, expectedDailyPnL > 0);
};

// ─── Account scaling (1 / 3 / 5 / 10 accounts) ─────────────────────────────────

export interface ScalingRow {
  accounts: number;
  totalCost: number;
  grossPull: number;
  netProfit: number;
  roiPercent: number;
  perAccountKeep: number;
}

/** Cost vs. potential return across multiple mirrored accounts. */
export const scaleAccounts = (params: {
  counts: number[];
  pullTarget: number;
  profitSplit: number;
  keep100Upto: number;
  costPerAccount: number;
}): ScalingRow[] => {
  const { counts, pullTarget, profitSplit, keep100Upto, costPerAccount } = params;
  const split = profitSplit / 100;
  // Trader keep on a single pull: 100% up to keep100Upto, split beyond.
  const perAccountKeep =
    keep100Upto > 0
      ? Math.min(pullTarget, keep100Upto) + Math.max(0, pullTarget - keep100Upto) * split
      : pullTarget * split;

  return counts.map((accounts) => {
    const totalCost = costPerAccount * accounts;
    const grossPull = pullTarget * accounts;
    const netProfit = perAccountKeep * accounts - totalCost;
    return {
      accounts,
      totalCost,
      grossPull,
      netProfit,
      roiPercent: totalCost > 0 ? (netProfit / totalCost) * 100 : 0,
      perAccountKeep,
    };
  });
};

// ─── Micro sizing projection ───────────────────────────────────────────────────

export interface MicroDay {
  /** 1-indexed trading day. */
  day: number;
  result: 'win' | 'loss';
  pnl: number;
  cumulative: number;
  /** True on the day the goal is reached. */
  goalHit: boolean;
}

export interface MicroProjection {
  riskPerTrade: number;
  winPerTrade: number;
  winDayPnL: number;
  lossDayPnL: number;
  dollarsPerPoint: number;
  /** Optimistic: green every day at the daily aim. */
  daysToGoal: number;
  calendarWeeks: number;
  badDayBuffer: number;
  pointsForDailyAim: number;
  dailyAimFeasible: boolean;
  maxNaturalWinDay: number;
  // Realistic mixed win/loss path ──────────────────────────────
  path: MicroDay[];
  realisticDays: number;
  realisticWeeks: number;
  winDays: number;
  lossDays: number;
  reachedGoal: boolean;
  blown: boolean;
  /** Lowest cushion (relative to drawdown floor) reached along the path. */
  worstDrawdown: number;
}

/**
 * Project a disciplined micro-contract plan: how many days to reach the goal at a
 * chosen daily aim, even if it's slow. Honours the consistency ceiling.
 */
export const projectMicroPlan = (params: {
  symbol: string;
  contracts: number;
  stopPts: number;
  rewardToRisk: number;
  tradesPerDay: number;
  winRatePercent: number;
  dailyAim: number;
  dailyCap: number;
  drawdownLimit: number;
  gapToGoal: number;
  maxDays?: number;
}): MicroProjection => {
  const {
    symbol,
    contracts,
    stopPts,
    rewardToRisk,
    tradesPerDay,
    winRatePercent,
    dailyAim,
    dailyCap,
    drawdownLimit,
    gapToGoal,
    maxDays = 120,
  } = params;
  const ppp = dollarsPerPoint(symbol, contracts);
  const riskPerTrade = riskPerTradeFor(symbol, contracts, stopPts);
  const winPerTrade = riskPerTrade * rewardToRisk;
  const naturalWinDay = winPerTrade * tradesPerDay;
  const maxNaturalWinDay = dailyCap > 0 ? Math.min(naturalWinDay, dailyCap) : naturalWinDay;
  const lossDayPnL = -riskPerTrade * tradesPerDay;
  const aimCapped = dailyCap > 0 ? Math.min(dailyAim, dailyCap) : dailyAim;
  const dailyAimFeasible = aimCapped <= maxNaturalWinDay;
  // A green day takes home the daily aim (you walk away), not the theoretical max.
  const winDay = dailyAimFeasible ? aimCapped : maxNaturalWinDay;
  const daysToGoal = winDay > 0 ? Math.ceil(gapToGoal / winDay) : 0;
  const pointsForDailyAim = ppp > 0 && rewardToRisk > 0 ? Math.ceil(dailyAim / (ppp * rewardToRisk)) : 0;
  const badDayBuffer = lossDayPnL < 0 ? Math.floor(drawdownLimit / Math.abs(lossDayPnL)) : 99;

  // ── Realistic mixed path: spread losses by win rate, honour trailing DD ──
  const winRate = Math.min(Math.max(winRatePercent, 1), 99) / 100;
  const path: MicroDay[] = [];
  let cumulative = 0;
  let highWater = 0;
  let worstDrawdown = 0;
  let reachedGoal = false;
  let blown = false;

  if (winDay > 0) {
    for (let day = 1; day <= maxDays; day++) {
      const isWin = Math.floor(day * winRate) > Math.floor((day - 1) * winRate);
      const pnl = isWin ? winDay : lossDayPnL;
      cumulative += pnl;
      if (cumulative > highWater) highWater = cumulative;
      const cushion = cumulative - (highWater - drawdownLimit);
      if (cushion < worstDrawdown) worstDrawdown = cushion;
      const goalHit = cumulative >= gapToGoal;
      path.push({ day, result: isWin ? 'win' : 'loss', pnl, cumulative, goalHit });
      if (cushion < 0) {
        blown = true;
        break;
      }
      if (goalHit) {
        reachedGoal = true;
        break;
      }
    }
  }

  return {
    riskPerTrade,
    winPerTrade,
    winDayPnL: maxNaturalWinDay,
    lossDayPnL,
    dollarsPerPoint: ppp,
    daysToGoal,
    calendarWeeks: Math.ceil((daysToGoal / TRADING_DAYS_PER_WEEK) * 10) / 10,
    badDayBuffer,
    pointsForDailyAim,
    dailyAimFeasible,
    maxNaturalWinDay,
    path,
    realisticDays: path.length,
    realisticWeeks: Math.ceil((path.length / TRADING_DAYS_PER_WEEK) * 10) / 10,
    winDays: path.filter((d) => d.result === 'win').length,
    lossDays: path.filter((d) => d.result === 'loss').length,
    reachedGoal,
    blown,
    worstDrawdown,
  };
};

// ─── Daily P&L helper ──────────────────────────────────────────────────────────

export const buildDailyPnL = <T extends { date?: string; netPL: number }>(
  trades: T[]
): Record<string, number> =>
  trades.reduce((acc, trade) => {
    const date = trade.date ? trade.date.split('T')[0] : 'unknown';
    acc[date] = (acc[date] || 0) + trade.netPL;
    return acc;
  }, {} as Record<string, number>);
