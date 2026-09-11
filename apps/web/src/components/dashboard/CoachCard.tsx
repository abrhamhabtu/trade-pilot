'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, Brain, ChevronLeft, ChevronRight, Clock, Pause, ShieldAlert, Sparkles, Target, Trophy } from 'lucide-react';
import type { Trade } from '@/store/tradingStore';
import { useRoutineStore } from '@/store/routineStore';
import { buildCoachInsights, type CoachCategory, type RuleLog } from '@/lib/coachInsights';
import { useHasMounted } from '@/hooks/useHasMounted';

const ROTATE_MS = 9000;

const CATEGORY: Record<CoachCategory, { label: string; icon: React.ElementType; chip: string; glow: string }> = {
  discipline: { label: 'Discipline', icon: Target, chip: 'text-tp-yellow bg-tp-yellow/10 ring-tp-yellow/20', glow: 'from-tp-yellow/25' },
  risk: { label: 'Risk', icon: ShieldAlert, chip: 'text-tp-red bg-tp-red/10 ring-tp-red/20', glow: 'from-tp-red/25' },
  timing: { label: 'Timing', icon: Clock, chip: 'text-tp-blue bg-tp-blue/10 ring-tp-blue/20', glow: 'from-tp-blue/25' },
  mindset: { label: 'Mindset', icon: Brain, chip: 'text-violet-300 bg-violet-400/10 ring-violet-400/20', glow: 'from-violet-400/25' },
  strength: { label: 'Strength', icon: Trophy, chip: 'text-tp-green bg-tp-green/10 ring-tp-green/20', glow: 'from-tp-green/25' },
};

export function CoachCard({ trades }: { trades: Trade[] }) {
  const mounted = useHasMounted();
  const { gamePlans, tradingRules } = useRoutineStore();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0); // restarts the progress animation

  const insights = useMemo(() => {
    const names = new Map(tradingRules.map((r) => [r.id, r.text]));
    const active = tradingRules.filter((r) => r.isActive).length;
    const logs: RuleLog[] = Object.entries(gamePlans)
      .map(([date, plan]) => {
        const rated = (plan.ruleCompliance ?? []).filter((rc) => rc.followed !== null);
        return {
          date,
          followed: rated.filter((rc) => rc.followed).length,
          total: Math.max(active, rated.length),
          broken: rated.filter((rc) => rc.followed === false).map((rc) => names.get(rc.ruleId) ?? 'a rule'),
        };
      })
      .filter((l) => l.followed + l.broken.length > 0);
    return buildCoachInsights(trades, logs, active);
  }, [trades, gamePlans, tradingRules]);

  const count = insights.length;
  const go = useCallback(
    (d: number) => {
      setIndex((i) => (i + d + count) % count);
      setTick((t) => t + 1);
    },
    [count],
  );

  useEffect(() => setIndex(0), [count]);
  useEffect(() => {
    if (paused || count < 2) return;
    const t = setTimeout(() => go(1), ROTATE_MS);
    return () => clearTimeout(t);
  }, [paused, count, go, index, tick]);

  if (!mounted || !count) {
    return <div className="mb-6 h-[132px] animate-pulse rounded-2xl border border-white/[0.06] bg-tp-card/60" />;
  }

  const insight = insights[Math.min(index, count - 1)];
  const cat = CATEGORY[insight.category];
  const warnCount = insights.filter((i) => i.tone === 'warn').length;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Pilot coach"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
      className="relative mb-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-tp-card"
    >
      <style>
        {'@keyframes coachIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes coachBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes coachWord{from{opacity:0;filter:blur(3px)}to{opacity:1;filter:none}}@keyframes coachScan{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}@media (prefers-reduced-motion:reduce){.coach-motion{animation:none!important}}'}
      </style>
      {/* AI scan line along the top edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
        <div className="coach-motion h-full w-1/4 bg-gradient-to-r from-transparent via-tp-green/80 to-transparent [animation:coachScan_4.5s_ease-in-out_infinite]" />
      </div>
      {/* Category glow */}
      <div key={`glow-${insight.id}`} className={clsx('pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br to-transparent blur-3xl transition-colors', cat.glow)} />

      {/* Story progress */}
      <div className="relative flex gap-1 px-5 pt-4">
        {insights.map((it, i) => (
          <button
            key={it.id}
            type="button"
            onClick={() => {
              setIndex(i);
              setTick((t) => t + 1);
            }}
            aria-label={`Show tip ${i + 1}: ${it.title}`}
            className="group/bar h-3 flex-1 py-1"
          >
            <span className="block h-1 overflow-hidden rounded-full bg-white/[0.08] group-hover/bar:bg-white/[0.14]">
              {i < index && <span className="block h-full w-full bg-white/50" />}
              {i === index && (
                <span
                  key={`${tick}-${index}`}
                  className="block h-full w-full origin-left bg-white/80"
                  style={{ animation: `coachBar ${ROTATE_MS}ms linear forwards`, animationPlayState: paused || count < 2 ? 'paused' : 'running' }}
                />
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="relative flex flex-col gap-4 p-5 pt-3 md:flex-row md:items-center md:gap-6">
        {/* Identity */}
        <div className="flex shrink-0 items-center gap-3 md:w-44 md:flex-col md:items-start md:gap-2">
          <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-tp-green/30 to-tp-blue/25 ring-1 ring-inset ring-white/15">
            <Sparkles className="h-5 w-5 text-white" />
            {warnCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-tp-yellow px-1 text-[10px] font-bold text-zinc-950">{warnCount}</span>}
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-50">Pilot Coach</div>
            <div className="text-[11px] leading-tight text-zinc-500">{trades.length ? `Read from your last ${trades.length} trades` : 'Discipline principles'}</div>
          </div>
        </div>

        {/* Insight */}
        <div key={insight.id} className="min-w-0 flex-1 [animation:coachIn_.35s_ease-out]" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', cat.chip)}>
              <cat.icon className="h-3 w-3" />
              {cat.label}
            </span>
            {insight.tone === 'warn' && <span className="text-[11px] font-medium text-tp-yellow">Needs attention</span>}
            {insight.tone === 'good' && <span className="text-[11px] font-medium text-tp-green">Keep doing this</span>}
          </div>
          <h3 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-zinc-50">{insight.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400" aria-label={insight.detail}>
            {/* Words stream in like a live AI reply */}
            {insight.detail.split(' ').map((word, i) => (
              <span key={i} aria-hidden className="coach-motion inline-block whitespace-pre opacity-0 [animation:coachWord_.35s_ease-out_forwards]" style={{ animationDelay: `${120 + i * 28}ms` }}>
                {word}{' '}
              </span>
            ))}
          </p>
          <div className="mt-3 inline-flex max-w-full items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 ring-1 ring-inset ring-white/[0.06]">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-tp-green" />
            <span>
              <span className="font-semibold text-zinc-50">Try: </span>
              {insight.action}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex shrink-0 items-center justify-between gap-2 md:flex-col md:items-end md:justify-center">
          <Link
            href={`/app/pilot?ask=${encodeURIComponent(insight.ask)}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            <Sparkles className="h-4 w-4" /> Ask Pilot
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={() => go(-1)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100" aria-label="Previous tip">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[38px] text-center text-xs tabular-nums text-zinc-500">
              <span className="inline-flex items-center gap-1">
                {paused && count > 1 && <Pause className="h-3 w-3" />}
                {index + 1}/{count}
              </span>
            </span>
            <button onClick={() => go(1)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100" aria-label="Next tip">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
