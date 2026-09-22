// ─── Pass odds ─────────────────────────────────────────────────────────────────
// How likely is this trader, trading the way they actually trade, to pass a
// given evaluation before blowing it?
//
// Method: bootstrap. Take the trader's real daily results, draw days from them
// at random (with replacement), and walk each drawn path through the firm's
// rules — trailing threshold, daily loss limit, consistency, minimum days —
// until it passes, blows, or runs out of time. Thousands of paths give a
// probability.
//
// Honest limits, surfaced in the UI:
//   • Days are drawn independently. Streaks and tilt are only as present as
//     they were in the sample, and never clustered.
//   • Only closed-trade daily results are known, so intraday trailing is
//     modelled at the close. Real intraday odds are worse.
//   • The past is a sample, not a promise. Fewer than ~20 days is thin.
// ───────────────────────────────────────────────────────────────────────────────

import type { Account } from '@/store/accountStore';
import type { DrawdownType, FirmAccountTier, PropFirm } from '@/components/payout/propFirmData';
import { PROP_FIRMS } from '@/components/payout/propFirmData';
import { rulesForAccount } from '@/lib/liquidation';

export const MIN_SAMPLE_DAYS = 10;

export interface OddsRules {
  startingBalance: number;
  drawdown: number;
  drawdownType: DrawdownType;
  /** Profit at which a trailing threshold locks. null = never. */
  lockProfit: number | null;
  dailyLossLimit: number | null;
  profitTarget: number;
  /** Best day as a % of the basis. 100+ means no rule. */
  consistencyPercent: number;
  minTradingDays: number;
}

/** Where an account already stands, to simulate the rest of it. */
export interface OddsStart {
  /** Profit so far, relative to the starting balance. */
  profit: number;
  /** Highest closing profit so far. */
  peakProfit: number;
  days: number;
  bestDay: number;
}

export interface OddsOptions {
  runs?: number;
  /** Trading days before a path counts as running out of time. */
  maxDays?: number;
  /** Multiplies every sampled day — trading bigger or smaller than history. */
  riskScale?: number;
  seed?: number;
  start?: OddsStart;
}

export interface OddsResult {
  runs: number;
  pass: number;
  blow: number;
  timeout: number;
  /** Days to pass, among passing paths. null when nothing passed. */
  medianDays: number | null;
  p25Days: number | null;
  p75Days: number | null;
  /** Mean trading days until the path ended, any outcome. Prices monthly fees. */
  meanDaysUsed: number;
  /** True when the threshold is intraday but we can only model it at the close. */
  optimistic: boolean;
}

/** Small, fast, seeded PRNG so the same inputs always give the same odds. */
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

const quantile = (sorted: number[], q: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null;

export function simulateOdds(samples: number[], rules: OddsRules, options: OddsOptions = {}): OddsResult {
  const runs = options.runs ?? 2000;
  const maxDays = options.maxDays ?? 60;
  const scale = options.riskScale ?? 1;
  const rand = mulberry32(options.seed ?? 7);
  const start = options.start ?? { profit: 0, peakProfit: 0, days: 0, bestDay: 0 };

  const floor = -rules.drawdown;
  const ceiling = rules.lockProfit === null ? Number.POSITIVE_INFINITY : rules.lockProfit;
  const consistency = rules.consistencyPercent > 0 && rules.consistencyPercent < 100 ? rules.consistencyPercent / 100 : null;

  let pass = 0;
  let blow = 0;
  let usedTotal = 0;
  const passDays: number[] = [];

  if (!samples.length || !(rules.drawdown > 0)) {
    return { runs: 0, pass: 0, blow: 0, timeout: 0, medianDays: null, p25Days: null, p75Days: null, meanDaysUsed: 0, optimistic: false };
  }

  for (let r = 0; r < runs; r++) {
    let profit = start.profit;
    let peak = Math.max(start.peakProfit, 0);
    let best = start.bestDay;
    let days = start.days;
    let outcome: 'pass' | 'blow' | null = null;
    let used = 0;

    while (used < maxDays) {
      let day = samples[Math.floor(rand() * samples.length)] * scale;
      if (rules.dailyLossLimit !== null && day < -rules.dailyLossLimit) day = -rules.dailyLossLimit;

      // The line that ends the account, measured relative to the starting balance.
      const threshold =
        rules.drawdownType === 'static' ? floor : Math.min(Math.max(peak - rules.drawdown, floor), ceiling);

      profit += day;
      days += 1;
      used += 1;
      if (profit <= threshold) {
        outcome = 'blow';
        break;
      }
      if (profit > peak) peak = profit;
      if (day > best) best = day;

      const needed = consistency ? Math.max(rules.profitTarget, best / consistency) : rules.profitTarget;
      if (profit >= needed && days >= rules.minTradingDays) {
        outcome = 'pass';
        break;
      }
    }

    usedTotal += used;
    if (outcome === 'pass') {
      pass += 1;
      passDays.push(used);
    } else if (outcome === 'blow') blow += 1;
  }

  passDays.sort((a, b) => a - b);
  return {
    runs,
    pass: pass / runs,
    blow: blow / runs,
    timeout: (runs - pass - blow) / runs,
    medianDays: quantile(passDays, 0.5),
    p25Days: quantile(passDays, 0.25),
    p75Days: quantile(passDays, 0.75),
    meanDaysUsed: usedTotal / runs,
    optimistic: rules.drawdownType === 'trailing-intraday',
  };
}

// ─── Samples ─────────────────────────────────────────────────────────────────

/** One sample per account per trading day. Accounts are never summed together. */
export function dailySamples(accounts: Account[]): number[] {
  const out: number[] = [];
  for (const a of accounts) {
    const byDay = new Map<string, number>();
    for (const t of a.trades ?? []) {
      const d = (t.date || '').slice(0, 10);
      if (!d) continue;
      byDay.set(d, (byDay.get(d) ?? 0) + t.netPL);
    }
    out.push(...byDay.values());
  }
  return out;
}

// ─── Firms ───────────────────────────────────────────────────────────────────

export function rulesFromFirm(firm: PropFirm, tier: FirmAccountTier): OddsRules {
  return {
    startingBalance: tier.accountSize,
    drawdown: tier.drawdown,
    drawdownType: firm.drawdownType,
    lockProfit: firm.drawdownLockProfit,
    dailyLossLimit: tier.dailyLossLimit,
    profitTarget: tier.profitTarget,
    consistencyPercent: firm.consistencyPercent,
    minTradingDays: firm.minTradingDays,
  };
}

export interface FirmOdds {
  firm: PropFirm;
  tier: FirmAccountTier;
  odds: OddsResult;
  /** Fees for one attempt, counting monthly renewals for the days it runs. */
  costPerAttempt: number;
  /** Expected fees spent for each pass. null when it never passes. */
  costPerPass: number | null;
}

const TRADING_DAYS_PER_MONTH = 21;

export function costPerAttempt(firm: PropFirm, tier: FirmAccountTier, meanDaysUsed: number): number {
  if (firm.costCadence === 'one-time') return tier.cost;
  return tier.cost * Math.max(1, Math.ceil(meanDaysUsed / TRADING_DAYS_PER_MONTH));
}

/** Every evaluation program and size, ranked by what a pass costs you. */
export function compareFirms(samples: number[], options: OddsOptions = {}): FirmOdds[] {
  const rows: FirmOdds[] = [];
  for (const firm of PROP_FIRMS) {
    if (firm.id === 'custom' || firm.payoutModel !== 'eval') continue;
    for (const tier of firm.tiers) {
      const odds = simulateOdds(samples, rulesFromFirm(firm, tier), { runs: 1200, ...options });
      const cpa = costPerAttempt(firm, tier, odds.meanDaysUsed);
      rows.push({ firm, tier, odds, costPerAttempt: cpa, costPerPass: odds.pass > 0 ? cpa / odds.pass : null });
    }
  }
  return rows.sort((a, b) => {
    if (a.costPerPass === null) return 1;
    if (b.costPerPass === null) return -1;
    return a.costPerPass - b.costPerPass;
  });
}

export const RISK_SCALES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** The same program at different sizes. Bigger passes faster and blows more. */
export function riskSweep(samples: number[], rules: OddsRules, options: OddsOptions = {}) {
  return RISK_SCALES.map((riskScale) => ({ riskScale, odds: simulateOdds(samples, rules, { ...options, riskScale }) }));
}

/**
 * Pass-rate gap a different size must beat current size by before we suggest
 * it. At 2,000 paths one standard error is about a point, so three points is a
 * real difference and not simulation noise.
 */
export const MEANINGFUL_EDGE = 0.03;

/** The size worth switching to, or 1 when nothing beats current size by a real margin. */
export function bestRiskScale(sweep: ReturnType<typeof riskSweep>): number {
  const now = sweep.find((r) => r.riskScale === 1);
  if (!now) return 1;
  const top = sweep.reduce((best, row) => (row.odds.pass > best.odds.pass ? row : best), now);
  return top.odds.pass >= now.odds.pass + MEANINGFUL_EDGE ? top.riskScale : 1;
}

// ─── Accounts ────────────────────────────────────────────────────────────────

/** Odds for an evaluation account in progress, from where it stands today. */
export function accountPassOdds(account: Account, fallbackSamples: number[]): OddsResult | null {
  if (account.isFunded !== false || account.status !== 'active') return null;
  const rules = rulesForAccount(account);
  if (!rules) return null;
  const target = account.profitTarget ?? null;
  if (!target || target <= 0) return null;

  const own = dailySamples([account]);
  const samples = own.length >= MIN_SAMPLE_DAYS ? own : fallbackSamples;
  if (samples.length < MIN_SAMPLE_DAYS) return null;

  const firm = rules.firmId ? PROP_FIRMS.find((f) => f.id === rules.firmId) : undefined;
  const days = own.length;
  let profit = 0;
  let peak = 0;
  let best = 0;
  const byDay = new Map<string, number>();
  for (const t of account.trades) byDay.set(t.date.slice(0, 10), (byDay.get(t.date.slice(0, 10)) ?? 0) + t.netPL);
  for (const [, v] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    profit += v;
    if (profit > peak) peak = profit;
    if (v > best) best = v;
  }

  return simulateOdds(
    samples,
    {
      startingBalance: rules.startingBalance,
      drawdown: rules.drawdown,
      drawdownType: rules.drawdownType,
      lockProfit: rules.lockProfit,
      dailyLossLimit: rules.dailyLossLimit,
      profitTarget: target,
      consistencyPercent: account.consistencyRulePercentage ?? firm?.consistencyPercent ?? 100,
      minTradingDays: firm?.minTradingDays ?? 1,
    },
    { runs: 1000, start: { profit, peakProfit: peak, days, bestDay: best } },
  );
}
