'use client';

import React from 'react';
import clsx from 'clsx';
import { Gauge, AlertTriangle, Target, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
          {/* Hero band — the answer, full width */}
          <div className={clsx('rounded-2xl border p-5 sm:p-6', dark ? 'border-white/[0.06] bg-tp-base/40' : 'border-gray-100 bg-gray-50')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={clsx('text-xs font-medium uppercase tracking-wide', muted)}>Estimated time to payout</p>
                <p className={clsx('mt-1 flex items-baseline gap-2 text-5xl font-bold tracking-tight', text)}>
                  ~{projection.totalDays}
                  <span className="text-xl font-semibold text-zinc-500">trading days</span>
                </p>
                <p className={clsx('mt-1.5 text-sm', muted)}>
                  ~{projection.calendarWeeks} weeks · {Math.round(winRatePercent)}% win rate · {formatCurrency(projection.expectedDailyPnL)}/day avg
                </p>
              </div>
              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                  consistencyOk ? 'bg-tp-green/10 text-tp-green' : 'bg-tp-yellow/10 text-tp-yellow'
                )}
              >
                {consistencyOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {consistencyOk ? 'On track' : 'Consistency at risk'}
              </span>
            </div>
            <RangeTrack best={idealDays} realistic={projection.totalDays} dark={dark} muted={muted} text={text} />
          </div>

          {/* Consistency + Progress — two clean cards */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Consistency */}
            <div
              className={clsx(
                'flex items-center gap-5 rounded-2xl border p-5',
                consistencyOk
                  ? dark ? 'border-tp-green/20 bg-tp-green/[0.04]' : 'border-green-200 bg-green-50'
                  : dark ? 'border-tp-yellow/25 bg-tp-yellow/[0.05]' : 'border-yellow-200 bg-yellow-50'
              )}
            >
              <div className="shrink-0">
                <RadialGauge
                  score={edge.consistencyScore}
                  rule={edge.consistencyRule}
                  isLinked={edge.isLinked}
                  ok={consistencyOk}
                  dark={dark}
                  text={text}
                />
              </div>
              <div className="min-w-0">
                <p className={clsx('text-xs font-medium uppercase tracking-wide', muted)}>Consistency</p>
                <p className={clsx('mt-1.5 text-sm leading-relaxed', dark ? 'text-zinc-300' : 'text-gray-600')}>
                  {edge.isLinked
                    ? consistencyOk
                      ? `On track — your best day ${formatCurrency(edge.bestDay)} is within the ${edge.consistencyRule}% cap.`
                      : `Over the line — best day ${formatCurrency(edge.bestDay)} is too big. Spread your green days to clear it.`
                    : `Link an account to track this live. Your best single day must stay under ${edge.consistencyRule}% of total profit.`}
                </p>
              </div>
            </div>

            {/* Progress to target */}
            <div className={clsx('rounded-2xl border p-5', dark ? 'border-white/[0.06] bg-tp-base/40' : 'border-gray-100 bg-gray-50')}>
              <div className="flex items-center justify-between">
                <p className={clsx('text-xs font-medium uppercase tracking-wide', muted)}>Progress to target</p>
                <span className="text-2xl font-bold text-tp-green">{progressPercent.toFixed(0)}%</span>
              </div>
              <div className={clsx('mt-3 h-2.5 overflow-hidden rounded-full', dark ? 'bg-white/[0.06]' : 'bg-gray-200')}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-tp-green to-tp-blue transition-all duration-500"
                  style={{ width: `${Math.max(2, progressPercent)}%` }}
                />
              </div>
              <p className={clsx('mt-2.5 text-sm', muted)}>
                {formatCurrency(edge.currentProfit)} of {formatCurrency(edge.effectiveTarget)} · <span className={text}>{formatCurrency(gap)}</span> to go
              </p>
            </div>
          </div>

          {/* Distinct stats */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat
              label="Daily ceiling"
              tip="The most a single day should make. Going over tightens your consistency target."
              value={formatCurrency(edge.dailyCeiling)}
              sub={`${edge.consistencyRule}% rule`}
              accent="yellow"
            />
            <MiniStat
              label="Avg per day"
              tip="Expected net P&L per trading day at your current edge."
              value={formatCurrency(projection.expectedDailyPnL)}
              sub="at your edge"
              accent="green"
            />
            <MiniStat
              label="Best-case pace"
              tip="Days to pass if every session hits the daily ceiling. Optimistic upper bound."
              value={`${idealDays} days`}
              sub="if every day maxes"
              accent="blue"
            />
            <MiniStat
              label="Drawdown buffer"
              tip="Trailing room below your peak before the account fails."
              value={formatCurrency(edge.drawdownLimit)}
              sub={`${projection.lossStreakToFail} loss days to fail`}
              accent="red"
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

// ─── Time-to-payout range track (best case → realistic) ──────────────────────

const RangeTrack: React.FC<{ best: number; realistic: number; dark: boolean; muted: string; text: string }> = ({
  best,
  realistic,
  dark,
  muted,
  text,
}) => {
  const max = Math.max(realistic * 1.25, best + 1, 1);
  const bestPct = Math.min(100, (best / max) * 100);
  const realPct = Math.min(100, (realistic / max) * 100);

  return (
    <div className="mt-5">
      <div className={clsx('relative h-2.5 rounded-full', dark ? 'bg-white/[0.06]' : 'bg-gray-200')}>
        {/* best → realistic band */}
        <div
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-tp-green/70 to-tp-blue/70"
          style={{ left: `${bestPct}%`, width: `${Math.max(2, realPct - bestPct)}%` }}
        />
        {/* markers */}
        <Marker pct={bestPct} color="#00D68F" />
        <Marker pct={realPct} color="#4F9CF9" />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-tp-green" />
          <span className={muted}>Best case</span>
          <span className={clsx('font-semibold', text)}>{best}d</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={clsx('font-semibold', text)}>{realistic}d</span>
          <span className={muted}>Realistic</span>
          <span className="h-2 w-2 rounded-full bg-tp-blue" />
        </span>
      </div>
    </div>
  );
};

const Marker: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <span
    className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tp-base"
    style={{ left: `${pct}%`, background: color }}
  />
);

// ─── Consistency radial gauge ────────────────────────────────────────────────

const RadialGauge: React.FC<{ score: number; rule: number; isLinked: boolean; ok: boolean; dark: boolean; text: string }> = ({
  score,
  rule,
  isLinked,
  ok,
  dark,
  text,
}) => {
  const size = 132;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = isLinked && rule > 0 ? Math.min(1, score / rule) : 0;
  const color = ok ? '#00D68F' : '#FFB800';

  return (
    <div className="relative my-2" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? 'rgba(255,255,255,0.07)' : '#e5e7eb'} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 500ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={clsx('text-3xl font-bold', ok ? 'text-tp-green' : 'text-tp-yellow')}>
          {isLinked ? `${Math.round(score)}%` : '—'}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-zinc-500">
          {ok ? <Target className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
          {rule}% max
        </span>
      </div>
    </div>
  );
};
