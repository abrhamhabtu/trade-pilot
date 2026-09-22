'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Dices, Gauge, Trophy } from 'lucide-react';
import { accountsInScope, useAccountStore } from '@/store/accountStore';
import {
  MIN_SAMPLE_DAYS,
  bestRiskScale,
  compareFirms,
  dailySamples,
  riskSweep,
  rulesFromFirm,
  simulateOdds,
  type OddsResult,
} from '@/lib/passOdds';
import type { FirmAccountTier, PropFirm } from './propFirmData';
import { AdviceLine, SectionHeader, useThemeClasses } from './payoutPrimitives';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;
const days = (o: OddsResult) =>
  o.medianDays === null ? '—' : o.p25Days !== null && o.p75Days !== null && o.p25Days !== o.p75Days ? `${o.medianDays} (${o.p25Days}–${o.p75Days})` : `${o.medianDays}`;

/** Pass / blow / out-of-time as one bar, each part labelled so color never carries it alone. */
function OutcomeBar({ odds }: { odds: OddsResult }) {
  const { dark, muted } = useThemeClasses();
  const parts = [
    { label: 'Pass', v: odds.pass, color: '#00D68F' },
    { label: 'Blow', v: odds.blow, color: '#FF4868' },
    { label: 'Out of time', v: odds.timeout, color: dark ? '#52525B' : '#D4D4D8' },
  ];
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {parts.filter((p) => p.v > 0).map((p) => (
          <div key={p.label} style={{ width: `${p.v * 100}%`, background: p.color }} title={`${p.label} ${pct(p.v)}`} />
        ))}
      </div>
      <div className={clsx('mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs', muted)}>
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} {pct(p.v)}
          </span>
        ))}
      </div>
    </div>
  );
}

interface OddsTabProps {
  firm: PropFirm;
  tier: FirmAccountTier;
  onPick: (firmId: string, tierId: string) => void;
}

export function OddsTab({ firm, tier, onPick }: OddsTabProps) {
  const { card, text, muted, dark, input } = useThemeClasses();
  const accounts = useAccountStore((s) => s.accounts);
  const scope = useMemo(() => accountsInScope(accounts), [accounts]);
  const [source, setSource] = useState<string>('all');

  const picked = useMemo(() => (source === 'all' ? scope : scope.filter((a) => a.id === source)), [scope, source]);
  const samples = useMemo(() => dailySamples(picked), [picked]);
  const enough = samples.length >= MIN_SAMPLE_DAYS;

  const rules = useMemo(() => rulesFromFirm(firm, tier), [firm, tier]);
  const odds = useMemo(() => (enough ? simulateOdds(samples, rules) : null), [enough, samples, rules]);
  const sweep = useMemo(() => (enough ? riskSweep(samples, rules) : []), [enough, samples, rules]);
  const best = sweep.length ? bestRiskScale(sweep) : 1;
  const bestRow = sweep.find((r) => r.riskScale === best);
  const nowRow = sweep.find((r) => r.riskScale === 1);
  const ranked = useMemo(() => (enough ? compareFirms(samples) : []), [enough, samples]);

  const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
  const winDays = samples.filter((s) => s > 0).length;

  return (
    <div className="space-y-5">
      <section className={clsx(card, 'p-5 sm:p-6')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeader
            icon={<Dices className="h-4 w-4 text-tp-green" />}
            title={`Your odds at ${firm.name} · ${firm.program} · ${tier.label}`}
            subtitle="Your own trading days, drawn at random thousands of times and run through this program's drawdown, daily limit, consistency rule and minimum days."
          />
          <label className="flex items-center gap-2 text-xs">
            <span className={muted}>Trading days from</span>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={clsx('rounded-lg border px-2.5 py-1.5 text-xs', input)}>
              <option value="all">All {scope.some((a) => a.type === 'demo') ? 'sample ' : ''}accounts</option>
              {scope.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!enough ? (
          <AdviceLine tone="neutral">
            {samples.length
              ? `${samples.length} trading day${samples.length === 1 ? '' : 's'} so far. Odds need at least ${MIN_SAMPLE_DAYS}, so import or trade ${MIN_SAMPLE_DAYS - samples.length} more.`
              : 'No trades yet. Import some and your odds appear here.'}
          </AdviceLine>
        ) : odds ? (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-1">
                <p className={clsx('text-[11px] uppercase tracking-wide', muted)}>Chance to pass</p>
                <p className={clsx('text-5xl font-semibold tracking-tight tabular-nums', odds.pass >= 0.5 ? 'text-tp-green' : odds.pass >= 0.3 ? 'text-tp-yellow' : 'text-tp-red')}>
                  {pct(odds.pass)}
                </p>
              </div>
              <div className="flex flex-col justify-center gap-3 sm:col-span-3">
                <OutcomeBar odds={odds} />
                <p className={clsx('text-xs', muted)}>
                  Passing paths take <span className={clsx('font-semibold', text)}>{days(odds)}</span> trading days (median, middle half in brackets). Out of time means
                  still open after 60 days.
                </p>
              </div>
            </div>
            <p className={clsx('mt-4 text-xs', muted)}>
              From {samples.length} trading days: {pct(winDays / samples.length)} green, averaging {avg >= 0 ? '' : '−'}{usd(Math.abs(avg))} a day.
            </p>
            {odds.optimistic && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-tp-yellow">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This program trails intraday. We only see daily results, so these odds are the best case. Real ones are lower.
              </p>
            )}
          </>
        ) : null}
      </section>

      {enough && bestRow && nowRow && (
        <section className={clsx(card, 'p-5')}>
          <SectionHeader
            icon={<Gauge className="h-4 w-4 text-tp-blue" />}
            title="What size gives you the best odds"
            subtitle="Every day scaled up or down from how you traded. Bigger finishes faster when it works and blows more often when it does not."
          />
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className={clsx('text-left text-[11px] uppercase tracking-wide', muted)}>
                  <th className="px-1 pb-2 font-medium">Size vs now</th>
                  <th className="px-1 pb-2 text-right font-medium">Pass</th>
                  <th className="px-1 pb-2 text-right font-medium">Blow</th>
                  <th className="px-1 pb-2 text-right font-medium">Days to pass</th>
                </tr>
              </thead>
              <tbody>
                {sweep.map((r) => (
                  <tr
                    key={r.riskScale}
                    className={clsx(
                      'border-t',
                      dark ? 'border-white/[0.06]' : 'border-gray-100',
                      r.riskScale === best && (dark ? 'bg-tp-green/[0.06]' : 'bg-emerald-50'),
                    )}
                  >
                    <td className={clsx('px-1 py-2 font-medium', text)}>
                      {r.riskScale}×{r.riskScale === 1 && <span className={clsx('ml-1.5 text-xs font-normal', muted)}>how you trade now</span>}
                      {r.riskScale === best && best !== 1 && <span className="ml-1.5 text-xs font-semibold text-tp-green">best odds</span>}
                    </td>
                    <td className="px-1 py-2 text-right font-semibold tabular-nums text-tp-green">{pct(r.odds.pass)}</td>
                    <td className="px-1 py-2 text-right tabular-nums text-tp-red">{pct(r.odds.blow)}</td>
                    <td className={clsx('px-1 py-2 text-right tabular-nums', muted)}>{r.odds.medianDays ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            {best === 1 ? (
              <AdviceLine tone="good">No other size beats yours by more than a few points here. Your current size is fine for this drawdown.</AdviceLine>
            ) : (
              <AdviceLine tone={best < 1 ? 'warn' : 'good'}>
                At {best}× your current size you pass {pct(bestRow.odds.pass)} of the time, against {pct(nowRow.odds.pass)} now.{' '}
                {best < 1 ? 'You are trading too big for this drawdown.' : 'This drawdown can take more size than you are using.'}
              </AdviceLine>
            )}
          </div>
        </section>
      )}

      {enough && ranked.length > 0 && (
        <section className={clsx(card, 'p-5')}>
          <SectionHeader
            icon={<Trophy className="h-4 w-4 text-tp-yellow" />}
            title="Where a pass costs you least"
            subtitle="Every evaluation we have rules for, at the size you trade now. Fees per pass = one attempt's fees (monthly plans renew while it runs) ÷ your chance to pass."
          />
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className={clsx('text-left text-[11px] uppercase tracking-wide', muted)}>
                  <th className="px-1 pb-2 font-medium">Program</th>
                  <th className="px-1 pb-2 text-right font-medium">Pass</th>
                  <th className="px-1 pb-2 text-right font-medium">Blow</th>
                  <th className="px-1 pb-2 text-right font-medium">Days</th>
                  <th className="px-1 pb-2 text-right font-medium">Fees / try</th>
                  <th className="px-1 pb-2 text-right font-medium">Fees / pass</th>
                  <th className="px-1 pb-2" />
                </tr>
              </thead>
              <tbody>
                {ranked.slice(0, 10).map((r, i) => {
                  const current = r.firm.id === firm.id && r.tier.id === tier.id;
                  return (
                    <tr key={`${r.firm.id}-${r.tier.id}`} className={clsx('border-t', dark ? 'border-white/[0.06]' : 'border-gray-100', current && (dark ? 'bg-white/[0.03]' : 'bg-gray-50'))}>
                      <td className={clsx('px-1 py-2', text)}>
                        <span className="font-medium">
                          {r.firm.name} {r.tier.label}
                        </span>
                        <span className={clsx('ml-1.5 text-xs', muted)}>{r.firm.program}</span>
                        {i === 0 && <span className="ml-1.5 text-xs font-semibold text-tp-green">cheapest pass</span>}
                      </td>
                      <td className="px-1 py-2 text-right font-semibold tabular-nums text-tp-green">{pct(r.odds.pass)}</td>
                      <td className="px-1 py-2 text-right tabular-nums text-tp-red">{pct(r.odds.blow)}</td>
                      <td className={clsx('px-1 py-2 text-right tabular-nums', muted)}>{r.odds.medianDays ?? '—'}</td>
                      <td className={clsx('px-1 py-2 text-right tabular-nums', muted)}>{usd(r.costPerAttempt)}</td>
                      <td className={clsx('px-1 py-2 text-right font-semibold tabular-nums', text)}>{r.costPerPass === null ? 'never' : usd(r.costPerPass)}</td>
                      <td className="px-1 py-2 text-right">
                        {current ? (
                          <span className={clsx('text-xs', muted)}>selected</span>
                        ) : (
                          <button type="button" onClick={() => onPick(r.firm.id, r.tier.id)} className="text-xs font-semibold text-tp-green hover:underline">
                            Plan this
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={clsx('mt-4 text-xs leading-relaxed', muted)}>
            Prices are list prices from the firm catalog and change with promotions. Odds treat each day as independent: streaks are only as common as they were
            in your history. Your past days are a sample, not a promise.
          </p>
        </section>
      )}
    </div>
  );
}

export default OddsTab;
