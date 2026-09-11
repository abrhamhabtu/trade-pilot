'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, TrendingDown, TrendingUp } from 'lucide-react';
import type { CalendarDataPoint, DailyPLDataPoint } from '../../hooks/useChartData';

interface DayPerformancePanelProps {
  dailyPLData: DailyPLDataPoint[];
  calendarData: CalendarDataPoint[];
}

type ViewMode = 'weekday' | 'date';

interface WeekdayRow {
  idx: number;
  name: string;
  short: string;
  total: number;
  average: number;
  days: number;
  greenDays: number;
  trades: number;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const usd = (v: number) => {
  const s = Math.abs(v).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  return v < 0 ? `-${s}` : s;
};
const signed = (v: number) => (v > 0 ? `+${usd(v)}` : usd(v));
// Dates are YYYY-MM-DD; parse at local noon so they never shift a day.
const local = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`);
const shortDate = (d: string) => local(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const DayPerformancePanel: React.FC<DayPerformancePanelProps> = ({ dailyPLData, calendarData }) => {
  const [view, setView] = useState<ViewMode>('weekday');

  const tradesByDate = useMemo(() => new Map(calendarData.map((d) => [d.date.slice(0, 10), d.trades])), [calendarData]);

  const weekdays = useMemo(() => {
    const map = new Map<number, WeekdayRow>();
    for (const day of dailyPLData) {
      const idx = local(day.date).getDay();
      const row = map.get(idx) ?? { idx, name: WEEKDAYS[idx], short: WEEKDAYS[idx].slice(0, 3), total: 0, average: 0, days: 0, greenDays: 0, trades: 0 };
      row.total += day.value;
      row.days += 1;
      row.greenDays += day.value > 0 ? 1 : 0;
      row.trades += tradesByDate.get(day.date.slice(0, 10)) ?? 0;
      row.average = row.total / row.days;
      map.set(idx, row);
    }
    // Always show Mon–Fri in calendar order; weekends only if traded.
    const rows = [1, 2, 3, 4, 5, 0, 6].filter((i) => map.has(i) || (i >= 1 && i <= 5)).map((i) => map.get(i) ?? { idx: i, name: WEEKDAYS[i], short: WEEKDAYS[i].slice(0, 3), total: 0, average: 0, days: 0, greenDays: 0, trades: 0 });
    const traded = rows.filter((r) => r.days > 0);
    const best = traded.length ? traded.reduce((a, b) => (b.average > a.average ? b : a)) : null;
    const worst = traded.length > 1 ? traded.reduce((a, b) => (b.average < a.average ? b : a)) : null;
    const maxAbs = Math.max(1, ...traded.map((r) => Math.abs(r.average)));
    return { rows, traded, best, worst: worst && worst.idx !== best?.idx ? worst : null, maxAbs };
  }, [dailyPLData, tradesByDate]);

  const dates = useMemo(() => {
    const ranked = dailyPLData.map((d) => ({ date: d.date, value: d.value, trades: tradesByDate.get(d.date.slice(0, 10)) ?? 0 }));
    const best = ranked.filter((d) => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 4);
    const worst = ranked.filter((d) => d.value < 0).sort((a, b) => a.value - b.value).slice(0, 4);
    return {
      best,
      worst,
      maxAbs: Math.max(1, ...[...best, ...worst].map((d) => Math.abs(d.value))),
      green: ranked.filter((d) => d.value > 0).length,
      red: ranked.filter((d) => d.value < 0).length,
    };
  }, [dailyPLData, tradesByDate]);

  const empty = dailyPLData.length === 0;
  const anyNegative = weekdays.traded.some((r) => r.average < 0);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/5 transition-all duration-200 hover:border-white/10 hover:shadow-lg hover:shadow-black/20">
      <div className="relative z-10 flex h-full flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-tp-blue" />
              <h3 className="text-sm font-semibold text-zinc-100">Best &amp; worst days</h3>
            </div>
            <p className="mt-1 text-xs text-zinc-500">{view === 'weekday' ? 'Average P&L per day you traded.' : 'Your biggest single days, green and red.'}</p>
          </div>
          <div className="flex shrink-0 rounded-lg bg-black/25 p-0.5 text-[11px] font-medium ring-1 ring-inset ring-white/[0.07]">
            {(['weekday', 'date'] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setView(m)}
                aria-pressed={view === m}
                className={clsx('rounded-md px-2.5 py-1 transition-colors', view === m ? 'bg-white/[0.1] text-zinc-50' : 'text-zinc-500 hover:text-zinc-200')}
              >
                {m === 'weekday' ? 'Weekdays' : 'Dates'}
              </button>
            ))}
          </div>
        </div>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <CalendarDays className="h-8 w-8 text-zinc-600" />
            <p className="max-w-[240px] text-xs leading-relaxed text-zinc-500">Import or log trades to see which days carry your results — and which ones cost you.</p>
          </div>
        ) : view === 'weekday' ? (
          <>
            {/* Takeaway */}
            {weekdays.best && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Insight tone="good" label="Strongest" name={weekdays.best.name} value={`${signed(weekdays.best.average)}/day`} />
                {weekdays.worst ? (
                  <Insight tone={weekdays.worst.average < 0 ? 'bad' : 'soft'} label={weekdays.worst.average < 0 ? 'Costing you' : 'Weakest'} name={weekdays.worst.name} value={`${signed(weekdays.worst.average)}/day`} />
                ) : (
                  <div className="rounded-lg bg-black/20 p-2.5 text-[11px] text-zinc-500 ring-1 ring-inset ring-white/[0.04]">Trade more weekdays to compare.</div>
                )}
              </div>
            )}

            {/* Weekday bars */}
            <ul className="flex min-h-0 flex-1 flex-col justify-between gap-1">
              {weekdays.rows.map((r) => {
                const pct = r.days ? (Math.abs(r.average) / weekdays.maxAbs) * 100 : 0;
                const neg = r.average < 0;
                const isBest = r.idx === weekdays.best?.idx;
                const isWorst = r.idx === weekdays.worst?.idx;
                return (
                  <li key={r.idx} className="flex items-center gap-3" title={r.days ? `${r.name}: ${r.days} days · ${r.trades} trades · ${usd(r.total)} total · ${Math.round((r.greenDays / r.days) * 100)}% green days` : `${r.name}: no trades`}>
                    <span className={clsx('w-8 shrink-0 text-xs font-medium', isBest ? 'text-tp-green' : isWorst ? (neg ? 'text-tp-red' : 'text-zinc-200') : r.days ? 'text-zinc-300' : 'text-zinc-600')}>{r.short}</span>
                    <div className={clsx('relative h-5 flex-1', anyNegative && 'grid grid-cols-2')}>
                      {anyNegative ? (
                        <>
                          <div className="flex justify-end border-r border-white/10 pr-px">
                            {neg && <div className="h-full rounded-l-[4px] bg-tp-red/80" style={{ width: `${pct}%` }} />}
                          </div>
                          <div className="flex pl-px">{!neg && r.days > 0 && <div className={clsx('h-full rounded-r-[4px]', isBest ? 'bg-tp-green' : 'bg-tp-green/45')} style={{ width: `${pct}%` }} />}</div>
                        </>
                      ) : (
                        <div className="h-full overflow-hidden rounded-[4px] bg-white/[0.04]">
                          {r.days > 0 && <div className={clsx('h-full rounded-[4px]', isBest ? 'bg-tp-green' : 'bg-tp-green/45')} style={{ width: `${Math.max(pct, 3)}%` }} />}
                        </div>
                      )}
                    </div>
                    <span className={clsx('w-16 shrink-0 text-right text-xs font-semibold tabular-nums', !r.days ? 'text-zinc-600' : neg ? 'text-tp-red' : 'text-zinc-100')}>{r.days ? signed(r.average) : '—'}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2 text-[11px] text-zinc-500">
              <span>
                {weekdays.traded.length} weekday{weekdays.traded.length === 1 ? '' : 's'} traded · hover for totals
              </span>
              {!anyNegative && weekdays.traded.length > 1 && <span className="text-tp-green">All net green</span>}
            </div>
          </>
        ) : (
          <>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
              <DateList title="Best days" icon={TrendingUp} tone="good" items={dates.best} maxAbs={dates.maxAbs} emptyText="No green days in this range yet." />
              <DateList title="Worst days" icon={TrendingDown} tone="bad" items={dates.worst} maxAbs={dates.maxAbs} emptyText="No red days in this range. Keep it that way." />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2 text-[11px] text-zinc-500">
              <span>
                <span className="text-tp-green">{dates.green}</span> green · <span className="text-tp-red">{dates.red}</span> red days
              </span>
              {dates.green + dates.red > 0 && <span>{Math.round((dates.green / (dates.green + dates.red)) * 100)}% of days green</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function Insight({ tone, label, name, value }: { tone: 'good' | 'bad' | 'soft'; label: string; name: string; value: string }) {
  return (
    <div
      className={clsx(
        'rounded-lg p-2.5 ring-1 ring-inset',
        tone === 'good' ? 'bg-tp-green/[0.07] ring-tp-green/20' : tone === 'bad' ? 'bg-tp-red/[0.07] ring-tp-red/20' : 'bg-black/20 ring-white/[0.06]',
      )}
    >
      <div className={clsx('text-[10px] font-semibold uppercase tracking-wider', tone === 'good' ? 'text-tp-green' : tone === 'bad' ? 'text-tp-red' : 'text-zinc-500')}>{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-zinc-50">{name}</div>
      <div className={clsx('text-xs font-medium tabular-nums', tone === 'bad' ? 'text-tp-red' : 'text-zinc-400')}>{value}</div>
    </div>
  );
}

function DateList({
  title,
  icon: Icon,
  tone,
  items,
  maxAbs,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  tone: 'good' | 'bad';
  items: { date: string; value: number; trades: number }[];
  maxAbs: number;
  emptyText: string;
}) {
  const good = tone === 'good';
  return (
    <div className="min-h-0">
      <div className={clsx('mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider', good ? 'text-tp-green' : 'text-tp-red')}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/[0.07] p-4 text-center text-xs text-zinc-500">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((d) => (
            <li key={d.date}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-zinc-300">
                  {shortDate(d.date)}
                  <span className="text-zinc-600"> · {d.trades} {d.trades === 1 ? 'trade' : 'trades'}</span>
                </span>
                <span className={clsx('font-semibold tabular-nums', good ? 'text-tp-green' : 'text-tp-red')}>{signed(d.value)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div className={clsx('h-full rounded-full', good ? 'bg-tp-green/70' : 'bg-tp-red/70')} style={{ width: `${Math.max(6, (Math.abs(d.value) / maxAbs) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
