'use client';

import React from 'react';
import clsx from 'clsx';
import { Gauge, TrendingUp, AlertTriangle } from 'lucide-react';
import { useThemeClasses, SectionHeader, MiniStat, AdviceLine } from './payoutPrimitives';
import { formatCurrency, PathProjection } from './payoutMath';

export interface EdgeData {
  /** Profit accrued so far on the live/linked account (0 if none). */
  currentProfit: number;
  /** Best single day so far (0 if none). */
  bestDay: number;
  /** Effective target after consistency adjustment. */
  effectiveTarget: number;
  /** Daily ceiling implied by the consistency rule. */
  dailyCeiling: number;
  /** Drawdown buffer in dollars. */
  drawdownLimit: number;
  /** Current consistency score (best day as % of total profit). */
  consistencyScore: number;
  /** Firm's consistency rule %. */
  consistencyRule: number;
  /** Trading days logged so far. */
  tradingDays: number;
  isLinked: boolean;
}

interface EdgeTrackerProps {
  edge: EdgeData;
  projection: PathProjection;
  winRatePercent: number;
  idealDays: number;
}

export const EdgeTracker: React.FC<EdgeTrackerProps> = ({ edge, projection, winRatePercent, idealDays }) => {
  const { card, text, muted, dark } = useThemeClasses();
  const gap = Math.max(0, edge.effectiveTarget - edge.currentProfit);
  const progressPercent = edge.effectiveTarget > 0 ? Math.min(100, (edge.currentProfit / edge.effectiveTarget) * 100) : 0;
  const consistencyOk = edge.currentProfit === 0 || edge.consistencyScore <= edge.consistencyRule;

  const status = projection.expectedDailyPnL <= 0 ? 'negative' : projection.blownAccount ? 'blown' : 'ok';

  return (
    <div className={clsx(card, 'p-6 sm:p-8')}>
      <SectionHeader
        icon={<Gauge className="h-4 w-4 text-tp-green" />}
        title="Your edge vs the firm"
        subtitle="Are you on track to pass and clear the consistency rule? This is where you stay ahead of the firm's traps."
      />

      {status === 'negative' && (
        <AdviceLine tone="warn">
          Negative expectancy at these settings — your win rate and R:R don&apos;t cover losses. Fix the strategy before payout is even possible.
        </AdviceLine>
      )}
      {status === 'blown' && (
        <AdviceLine tone="warn">
          Trailing drawdown breached in the simulation after {projection.totalDays} days. Risk per trade is too high for the {formatCurrency(edge.drawdownLimit)} buffer.
        </AdviceLine>
      )}

      {status === 'ok' && (
        <>
          {/* Hero timeline */}
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className={clsx('text-sm font-medium', muted)}>Estimated time to payout</p>
              <p className={clsx('mt-1 text-4xl font-bold tracking-tight sm:text-5xl', text)}>
                ~{projection.totalDays}
                <span className="ml-2 text-2xl font-semibold text-zinc-500">trading days</span>
              </p>
              <p className={clsx('mt-2 text-sm', muted)}>
                ~{projection.calendarWeeks} weeks · {Math.round(winRatePercent)}% win rate · {formatCurrency(projection.expectedDailyPnL)}/day avg · {formatCurrency(gap)} still needed
              </p>
            </div>

            {/* Consistency gauge */}
            <div
              className={clsx(
                'rounded-xl border p-4',
                consistencyOk
                  ? dark
                    ? 'border-tp-green/25 bg-tp-green/5'
                    : 'border-green-200 bg-green-50'
                  : dark
                    ? 'border-tp-yellow/30 bg-tp-yellow/5'
                    : 'border-yellow-200 bg-yellow-50'
              )}
            >
              <p className={clsx('text-xs font-medium uppercase tracking-wide', muted)}>Consistency score</p>
              <p className={clsx('mt-1 text-3xl font-bold', consistencyOk ? 'text-tp-green' : 'text-tp-yellow')}>
                {edge.isLinked ? `${edge.consistencyScore.toFixed(0)}%` : '—'}
                <span className="ml-2 text-sm font-medium text-zinc-500">/ {edge.consistencyRule}% max</span>
              </p>
              <p className={clsx('mt-1 text-xs', muted)}>
                {edge.isLinked
                  ? consistencyOk
                    ? `Clear — best day ${formatCurrency(edge.bestDay)} is within range.`
                    : `Tightening target — best day ${formatCurrency(edge.bestDay)} is too big.`
                  : 'Link an account to track your live consistency.'}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm">
              <span className={muted}>
                {formatCurrency(edge.currentProfit)} of {formatCurrency(edge.effectiveTarget)}
              </span>
              <span className="font-medium text-tp-green">{progressPercent.toFixed(0)}%</span>
            </div>
            <div className={clsx('h-2 overflow-hidden rounded-full', dark ? 'bg-white/[0.06]' : 'bg-gray-100')}>
              <div className="h-full rounded-full bg-tp-green transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          {/* Key edge stats */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat
              label="Daily ceiling"
              tip="The most you should let a single day make. Going over tightens your consistency target."
              value={formatCurrency(edge.dailyCeiling)}
              sub={`${edge.consistencyRule}% rule`}
              accent="yellow"
            />
            <MiniStat
              label="Gap to goal"
              tip="Profit still needed to qualify for payout, after consistency adjustment."
              value={formatCurrency(gap)}
            />
            <MiniStat
              label="DD buffer"
              tip="Trailing room below your peak before the account fails."
              value={formatCurrency(edge.drawdownLimit)}
              sub={`${projection.lossStreakToFail} loss days to fail`}
              accent="red"
            />
            <MiniStat
              label="Best-case pace"
              tip="Days to pass if every session hits the daily ceiling. Optimistic upper bound."
              value={`${idealDays} days`}
              sub="if every day maxes"
              accent="blue"
            />
          </div>

          {/* Scenario row */}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Scenario label="Best case" tone="green" days={idealDays} detail="Every day hits the daily ceiling" />
            <Scenario
              label="Realistic"
              tone="blue"
              days={projection.totalDays}
              detail={`${projection.winDays || Math.round(projection.totalDays * (winRatePercent / 100))}W · ${projection.lossDays || projection.totalDays - Math.round(projection.totalDays * (winRatePercent / 100))}L at ${Math.round(winRatePercent)}%`}
            />
            <Scenario
              label="Stress test"
              tone="red"
              days={projection.lossStreakToFail}
              detail={`Loss days from peak to breach ${formatCurrency(edge.drawdownLimit)} trail`}
            />
          </div>

          {!consistencyOk && edge.isLinked && (
            <p className="mt-4 inline-flex items-start gap-2 rounded-lg bg-tp-yellow/10 px-3 py-2 text-xs text-tp-yellow">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Consistency rule is raising your effective target to {formatCurrency(edge.effectiveTarget)}. You need more total profit before that {formatCurrency(edge.bestDay)} day qualifies.
            </p>
          )}
        </>
      )}
    </div>
  );
};

const TONE_BORDER = {
  green: 'border-tp-green/20',
  blue: 'border-tp-blue/20',
  red: 'border-tp-red/20',
} as const;

const Scenario: React.FC<{ label: string; tone: keyof typeof TONE_BORDER; days: number; detail: string }> = ({
  label,
  tone,
  days,
  detail,
}) => {
  const { card, text, muted } = useThemeClasses();
  return (
    <div className={clsx(card, 'p-4', TONE_BORDER[tone])}>
      <div className={clsx('flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide', muted)}>
        {tone === 'green' && <TrendingUp className="h-3.5 w-3.5 text-tp-green" />}
        {tone === 'red' && <AlertTriangle className="h-3.5 w-3.5 text-tp-red" />}
        {label}
      </div>
      <div className={clsx('mt-1 text-2xl font-bold', text)}>
        {days}
        <span className="ml-1 text-sm font-normal text-zinc-500">days</span>
      </div>
      <p className={clsx('mt-1 text-xs leading-relaxed', muted)}>{detail}</p>
    </div>
  );
};
