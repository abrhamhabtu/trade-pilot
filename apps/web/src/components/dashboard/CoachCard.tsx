'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, BellOff, Brain, Check, ChevronLeft, ChevronRight, Clock, Pause, Play, Plus, ShieldAlert, Sparkles, Target, Trophy } from 'lucide-react';
import type { Trade } from '@/store/tradingStore';
import { useRoutineStore, type TradingRule } from '@/store/routineStore';
import { buildCoachInsights, type CoachCategory, type CoachInsight, type RuleLog } from '@/lib/coachInsights';
import { useHasMounted } from '@/hooks/useHasMounted';

const ROTATE_MS = 15000;
const SNOOZE_KEY = 'tradepilot_coach_snoozed';
const SNOOZE_DAYS = 7;

/** Where a coaching card lands if the trader promotes it to a standing rule. */
const RULE_CATEGORY: Record<CoachCategory, TradingRule['category']> = {
  discipline: 'mindset',
  risk: 'risk',
  timing: 'time',
  mindset: 'mindset',
  strength: 'entry',
};

const usd0 = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString()}`;

const CATEGORY: Record<CoachCategory, { label: string; icon: React.ElementType; chip: string; dot: string; glow: string; accent: string }> = {
  discipline: { label: 'Discipline', icon: Target, chip: 'text-tp-yellow bg-tp-yellow/10 ring-tp-yellow/20', dot: 'bg-tp-yellow', glow: 'from-tp-yellow/20', accent: 'from-tp-yellow/70' },
  risk: { label: 'Risk', icon: ShieldAlert, chip: 'text-tp-red bg-tp-red/10 ring-tp-red/20', dot: 'bg-tp-red', glow: 'from-tp-red/20', accent: 'from-tp-red/70' },
  timing: { label: 'Timing', icon: Clock, chip: 'text-tp-blue bg-tp-blue/10 ring-tp-blue/20', dot: 'bg-tp-blue', glow: 'from-tp-blue/20', accent: 'from-tp-blue/70' },
  mindset: { label: 'Mindset', icon: Brain, chip: 'text-violet-300 bg-violet-400/10 ring-violet-400/20', dot: 'bg-violet-400', glow: 'from-violet-400/20', accent: 'from-violet-400/70' },
  strength: { label: 'Strength', icon: Trophy, chip: 'text-tp-green bg-tp-green/10 ring-tp-green/20', dot: 'bg-tp-green', glow: 'from-tp-green/20', accent: 'from-tp-green/70' },
};

// Snoozes live in this browser only: a convenience, never something that must persist.
function readSnoozed(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const now = Date.now();
    return Object.fromEntries(Object.entries(parsed).filter(([, until]) => until > now));
  } catch {
    return {};
  }
}

function writeSnoozed(v: Record<string, number>) {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(v));
  } catch {
    /* private mode or blocked storage: the snooze lasts for this visit only */
  }
}

function ImpactPanel({ insight }: { insight: CoachInsight }) {
  const good = insight.tone === 'good';
  const showMoney = insight.weight >= 250;
  const evidence = insight.evidence ?? [];
  if (!showMoney && !evidence.length) return null;

  return (
    <aside className="flex shrink-0 flex-col justify-center rounded-xl bg-black/25 p-4 ring-1 ring-inset ring-white/[0.06] md:w-60">
      {showMoney && (
        <div className={clsx(evidence.length && 'mb-3 border-b border-white/[0.06] pb-3')} title="Roughly what this pattern is worth, measured from your own trades.">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">{good ? 'Worth to you' : 'At stake'}</div>
          <div className={clsx('mt-0.5 text-2xl font-semibold tabular-nums tracking-tight', good ? 'text-tp-green' : 'text-tp-red')}>
            {good ? '+' : '−'}
            {usd0(insight.weight)}
          </div>
        </div>
      )}
      {evidence.length > 0 && (
        <dl className="space-y-1.5">
          {evidence.map((e) => (
            <div key={e.label} className="flex items-baseline justify-between gap-3">
              <dt className="truncate text-xs text-zinc-500">{e.label}</dt>
              <dd className="text-sm font-semibold tabular-nums text-zinc-100">{e.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}

export function CoachCard({ trades }: { trades: Trade[] }) {
  const mounted = useHasMounted();
  const { gamePlans, tradingRules, addTradingRule } = useRoutineStore();
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [held, setHeld] = useState(false); // paused by the button, until pressed again
  const [tick, setTick] = useState(0); // restarts the progress animation
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [showSnoozed, setShowSnoozed] = useState(false);

  useEffect(() => setSnoozed(readSnoozed()), []);

  const all = useMemo(() => {
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

  const insights = useMemo(() => (showSnoozed ? all : all.filter((i) => !snoozed[i.id])), [all, snoozed, showSnoozed]);
  const snoozedCount = all.length - all.filter((i) => !snoozed[i.id]).length;
  const count = insights.length;
  const paused = hovering || held;

  const go = useCallback(
    (d: number) => {
      if (!count) return;
      setIndex((i) => (i + d + count) % count);
      setTick((t) => t + 1);
    },
    [count],
  );
  const jump = (i: number) => {
    setIndex(i);
    setTick((t) => t + 1);
  };

  useEffect(() => setIndex(0), [count]);
  useEffect(() => {
    if (paused || count < 2) return;
    const t = setTimeout(() => go(1), ROTATE_MS);
    return () => clearTimeout(t);
  }, [paused, count, go, index, tick]);

  if (!mounted || !all.length) {
    return <div className="mb-6 h-[180px] animate-pulse rounded-2xl border border-white/[0.06] bg-tp-card/60" />;
  }

  // Everything snoozed: stay small and out of the way.
  if (!count) {
    return (
      <section className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-tp-card px-5 py-3.5">
        <span className="flex items-center gap-2.5 text-sm text-zinc-400">
          <Sparkles className="h-4 w-4 text-tp-green" />
          Pilot Coach · all caught up. {snoozedCount} tip{snoozedCount === 1 ? '' : 's'} snoozed.
        </span>
        <button type="button" onClick={() => setShowSnoozed(true)} className="text-xs font-medium text-zinc-400 hover:text-zinc-100">
          Show them
        </button>
      </section>
    );
  }

  const insight = insights[Math.min(index, count - 1)];
  const cat = CATEGORY[insight.category];
  const warnCount = insights.filter((i) => i.tone === 'warn').length;
  const ruleExists = tradingRules.some((r) => r.text.trim() === insight.action.trim());
  const isSnoozed = !!snoozed[insight.id];

  const toggleSnooze = () => {
    const next = { ...snoozed };
    if (isSnoozed) delete next[insight.id];
    else next[insight.id] = Date.now() + SNOOZE_DAYS * 86_400_000;
    setSnoozed(next);
    writeSnoozed(next);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Pilot coach"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
      className="relative mb-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-tp-card"
    >
      <style>
        {'@keyframes coachIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes coachBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes coachWord{from{opacity:0;filter:blur(3px)}to{opacity:1;filter:none}}@media (prefers-reduced-motion:reduce){.coach-motion{animation:none!important}}'}
      </style>

      {/* Category accent along the left edge, and a soft glow behind the content */}
      <div className={clsx('pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b to-transparent', cat.accent)} />
      <div key={`glow-${insight.id}`} className={clsx('pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-gradient-to-br to-transparent blur-3xl', cat.glow)} />

      {/* Header: who is talking, how much there is, and where you are in it */}
      <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-tp-green/30 to-tp-blue/25 ring-1 ring-inset ring-white/15">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-zinc-50">Pilot Coach</div>
            <div className="text-[11px] text-zinc-500">
              {trades.length ? `From your last ${trades.length} trades` : 'Discipline principles'} · {count} insight{count === 1 ? '' : 's'}
              {warnCount > 0 && <span className="text-tp-yellow"> · {warnCount} need{warnCount === 1 ? 's' : ''} attention</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => go(-1)} className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100" aria-label="Previous tip">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[34px] text-center text-xs tabular-nums text-zinc-500">
            {index + 1}/{count}
          </span>
          <button onClick={() => go(1)} className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100" aria-label="Next tip">
            <ChevronRight className="h-4 w-4" />
          </button>
          {count > 1 && (
            <button
              onClick={() => setHeld((v) => !v)}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100"
              aria-label={held ? 'Resume rotating tips' : 'Pause rotating tips'}
              aria-pressed={held}
            >
              {held ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </header>

      {/* Topic strip: every tip by name, with its progress */}
      <nav aria-label="Coaching topics" className="relative flex gap-1.5 overflow-x-auto px-5 pt-3 [scrollbar-width:none]">
        {insights.map((it, i) => {
          const c = CATEGORY[it.category];
          const active = i === index;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => jump(i)}
              aria-current={active ? 'true' : undefined}
              className={clsx(
                'relative flex min-w-0 max-w-[13rem] shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors',
                active ? 'bg-white/[0.08] text-zinc-100 ring-white/[0.12]' : 'text-zinc-500 ring-white/[0.05] hover:bg-white/[0.04] hover:text-zinc-300',
              )}
            >
              <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', c.dot, !active && 'opacity-60')} />
              <span className="truncate">{it.title}</span>
              {active && count > 1 && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.06]">
                  <span
                    key={`${tick}-${index}`}
                    className="coach-motion block h-full origin-left bg-white/60"
                    style={{ animation: `coachBar ${ROTATE_MS}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Body: the read on the left, what it is worth on the right */}
      <div key={insight.id} className="relative flex flex-col gap-4 px-5 pb-4 pt-4 [animation:coachIn_.35s_ease-out] md:flex-row md:items-stretch md:gap-6" aria-live="polite">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', cat.chip)}>
              <cat.icon className="h-3 w-3" />
              {cat.label}
            </span>
            {insight.tone === 'warn' && <span className="text-[11px] font-medium text-tp-yellow">Needs attention</span>}
            {insight.tone === 'good' && <span className="text-[11px] font-medium text-tp-green">Keep doing this</span>}
            {isSnoozed && <span className="text-[11px] font-medium text-zinc-500">Snoozed</span>}
          </div>
          <h3 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-zinc-50">{insight.title}</h3>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-400" aria-label={insight.detail}>
            {/* Words stream in like a live reply */}
            {insight.detail.split(' ').map((word, i) => (
              <span key={i} aria-hidden className="coach-motion inline-block whitespace-pre opacity-0 [animation:coachWord_.3s_ease-out_forwards]" style={{ animationDelay: `${80 + i * 18}ms` }}>
                {word}{' '}
              </span>
            ))}
          </p>
        </div>
        <ImpactPanel insight={insight} />
      </div>

      {/* Action bar: the one habit to try, and what to do with it */}
      <footer className="relative flex flex-col gap-3 border-t border-white/[0.05] bg-black/15 px-5 py-3 md:flex-row md:items-center md:justify-between">
        <p className="flex min-w-0 items-start gap-2 text-sm text-zinc-200">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-tp-green" />
          <span>
            <span className="font-semibold text-zinc-50">Try: </span>
            {insight.action}
          </span>
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSnooze}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200"
            title={isSnoozed ? 'Bring this tip back now' : `Hide this tip for ${SNOOZE_DAYS} days`}
          >
            <BellOff className="h-3.5 w-3.5" />
            {isSnoozed ? 'Unsnooze' : `Snooze ${SNOOZE_DAYS}d`}
          </button>
          {ruleExists ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-tp-green" title="Preflight grades it every day">
              <Check className="h-3.5 w-3.5" /> In your rules
            </span>
          ) : (
            <button
              type="button"
              onClick={() => addTradingRule(insight.action, RULE_CATEGORY[insight.category])}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-white/[0.1] transition hover:bg-white/[0.06] hover:text-zinc-50"
            >
              <Plus className="h-3.5 w-3.5" /> Make it a rule
            </button>
          )}
          <Link
            href={`/app/pilot?ask=${encodeURIComponent(insight.ask)}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            <Sparkles className="h-3.5 w-3.5" /> Ask Pilot
          </Link>
        </div>
      </footer>
    </section>
  );
}
