// ─── The prop ledger ───────────────────────────────────────────────────────────
// Trading P&L says whether you can trade. The ledger says whether prop trading is
// paying you: every fee, reset and activation against every payout that reached
// your bank. Plenty of traders are profitable on the chart and negative here.
//
// Payouts count at what the trader received when they recorded it, and at the
// gross withdrawal otherwise. The result flags how many are gross so the total
// never looks more exact than it is.
// ───────────────────────────────────────────────────────────────────────────────

import type { Account, CostKind } from '@/store/accountStore';
import { resolveFirm } from '@/lib/liquidation';

export interface LedgerRow {
  key: string;
  label: string;
  spent: number;
  received: number;
  net: number;
  payouts: number;
  accounts: number;
}

export interface LedgerMonth {
  month: string; // YYYY-MM
  spent: number;
  received: number;
  /** Running net at the end of this month. */
  cumulative: number;
}

export interface Ledger {
  spent: number;
  received: number;
  net: number;
  /** net ÷ spent. null until something has been spent. */
  returnOnFees: number | null;
  payoutCount: number;
  /** Payouts with no "received" amount, counted at the gross withdrawal. */
  grossPayouts: number;
  byKind: Record<CostKind, number>;
  byFirm: LedgerRow[];
  byAccount: (LedgerRow & { status: Account['status']; funded: boolean })[];
  months: LedgerMonth[];
  evals: { passed: number; failed: number; open: number; passRate: number | null };
  funded: { total: number; paid: number; payoutRate: number | null };
  /** Fees spent per funded account won. null when none have been won. */
  costPerFunded: number | null;
}

const KINDS: CostKind[] = ['evaluation', 'reset', 'activation', 'subscription', 'data', 'other'];

export const COST_KIND_LABEL: Record<CostKind, string> = {
  evaluation: 'Evaluation',
  reset: 'Reset',
  activation: 'Activation',
  subscription: 'Subscription',
  data: 'Data / platform',
  other: 'Other',
};

/** The firm name an account belongs to, falling back to what the trader typed. */
export function firmLabel(account: Pick<Account, 'broker' | 'startingBalance' | 'balance'>): string {
  return resolveFirm(account)?.firm.name ?? (account.broker?.trim() || 'Unassigned');
}

function paidOut(account: Account): { received: number; count: number; gross: number } {
  let received = 0;
  let count = 0;
  let gross = 0;
  for (const a of account.balanceAdjustments ?? []) {
    if (a.type !== 'payout') continue;
    count += 1;
    if (typeof a.received === 'number' && a.received > 0) received += a.received;
    else {
      received += Math.abs(a.amount);
      gross += 1;
    }
  }
  return { received, count, gross };
}

const spentOn = (account: Account) => (account.costs ?? []).reduce((n, c) => n + Math.abs(c.amount), 0);

export function computeLedger(accounts: Account[]): Ledger {
  const byKind = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<CostKind, number>;
  const firms = new Map<string, LedgerRow>();
  const monthly = new Map<string, { spent: number; received: number }>();
  const byAccount: Ledger['byAccount'] = [];

  let spent = 0;
  let received = 0;
  let payoutCount = 0;
  let grossPayouts = 0;

  const bump = (month: string, key: 'spent' | 'received', v: number) => {
    const m = monthly.get(month) ?? { spent: 0, received: 0 };
    m[key] += v;
    monthly.set(month, m);
  };

  for (const account of accounts) {
    const s = spentOn(account);
    const p = paidOut(account);
    spent += s;
    received += p.received;
    payoutCount += p.count;
    grossPayouts += p.gross;

    for (const c of account.costs ?? []) {
      byKind[c.kind] = (byKind[c.kind] ?? 0) + Math.abs(c.amount);
      bump(c.date.slice(0, 7), 'spent', Math.abs(c.amount));
    }
    for (const a of account.balanceAdjustments ?? []) {
      if (a.type !== 'payout') continue;
      const got = typeof a.received === 'number' && a.received > 0 ? a.received : Math.abs(a.amount);
      bump(a.date.slice(0, 7), 'received', got);
    }

    const label = firmLabel(account);
    const row = firms.get(label) ?? { key: label, label, spent: 0, received: 0, net: 0, payouts: 0, accounts: 0 };
    row.spent += s;
    row.received += p.received;
    row.net = row.received - row.spent;
    row.payouts += p.count;
    row.accounts += 1;
    firms.set(label, row);

    byAccount.push({
      key: account.id,
      label: account.name,
      spent: s,
      received: p.received,
      net: p.received - s,
      payouts: p.count,
      accounts: 1,
      status: account.status,
      funded: account.isFunded === true,
    });
  }

  let running = 0;
  const months = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => {
      running += m.received - m.spent;
      return { month, spent: m.spent, received: m.received, cumulative: running };
    });

  // An evaluation is decided once it passes or blows. A funded account with an
  // evaluation fee on record got there by passing one; a funded account without
  // one is instant funding and stays out of the rate.
  const cameFromEval = (a: Account) =>
    a.status === 'passed_eval' || (a.isFunded === true && (a.costs ?? []).some((c) => c.kind === 'evaluation'));
  const evalAccounts = accounts.filter((a) => a.isFunded === false || cameFromEval(a));
  const passed = evalAccounts.filter(cameFromEval).length;
  const failed = evalAccounts.filter((a) => a.status === 'blown').length;
  const open = evalAccounts.length - passed - failed;

  const fundedAccounts = accounts.filter((a) => a.isFunded === true);
  const fundedPaid = fundedAccounts.filter((a) => paidOut(a).count > 0).length;
  const fundedWon = accounts.filter((a) => a.isFunded === true || a.status === 'passed_eval').length;

  const net = received - spent;
  return {
    spent,
    received,
    net,
    returnOnFees: spent > 0 ? net / spent : null,
    payoutCount,
    grossPayouts,
    byKind,
    byFirm: [...firms.values()].sort((a, b) => b.net - a.net),
    byAccount: byAccount.sort((a, b) => b.net - a.net),
    months,
    evals: { passed, failed, open, passRate: passed + failed > 0 ? passed / (passed + failed) : null },
    funded: {
      total: fundedAccounts.length,
      paid: fundedPaid,
      payoutRate: fundedAccounts.length ? fundedPaid / fundedAccounts.length : null,
    },
    costPerFunded: fundedWon > 0 && spent > 0 ? spent / fundedWon : null,
  };
}
