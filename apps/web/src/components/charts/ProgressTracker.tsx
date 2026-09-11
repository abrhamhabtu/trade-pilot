'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ArrowRight, Check, CheckCheck, ChevronLeft, ChevronRight, Flame, ListChecks, X } from 'lucide-react';
import { useRoutineStore } from '../../store/routineStore';

interface ProgressTrackerProps {
  onViewMore?: () => void;
}

interface DayCell {
  date: Date;
  key: string;
  score: number;
  hasData: boolean;
  followed: number;
  total: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const noon = (d: Date) => {
  const n = new Date(d);
  n.setHours(12, 0, 0, 0);
  return n;
};
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// 80%+ followed = green, 50–79% = amber, below = red.
const band = (score: number) => (score >= 80 ? 'good' : score >= 50 ? 'mixed' : 'poor');
const CELL_TONE = {
  good: 'bg-tp-green',
  mixed: 'bg-tp-yellow',
  poor: 'bg-tp-red',
} as const;
const TEXT_TONE = { good: 'text-tp-green', mixed: 'text-tp-yellow', poor: 'text-tp-red' } as const;
const STROKE = { good: '#00D68F', mixed: '#FFB800', poor: '#FF4868' } as const;

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ onViewMore }) => {
  const { gamePlans, tradingRules } = useRoutineStore();
  const [logDate, setLogDate] = useState<Date | null>(null);
  const [hovered, setHovered] = useState<DayCell | null>(null);
  // Store data and "today" only exist in the browser, so render after mount (no hydration mismatch).
  const [mounted, setMounted] = useState(false);
  const [width, setWidth] = useState(0);
  const boxRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMounted(true);
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = width > 0 && width < 520;
  // Each week column is 24px (20px cell + 4px gap); 32px for day labels.
  const WEEKS = Math.max(6, Math.min(20, Math.floor(((narrow ? width : width - 184) - 36) / 24) || 12));

  const activeRules = tradingRules.filter((r) => r.isActive);

  const scoreFor = useMemo(
    () => (key: string) => {
      const plan = gamePlans[key];
      const rated = (plan?.ruleCompliance ?? []).filter((rc) => rc.followed !== null);
      if (!rated.length) return { hasData: false, score: 0, followed: 0, total: activeRules.length };
      const followed = rated.filter((rc) => rc.followed).length;
      const total = Math.max(activeRules.length, rated.length);
      return { hasData: true, score: Math.round((followed / total) * 100), followed, total };
    },
    [gamePlans, activeRules.length],
  );

  // Weekday-only grid: columns are weeks (oldest → newest), rows Mon–Fri.
  const weeks = useMemo(() => {
    const today = noon(new Date());
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const cols: DayCell[][] = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const col: DayCell[] = [];
      for (let d = 0; d < 5; d++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() - w * 7 + d);
        const key = dateKey(date);
        col.push({ date, key, ...scoreFor(key) });
      }
      cols.push(col);
    }
    return cols;
  }, [scoreFor, WEEKS]);

  const stats = useMemo(() => {
    const now = new Date();
    const past = weeks.flat().filter((c) => c.date <= now);
    const logged = past.filter((c) => c.hasData);
    const last20 = past.slice(-20).filter((c) => c.hasData);
    const avg = last20.length ? Math.round(last20.reduce((n, c) => n + c.score, 0) / last20.length) : null;

    // Streak across all history: days you logged at 80%+. Unlogged days are neutral (no trading).
    const keys = Object.keys(gamePlans).sort();
    let run = 0;
    let best = 0;
    for (const k of keys) {
      const s = scoreFor(k);
      if (!s.hasData) continue;
      run = s.score >= 80 ? run + 1 : 0;
      best = Math.max(best, run);
    }
    const thisWeek = weeks[weeks.length - 1].filter((c) => c.date <= now);
    return {
      avg,
      streak: run,
      best,
      loggedCount: logged.length,
      weekLogged: thisWeek.filter((c) => c.hasData).length,
      weekDays: thisWeek.length,
    };
  }, [weeks, gamePlans, scoreFor]);

  const today = scoreFor(dateKey(new Date()));
  const isWeekend = [0, 6].includes(new Date().getDay());

  const monthMarks = weeks.map((col, i) => {
    const m = col[0].date.getMonth();
    return i === 0 || m !== weeks[i - 1][0].date.getMonth() ? col[0].date.toLocaleDateString('en-US', { month: 'short' }) : '';
  });

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/5 transition-all duration-200 hover:border-white/10 hover:shadow-lg hover:shadow-black/20">
      <div ref={boxRef} className="relative z-10 flex h-full flex-col p-4">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-tp-green" />
              <h3 className="text-sm font-semibold text-zinc-100">Rule discipline</h3>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Did you follow your trading rules each day?</p>
          </div>
          {onViewMore && (
            <button onClick={onViewMore} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100">
              Edit rules <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {!mounted ? (
          <div className="flex-1 animate-pulse rounded-xl bg-white/[0.02]" />
        ) : activeRules.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-tp-green/10 text-tp-green ring-1 ring-inset ring-tp-green/20">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Write your rules first</p>
              <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-zinc-500">
                Add 3–5 rules you want to trade by. Then tick them off each day and watch the streak grow.
              </p>
            </div>
            {onViewMore && (
              <button onClick={onViewMore} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200">
                Set up rules
              </button>
            )}
          </div>
        ) : (
          <div className={clsx('flex min-h-0 flex-1 gap-4', narrow && 'flex-col-reverse justify-end gap-3')}>
            {/* Heatmap */}
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <div className="flex overflow-x-auto [scrollbar-width:none]">
                <div className="mx-auto inline-flex flex-col">
                  <div className="ml-8 flex gap-1 pb-1">
                    {monthMarks.map((m, i) => (
                      <span key={i} className="w-5 shrink-0 overflow-visible whitespace-nowrap text-[10px] font-medium text-zinc-500">
                        {m}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <div className="flex w-7 flex-col gap-1">
                      {DAY_LABELS.map((d) => (
                        <span key={d} className="flex h-5 items-center text-[10px] text-zinc-600">
                          {d}
                        </span>
                      ))}
                    </div>
                    {weeks.map((col, wi) => (
                      <div key={wi} className="flex flex-col gap-1">
                        {col.map((c) => {
                          const future = c.date > new Date() && !sameDay(c.date, new Date());
                          const isToday = sameDay(c.date, new Date());
                          return (
                            <button
                              key={c.key}
                              type="button"
                              disabled={future}
                              onClick={() => setLogDate(noon(c.date))}
                              onMouseEnter={() => setHovered(c)}
                              onMouseLeave={() => setHovered(null)}
                              onFocus={() => setHovered(c)}
                              onBlur={() => setHovered(null)}
                              aria-label={`${c.date.toDateString()}: ${c.hasData ? `${c.score}% of rules followed` : 'not logged'}`}
                              className={clsx(
                                'h-5 w-5 rounded-[5px] transition-transform',
                                future
                                  ? 'bg-white/[0.02]'
                                  : c.hasData
                                    ? clsx(CELL_TONE[band(c.score)], c.score < 100 && c.score >= 80 && 'opacity-75', 'hover:scale-110')
                                    : 'bg-white/[0.05] ring-1 ring-inset ring-white/[0.04] hover:bg-white/[0.1]',
                                isToday && 'ring-2 ring-white/70 ring-offset-2 ring-offset-tp-card',
                              )}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex h-4 items-center justify-between gap-3 text-[11px] text-zinc-500">
                {hovered ? (
                  <span className="truncate">
                    <span className="text-zinc-300">{hovered.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    {' · '}
                    {hovered.hasData ? (
                      <span className={TEXT_TONE[band(hovered.score)]}>
                        {hovered.followed}/{hovered.total} rules followed
                      </span>
                    ) : (
                      'Not logged — click to log'
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    {(
                      [
                        ['bg-white/[0.06]', 'Not logged'],
                        ['bg-tp-red', 'Under 50%'],
                        ['bg-tp-yellow', '50–79%'],
                        ['bg-tp-green', '80%+'],
                      ] as const
                    ).map(([c, l]) => (
                      <span key={l} className="flex items-center gap-1">
                        <span className={clsx('h-2.5 w-2.5 rounded-sm', c)} />
                        {l}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>

            {/* Today + stats */}
            <div className={clsx('shrink-0 gap-2', narrow ? 'grid grid-cols-3' : 'flex w-[168px] flex-col gap-2.5 border-l border-white/[0.06] pl-4')}>
              <TodayCard compact={narrow} today={today} weekend={isWeekend} onLog={() => setLogDate(noon(new Date()))} />
              <div className={clsx(narrow ? 'contents' : 'grid grid-cols-2 gap-2')}>
                <MiniStat
                  label="Streak"
                  value={stats.streak ? `${stats.streak}d` : '0'}
                  icon={<Flame className={clsx('h-3 w-3', stats.streak ? 'text-orange-400' : 'text-zinc-600')} />}
                  sub={stats.best ? `best ${stats.best}d` : 'at 80%+'}
                />
                <MiniStat
                  label="Avg (4 wks)"
                  value={stats.avg === null ? '—' : `${stats.avg}%`}
                  tone={stats.avg === null ? undefined : TEXT_TONE[band(stats.avg)]}
                  sub={`${stats.weekLogged}/${stats.weekDays || 5} this wk`}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {logDate && <QuickLog date={logDate} setDate={setLogDate} onClose={() => setLogDate(null)} />}
    </div>
  );
};

function TodayCard({ today, weekend, onLog, compact }: { today: { hasData: boolean; score: number; followed: number; total: number }; weekend: boolean; onLog: () => void; compact?: boolean }) {
  if (!today.hasData) {
    return (
      <div className={clsx('flex min-w-0 flex-1 flex-col rounded-xl bg-black/20 ring-1 ring-inset ring-white/[0.05]', compact ? 'justify-between p-2.5' : 'justify-center p-3')}>
        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Today</div>
        <div className="mt-1 truncate text-sm font-medium text-zinc-200">{weekend ? 'Weekend' : 'Not logged yet'}</div>
        <button onClick={onLog} className={clsx(compact ? 'mt-1.5 px-2 py-1' : 'mt-3 px-3 py-1.5', 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-white text-xs font-semibold text-zinc-950 hover:bg-zinc-200')}>
          <Check className="h-3.5 w-3.5" /> Log today
        </button>
      </div>
    );
  }
  const b = band(today.score);
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <button onClick={onLog} className={clsx('flex min-w-0 flex-1 items-center rounded-xl bg-black/20 text-left ring-1 ring-inset ring-white/[0.05] hover:bg-black/30', compact ? 'gap-2 p-2.5' : 'gap-3 p-3')}>
      <svg width="52" height="52" viewBox="0 0 52 52" className={clsx('shrink-0 -rotate-90', compact && 'h-8 w-8')}>
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={STROKE[b]} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * today.score) / 100} className="transition-all duration-700" />
      </svg>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Today</div>
        <div className={clsx('text-lg font-semibold tabular-nums leading-tight', TEXT_TONE[b])}>{today.score}%</div>
        <div className="truncate text-[11px] text-zinc-500">
          {today.followed}/{today.total}{compact ? ' rules' : ' rules · edit'}
        </div>
      </div>
    </button>
  );
}

function MiniStat({ label, value, sub, icon, tone }: { label: string; value: string; sub: string; icon?: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl bg-black/20 p-2.5 ring-1 ring-inset ring-white/[0.05]">
      <div className="flex items-center gap-1 text-[10px] text-zinc-500">
        {icon}
        {label}
      </div>
      <div className={clsx('mt-0.5 text-base font-semibold tabular-nums leading-tight text-zinc-100', tone)}>{value}</div>
      <div className="mt-0.5 truncate text-[10px] text-zinc-600">{sub}</div>
    </div>
  );
}

// ─── Quick log ───────────────────────────────────────────────────────────────

function QuickLog({ date, setDate, onClose }: { date: Date; setDate: (d: Date) => void; onClose: () => void }) {
  const { tradingRules, getGamePlan, batchUpdateRuleCompliance } = useRoutineStore();
  const rules = tradingRules.filter((r) => r.isActive);
  const key = dateKey(date);
  const saved = useMemo(() => {
    const plan = getGamePlan(key);
    return Object.fromEntries(plan.ruleCompliance.map((rc) => [rc.ruleId, rc.followed])) as Record<string, boolean | null>;
  }, [getGamePlan, key]);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>(saved);
  const [done, setDone] = useState(false);

  useEffect(() => setAnswers(saved), [saved]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onClose, 700);
    return () => clearTimeout(t);
  }, [done, onClose]);

  const changes = Object.fromEntries(
    Object.entries(answers).filter(([id, v]) => v !== null && v !== undefined && v !== saved[id]),
  ) as Record<string, boolean>;
  const answered = rules.filter((r) => answers[r.id] === true || answers[r.id] === false).length;
  const followed = rules.filter((r) => answers[r.id] === true).length;
  const isToday = sameDay(date, new Date());
  const label = isToday
    ? 'Today'
    : sameDay(date, new Date(Date.now() - 86_400_000))
      ? 'Yesterday'
      : date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const shift = (days: number) => {
    const next = noon(date);
    next.setDate(next.getDate() + days);
    if (next <= noon(new Date())) setDate(next);
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Log your rules">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-tp-raised shadow-2xl shadow-black/60">
        {done && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-tp-raised/90 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-full bg-tp-green/15 px-5 py-2.5 text-tp-green">
              <Check className="h-5 w-5" /> <span className="font-semibold">Logged</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100" aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-[150px] text-center">
              <div className="text-sm font-semibold text-zinc-50">{label}</div>
              <div className="text-[11px] text-zinc-500">Did you follow each rule?</div>
            </div>
            <button onClick={() => shift(1)} disabled={isToday} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 disabled:opacity-25" aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto p-3">
          {rules.map((rule) => {
            const v = answers[rule.id];
            return (
              <li key={rule.id} className="flex items-center gap-3 rounded-xl bg-black/20 p-3 ring-1 ring-inset ring-white/[0.04]">
                <span className="min-w-0 flex-1 text-sm leading-snug text-zinc-200">{rule.text}</span>
                <div className="flex shrink-0 gap-1 rounded-lg bg-black/30 p-0.5">
                  {([true, false] as const).map((val) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [rule.id]: a[rule.id] === val ? null : val }))}
                      aria-pressed={v === val}
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                        v === val
                          ? val
                            ? 'bg-tp-green text-zinc-950'
                            : 'bg-tp-red text-white'
                          : 'text-zinc-500 hover:text-zinc-200',
                      )}
                    >
                      {val ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      {val ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] p-4">
          <button
            onClick={() => setAnswers(Object.fromEntries(rules.map((r) => [r.id, true])))}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Followed all
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-zinc-500">
              {answered ? `${followed}/${rules.length} followed` : `0/${rules.length} answered`}
            </span>
            <button
              onClick={() => {
                if (!Object.keys(changes).length) return onClose();
                batchUpdateRuleCompliance(key, changes);
                setDone(true);
              }}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200"
            >
              {Object.keys(changes).length ? 'Save' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
