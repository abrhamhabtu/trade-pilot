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
  /** Funding model of the selected program — drives risk posture guidance. */
  payoutModel: 'eval' | 'instant';
  /** Program label e.g. "S2F Sim PRO" for the posture copy. */
  programLabel: string;
}

const CONTRACT_OPTIONS = [2, 3, 4, 5];
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
  payoutModel,
  programLabel,
}) => {
  const { card, inset, text, muted, dark } = useThemeClasses();

  const posture =
    payoutModel === 'instant'
      ? {
          tone: 'warn' as const,
          label: 'Funded from day one',
          text: `${programLabel} is funded capital — your payout engine, not a lottery ticket. Size for survival: protect the ${formatCurrency(drawdownLimit)} trail first and let the payouts come. One blown account here is real money out the door.`,
        }
      : {
          tone: 'good' as const,
          label: 'Evaluation — resets are cheap',
          text: `${programLabel} is an evaluation. A reset costs a fee, not your funded account, so you can push size a little to pass fast. But bank the discipline now — the habits you build clearing this eval are exactly what keep the funded account alive.`,
        };

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

    // Day-level symmetry — the core of why the math now holds together.
    lines.push({
      tone: 'good',
      text: `Green day ${formatCurrency(proj.winDayPnL)} vs red day ${formatCurrency(proj.lossDayPnL)} — a clean ${rewardToRisk.toFixed(1)}:1, same as your trade edge. That symmetry is what actually compounds to a payout.`,
    });

    if (proj.winBreachesCeiling && dailyCap > 0) {
      lines.push({
        tone: 'warn',
        text: `One ${plan.contracts} ${plan.symbol} win is ${formatCurrency(proj.winPerTrade)} — above your ${formatCurrency(dailyCap)} consistency ceiling. Drop contracts so a single green trade stays legal.`,
      });
    } else if (proj.winDayOvershoots) {
      lines.push({
        tone: 'neutral',
        text: `At ${plan.contracts} ${plan.symbol}, one win is ${formatCurrency(proj.winPerTrade)} — already past your ${formatCurrency(plan.dailyAim)} aim. Your aim is really one good trade; size down to 2 for finer control.`,
      });
    } else if (!proj.dailyAimFeasible) {
      lines.push({
        tone: 'warn',
        text: `Hitting ${formatCurrency(plan.dailyAim)} needs ${proj.tradesToAim} wins at this size — more than your ~${tradesPerDay}/day. Size up or trim the aim.`,
      });
    } else {
      lines.push({
        tone: 'good',
        text: `${formatCurrency(plan.dailyAim)}/day ≈ ${proj.tradesToAim} winning trade${proj.tradesToAim > 1 ? 's' : ''} (~${proj.pointsForDailyAim} ${plan.symbol} pts) at ${rewardToRisk.toFixed(1)}R — reachable without chasing.`,
      });
    }

    if (proj.badDayBuffer < 3) {
      lines.push({ tone: 'warn', text: `Only ~${Math.max(1, proj.badDayBuffer)} red day(s) from peak before the ${formatCurrency(drawdownLimit)} trail breaches. Size down before you need a comeback.` });
    } else {
      lines.push({ tone: 'good', text: `~${proj.badDayBuffer} red days of buffer against the ${formatCurrency(drawdownLimit)} trail — room to breathe while you grind.` });
    }

    if (plan.contracts >= 5) {
      lines.push({ tone: 'warn', text: `5 ${plan.symbol} is heavy. On choppy days drop to 2–3 — you don't need a hero session to pass.` });
    }

    return lines.slice(0, 4);
  }, [dailyCap, drawdownLimit, plan, proj, rewardToRisk, tradesPerDay]);

  return (
    <div className={clsx(card, 'p-6 sm:p-8')}>
      <SectionHeader
        icon={<Crosshair className="h-4 w-4 text-tp-blue" />}
        title="Micro sizing plan"
        subtitle="Trade small, stay alive. Pick your size and daily aim — see the slow-but-safe path to your goal, even if it takes weeks."
      />

      {/* Program-aware risk posture */}
      <div
        className={clsx(
          'mb-5 rounded-xl border p-3.5',
          posture.tone === 'warn'
            ? dark ? 'border-tp-yellow/25 bg-tp-yellow/[0.07]' : 'border-yellow-200 bg-yellow-50'
            : dark ? 'border-tp-green/25 bg-tp-green/[0.06]' : 'border-green-200 bg-green-50'
        )}
      >
        <div className={clsx('text-[10px] font-bold uppercase tracking-wider', posture.tone === 'warn' ? 'text-tp-yellow' : 'text-tp-green')}>
          {posture.label}
        </div>
        <p className={clsx('mt-1 text-xs leading-relaxed', dark ? 'text-zinc-300' : 'text-gray-600')}>{posture.text}</p>
      </div>

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
            <div className="flex items-center gap-2">
              <PillToggle
                options={CONTRACT_OPTIONS.map((n) => ({ value: n, label: `${n} ${plan.symbol}` }))}
                value={plan.contracts}
                onChange={(v) => onChange({ contracts: Number(v) })}
              />
              <div className="w-20">
                <NumberInput
                  value={plan.contracts}
                  min={1}
                  max={50}
                  step={1}
                  onChange={(v) => onChange({ contracts: Math.max(1, Number(v) || 1) })}
                />
              </div>
            </div>
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
        <MiniStat label="Green day" value={formatCurrency(proj.winDayPnL)} sub={`${proj.tradesToAim} win${proj.tradesToAim > 1 ? 's' : ''} → walk`} accent="green" />
        <MiniStat label="Red day" value={formatCurrency(proj.lossDayPnL)} sub={`${proj.tradesToAim} trade${proj.tradesToAim > 1 ? 's' : ''} all stop`} accent="red" />
        <MiniStat label="Ceiling" value={dailyCap > 0 ? formatCurrency(dailyCap) : '—'} sub="consistency cap" accent="yellow" />
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
