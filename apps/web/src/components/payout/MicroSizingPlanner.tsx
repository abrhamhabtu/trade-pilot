'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { Crosshair } from 'lucide-react';
import { useThemeClasses, SectionHeader, MiniStat, PillToggle, NumberInput, AdviceLine } from './payoutPrimitives';
import { projectMicroPlan, formatCurrency, MicroDay, TRADING_DAYS_PER_WEEK } from './payoutMath';
import { MICRO_POINT_VALUE } from './propFirmData';

export interface MicroPlanState {
  symbol: string;
  contracts: number;
  stopPts: number;
  dailyAim: number;
}

interface MicroSizingPlannerProps {
  plan: MicroPlanState;
  onChange: (patch: Partial<MicroPlanState>) => void;
  rewardToRisk: number;
  tradesPerDay: number;
  winRatePercent: number;
  dailyCap: number;
  drawdownLimit: number;
  gapToGoal: number;
}

const CONTRACT_OPTIONS = [2, 3, 5];
const STOP_OPTIONS = [20, 25, 30, 35, 40];
const AIM_PRESETS = [200, 250, 300, 350, 400, 500];

export const MicroSizingPlanner: React.FC<MicroSizingPlannerProps> = ({
  plan,
  onChange,
  rewardToRisk,
  tradesPerDay,
  winRatePercent,
  dailyCap,
  drawdownLimit,
  gapToGoal,
}) => {
  const { card, inset, text, muted } = useThemeClasses();

  const proj = useMemo(
    () =>
      projectMicroPlan({
        symbol: plan.symbol,
        contracts: plan.contracts,
        stopPts: plan.stopPts,
        rewardToRisk,
        tradesPerDay,
        winRatePercent,
        dailyAim: plan.dailyAim,
        dailyCap,
        drawdownLimit,
        gapToGoal,
      }),
    [plan, rewardToRisk, tradesPerDay, winRatePercent, dailyCap, drawdownLimit, gapToGoal]
  );

  const advice = useMemo(() => {
    const lines: { tone: 'neutral' | 'warn' | 'good'; text: string }[] = [];
    if (dailyCap > 0) {
      lines.push({
        tone: 'good',
        text: `Aim for ${formatCurrency(plan.dailyAim)}/day — the ${formatCurrency(dailyCap)} consistency cap is the ceiling, not the goal.`,
      });
    }
    if (!proj.dailyAimFeasible && plan.dailyAim > 0) {
      lines.push({
        tone: 'warn',
        text: `${formatCurrency(plan.dailyAim)}/day is tight at ${plan.contracts} ${plan.symbol} — max green day here is ${formatCurrency(proj.maxNaturalWinDay)}. Size up, add a trade, or trim your aim.`,
      });
    } else if (proj.dailyAimFeasible && proj.pointsForDailyAim > 0) {
      lines.push({
        tone: 'good',
        text: `${formatCurrency(plan.dailyAim)}/day ≈ ${proj.pointsForDailyAim} ${plan.symbol} points at ${rewardToRisk.toFixed(1)}R — reachable without chasing.`,
      });
    }
    if (plan.contracts >= 5) {
      lines.push({ tone: 'warn', text: `5 ${plan.symbol} is your ceiling. On choppy days drop to 2–3 — you don't need a hero session to pass.` });
    } else {
      lines.push({ tone: 'good', text: `${plan.contracts} ${plan.symbol} keeps you boring on purpose. That discipline is how you survive a ${formatCurrency(drawdownLimit)} trail.` });
    }
    if (proj.badDayBuffer < 5) {
      lines.push({ tone: 'warn', text: `Only ~${Math.max(1, proj.badDayBuffer)} full loss day(s) from peak before drawdown breaches. Size down before you need a comeback.` });
    } else {
      lines.push({ tone: 'good', text: `~${proj.badDayBuffer} max-loss days of buffer — room to breathe while you grind.` });
    }
    return lines.slice(0, 4);
  }, [dailyCap, drawdownLimit, plan, proj, rewardToRisk]);

  return (
    <div className={clsx(card, 'p-6 sm:p-8')}>
      <SectionHeader
        icon={<Crosshair className="h-4 w-4 text-tp-blue" />}
        title="Micro sizing plan"
        subtitle="Trade small, stay alive. Pick your size and daily aim — see the slow-but-safe path to your goal, even if it takes weeks."
      />

      {/* Symbol + contracts + stop */}
      <div className="space-y-4">
        <div>
          <label className={clsx('mb-2 block text-xs font-medium uppercase tracking-wide', muted)}>Instrument</label>
          <PillToggle
            options={Object.keys(MICRO_POINT_VALUE).map((s) => ({ value: s, label: `${s} ($${MICRO_POINT_VALUE[s]}/pt)` }))}
            value={plan.symbol}
            onChange={(v) => onChange({ symbol: String(v) })}
            accent="blue"
          />
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <label className={clsx('mb-2 block text-xs font-medium uppercase tracking-wide', muted)}>Contracts</label>
            <PillToggle
              options={CONTRACT_OPTIONS.map((n) => ({ value: n, label: `${n} ${plan.symbol}` }))}
              value={plan.contracts}
              onChange={(v) => onChange({ contracts: Number(v) })}
            />
          </div>
          <div>
            <label className={clsx('mb-2 block text-xs font-medium uppercase tracking-wide', muted)}>Stop (points)</label>
            <PillToggle
              options={STOP_OPTIONS.map((n) => ({ value: n, label: `${n}pt` }))}
              value={plan.stopPts}
              onChange={(v) => onChange({ stopPts: Number(v) })}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="w-40">
            <NumberInput label="Daily profit aim" prefix="$" value={plan.dailyAim} min={50} max={5000} step={25} onChange={(v) => onChange({ dailyAim: Number(v) || 0 })} />
          </div>
          <PillToggle
            options={AIM_PRESETS.map((a) => ({ value: a, label: `$${a}` }))}
            value={plan.dailyAim}
            onChange={(v) => onChange({ dailyAim: Number(v) })}
          />
        </div>
      </div>

      {/* Size summary */}
      <p className={clsx(inset, 'mt-5 px-4 py-3 text-sm')}>
        <span className={text}>
          {plan.contracts} {plan.symbol} × {plan.stopPts}pt stop
        </span>{' '}
        · <span className={text}>${proj.dollarsPerPoint}/pt</span> →{' '}
        <span className="font-medium text-tp-red">{formatCurrency(proj.riskPerTrade)}</span> risk/trade ·{' '}
        <span className="font-medium text-tp-green">+{formatCurrency(proj.winPerTrade)}</span> at {rewardToRisk.toFixed(1)}R
      </p>

      {/* Realistic vs best case */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className={clsx(inset, 'p-4')}>
          <p className={clsx('text-xs font-medium uppercase tracking-wide', muted)}>Realistic — with red days</p>
          <p className={clsx('mt-1 text-3xl font-bold tracking-tight', proj.blown ? 'text-tp-red' : text)}>
            {proj.blown ? 'Blown' : `~${proj.realisticDays || '—'}`}
            {!proj.blown && <span className="ml-2 text-base font-semibold text-zinc-500">days</span>}
          </p>
          <p className={clsx('mt-1 text-sm', muted)}>
            {proj.blown
              ? `Drawdown breaches at ${winRatePercent}% win rate before you reach goal — size down.`
              : `${proj.winDays}W · ${proj.lossDays}L at ${winRatePercent}% win rate · ~${proj.realisticWeeks} weeks`}
          </p>
        </div>
        <div className={clsx(inset, 'p-4')}>
          <p className={clsx('text-xs font-medium uppercase tracking-wide', muted)}>Best case — green every day</p>
          <p className={clsx('mt-1 text-3xl font-bold tracking-tight text-tp-green')}>
            ~{proj.daysToGoal || '—'}
            <span className="ml-2 text-base font-semibold text-zinc-500">days</span>
          </p>
          <p className={clsx('mt-1 text-sm', muted)}>
            Hitting {formatCurrency(plan.dailyAim)} every session · ~{proj.calendarWeeks} weeks. Rarely happens — plan for the left.
          </p>
        </div>
      </div>

      {/* Calendar */}
      {proj.path.length > 0 && (
        <MicroCalendar path={proj.path} blown={proj.blown} reachedGoal={proj.reachedGoal} />
      )}

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Daily aim" value={formatCurrency(plan.dailyAim)} sub={proj.dailyAimFeasible ? 'reachable' : 'too high here'} accent={proj.dailyAimFeasible ? 'green' : 'yellow'} />
        <MiniStat label="Loss day" value={formatCurrency(proj.lossDayPnL)} sub={`${plan.contracts} ${plan.symbol} × ${plan.stopPts}pt`} accent="red" />
        <MiniStat label="Ceiling" value={dailyCap > 0 ? formatCurrency(dailyCap) : '—'} sub="don't chase" accent="yellow" />
        <MiniStat label="Bad-day buffer" value={`~${proj.badDayBuffer}d`} sub="losses from peak to fail" accent="red" />
      </div>

      {/* Advice */}
      <div className="mt-5 space-y-2">
        {advice.map((line, i) => (
          <AdviceLine key={i} tone={line.tone}>
            {line.text}
          </AdviceLine>
        ))}
      </div>
    </div>
  );
};

// ─── Trading-day calendar ──────────────────────────────────────────────────────

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const MAX_WEEKS = 12;

const MicroCalendar: React.FC<{ path: MicroDay[]; blown: boolean; reachedGoal: boolean }> = ({
  path,
  blown,
  reachedGoal,
}) => {
  const { inset, text, muted, dark } = useThemeClasses();

  // Group into weeks of 5 trading days.
  const weeks: MicroDay[][] = [];
  for (let i = 0; i < path.length; i += TRADING_DAYS_PER_WEEK) {
    weeks.push(path.slice(i, i + TRADING_DAYS_PER_WEEK));
  }
  const shown = weeks.slice(0, MAX_WEEKS);
  const hiddenWeeks = weeks.length - shown.length;

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className={clsx('text-xs font-medium uppercase tracking-wide', muted)}>
          Projected path — green wins, red losses
        </p>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-tp-green/50" /> Win
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-tp-red/40" /> Loss
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm ring-2 ring-tp-green ring-offset-1 ring-offset-transparent" /> Goal
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Weekday header */}
          <div className="mb-1.5 grid grid-cols-[2.5rem_repeat(5,minmax(3rem,1fr))] gap-1.5">
            <span />
            {WEEKDAYS.map((d) => (
              <span key={d} className={clsx('text-center text-[10px] font-medium uppercase', muted)}>
                {d}
              </span>
            ))}
          </div>

          {shown.map((week, wi) => {
            return (
              <div key={wi} className="mb-1.5 grid grid-cols-[2.5rem_repeat(5,minmax(3rem,1fr))] items-stretch gap-1.5">
                <span className={clsx('flex items-center text-[10px] font-medium', muted)}>W{wi + 1}</span>
                {Array.from({ length: TRADING_DAYS_PER_WEEK }).map((_, di) => {
                  const day = week[di];
                  if (!day) return <span key={di} />;
                  const win = day.result === 'win';
                  return (
                    <div
                      key={di}
                      title={`Day ${day.day}: ${win ? 'Win' : 'Loss'} ${formatCurrency(day.pnl)} → running ${formatCurrency(day.cumulative)}`}
                      className={clsx(
                        'group relative flex h-12 flex-col items-center justify-center rounded-lg border text-center transition-transform hover:z-10 hover:scale-[1.06]',
                        win
                          ? 'border-tp-green/30 bg-tp-green/10'
                          : 'border-tp-red/25 bg-tp-red/10',
                        day.goalHit && 'ring-2 ring-tp-green ring-offset-1 ring-offset-tp-card',
                        day.goalHit && blown && 'ring-tp-red'
                      )}
                    >
                      <span className={clsx('text-xs font-bold', win ? 'text-tp-green' : 'text-tp-red')}>
                        {win ? '+' : ''}
                        {formatCurrency(day.pnl)}
                      </span>
                      <span className={clsx('text-[9px]', dark ? 'text-zinc-500' : 'text-gray-400')}>
                        {formatCurrency(day.cumulative)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className={clsx(inset, 'mt-3 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm')}>
        <span className={muted}>
          {hiddenWeeks > 0 ? `Showing first ${MAX_WEEKS} weeks · +${hiddenWeeks} more to finish` : 'Full path shown'}
        </span>
        <span className={clsx('font-semibold', blown ? 'text-tp-red' : reachedGoal ? 'text-tp-green' : text)}>
          {blown
            ? 'Account blown on this path'
            : reachedGoal
              ? `Goal reached day ${path[path.length - 1].day}`
              : 'Goal not reached within window'}
        </span>
      </div>
    </div>
  );
};
