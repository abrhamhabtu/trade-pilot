'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { CalendarClock, CheckCircle2, Clock, Hand, Lock } from 'lucide-react';
import { accountsInScope, useAccountStore } from '@/store/accountStore';
import { localSessionDate } from '@/lib/sessionRisk';
import { payoutSchedule, type PayoutStatus, type PayoutWindow } from '@/lib/payoutSchedule';
import { shortDate, signedUsd } from './accountUi';

const STATUS: Record<PayoutStatus, { label: string; icon: React.ElementType; tone: string }> = {
  ready: { label: 'Ready to request', icon: CheckCircle2, tone: 'text-tp-green bg-tp-green/10' },
  waiting: { label: 'Building', icon: Clock, tone: 'text-tp-blue bg-tp-blue/10' },
  held: { label: 'Held by consistency', icon: Hand, tone: 'text-tp-yellow bg-tp-yellow/10' },
  maxed: { label: 'All payouts taken', icon: Lock, tone: 'text-zinc-400 bg-white/[0.06]' },
};

function WindowCard({ w, onOpen }: { w: PayoutWindow; onOpen: () => void }) {
  const s = STATUS[w.status];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-w-[250px] flex-1 flex-col rounded-xl bg-black/20 p-4 text-left ring-1 ring-inset ring-white/[0.05] transition-colors hover:ring-white/[0.12]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-100">{w.accountName}</p>
          <p className="truncate text-[11px] text-zinc-500">{w.firmName}</p>
        </div>
        <span className={clsx('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', s.tone)}>
          <s.icon className="h-3 w-3" /> {s.label}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] text-zinc-500">{w.status === 'ready' ? 'You could take' : 'Available so far'}</p>
          <p className={clsx('text-xl font-semibold tabular-nums', w.status === 'ready' ? 'text-tp-green' : 'text-zinc-200')}>{signedUsd(w.afterSplit)}</p>
          <p className="text-[11px] text-zinc-600">after split · request {signedUsd(w.requestable)}</p>
        </div>
        {w.earliestDate && (
          <div className="text-right">
            <p className="text-[11px] text-zinc-500">Earliest</p>
            <p className="text-sm font-semibold text-tp-blue">{shortDate(w.earliestDate).replace(/, \d{4}$/, '')}</p>
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-zinc-500">
          <span>
            {w.days.qualifyingProfit ? `Winning days of $${w.days.qualifyingProfit}+` : 'Trading days'}
          </span>
          <span className="tabular-nums">
            {w.days.have}/{w.days.need}
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-tp-blue" style={{ width: `${(w.days.have / Math.max(1, w.days.need)) * 100}%` }} />
        </div>
      </div>

      {w.blockers.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs leading-snug text-zinc-400">
          {w.blockers.map((b) => (
            <li key={b.kind}>· {b.text}</li>
          ))}
        </ul>
      )}
    </button>
  );
}

/** When each funded account can next pay out, and what stands in the way. */
export function NextPayouts({ onOpen }: { onOpen: (accountId: string) => void }) {
  const accounts = useAccountStore((s) => s.accounts);
  const windows = useMemo(() => payoutSchedule(accountsInScope(accounts), localSessionDate()), [accounts]);
  if (!windows.length) return null;

  const ready = windows.filter((w) => w.status === 'ready');
  const readyTotal = ready.reduce((n, w) => n + w.afterSplit, 0);

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-tp-card p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <CalendarClock className="h-4 w-4 text-tp-yellow" /> Next payouts
        </h2>
        <p className="text-xs text-zinc-500">
          {ready.length
            ? `${ready.length} ready · about ${signedUsd(readyTotal)} to you if requested today`
            : 'None ready yet'}{' '}
          · estimates, confirm on your firm&apos;s dashboard
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {windows.map((w) => (
          <WindowCard key={w.accountId} w={w} onOpen={() => onOpen(w.accountId)} />
        ))}
      </div>
    </section>
  );
}

export default NextPayouts;
