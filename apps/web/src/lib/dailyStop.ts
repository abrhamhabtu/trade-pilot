// ─── The daily stop ────────────────────────────────────────────────────────────
// Most funded accounts do not die on a losing day. They die on the day after a
// good one, or they get held at payout because one day was too good. This
// module answers "should I still be trading today?" with four hard lines:
//
//   loss         — today's loss reached the tightest limit in play
//   goal         — today's profit reached the target set in Preflight
//   consistency  — one more dollar today and the best day breaks the firm's rule
//   trades / time — the count or the clock the trader committed to
//
// Any one of them means done for the day. Approaching the goal or the
// consistency ceiling (80%) raises a warning first.
// ───────────────────────────────────────────────────────────────────────────────

import type { Account } from '@/store/accountStore';
import { getFirmById, PROP_FIRMS } from '@/components/payout/propFirmData';
import { resolveFirm, rulesForAccount } from '@/lib/liquidation';

export type StopKind = 'loss' | 'goal' | 'consistency' | 'trades' | 'time';

export interface StopReason {
  kind: StopKind;
  text: string;
}

export interface DayPlanLimits {
  maxLoss?: number | null;
  maxProfit?: number | null;
  maxTrades?: number | null;
  /** "HH:MM", 24-hour, local time. */
  stopTime?: string;
}

export interface DailyStop {
  stopped: boolean;
  reasons: StopReason[];
  /** Close to a line but not over it. null when nothing is close. */
  warning: StopReason | null;
  todayPnL: number;
  tradesToday: number;
  /** Most today can make before the consistency rule breaks. null when no rule applies. */
  consistencyCeiling: number | null;
  /** The loss limit in force today: the tightest of the plan, the account and the firm. */
  lossLimit: number | null;
  profitGoal: number | null;
}

const WARN_AT = 0.8;
const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`;

function lastPayoutDate(account: Account): string | null {
  const dates = (account.balanceAdjustments ?? []).filter((a) => a.type === 'payout').map((a) => a.date);
  return dates.length ? dates.sort().at(-1)! : null;
}

/**
 * Most today can earn before the best day breaks the consistency rule.
 *
 * profitTarget basis: best day ≤ p × target.
 * totalProfit basis:  best day ≤ p × total profit. Today alone needs
 *   today ≤ p × (prior + today), i.e. today ≤ p × prior / (1 − p). Early in a
 *   cycle that is tiny and the rule is only checked at payout, so the ceiling
 *   never drops below the planning number p × target.
 */
export function consistencyCeiling(account: Account, today: string): number | null {
  const rules = rulesForAccount(account);
  const firm = rules?.firmId ? PROP_FIRMS.find((f) => f.id === rules.firmId) : resolveFirm(account)?.firm;
  const pct = account.consistencyRulePercentage ?? firm?.consistencyPercent;
  if (!pct || pct >= 100) return null;
  const p = pct / 100;

  const tier = firm && rules?.tierId ? getFirmById(firm.id).tiers.find((t) => t.id === rules.tierId) : undefined;
  const target = account.profitTarget ?? tier?.profitTarget ?? null;
  const planning = target ? p * target : null;

  if (firm?.consistencyBasis === 'profitTarget') return planning;

  const since = lastPayoutDate(account);
  const prior = account.trades
    .filter((t) => t.date < today && (!since || t.date > since))
    .reduce((n, t) => n + t.netPL, 0);
  const running = prior > 0 ? (p * prior) / (1 - p) : 0;
  const ceiling = Math.max(running, planning ?? 0);
  return ceiling > 0 ? ceiling : null;
}

function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function evaluateDailyStop(
  account: Account,
  today: string,
  plan: DayPlanLimits = {},
  now: Date = new Date(),
): DailyStop {
  const todays = account.trades.filter((t) => t.date.slice(0, 10) === today);
  const todayPnL = todays.reduce((n, t) => n + t.netPL, 0);
  const tradesToday = todays.length;

  const firmDll = rulesForAccount(account)?.dailyLossLimit ?? null;
  const limits = [plan.maxLoss, account.personalDailyLimit, firmDll].filter(
    (v): v is number => typeof v === 'number' && v > 0,
  );
  const lossLimit = limits.length ? Math.min(...limits) : null;
  const profitGoal = plan.maxProfit && plan.maxProfit > 0 ? plan.maxProfit : null;
  const ceiling = consistencyCeiling(account, today);

  const reasons: StopReason[] = [];
  if (lossLimit !== null && todayPnL <= -lossLimit) {
    reasons.push({ kind: 'loss', text: `Down ${money(todayPnL)} against a ${money(lossLimit)} daily stop.` });
  }
  if (profitGoal !== null && todayPnL >= profitGoal) {
    reasons.push({ kind: 'goal', text: `Up ${money(todayPnL)}: today's ${money(profitGoal)} goal is in.` });
  }
  if (ceiling !== null && todayPnL >= ceiling) {
    reasons.push({
      kind: 'consistency',
      text: `Up ${money(todayPnL)}. More today and this becomes a day the consistency rule holds your payout over (cap ${money(ceiling)}).`,
    });
  }
  if (plan.maxTrades && plan.maxTrades > 0 && tradesToday >= plan.maxTrades) {
    reasons.push({ kind: 'trades', text: `${tradesToday} trade${tradesToday === 1 ? '' : 's'} taken of the ${plan.maxTrades} you allowed yourself.` });
  }
  const stopAt = plan.stopTime ? minutesOf(plan.stopTime) : null;
  if (stopAt !== null && now.getHours() * 60 + now.getMinutes() >= stopAt) {
    reasons.push({ kind: 'time', text: `It is past ${plan.stopTime}, the time you said you would stop.` });
  }

  let warning: StopReason | null = null;
  if (!reasons.length && todayPnL > 0) {
    const near = [
      ceiling !== null ? { kind: 'consistency' as const, line: ceiling, what: 'the consistency cap' } : null,
      profitGoal !== null ? { kind: 'goal' as const, line: profitGoal, what: "today's goal" } : null,
    ]
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.line - b.line)[0];
    if (near && todayPnL >= WARN_AT * near.line) {
      warning = { kind: near.kind, text: `${money(near.line - todayPnL)} from ${near.what}. Tighten up or finish.` };
    }
  }

  return { stopped: reasons.length > 0, reasons, warning, todayPnL, tradesToday, consistencyCeiling: ceiling, lossLimit, profitGoal };
}
