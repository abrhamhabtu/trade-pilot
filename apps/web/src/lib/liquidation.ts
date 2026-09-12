// ─── The Liquidation Clock ─────────────────────────────────────────────────────
// Prop accounts rarely die from a bad strategy. They die because a trailing
// threshold crept up behind a peak the trader never looked at, and one ordinary
// loser landed underneath it.
//
// This module answers one question at all times: how much room is left, in
// dollars, in points, and in losers-you-can-still-take.
//
// Honesty note: TradePilot only ever sees CLOSED trades. For firms with an
// intraday trailing threshold, the real threshold follows unrealized peaks —
// every open-trade high we never saw pushed it higher than we can prove. So
// intraday numbers are reported as a best case and flagged as such. Never let
// the UI imply otherwise.
// ───────────────────────────────────────────────────────────────────────────────

import type { Trade } from '@/store/tradingStore';
import type { Account, BalanceAdjustment } from '@/store/accountStore';
import {
  PROP_FIRMS,
  type PropFirm,
  type FirmAccountTier,
  type DrawdownType,
} from '@/components/payout/propFirmData';
import { SESSION_INSTRUMENTS, localSessionDate } from '@/lib/sessionRisk';

export type InstrumentSymbol = keyof typeof SESSION_INSTRUMENTS;

/** Per-account drawdown rules. Resolved from the firm catalog, or set by hand. */
export interface LiquidationRules {
  firmId: string | null;
  tierId: string | null;
  /** Label shown in the UI, e.g. "Apex Trader Funding · Apex 4.0". */
  label: string;
  drawdownType: DrawdownType;
  /** Size of the buffer in dollars. */
  drawdown: number;
  /** Profit at which a trailing threshold locks. null = trails forever. */
  lockProfit: number | null;
  dailyLossLimit: number | null;
  startingBalance: number;
  /** True when we inferred the firm from the account's broker name. */
  inferred: boolean;
}

export type LiquidationStatus = 'breached' | 'danger' | 'caution' | 'safe';

export interface LiquidationState {
  rules: LiquidationRules;
  /** Current equity: starting balance + realized P&L + adjustments. */
  balance: number;
  /** The line that kills the account. */
  threshold: number;
  /** balance − threshold. Negative means already gone. */
  cushion: number;
  /** Where the threshold started life, before any trailing. */
  initialThreshold: number;
  /** How far the threshold has crept up. 0 for static accounts. */
  trailed: number;
  /** True once a trailing threshold has hit its lock and stopped moving. */
  locked: boolean;
  /** Peak the threshold is measured from. */
  peak: number;
  /** Cushion as a share of the full buffer, 0–1. */
  bufferRemaining: number;
  status: LiquidationStatus;

  /** Mean loss across losing trades, as a positive number. null if no losers. */
  avgLoss: number | null;
  /** Worst single loss, positive. null if no losers. */
  worstLoss: number | null;
  /** Whole losers of average size the cushion still absorbs. */
  lossesSurvived: number | null;
  /** Whole losers of WORST size the cushion still absorbs. */
  worstCaseLossesSurvived: number | null;

  /** Realized P&L for the current session date. */
  todayPnL: number;
  /** Room left under the daily loss limit. null when the plan has none. */
  dailyRemaining: number | null;
  /** The binding constraint right now — daily limit or the drawdown floor. */
  bindingConstraint: 'daily' | 'drawdown';
  /** Dollars to the nearest of the two. Never negative. */
  roomToStop: number;

  /** Intraday-trailing accounts are estimated from closed trades only. */
  estimated: boolean;
}

/** Points of the given instrument that `dollars` buys at `contracts` size. */
export function dollarsToPoints(
  dollars: number,
  symbol: InstrumentSymbol,
  contracts: number,
): number | null {
  const spec = SESSION_INSTRUMENTS[symbol];
  if (!spec || !Number.isFinite(dollars)) return null;
  const per = spec.pointValue * Math.max(1, contracts);
  if (!(per > 0)) return null;
  return dollars / per;
}

/** Normalizes a broker string for fuzzy matching against firm names. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Best-effort match of an account to a firm + tier.
 *
 * Broker name picks the firm; starting balance picks the tier (nearest account
 * size). Returns null when nothing plausibly matches — we would rather show no
 * clock than a confidently wrong one.
 */
export function resolveFirm(
  account: Pick<Account, 'broker' | 'startingBalance' | 'balance'>,
): { firm: PropFirm; tier: FirmAccountTier } | null {
  const broker = norm(account.broker || '');
  if (!broker) return null;

  const candidates = PROP_FIRMS.filter((f) => {
    if (f.id === 'custom') return false;
    const n = norm(f.name);
    return n === broker || n.startsWith(broker) || broker.startsWith(n);
  });
  if (!candidates.length) return null;

  // Prefer the firm's flagship program: the first entry for that name.
  const firm = candidates[0];
  const size = account.startingBalance ?? account.balance ?? 0;
  if (!firm.tiers.length) return null;

  const tier = firm.tiers.reduce((best, t) =>
    Math.abs(t.accountSize - size) < Math.abs(best.accountSize - size) ? t : best,
  );
  return { firm, tier };
}

/** Builds rules for an account, preferring anything the trader set by hand. */
export function rulesForAccount(account: Account): LiquidationRules | null {
  const override = account.liquidationRules;
  const startingBalance =
    account.startingBalance ?? (override?.startingBalance || account.balance);

  if (override && Number.isFinite(override.drawdown) && override.drawdown > 0) {
    return { ...override, startingBalance, inferred: false };
  }

  const match = resolveFirm(account);
  if (!match) return null;
  const { firm, tier } = match;

  return {
    firmId: firm.id,
    tierId: tier.id,
    label: `${firm.name} · ${firm.program}`,
    drawdownType: firm.drawdownType,
    drawdown: tier.drawdown,
    lockProfit: firm.drawdownLockProfit,
    dailyLossLimit: tier.dailyLossLimit,
    startingBalance,
    inferred: true,
  };
}

interface EquityPoint {
  date: string;
  /** Equity at the close of that date. */
  close: number;
  /** Highest running equity reached within that date, closed-trade basis. */
  intradayPeak: number;
}

/**
 * Walks trades and adjustments chronologically into a daily equity series.
 * Trades are ordered by date then time so intraday peaks are meaningful.
 */
function buildEquityCurve(
  startingBalance: number,
  trades: Trade[],
  adjustments: BalanceAdjustment[],
): { curve: EquityPoint[]; balance: number } {
  const sorted = [...trades].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.time || '').localeCompare(b.time || '');
  });

  const adjByDate = new Map<string, number>();
  for (const adj of adjustments) {
    adjByDate.set(adj.date, (adjByDate.get(adj.date) || 0) + adj.amount);
  }

  const curve: EquityPoint[] = [];
  let equity = startingBalance;
  let i = 0;

  const dates = Array.from(
    new Set([...sorted.map((t) => t.date), ...adjByDate.keys()]),
  ).sort();

  for (const date of dates) {
    let peak = equity;
    while (i < sorted.length && sorted[i].date === date) {
      equity += sorted[i].netPL;
      if (equity > peak) peak = equity;
      i += 1;
    }
    // Payouts and deposits land at the close, after the day's trading.
    equity += adjByDate.get(date) || 0;
    curve.push({ date, close: equity, intradayPeak: Math.max(peak, equity) });
  }

  return { curve, balance: equity };
}

/**
 * The threshold that liquidates the account.
 *
 * static        — fixed at start − buffer, forever.
 * trailing-eod  — trails the highest DAILY CLOSE, then locks.
 * trailing-intraday — trails the highest equity touched at any moment. We can
 *                 only see closed-trade highs, so this is a floor on the truth.
 */
function computeThreshold(
  rules: LiquidationRules,
  curve: EquityPoint[],
): { threshold: number; peak: number; locked: boolean } {
  const initial = rules.startingBalance - rules.drawdown;
  if (rules.drawdownType === 'static') {
    return { threshold: initial, peak: rules.startingBalance, locked: true };
  }

  const useIntraday = rules.drawdownType === 'trailing-intraday';
  let peak = rules.startingBalance;
  for (const p of curve) {
    const high = useIntraday ? p.intradayPeak : p.close;
    if (high > peak) peak = high;
  }

  const trailed = peak - rules.drawdown;
  const ceiling =
    rules.lockProfit === null
      ? Number.POSITIVE_INFINITY
      : rules.startingBalance + rules.lockProfit;

  const threshold = Math.min(Math.max(trailed, initial), ceiling);
  return { threshold, peak, locked: trailed >= ceiling };
}

function statusFor(bufferRemaining: number, cushion: number): LiquidationStatus {
  if (cushion <= 0) return 'breached';
  if (bufferRemaining <= 0.2) return 'danger';
  if (bufferRemaining <= 0.45) return 'caution';
  return 'safe';
}

export interface LiquidationOptions {
  /** Session date to treat as "today". Defaults to the local date. */
  today?: string;
  /** The trader's own daily stop, if tighter than the firm's. */
  personalDailyLimit?: number | null;
}

/** Computes the full clock state, or null when the account has no known rules. */
export function computeLiquidation(
  account: Account,
  options: LiquidationOptions = {},
): LiquidationState | null {
  const rules = rulesForAccount(account);
  if (!rules || !(rules.drawdown > 0)) return null;

  const today = options.today ?? localSessionDate();
  const trades = account.trades || [];
  const { curve, balance } = buildEquityCurve(
    rules.startingBalance,
    trades,
    account.balanceAdjustments || [],
  );

  const { threshold, peak, locked } = computeThreshold(rules, curve);
  const initialThreshold = rules.startingBalance - rules.drawdown;
  const cushion = balance - threshold;
  const bufferRemaining =
    rules.drawdown > 0 ? Math.max(0, Math.min(1, cushion / rules.drawdown)) : 0;

  const losses = trades.filter((t) => t.netPL < 0).map((t) => Math.abs(t.netPL));
  const avgLoss = losses.length
    ? losses.reduce((a, b) => a + b, 0) / losses.length
    : null;
  const worstLoss = losses.length ? Math.max(...losses) : null;

  const todayPnL = trades
    .filter((t) => t.date === today)
    .reduce((sum, t) => sum + t.netPL, 0);

  const firmLimit = rules.dailyLossLimit;
  const personal = options.personalDailyLimit ?? null;
  const effectiveLimit =
    firmLimit !== null && personal !== null
      ? Math.min(firmLimit, personal)
      : firmLimit ?? personal;

  const dailyRemaining =
    effectiveLimit !== null ? Math.max(0, effectiveLimit + Math.min(0, todayPnL)) : null;

  const safeCushion = Math.max(0, cushion);
  const bindingConstraint: 'daily' | 'drawdown' =
    dailyRemaining !== null && dailyRemaining < safeCushion ? 'daily' : 'drawdown';
  const roomToStop =
    bindingConstraint === 'daily' ? (dailyRemaining as number) : safeCushion;

  return {
    rules,
    balance,
    threshold,
    cushion,
    initialThreshold,
    trailed: Math.max(0, threshold - initialThreshold),
    locked,
    peak,
    bufferRemaining,
    status: statusFor(bufferRemaining, cushion),
    avgLoss,
    worstLoss,
    lossesSurvived: avgLoss && avgLoss > 0 ? Math.floor(safeCushion / avgLoss) : null,
    worstCaseLossesSurvived:
      worstLoss && worstLoss > 0 ? Math.floor(safeCushion / worstLoss) : null,
    todayPnL,
    dailyRemaining,
    bindingConstraint,
    roomToStop,
    estimated: rules.drawdownType === 'trailing-intraday',
  };
}

/** Short human sentence for the clock. Kept blunt on purpose. */
export function liquidationHeadline(state: LiquidationState): string {
  if (state.cushion <= 0) return 'Account is past its threshold.';
  if (state.lossesSurvived === 0) return 'One average loser ends this account.';
  if (state.lossesSurvived !== null && state.lossesSurvived <= 2) {
    return `You survive ${state.lossesSurvived} more average losers.`;
  }
  if (state.bindingConstraint === 'daily') {
    return 'Your daily limit bites before the drawdown does.';
  }
  return `You survive ${state.lossesSurvived ?? '—'} more average losers.`;
}
