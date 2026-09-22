// ─── Payout schedule ───────────────────────────────────────────────────────────
// For every funded account: can it request a payout today, and if not, what is
// in the way and when is the earliest it could? Run five accounts and payout
// windows slip by unnoticed; this puts them in one list.
//
// Built from the firm catalog and its fine print. Where a firm's rule is not
// known we leave that check out rather than invent one, and the amount is an
// estimate to confirm on the firm's dashboard before requesting.
// ───────────────────────────────────────────────────────────────────────────────

import type { Account } from '@/store/accountStore';
import { finePrintFor, minDayProfitFor } from '@/components/payout/firmFinePrint';
import { resolveFirm } from '@/lib/liquidation';

export type PayoutStatus = 'ready' | 'waiting' | 'held' | 'maxed';

export interface Blocker {
  kind: 'days' | 'profit' | 'consistency' | 'safety-net' | 'max-payouts';
  text: string;
}

export interface PayoutWindow {
  accountId: string;
  accountName: string;
  firmName: string;
  status: PayoutStatus;
  blockers: Blocker[];
  /** Profit since the last payout. */
  cycleProfit: number;
  /** Largest request the rules allow right now, before the split. */
  requestable: number;
  /** What would reach the trader after the split. */
  afterSplit: number;
  /** Earliest date the day-count rule could be met, if every day qualifies. null when days are not what blocks it. */
  earliestDate: string | null;
  /** How far through the day requirement, for a progress bar. */
  days: { have: number; need: number; qualifyingProfit: number | null };
  payoutsTaken: number;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`;

/** The date `n` weekdays after `from` (not counting `from`). */
export function addTradingDays(from: string, n: number): string {
  const d = new Date(`${from}T12:00:00`);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return ymd(d);
}

export function payoutWindow(account: Account, today: string): PayoutWindow | null {
  if (account.isFunded !== true || account.status !== 'active') return null;
  const match = resolveFirm(account);
  if (!match) return null;
  const { firm, tier } = match;
  const fp = finePrintFor(firm.id);

  const payouts = (account.balanceAdjustments ?? []).filter((a) => a.type === 'payout');
  const lastPayout = payouts.map((p) => p.date).sort().at(-1) ?? null;
  const paidSoFar = payouts.reduce((n, p) => n + Math.abs(p.amount), 0);

  const byDay = new Map<string, number>();
  for (const t of account.trades) {
    const d = t.date.slice(0, 10);
    if (lastPayout && d <= lastPayout) continue;
    byDay.set(d, (byDay.get(d) ?? 0) + t.netPL);
  }
  const dayValues = [...byDay.values()];
  const cycleProfit = dayValues.reduce((a, b) => a + b, 0);
  const bestDay = dayValues.length ? Math.max(0, ...dayValues) : 0;
  const lifetimeProfit = account.trades.reduce((n, t) => n + t.netPL, 0) - paidSoFar;

  const blockers: Blocker[] = [];

  // Days: qualifying winning days when the firm counts them, otherwise trading days.
  const qualifying = minDayProfitFor(fp, tier.id);
  const need = fp?.payoutDays?.value.count ?? firm.minTradingDays;
  const have =
    fp?.payoutDays !== undefined
      ? dayValues.filter((v) => v >= (qualifying ?? 0.01)).length
      : dayValues.length;
  let earliestDate: string | null = null;
  if (have < need) {
    const short = need - have;
    earliestDate = addTradingDays(today, short);
    blockers.push({
      kind: 'days',
      text:
        fp?.payoutDays !== undefined
          ? `${have} of ${need} winning days${qualifying ? ` of ${money(qualifying)}+` : ''} this cycle.`
          : `${have} of ${need} trading days this cycle.`,
    });
  }

  // How much could come out. A safety net holds back drawdown + a fixed amount.
  const net = fp?.safetyNetOverDrawdown;
  let withdrawable = Math.max(0, cycleProfit);
  if (net !== undefined) {
    const floor = tier.drawdown + net;
    withdrawable = Math.max(0, Math.min(withdrawable, lifetimeProfit - floor));
    if (withdrawable <= 0 && cycleProfit > 0) {
      blockers.push({ kind: 'safety-net', text: `Profit has to clear ${money(floor)} (drawdown + ${money(net)}) before anything can come out.` });
    }
  }
  const cap = fp?.payoutCaps?.value[tier.id];
  const requestable = cap !== undefined ? Math.min(withdrawable, cap) : withdrawable;

  const minPayout = fp?.minPayout?.value ?? 0;
  if (cycleProfit <= 0) {
    blockers.push({ kind: 'profit', text: `Cycle is ${cycleProfit < 0 ? `down ${money(cycleProfit)}` : 'flat'}. It needs to be positive.` });
  } else if (requestable < minPayout && !blockers.some((b) => b.kind === 'safety-net')) {
    blockers.push({ kind: 'profit', text: `${money(requestable)} available, under the ${money(minPayout)} minimum request.` });
  }

  // Consistency, measured on this cycle.
  const pct = account.consistencyRulePercentage ?? firm.consistencyPercent;
  if (pct > 0 && pct < 100 && bestDay > 0 && cycleProfit > 0) {
    const p = pct / 100;
    const limit = firm.consistencyBasis === 'profitTarget' ? p * tier.profitTarget : p * cycleProfit;
    if (bestDay > limit) {
      const needed = firm.consistencyBasis === 'profitTarget' ? null : bestDay / p - cycleProfit;
      blockers.push({
        kind: 'consistency',
        text:
          needed !== null
            ? `Best day ${money(bestDay)} is over ${pct}% of cycle profit. ${money(needed)} more profit, in smaller days, clears it.`
            : `Best day ${money(bestDay)} is over ${pct}% of the ${money(tier.profitTarget)} target.`,
      });
    }
  }

  const maxPayouts = fp?.maxPayouts?.value;
  if (maxPayouts !== undefined && payouts.length >= maxPayouts) {
    blockers.length = 0;
    blockers.push({ kind: 'max-payouts', text: `All ${maxPayouts} payouts taken. ${fp?.maxPayouts?.note ?? ''}`.trim() });
  }

  // Split: some firms pay 100% up to a lifetime amount, then their split.
  const full = Math.max(0, Math.min(requestable, firm.keep100Upto - paidSoFar));
  const afterSplit = full + (requestable - full) * (firm.profitSplit / 100);

  const status: PayoutStatus = blockers.some((b) => b.kind === 'max-payouts')
    ? 'maxed'
    : blockers.some((b) => b.kind === 'consistency')
      ? 'held'
      : blockers.length
        ? 'waiting'
        : 'ready';

  return {
    accountId: account.id,
    accountName: account.name,
    firmName: `${firm.name} · ${firm.program}`,
    status,
    blockers,
    cycleProfit,
    requestable,
    afterSplit,
    earliestDate: blockers.every((b) => b.kind === 'days') ? earliestDate : null,
    days: { have: Math.min(have, need), need, qualifyingProfit: qualifying },
    payoutsTaken: payouts.length,
  };
}

const ORDER: Record<PayoutStatus, number> = { ready: 0, waiting: 1, held: 2, maxed: 3 };

/** Every funded account's payout window, ready ones first. */
export function payoutSchedule(accounts: Account[], today: string): PayoutWindow[] {
  return accounts
    .map((a) => payoutWindow(a, today))
    .filter((w): w is PayoutWindow => w !== null)
    .sort(
      (a, b) =>
        ORDER[a.status] - ORDER[b.status] ||
        (a.earliestDate ?? '9999').localeCompare(b.earliestDate ?? '9999') ||
        b.afterSplit - a.afterSplit,
    );
}
