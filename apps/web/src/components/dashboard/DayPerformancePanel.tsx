'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, TrendingDown, TrendingUp } from 'lucide-react';
import type {
  CalendarDataPoint,
  DailyPLDataPoint,
} from '../../hooks/useChartData';

interface DayPerformancePanelProps {
  dailyPLData: DailyPLDataPoint[];
  calendarData: CalendarDataPoint[];
}

interface RankedDay {
  date: string;
  value: number;
  trades: number;
}

interface RankedWeekday {
  weekday: string;
  total: number;
  average: number;
  days: number;
  trades: number;
}

type ViewMode = 'weekday' | 'date';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

const weekdayName = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
  });

const RankedDayRow: React.FC<{
  day: RankedDay;
  maxAbs: number;
  rank: number;
  tone: 'win' | 'loss';
}> = ({ day, maxAbs, rank, tone }) => {
  const pct = maxAbs > 0 ? Math.max(8, (Math.abs(day.value) / maxAbs) * 100) : 0;
  const isWin = tone === 'win';

  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.025] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={clsx(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
              isWin
                ? 'bg-emerald-400/10 text-emerald-300'
                : 'bg-rose-400/10 text-rose-300'
            )}
          >
            {rank}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-zinc-200">
              {formatDate(day.date)}
            </div>
            <div className="text-[10px] text-zinc-500">
              {day.trades} {day.trades === 1 ? 'trade' : 'trades'}
            </div>
          </div>
        </div>
        <div
          className={clsx(
            'text-right text-xs font-bold tabular-nums',
            isWin ? 'text-emerald-400' : 'text-rose-400'
          )}
        >
          {formatCurrency(day.value)}
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={clsx('h-full rounded-full', isWin ? 'bg-emerald-400' : 'bg-rose-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const RankedWeekdayRow: React.FC<{
  day: RankedWeekday;
  maxAbs: number;
  rank: number;
  tone: 'win' | 'loss';
}> = ({ day, maxAbs, rank, tone }) => {
  const pct = maxAbs > 0 ? Math.max(8, (Math.abs(day.average) / maxAbs) * 100) : 0;
  const isWin = tone === 'win';

  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.025] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={clsx(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
              isWin
                ? 'bg-emerald-400/10 text-emerald-300'
                : 'bg-rose-400/10 text-rose-300'
            )}
          >
            {rank}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-zinc-200">
              {day.weekday}
            </div>
            <div className="text-[10px] text-zinc-500">
              {day.days} {day.days === 1 ? 'day' : 'days'} / {day.trades}{' '}
              {day.trades === 1 ? 'trade' : 'trades'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className={clsx(
              'text-xs font-bold tabular-nums',
              isWin ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {formatCurrency(day.average)}
          </div>
          <div className="text-[10px] text-zinc-600">
            {formatCurrency(day.total)} total
          </div>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={clsx('h-full rounded-full', isWin ? 'bg-emerald-400' : 'bg-rose-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export const DayPerformancePanel: React.FC<DayPerformancePanelProps> = ({
  dailyPLData,
  calendarData,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('weekday');

  const { bestDays, worstDays, maxAbs, profitableDays, losingDays } = useMemo(() => {
    const tradesByDate = new Map(calendarData.map((day) => [day.date, day.trades]));
    const ranked = dailyPLData.map((day) => ({
      date: day.date,
      value: day.value,
      trades: tradesByDate.get(day.date) ?? 0,
    }));

    const best = ranked
      .filter((day) => day.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    const worst = ranked
      .filter((day) => day.value < 0)
      .sort((a, b) => a.value - b.value)
      .slice(0, 3);
    const largest = Math.max(
      1,
      ...[...best, ...worst].map((day) => Math.abs(day.value))
    );

    return {
      bestDays: best,
      worstDays: worst,
      maxAbs: largest,
      profitableDays: ranked.filter((day) => day.value > 0).length,
      losingDays: ranked.filter((day) => day.value < 0).length,
    };
  }, [calendarData, dailyPLData]);

  const {
    bestWeekdays,
    worstWeekdays,
    weekdayMaxAbs,
    activeWeekdays,
  } = useMemo(() => {
    const tradesByDate = new Map(calendarData.map((day) => [day.date, day.trades]));
    const weekdayMap = new Map<string, RankedWeekday>();

    for (const day of dailyPLData) {
      const name = weekdayName(day.date);
      const existing =
        weekdayMap.get(name) ?? {
          weekday: name,
          total: 0,
          average: 0,
          days: 0,
          trades: 0,
        };

      existing.total += day.value;
      existing.days += 1;
      existing.trades += tradesByDate.get(day.date) ?? 0;
      existing.average = existing.total / existing.days;
      weekdayMap.set(name, existing);
    }

    const ranked = Array.from(weekdayMap.values());
    const best = ranked
      .filter((day) => day.average > 0)
      .sort((a, b) => b.average - a.average)
      .slice(0, 3);
    const worst = ranked.sort((a, b) => a.average - b.average).slice(0, 3);

    return {
      bestWeekdays: best,
      worstWeekdays: worst,
      weekdayMaxAbs: Math.max(
        1,
        ...[...best, ...worst].map((day) => Math.abs(day.average))
      ),
      activeWeekdays: ranked.length,
    };
  }, [calendarData, dailyPLData]);

  const empty =
    viewMode === 'weekday'
      ? bestWeekdays.length === 0 && worstWeekdays.length === 0
      : bestDays.length === 0 && worstDays.length === 0;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/5 transition-all duration-200 hover:border-white/10 hover:shadow-lg hover:shadow-black/20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-400/60 via-white/10 to-rose-400/60" />
      <div className="relative z-10 flex h-full flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-tp-blue" />
              <h3 className="text-sm font-semibold text-zinc-100">
                Best / Worst Days
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {viewMode === 'weekday'
                ? 'Default view ranks weekdays by average daily P&L.'
                : 'Ranked by total net P&L per trading date.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.025] p-0.5 text-[10px] font-semibold">
              {(['weekday', 'date'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={clsx(
                    'rounded-md px-2 py-1 transition-colors',
                    viewMode === mode
                      ? 'bg-white text-zinc-950'
                      : 'text-zinc-500 hover:text-zinc-200'
                  )}
                >
                  {mode === 'weekday' ? 'Weekdays' : 'Dates'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <CalendarDays className="h-8 w-8 text-zinc-600" />
            <p className="max-w-[220px] text-xs leading-relaxed text-zinc-500">
              Import or log trades to see which trading days are carrying or
              hurting performance.
            </p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-h-0">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                {viewMode === 'weekday' ? 'Best weekdays' : 'Best dates'}
              </div>
              <div className="space-y-2">
                {viewMode === 'weekday'
                  ? bestWeekdays.map((day, index) => (
                      <RankedWeekdayRow
                        key={day.weekday}
                        day={day}
                        maxAbs={weekdayMaxAbs}
                        rank={index + 1}
                        tone="win"
                      />
                    ))
                  : bestDays.map((day, index) => (
                      <RankedDayRow
                        key={day.date}
                        day={day}
                        maxAbs={maxAbs}
                        rank={index + 1}
                        tone="win"
                      />
                    ))}
              </div>
            </div>

            <div className="min-h-0">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400">
                <TrendingDown className="h-3.5 w-3.5" />
                {viewMode === 'weekday' ? 'Weakest weekdays' : 'Worst dates'}
              </div>
              <div className="space-y-2">
                {viewMode === 'weekday'
                  ? worstWeekdays.map((day, index) => (
                      <RankedWeekdayRow
                        key={day.weekday}
                        day={day}
                        maxAbs={weekdayMaxAbs}
                        rank={index + 1}
                        tone={day.average >= 0 ? 'win' : 'loss'}
                      />
                    ))
                  : worstDays.map((day, index) => (
                      <RankedDayRow
                        key={day.date}
                        day={day}
                        maxAbs={maxAbs}
                        rank={index + 1}
                        tone="loss"
                      />
                    ))}
              </div>
            </div>
          </div>
        )}
        {!empty && (
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2 text-[10px] text-zinc-500">
            {viewMode === 'weekday' ? (
              <>
                <span>{activeWeekdays} weekdays traded</span>
                <span>average per active weekday</span>
              </>
            ) : (
              <>
                <span>{profitableDays} green days</span>
                <span>{losingDays} red days</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
