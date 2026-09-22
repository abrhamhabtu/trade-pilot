'use client';

import React from 'react';
import clsx from 'clsx';
import { AlertTriangle, Hand } from 'lucide-react';
import { useAccountStore } from '@/store/accountStore';
import { useDailyStop } from '@/hooks/useDailyStop';
import { useHasMounted } from '@/hooks/useHasMounted';

/** Loud, and only there when it matters: the day is over, or close to a line. */
export function DailyStopBanner() {
  const mounted = useHasMounted();
  const account = useAccountStore((s) => s.accounts.find((a) => a.id === s.selectedAccountId) ?? s.accounts[0] ?? null);
  const stop = useDailyStop(account);

  if (!mounted || !account || !stop || account.status === 'blown') return null;
  if (!stop.stopped && !stop.warning) return null;

  const loss = stop.reasons.some((r) => r.kind === 'loss');
  const tone = stop.stopped ? (loss ? 'red' : 'blue') : 'yellow';
  const lines = stop.stopped ? stop.reasons : [stop.warning!];

  return (
    <div
      role={stop.stopped ? 'alert' : 'status'}
      className={clsx(
        'flex items-start gap-3 rounded-2xl border px-5 py-4',
        tone === 'red' && 'border-tp-red/30 bg-tp-red/10',
        tone === 'blue' && 'border-tp-blue/30 bg-tp-blue/10',
        tone === 'yellow' && 'border-tp-yellow/30 bg-tp-yellow/10',
      )}
    >
      {stop.stopped ? (
        <Hand className={clsx('mt-0.5 h-5 w-5 shrink-0', loss ? 'text-tp-red' : 'text-tp-blue')} />
      ) : (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-tp-yellow" />
      )}
      <div>
        <p className={clsx('text-sm font-semibold', tone === 'red' ? 'text-tp-red' : tone === 'blue' ? 'text-tp-blue' : 'text-tp-yellow')}>
          {stop.stopped ? `Done for today on ${account.name}` : `${account.name} is close to a line`}
        </p>
        <ul className="mt-1 space-y-0.5 text-sm text-zinc-300">
          {lines.map((r) => (
            <li key={r.kind}>{r.text}</li>
          ))}
        </ul>
        {stop.stopped && !loss && (
          <p className="mt-1.5 text-xs text-zinc-500">A good day kept is worth more than a great day given back.</p>
        )}
      </div>
    </div>
  );
}

export default DailyStopBanner;
