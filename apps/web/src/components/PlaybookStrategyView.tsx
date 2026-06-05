'use client';

import Image from 'next/image';
import React from 'react';
import {
  ArrowLeft,
  Target,
  TrendingUp,
  LogOut,
  Shield,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Gauge,
  BookOpen,
} from 'lucide-react';
import clsx from 'clsx';
import type { PlaybookStrategy } from './Playbooks';
import { buildStrategyChart } from '@/lib/strategyChart';

const DIFF_STYLE: Record<PlaybookStrategy['difficulty'], string> = {
  Beginner: 'bg-tp-green/15 text-tp-green border-tp-green/30',
  Intermediate: 'bg-tp-yellow/15 text-tp-yellow border-tp-yellow/30',
  Advanced: 'bg-tp-red/15 text-tp-red border-tp-red/30',
};

export const PlaybookStrategyView: React.FC<{ strategy: PlaybookStrategy; onBack: () => void }> = ({ strategy, onBack }) => {
  const heroChart = buildStrategyChart({
    symbol: 'NQ',
    subtitle: `${strategy.timeframe} · ${strategy.name}`,
    direction: 'Long',
    variant: 0,
  });

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100">
        <ArrowLeft className="h-4 w-4" />
        All strategies
      </button>

      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8"
        style={{ background: 'linear-gradient(135deg, rgba(0,214,143,0.10) 0%, rgba(79,156,249,0.06) 55%, rgba(23,32,53,0.5) 100%)' }}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={clsx('rounded-full border px-2.5 py-1 text-xs font-semibold', DIFF_STYLE[strategy.difficulty])}>
                {strategy.difficulty}
              </span>
              <Chip icon={<Clock className="h-3 w-3" />}>{strategy.timeframe}</Chip>
              <Chip icon={<Activity className="h-3 w-3" />}>{strategy.marketCondition}</Chip>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">{strategy.name}</h1>
            <p className="mt-3 text-base leading-relaxed text-zinc-300">{strategy.description}</p>
          </div>

          {/* Headline stat */}
          <div className="shrink-0 rounded-2xl border border-tp-green/20 bg-tp-green/[0.06] px-6 py-4 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Historical win rate</div>
            <div className="mt-1 text-5xl font-bold text-tp-green">{strategy.winRate}%</div>
            <div className="mt-1 text-xs text-zinc-400">avg {strategy.riskReward} risk:reward</div>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<TrendingUp className="h-4 w-4 text-tp-green" />} label="Win rate" value={`${strategy.winRate}%`} />
        <StatCard icon={<Gauge className="h-4 w-4 text-tp-blue" />} label="Risk : reward" value={strategy.riskReward} />
        <StatCard icon={<Clock className="h-4 w-4 text-tp-yellow" />} label="Timeframe" value={strategy.timeframe} />
        <StatCard icon={<Activity className="h-4 w-4 text-zinc-300" />} label="Best in" value={strategy.marketCondition} small />
      </div>

      {/* The idea + anatomy chart */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Section title="The idea" icon={<BookOpen className="h-4 w-4 text-tp-green" />}>
          <p className="text-[15px] leading-relaxed text-zinc-300">{strategy.overview}</p>
        </Section>

        <div className="rounded-2xl border border-white/[0.06] bg-tp-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-tp-blue" />
            <h2 className="text-sm font-semibold text-zinc-100">Anatomy of the setup</h2>
          </div>
          <figure className="overflow-hidden rounded-xl border border-white/[0.06]">
            <Image src={heroChart} alt={`${strategy.name} setup`} width={720} height={320} unoptimized className="h-auto w-full" />
            <figcaption className="bg-tp-base/40 px-3 py-2 text-[11px] text-zinc-500">
              Wait for the reaction at the key level, enter on confirmation, stop just beyond it, target the next level.
            </figcaption>
          </figure>
        </div>
      </div>

      {/* The playbook — entry / exit / risk */}
      <div className="grid gap-4 lg:grid-cols-3">
        <RuleColumn title="Entry rules" tone="green" icon={<TrendingUp className="h-4 w-4" />} rules={strategy.entryRules} numbered />
        <RuleColumn title="Exit rules" tone="blue" icon={<LogOut className="h-4 w-4" />} rules={strategy.exitRules} numbered />
        <RuleColumn title="Risk management" tone="red" icon={<Shield className="h-4 w-4" />} rules={strategy.riskManagement} />
      </div>

      {/* Worked examples */}
      <Section title="Worked examples" icon={<Target className="h-4 w-4 text-tp-green" />}>
        <div className="space-y-5">
          {strategy.examples.map((ex, i) => {
            const isWin = /\+|profit|win/i.test(ex.result);
            const chart = buildStrategyChart({
              symbol: i % 2 === 0 ? 'ES' : 'NQ',
              subtitle: ex.title,
              direction: i % 2 === 0 ? 'Long' : 'Short',
              variant: i % 2 === 0 ? 2 : 1,
            });
            return (
              <div key={i} className="overflow-hidden rounded-xl border border-white/[0.06] bg-tp-base/40">
                <div className="grid gap-0 lg:grid-cols-2">
                  <figure className="border-b border-white/[0.06] lg:border-b-0 lg:border-r">
                    <Image src={chart} alt={ex.title} width={720} height={320} unoptimized className="h-auto w-full" />
                  </figure>
                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h4 className="text-base font-bold text-zinc-100">{ex.title}</h4>
                      <span className={clsx('rounded-full px-2.5 py-1 text-xs font-bold', isWin ? 'bg-tp-green/15 text-tp-green' : 'bg-tp-red/15 text-tp-red')}>
                        {ex.result}
                      </span>
                    </div>
                    <p className="mb-3 text-sm text-zinc-400">{ex.description}</p>
                    <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                      <ExRow label="Setup" tone="blue" value={ex.setup} />
                      <ExRow label="Entry" tone="green" value={ex.entry} />
                      <ExRow label="Exit" tone="yellow" value={ex.exit} />
                    </dl>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Edge & pitfalls */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-tp-green/20 bg-tp-green/[0.04] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-tp-green" />
            <h2 className="text-sm font-semibold text-zinc-100">What gives you the edge</h2>
          </div>
          <ul className="space-y-2.5">
            {strategy.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-tp-green" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-tp-red/20 bg-tp-red/[0.04] p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-tp-red" />
            <h2 className="text-sm font-semibold text-zinc-100">What blows it up</h2>
          </div>
          <ul className="space-y-2.5">
            {strategy.commonMistakes.map((m, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tp-red" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-center text-xs text-zinc-500">
        Educational playbook · win rate and R:R are illustrative. Backtest on your own data before trading live.
      </p>
    </div>
  );
};

// ─── Bits ────────────────────────────────────────────────────────────────────

const Chip: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-zinc-300">
    {icon}
    {children}
  </span>
);

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; small?: boolean }> = ({ icon, label, value, small }) => (
  <div className="rounded-xl border border-white/[0.06] bg-tp-card p-4">
    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
      {icon}
      {label}
    </div>
    <div className={clsx('mt-1.5 font-bold text-zinc-100', small ? 'text-sm' : 'text-2xl')}>{value}</div>
  </div>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="rounded-2xl border border-white/[0.06] bg-tp-card p-5 sm:p-6">
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
    </div>
    {children}
  </div>
);

const TONE: Record<'green' | 'blue' | 'red', { text: string; bg: string; border: string }> = {
  green: { text: 'text-tp-green', bg: 'bg-tp-green/15', border: 'border-tp-green/20' },
  blue: { text: 'text-tp-blue', bg: 'bg-tp-blue/15', border: 'border-tp-blue/20' },
  red: { text: 'text-tp-red', bg: 'bg-tp-red/15', border: 'border-tp-red/20' },
};

const RuleColumn: React.FC<{
  title: string;
  tone: 'green' | 'blue' | 'red';
  icon: React.ReactNode;
  rules: string[];
  numbered?: boolean;
}> = ({ title, tone, icon, rules, numbered }) => {
  const t = TONE[tone];
  return (
    <div className={clsx('rounded-2xl border bg-tp-card p-5', t.border)}>
      <div className="mb-4 flex items-center gap-2">
        <span className={clsx('grid h-7 w-7 place-items-center rounded-lg', t.bg, t.text)}>{icon}</span>
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      </div>
      <ul className="space-y-3">
        {rules.map((rule, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-300">
            {numbered ? (
              <span className={clsx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold', t.bg, t.text)}>{i + 1}</span>
            ) : (
              <Shield className={clsx('mt-0.5 h-4 w-4 shrink-0', t.text)} />
            )}
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
};

const EX_TONE: Record<'green' | 'blue' | 'yellow', string> = {
  green: 'text-tp-green',
  blue: 'text-tp-blue',
  yellow: 'text-tp-yellow',
};

const ExRow: React.FC<{ label: string; tone: 'green' | 'blue' | 'yellow'; value: string }> = ({ label, tone, value }) => (
  <div>
    <dt className={clsx('text-[11px] font-semibold uppercase tracking-wide', EX_TONE[tone])}>{label}</dt>
    <dd className="mt-0.5 text-zinc-400">{value}</dd>
  </div>
);
