'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, BookOpenCheck } from 'lucide-react';
import { accountsInScope, useAccountStore } from '@/store/accountStore';
import { APP_ROUTES } from '@/lib/navigation';
import { computeLedger } from '@/lib/propLedger';
import { useThemeClasses } from '@/components/payout/payoutPrimitives';

const usd = (n: number) => `${n < 0 ? '−' : n > 0 ? '+' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;

/** One line on the dashboard: is prop trading paying you, after every fee? */
export function PropNetCard() {
  const { card, text, muted } = useThemeClasses();
  const accounts = useAccountStore((s) => s.accounts);
  const l = useMemo(() => computeLedger(accountsInScope(accounts)), [accounts]);

  if (l.spent === 0 && l.payoutCount === 0) return null;

  return (
    <Link
      href={APP_ROUTES.payout}
      className={clsx(card, 'group flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3.5 transition-colors hover:border-tp-green/30')}
    >
      <span className="flex items-center gap-2.5">
        <BookOpenCheck className="h-4 w-4 text-tp-green" />
        <span className={clsx('text-sm', muted)}>Prop net, after fees</span>
        <span className={clsx('text-lg font-semibold tabular-nums', l.net < 0 ? 'text-tp-red' : 'text-tp-green')}>{usd(l.net)}</span>
      </span>
      <span className={clsx('flex flex-wrap items-center gap-x-5 gap-y-1 text-xs', muted)}>
        <span>
          <span className={clsx('font-semibold tabular-nums', text)}>${Math.round(l.received).toLocaleString()}</span> received
        </span>
        <span>
          <span className={clsx('font-semibold tabular-nums', text)}>${Math.round(l.spent).toLocaleString()}</span> in fees
        </span>
        {l.returnOnFees !== null && (
          <span>
            <span className={clsx('font-semibold tabular-nums', text)}>${(l.received / l.spent).toFixed(2)}</span> back per $1
          </span>
        )}
        <span className="inline-flex items-center gap-1 font-medium text-tp-green">
          Ledger <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}

export default PropNetCard;
