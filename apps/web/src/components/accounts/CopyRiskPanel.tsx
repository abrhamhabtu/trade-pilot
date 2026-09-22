'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { Copy, Skull } from 'lucide-react';
import { accountsInScope, useAccountStore } from '@/store/accountStore';
import { COPY_CORRELATION, MIN_SHARED_DAYS, findCopyGroups } from '@/lib/copyRisk';
import { signedUsd } from './accountUi';
import { AskPilotLink } from '@/components/pilot/AskPilotLink';

/** Accounts that trade as copies, and what one bad day does to all of them together. */
export function CopyRiskPanel() {
  const accounts = useAccountStore((s) => s.accounts);
  const groups = useMemo(() => findCopyGroups(accountsInScope(accounts)), [accounts]);

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-tp-card p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tp-yellow/10 text-tp-yellow ring-1 ring-inset ring-tp-yellow/20">
          <Copy className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Correlated risk</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Accounts whose days move together (correlation {COPY_CORRELATION}+ over {MIN_SHARED_DAYS}+ shared days, whatever their size). Copies are
            one bet at several times the size, not several bets.
          </p>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.08] p-5 text-center text-sm text-zinc-500">
          No live accounts are trading as copies of each other. If you start a copier, this shows what one bad day would do to all of them at once.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.05]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-100">
                  {g.members.length} accounts move together
                  <span className="ml-2 text-xs font-normal text-zinc-500">correlation ≥ {g.minCorrelation.toFixed(2)}</span>
                </p>
                <p className={clsx('text-sm font-semibold', g.blowCount > 0 ? 'text-tp-red' : 'text-tp-yellow')}>
                  Worst day on all at once: −{signedUsd(g.combinedWorstDay).replace('-', '')}
                  {g.blowCount > 0 && ` · ends ${g.blowCount}`}
                </p>
              </div>

              <div className="-mx-1 mt-3 overflow-x-auto">
                <table className="w-full min-w-[440px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                      <th className="px-1 pb-2 font-medium">Account</th>
                      <th className="px-1 pb-2 text-right font-medium">Worst day</th>
                      <th className="px-1 pb-2 text-right font-medium">Room left</th>
                      <th className="px-1 pb-2 text-right font-medium">Survives it?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.members.map((m) => (
                      <tr key={m.id} className="border-t border-white/[0.05]">
                        <td className="px-1 py-2 text-zinc-200">
                          {m.name}
                          <span className="ml-1.5 text-xs text-zinc-500">{m.firm}</span>
                        </td>
                        <td className="px-1 py-2 text-right tabular-nums text-tp-red">−{signedUsd(m.worstDay).replace('-', '')}</td>
                        <td className="px-1 py-2 text-right tabular-nums text-zinc-300">{m.cushion === null ? 'rules unknown' : signedUsd(m.cushion)}</td>
                        <td className="px-1 py-2 text-right">
                          {m.cushion === null ? (
                            <span className="text-xs text-zinc-500">—</span>
                          ) : m.wouldBlow ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-tp-red">
                              <Skull className="h-3 w-3" /> No
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-tp-green">Yes</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-zinc-400">
                {g.suggestions.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
              <AskPilotLink
                className="mt-3"
                question={`${g.members.map((m) => m.name).join(', ')} trade as copies. Their worst day together is ${signedUsd(g.combinedWorstDay)} and it would end ${g.blowCount} of them. How should I size and stagger them?`}
                label="Ask Pilot how to size these"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default CopyRiskPanel;
