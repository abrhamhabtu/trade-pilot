// ─── Account pulse ─────────────────────────────────────────────────────────────
// A journal answers "how did I trade?". A prop trader's first question is
// different: "how close am I to losing this account, and how close to being
// paid?". This module gathers the engines that already answer pieces of that
// (the liquidation clock, the payout schedule, the firm's fine print) into one
// read per account, so the dashboard and the Rulebook say the same thing.
//
// Nothing here invents a rule. Where the firm is unknown a section is null and
// the UI says so.
// ───────────────────────────────────────────────────────────────────────────────

import type { Account } from '@/store/accountStore';
import type { FirmAccountTier, PropFirm } from '@/components/payout/propFirmData';
import { PROP_FIRMS } from '@/components/payout/propFirmData';
import { computeLiquidation, resolveFirm, rulesForAccount, type LiquidationState } from '@/lib/liquidation';
import { payoutWindow, type PayoutWindow } from '@/lib/payoutSchedule';
import { firmWarningsFor } from '@/lib/firmWarnings';
import type { PreflightReason } from '@/lib/preflight';
import { localSessionDate } from '@/lib/sessionRisk';

export type PulseTone = 'good' | 'warn' | 'bad' | 'idle';
export type PulseStage = 'funded' | 'evaluation' | 'unknown';

export interface ConsistencyPulse {
  /** The firm's cap: best day must stay at or under this % of the basis. */
  limitPct: number;
  /** What the cap is measured against. */
  basis: 'profitTarget' | 'totalProfit';
  basisAmount: number;
  bestDay: number;
  /** Best day as a % of the basis. Can run past the limit. */
  sharePct: number;
  /** Dollars the best day may be. */
  cap: number;
  ok: boolean;
}

export interface TargetPulse {
  profit: number;
  target: number;
  toGo: number;
  /** 0–1. */
  progress: number;
}

export interface PulseVerdict {
  tone: PulseTone;
  title: string;
  detail: string;
}

export interface AccountPulse {
  account: Account;
  firm: PropFirm | null;
  tier: FirmAccountTier | null;
  stage: PulseStage;
  closed: boolean;
  liq: LiquidationState | null;
  consistency: ConsistencyPulse | null;
  /** Evaluations chase a target… */
  target: TargetPulse | null;
  /** …funded accounts wait on a payout window. */
  payout: PayoutWindow | null;
  warnings: PreflightReason[];
  verdict: PulseVerdict;
}

const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`;

function consistencyFor(account: Account, firm: PropFirm | null, tier: FirmAccountTier | null): ConsistencyPulse | null {
  const limitPct = account.consistencyRulePercentage ?? firm?.consistencyPercent ?? 0;
  if (!(limitPct > 0) || limitPct >= 100) return null;

  // Consistency is judged on the current cycle: everything since the last payout.
  const lastPayout =
    (account.balanceAdjustments ?? [])
      .filter((a) => a.type === 'payout')
      .map((a) => a.date)
      .sort()
      .at(-1) ?? null;
  const byDay = new Map<string, number>();
  for (const t of account.trades) {
    const d = t.date.slice(0, 10);
    if (lastPayout && d <= lastPayout) continue;
    byDay.set(d, (byDay.get(d) ?? 0) + t.netPL);
  }
  const days = [...byDay.values()];
  const cycleProfit = days.reduce((a, b) => a + b, 0);
  const bestDay = days.length ? Math.max(0, ...days) : 0;

  const basis: ConsistencyPulse['basis'] = account.consistencyBasis
    ? account.consistencyBasis === 'profitTarget'
      ? 'profitTarget'
      : 'totalProfit'
    : firm?.consistencyBasis ?? 'totalProfit';
  const target = account.profitTarget ?? tier?.profitTarget ?? 0;
  const basisAmount = basis === 'profitTarget' ? target : Math.max(0, cycleProfit);
  if (!(basisAmount > 0)) return null;

  const sharePct = (bestDay / basisAmount) * 100;
  return {
    limitPct,
    basis,
    basisAmount,
    bestDay,
    sharePct,
    cap: (limitPct / 100) * basisAmount,
    ok: sharePct <= limitPct,
  };
}

/**
 * The one line at the top of the dashboard. Order matters: the first condition
 * that holds wins, so the list runs from "account over" down to "all clear".
 * Tune the wording or the order here and every surface follows.
 */
export function pulseVerdict(p: Omit<AccountPulse, 'verdict'>): PulseVerdict {
  const { liq, payout, target, consistency, account } = p;
  const firmName = p.firm?.name ?? account.broker ?? 'the firm';

  if (p.closed) return { tone: 'bad', title: 'This account is closed out', detail: 'Kept for the record. Nothing here can be traded.' };
  if (!liq) return { tone: 'idle', title: 'No firm rules on this account', detail: 'Pick a firm or set the drawdown by hand to track its limits.' };
  if (liq.cushion <= 0) return { tone: 'bad', title: 'Past the liquidation line', detail: `Equity is under the level ${firmName} closes accounts at.` };
  if (liq.dailyRemaining !== null && liq.dailyRemaining <= 0) {
    return { tone: 'bad', title: 'Daily stop hit. Done for today', detail: 'The day’s loss budget is spent. The account is still alive; keep it that way.' };
  }
  if (liq.lossesSurvived !== null && liq.lossesSurvived <= 1) {
    return { tone: 'bad', title: liq.lossesSurvived === 0 ? 'One average loser ends this account' : 'Two average losers end this account', detail: `${money(liq.roomToStop)} of room left. Trade the smallest size you have, or sit out.` };
  }
  if (liq.status === 'danger') return { tone: 'bad', title: 'Thin cushion', detail: `${money(liq.cushion)} above the line, under a fifth of the buffer. Size down.` };
  if (consistency && !consistency.ok) {
    return { tone: 'warn', title: 'Best day is over the consistency cap', detail: `${money(consistency.bestDay)} against a ${money(consistency.cap)} cap. Smaller green days bring it back in line.` };
  }
  if (payout?.status === 'ready') {
    return { tone: 'good', title: 'Payout window is open', detail: `About ${money(payout.afterSplit)} reaches you after the split. Confirm on ${firmName}’s dashboard.` };
  }
  if (liq.status === 'caution') return { tone: 'warn', title: 'Cushion under half', detail: `${money(liq.cushion)} above the line. Keep risk per trade small.` };
  if (target && target.progress >= 0.8 && target.toGo > 0) {
    return { tone: 'good', title: `${money(target.toGo)} from the target`, detail: 'Close enough that protecting it matters more than pushing.' };
  }
  return { tone: 'good', title: 'Clear to trade', detail: `${money(liq.roomToStop)} of room before ${liq.bindingConstraint === 'daily' ? 'today’s stop' : 'the liquidation line'}.` };
}

export function accountPulse(account: Account, today: string = localSessionDate()): AccountPulse {
  const rules = rulesForAccount(account);
  const match = resolveFirm(account);
  const firm = (rules?.firmId ? PROP_FIRMS.find((f) => f.id === rules.firmId) : undefined) ?? match?.firm ?? null;
  const tier = (firm && rules?.tierId ? firm.tiers.find((t) => t.id === rules.tierId) : undefined) ?? match?.tier ?? null;

  const liq = computeLiquidation(account, { today, personalDailyLimit: account.personalDailyLimit ?? null });
  const stage: PulseStage = account.isFunded === undefined ? 'unknown' : account.isFunded ? 'funded' : 'evaluation';
  const closed = account.status === 'blown';

  let target: TargetPulse | null = null;
  const goal = account.profitTarget ?? tier?.profitTarget ?? 0;
  if (!closed && stage !== 'funded' && goal > 0) {
    const start = rules?.startingBalance ?? account.startingBalance ?? 0;
    const profit = liq ? liq.balance - start : account.trades.reduce((n, t) => n + t.netPL, 0);
    target = { profit, target: goal, toGo: Math.max(0, goal - profit), progress: Math.max(0, Math.min(1, profit / goal)) };
  }

  const base: Omit<AccountPulse, 'verdict'> = {
    account,
    firm,
    tier,
    stage,
    closed,
    liq,
    consistency: consistencyFor(account, firm, tier),
    target,
    payout: closed ? null : payoutWindow(account, today),
    warnings: closed ? [] : firmWarningsFor(account, today),
  };
  return { ...base, verdict: pulseVerdict(base) };
}
