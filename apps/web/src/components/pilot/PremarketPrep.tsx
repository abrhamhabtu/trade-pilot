'use client';

import Link from 'next/link';
import { CheckCircle2, Clock, Sparkles, TriangleAlert } from 'lucide-react';
import clsx from 'clsx';
import type { PremarketBriefing } from '@/lib/pilot';
import { APP_ROUTES } from '@/lib/navigation';

export function PremarketPrep({
  briefing,
  onRefresh,
}: {
  briefing: PremarketBriefing;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-tp-green">
            1 · Plan · Pre-market
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">
            {briefing.weekday} prep
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Built from {briefing.tradeCount} of your trades · {briefing.date}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-tp-green/30 bg-tp-green/10 px-3 py-2 text-sm font-medium text-tp-green hover:bg-tp-green/15"
        >
          <Sparkles className="h-4 w-4" />
          Generate briefing
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#142c2b] to-[#121e2a] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Pilot recommendation</p>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-100">{briefing.recommendation}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {briefing.focusSetup && <Chip>{briefing.focusSetup}</Chip>}
            {briefing.bestWindow && <Chip muted>Take: {briefing.bestWindow}</Chip>}
            {briefing.avoidWindow && <Chip warn>Skip: {briefing.avoidWindow}</Chip>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-tp-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Session scan</p>
          <dl className="mt-3 space-y-2.5 text-sm">
            <Row label="Last session" value={briefing.lastSession ? `${briefing.lastSession.date} · ${briefing.lastSession.pnl >= 0 ? '+' : ''}${briefing.lastSession.pnl.toFixed(0)}` : '—'} />
            <Row label="Streak" value={briefing.streak ? `${briefing.streak.count} ${briefing.streak.direction}s` : '—'} />
            <Row label="Revenge re-entries" value={briefing.revengeRate != null ? `${briefing.revengeRate}% of tape` : 'Need more stamps'} />
          </dl>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.08] bg-tp-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Clock className="h-4 w-4 text-tp-yellow" />
            Session windows
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            These are clock windows, not live CPI prints. Always confirm the economic calendar before you size up.
          </p>
          <ul className="mt-4 space-y-2">
            {briefing.events.map((event) => (
              <li
                key={`${event.time}-${event.label}`}
                className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <span className="w-12 shrink-0 font-mono text-xs text-zinc-400">{event.time}</span>
                <span className="flex-1 text-sm text-zinc-200">{event.label}</span>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                    event.impact === 'high' ? 'bg-tp-red/15 text-tp-red' : 'bg-tp-yellow/15 text-tp-yellow',
                  )}
                >
                  {event.impact}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-tp-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <CheckCircle2 className="h-4 w-4 text-tp-green" />
            Before the first trade
          </h3>
          <ul className="mt-4 space-y-2">
            {briefing.checklist.map((item) => (
              <li key={item.id} className="flex gap-2 text-sm text-zinc-300">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-tp-green/70" />
                {item.label}
              </li>
            ))}
          </ul>
          <Link
            href="/app/session"
            className="mt-4 inline-flex text-xs font-semibold text-tp-green hover:underline"
          >
            Open session sizing →
          </Link>
        </section>
      </div>

      {briefing.patterns.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-zinc-100">Patterns on your tape</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {briefing.patterns.map((pattern) => (
              <div
                key={pattern.title}
                className={clsx(
                  'rounded-xl border p-4',
                  pattern.tone === 'warn' && 'border-tp-red/20 bg-tp-red/[0.04]',
                  pattern.tone === 'good' && 'border-tp-green/20 bg-tp-green/[0.04]',
                  pattern.tone === 'info' && 'border-white/[0.08] bg-white/[0.02]',
                )}
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                  {pattern.tone === 'warn' && <TriangleAlert className="h-3.5 w-3.5 text-tp-red" />}
                  {pattern.title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{pattern.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-zinc-600">
        Pilot is a coach on your journal — not a signal service. It will not tell you to buy or sell.{' '}
        <Link href={APP_ROUTES.playbooks} className="text-zinc-400 hover:text-zinc-200">
          Tie this to a playbook
        </Link>
        .
      </p>
    </div>
  );
}

function Chip({ children, muted, warn }: { children: React.ReactNode; muted?: boolean; warn?: boolean }) {
  return (
    <span
      className={clsx(
        'rounded-full px-2.5 py-1 text-[11px] font-semibold',
        warn && 'bg-tp-red/15 text-tp-red',
        muted && 'bg-white/[0.06] text-zinc-400',
        !muted && !warn && 'bg-tp-green/15 text-tp-green',
      )}
    >
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-200">{value}</dd>
    </div>
  );
}
