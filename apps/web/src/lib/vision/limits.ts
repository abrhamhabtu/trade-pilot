// The trader's own limits: how much a trade may risk, by market and account type,
// and when they can actually trade. Studies, Autopilot, strategy runs and replay
// all read these, so no plan can recommend a size the trader has ruled out.

export interface RiskLimits {
  /** Largest risk per trade as a share of the drawdown, in percent. Evaluations may run hotter, so that can be tested. */
  evalPct: number;
  fundedPct: number;
  /** Tighter caps by market; the lower of this and the account's cap applies. */
  perMarket: Record<string, number>;
  /** Live money: largest risk per trade as a percent of the balance. */
  livePct: number;
  /** The consistency rule to assume on funded accounts: best day at most this share of profit. 100 = none. */
  fundedConsistencyPct: number;
  /** New York minutes when entries can be taken; null = any time. */
  hours: [number, number] | null;
  /** Weekdays that can be traded, 1 = Monday. */
  weekdays: number[];
  /** Skip these days when choosing and running plans. */
  skipNews: { cpi: boolean; jobs: boolean; fomc: boolean };
}

export const DEFAULT_LIMITS: RiskLimits = { evalPct: 30, fundedPct: 20, perMarket: { GC: 10 }, livePct: 2, fundedConsistencyPct: 20, hours: null, weekdays: [1, 2, 3, 4, 5], skipNews: { cpi: false, jobs: false, fomc: false } };

export const riskCap = (l: RiskLimits, symbol: string, phase: "eval" | "funded" | "live") => Math.min(phase === "eval" ? l.evalPct : phase === "funded" ? l.fundedPct : 100, l.perMarket[symbol] ?? 100) / 100;

/** Changes here change what every study can recommend. */
export const limitsKey = (l: RiskLimits) => JSON.stringify([l.evalPct, l.fundedPct, l.perMarket, l.livePct, l.fundedConsistencyPct, l.hours, l.weekdays, l.skipNews]);

/** Day margin per contract, a common broker figure. Yours may differ. */
export const DAY_MARGIN: Record<string, { micro: number; full: number }> = { NQ: { micro: 100, full: 1000 }, ES: { micro: 50, full: 500 }, GC: { micro: 100, full: 1000 }, CL: { micro: 50, full: 500 } };

/** Round-trip cost per contract, an estimate of commissions and exchange fees. */
export const FEES = { micro: 1.04, full: 3.64 };
