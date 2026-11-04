'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowRight, ChevronLeft, ChevronRight, Download, FileText, Landmark, NotebookPen, Sparkles, Target, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useHistoryParam } from '@/hooks/useHistoryParam';
import { MIN_SAMPLE, NEWS_LABEL, NEWS_MINUTE, buildDays, currentStreak, dayOf, daysInMonth, inMonth, localTimeOf, monthCsv, monthKey, newsOn, pace, patterns, summarize, toReview, upcoming, weekdayOf, ymd, type Bucket, type CalDay } from '@/lib/calendarStats';
import { payoutWindow } from '@/lib/payoutSchedule';
import { localSessionDate } from '@/lib/sessionRisk';
import { useAccountStore } from '@/store/accountStore';
import { useDailyNotesStore } from '@/store/dailyNotesStore';
import type { Trade } from '@/store/tradingStore';
import { DayReviewModal } from './DayReviewModal';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GOAL_KEY = 'tp_calendar_goal';
const WEEKENDS_KEY = 'tp_calendar_weekends';

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const money = (n: number) => `${n < 0 ? '-' : n > 0 ? '+' : ''}${usd(n)}`;
const compact = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? '-' : n > 0 ? '+' : '';
  return a >= 1000 ? `${s}$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `${s}$${Math.round(a)}`;
};
const nice = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const tone = (n: number) => (n > 0 ? 'text-tp-green' : n < 0 ? 'text-tp-red' : 'text-zinc-400');
const stored = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const store = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* a remembered choice, nothing more */
  }
};

/** The day's P&L trade by trade, drawn in the cell. */
function DayPath({ path, up }: { path: number[]; up: boolean }) {
  if (path.length < 3) return null;
  const lo = Math.min(...path);
  const hi = Math.max(...path);
  const span = hi - lo || 1;
  const pts = path.map((v, i) => `${((i / (path.length - 1)) * 100).toFixed(1)},${(22 - ((v - lo) / span) * 20).toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden className="absolute inset-x-2.5 bottom-2 h-5 w-[calc(100%-20px)] opacity-60">
      <polyline points={pts} fill="none" stroke={up ? 'rgb(var(--tp-green))' : 'rgb(var(--tp-red))'} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarPage({ trades, accountId }: { trades: Trade[]; accountId?: string }) {
  const { accounts, selectedAccountId } = useAccountStore();
  const notes = useDailyNotesStore((s) => s.notes);
  const hasNote = useDailyNotesStore((s) => s.hasNote);
  const days = useMemo(() => buildDays(trades), [trades]);
  const [today, setToday] = useState('');
  useEffect(() => setToday(localSessionDate()), []);
  const latest = days[days.length - 1]?.date;
  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(null);
  const start = today || latest || '2026-01-01';
  const initial = latest ?? start;
  const y = cursor?.y ?? Number(initial.slice(0, 4));
  const m = cursor?.m ?? Number(initial.slice(5, 7)) - 1;
  const [view, setView] = useState<'month' | 'year'>('month');
  const [weekends, setWeekends] = useState(false);
  const [goal, setGoal] = useState(0);
  const [fomc, setFomc] = useState<Set<string> | undefined>();
  const [dayParam, setSelected] = useHistoryParam('day');
  const selected = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : null;

  useEffect(() => {
    setGoal(Number(stored(GOAL_KEY)) || 0);
    setWeekends(stored(WEEKENDS_KEY) === '1');
    // Past FOMC dates come from the data library, when it's there.
    fetch('/api/library/context', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => j?.fomc && setFomc(new Set<string>(j.fomc))).catch(() => undefined);
  }, []);

  const go = (d: number) => setCursor(() => {
    const t = y * 12 + m + d;
    return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selected || (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') go(view === 'year' ? -12 : -1);
      if (e.key === 'ArrowRight') go(view === 'year' ? 12 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const month = useMemo(() => inMonth(days, y, m), [days, y, m]);
  const sum = useMemo(() => summarize(month), [month]);
  const prev = useMemo(() => (m === 0 ? summarize(inMonth(days, y - 1, 11)) : summarize(inMonth(days, y, m - 1))), [days, y, m]);
  const streak = useMemo(() => currentStreak(days), [days]);
  const biggest = useMemo(() => Math.max(1, ...month.map((d) => Math.abs(d.pnl))), [month]);
  const account = accounts.find((a) => a.id === (accountId || selectedAccountId));
  const adjustments = useMemo(() => account?.balanceAdjustments ?? [], [account]);
  const adjByDate = useMemo(() => new Map(adjustments.map((a) => [a.date, a])), [adjustments]);
  const payouts = adjustments.filter((a) => a.type === 'payout' && a.date.startsWith(monthKey(y, m))).reduce((s, a) => s + Math.abs(a.received ?? a.amount), 0);
  const payout = useMemo(() => {
    if (!account || !today) return null;
    const w = payoutWindow(account, today);
    if (!w) return null;
    if (w.status === 'ready') return { date: today, amount: w.afterSplit };
    return w.earliestDate ? { date: w.earliestDate, amount: w.afterSplit } : null;
  }, [account, today]);
  const coming = useMemo(() => (today ? upcoming(today, { days: 30, fomc, payout }) : []), [today, fomc, payout]);
  const review = useMemo(() => toReview(days, (d) => hasNote(d, accountId), 5), [days, hasNote, accountId, notes]); // eslint-disable-line react-hooks/exhaustive-deps
  const found = useMemo(() => patterns(days, trades, fomc), [days, trades, fomc]);
  const weekendTrades = month.some((d) => [0, 6].includes(weekdayOf(d.date)));
  const payoutOnWeekend = !!payout && payout.date.startsWith(monthKey(y, m)) && [0, 6].includes(weekdayOf(payout.date));
  const showWeekends = weekends || weekendTrades || payoutOnWeekend;
  const cols = showWeekends ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];

  // Weeks as rows, Sunday first, with each week's total over all its days.
  const weeks = useMemo(() => {
    const first = weekdayOf(ymd(y, m, 1));
    const out: { dates: (string | null)[]; pnl: number; days: number }[] = [];
    let cur: (string | null)[] = Array(first).fill(null);
    const close = () => {
      const list = cur.filter(Boolean) as string[];
      const traded = list.map((d) => byDate.get(d)).filter(Boolean) as CalDay[];
      out.push({ dates: [...cur, ...Array(7 - cur.length).fill(null)], pnl: traded.reduce((a, d) => a + d.pnl, 0), days: traded.length });
      cur = [];
    };
    for (let d = 1; d <= daysInMonth(y, m); d++) {
      cur.push(ymd(y, m, d));
      if (cur.length === 7) close();
    }
    if (cur.length) close();
    return out;
  }, [y, m, byDate]);
  const weekBest = Math.max(1, ...weeks.map((w) => Math.abs(w.pnl)));
  const tradeDates = useMemo(() => days.map((d) => d.date), [days]);
  // What's coming that this month's grid can't show: a link to it, not a second list.
  const elsewhere = coming.filter((e) => !e.date.startsWith(monthKey(y, m))).slice(0, 3);
  const showMonth = (date: string) => setCursor({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 });
  const selectedTrades = selected ? trades.filter((t) => dayOf(t.date) === selected) : [];
  const delta = sum.pnl - prev.pnl;
  const empty = !trades.length;

  return (
    <div className="space-y-4">
      {/* The month, at a glance */}
      <section className="rounded-[26px] border border-white/[0.07] bg-tp-card/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <button aria-label={view === 'year' ? 'Previous year' : 'Previous month'} onClick={() => go(view === 'year' ? -12 : -1)} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-zinc-300 hover:bg-white/[0.11]"><ChevronLeft className="h-4 w-4" /></button>
          <h1 className="min-w-[10.5rem] text-center text-[19px] font-semibold tracking-[-0.02em] text-zinc-50">{view === 'year' ? y : `${MONTHS[m]} ${y}`}</h1>
          <button aria-label={view === 'year' ? 'Next year' : 'Next month'} onClick={() => go(view === 'year' ? 12 : 1)} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-zinc-300 hover:bg-white/[0.11]"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => today && setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })} className="rounded-full px-3 py-2 text-[13px] font-medium text-zinc-400 hover:text-zinc-100">Today</button>
          {latest && !latest.startsWith(monthKey(y, m)) && <button onClick={() => setCursor({ y: Number(latest.slice(0, 4)), m: Number(latest.slice(5, 7)) - 1 })} className="rounded-full px-3 py-2 text-[13px] font-medium text-zinc-400 hover:text-zinc-100">Latest trades</button>}
          <span className="flex-1" />
          <div role="group" aria-label="Calendar view" className="flex rounded-full bg-white/[0.06] p-[3px]">
            {(['month', 'year'] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={clsx('rounded-full px-3.5 py-1.5 text-[13px] font-medium capitalize', view === v ? 'bg-white/[0.14] text-zinc-50' : 'text-zinc-400 hover:text-zinc-200')}>{v}</button>)}
          </div>
          <button aria-label="Download this month as CSV" onClick={() => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([monthCsv(month)], { type: 'text/csv' }));
            a.download = `tradepilot-${monthKey(y, m)}.csv`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          }} disabled={!month.length} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-zinc-300 hover:bg-white/[0.11] disabled:opacity-30"><Download className="h-4 w-4" /></button>
        </div>
        {view === 'month' && (
          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className={clsx('text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums', sum.days ? tone(sum.pnl) : 'text-zinc-500')}>{sum.days ? money(sum.pnl) : '$0'}</p>
              <p className="mt-1.5 text-[13px] text-zinc-400">{!sum.days ? 'No trades this month' : prev.days ? <><span className={tone(delta)}>{money(delta)}</span> against {MONTHS[m === 0 ? 11 : m - 1]}</> : `Over ${sum.days} trading day${sum.days === 1 ? '' : 's'}`}{payouts > 0 && `, ${usd(payouts)} paid out`}</p>
            </div>
            {sum.days > 0 && (
              <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
                <Fact k="Green days" v={`${sum.green} of ${sum.days}`} sub={`${Math.round((sum.green / sum.days) * 100)}%`} />
                <Fact k="Win rate" v={`${Math.round(sum.winRate * 100)}%`} sub={`${sum.trades} trades`} />
                <Fact k="Profit factor" v={sum.profitFactor == null ? 'No losses' : sum.profitFactor.toFixed(2)} />
                <Fact k="Average green" v={money(sum.avgGreen)} cls="text-tp-green" sub={sum.avgRed ? `Red ${money(sum.avgRed)}` : undefined} />
                <Fact k="Best day" v={money(sum.best?.pnl ?? 0)} cls="text-tp-green" sub={sum.best ? nice(sum.best.date) : undefined} />
                <Fact k="Worst day" v={money(sum.worst?.pnl ?? 0)} cls={sum.worst && sum.worst.pnl < 0 ? 'text-tp-red' : undefined} sub={sum.worst ? nice(sum.worst.date) : undefined} />
              </dl>
            )}
          </div>
        )}
      </section>

      {view === 'year' ? (
        <YearView days={byDate} y={y} onMonth={(mm) => (setCursor({ y, m: mm }), setView('month'))} onDay={setSelected} today={today} />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 rounded-[26px] border border-white/[0.07] bg-tp-card/70 p-3 sm:p-4">
            {elsewhere.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5 px-1 text-[12.5px]">
                <span className="text-zinc-500">Next up</span>
                {elsewhere.map((e) => (
                  <button key={e.date + e.kind} onClick={() => showMonth(e.date)} title={e.detail} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-zinc-300 hover:bg-white/[0.1]">
                    <span className="tabular-nums text-zinc-500">{nice(e.date).replace(/^\w+, /, '')}</span> {e.title}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr)) minmax(70px, 0.7fr)` }}>
              {cols.map((c) => <div key={c} className="pb-1 text-center text-[12.5px] font-medium text-zinc-500">{SHORT[c]}</div>)}
              <div className="pb-1 text-center text-[12.5px] font-medium text-zinc-500">Week</div>
              {weeks.map((w, k) => (
                <div key={k} className="contents">
                  {cols.map((c) => {
                    const date = w.dates[c];
                    if (!date) return <div key={c} className="min-h-[92px] sm:min-h-[104px]" />;
                    const d = byDate.get(date);
                    const adj = adjByDate.get(date);
                    const news = newsOn(date, fomc);
                    const isToday = date === today;
                    const future = !!today && date > today;
                    const isPayout = payout?.date === date;
                    const heat = d ? 0.07 + (Math.abs(d.pnl) / biggest) * 0.3 : 0;
                    // Times need the browser's time zone, so they wait until the page is on screen.
                    const timeOf = (n: (typeof news)[number]) => (today ? localTimeOf(date, NEWS_MINUTE[n]) : '');
                    const newsText = news.map((n) => `${NEWS_LABEL[n]} at ${timeOf(n)} your time${n === 'jobs' && future ? ' (usual date)' : ''}`).join(', ');
                    const payoutText = isPayout && payout ? `Payout eligible${payout.amount > 0 ? `, about ${usd(payout.amount)} to you` : ''}${future ? ', if every day until then qualifies' : ''}` : '';
                    const label = [nice(date), d ? `${money(d.pnl)}, ${d.trades} trade${d.trades === 1 ? '' : 's'}` : future ? '' : 'no trades', newsText, payoutText].filter(Boolean).join('. ');
                    const flagged = !d && (news.length > 0 || isPayout);
                    const Tag = d ? 'button' : 'div';
                    return (
                      <Tag key={c} {...(d ? { onClick: () => setSelected(date), type: 'button' as const } : {})} aria-label={label} title={label}
                        className={clsx('relative flex min-h-[92px] flex-col overflow-hidden rounded-[14px] p-2 text-left ring-1 ring-inset transition sm:min-h-[104px] sm:p-2.5', d ? 'hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white' : '', isToday ? 'ring-tp-blue' : isPayout ? 'ring-tp-yellow/40' : flagged && future ? 'ring-tp-yellow/20' : d ? 'ring-white/[0.05]' : 'ring-white/[0.03]', flagged && future && 'bg-tp-yellow/[0.04]')}
                        style={d ? { background: d.pnl >= 0 ? `rgb(var(--tp-green) / ${heat})` : `rgb(var(--tp-red) / ${heat})` } : undefined}>
                        <span className="flex items-center gap-1">
                          <span className={clsx('text-[12px] font-medium tabular-nums', isToday ? 'text-tp-blue' : d || flagged ? 'text-zinc-300' : 'text-zinc-600')}>{Number(date.slice(8))}</span>
                          {isToday && <span className="text-[11px] font-medium text-tp-blue">Today</span>}
                          <span className="flex-1" />
                          {d && news.map((n) => <span key={n} className="rounded-full bg-tp-yellow/15 px-1 text-[9.5px] font-semibold uppercase leading-[15px] text-tp-yellow">{n === 'jobs' ? 'NFP' : n}</span>)}
                          {hasNote(date, accountId) && <FileText aria-label="Has a note" className="h-3 w-3 text-zinc-400" />}
                          {adj && !isPayout && <Wallet aria-label="Balance change" className="h-3 w-3 text-zinc-300" />}
                        </span>
                        {d && (
                          <span className="relative mt-1">
                            <span className={clsx('block truncate text-[15px] font-semibold tabular-nums tracking-[-0.02em] sm:text-[16px]', d.pnl >= 0 ? 'text-zinc-50' : 'text-[#FFB4AE]')}>{compact(d.pnl)}</span>
                            <span className="block truncate text-[11px] tabular-nums text-zinc-400">{d.wins}W {d.losses}L</span>
                            {isPayout && payout && <span className="block truncate text-[11px] font-medium text-tp-yellow">{payout.amount > 0 ? `Payout, ${compact(payout.amount).replace('+', '')}` : 'Payout eligible'}</span>}
                          </span>
                        )}
                        {!d && news.length > 0 && (
                          <span className="mt-1 space-y-0.5">
                            {news.map((n) => (
                              <span key={n} className="block min-w-0">
                                <span className="block truncate text-[12.5px] font-medium leading-tight text-zinc-100">{NEWS_LABEL[n]}</span>
                                <span className="block truncate text-[11px] leading-tight tabular-nums text-zinc-400">{timeOf(n)}</span>
                              </span>
                            ))}
                          </span>
                        )}
                        {!d && adj && <span className="mt-1 truncate text-[11.5px] capitalize text-zinc-400">{adj.type} {usd(adj.amount)}</span>}
                        {!d && isPayout && payout && <span className="mt-1 block truncate text-[12px] font-medium text-tp-yellow">{payout.amount > 0 ? `Payout, ${compact(payout.amount).replace('+', '')}` : 'Payout eligible'}</span>}
                        {d && !isPayout && <DayPath path={d.path} up={d.pnl >= 0} />}
                      </Tag>
                    );
                  })}
                  <div className="flex min-h-[92px] flex-col justify-between rounded-[14px] bg-white/[0.025] p-2 sm:min-h-[104px] sm:p-2.5">
                    <span className="text-[11.5px] text-zinc-500">{w.days ? `${w.days} day${w.days === 1 ? '' : 's'}` : ''}</span>
                    {w.days > 0 && (
                      <span>
                        <span className={clsx('block truncate text-[14px] font-semibold tabular-nums', tone(w.pnl))}>{compact(w.pnl)}</span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/[0.06]"><span className={clsx('block h-full rounded-full', w.pnl >= 0 ? 'bg-tp-green' : 'bg-tp-red')} style={{ width: `${(Math.abs(w.pnl) / weekBest) * 100}%` }} /></span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[12px] text-zinc-500">
              <span>Stronger color means a bigger day. News times are in your time zone. Tap a traded day to review it.</span>
              {!weekendTrades && <button aria-pressed={weekends} onClick={() => {
                setWeekends(!weekends);
                store(WEEKENDS_KEY, weekends ? '0' : '1');
              }} className="font-medium text-zinc-400 hover:text-zinc-100">{weekends ? 'Hide weekends' : 'Show weekends'}</button>}
            </div>
          </section>

          <div className="space-y-4">
            <Goal goal={goal} onGoal={(g) => {
              setGoal(g);
              store(GOAL_KEY, String(g));
            }} month={month} y={y} m={m} today={today} current={!!today && today.startsWith(monthKey(y, m))} />
            {!empty && (
              <Rail icon={<NotebookPen className="h-4 w-4" />} title="Worth reviewing">
                {review.length === 0 ? <p className="text-[13px] text-zinc-500">Every losing day has a note.</p> : (
                  <>
                    <p className="mb-2 text-[12px] leading-snug text-zinc-500">Your biggest losing days with no note yet.</p>
                    <ul className="space-y-0.5">
                      {review.map((d) => (
                        <li key={d.date}>
                          <button onClick={() => setSelected(d.date)} className="group flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13px] hover:bg-white/[0.05]">
                            <span className="flex-1 text-zinc-300">{nice(d.date)}</span>
                            <span className="font-medium tabular-nums text-tp-red">{money(d.pnl)}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-200" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Rail>
            )}
          </div>
        </div>
      )}

      {!empty && <PatternsPanel p={found} total={days.length} streak={streak} />}
      {empty && <p className="rounded-[20px] bg-white/[0.03] px-5 py-8 text-center text-[14px] text-zinc-400">Import your trades, and each day fills in here with its result, patterns and what to review.</p>}

      <DayReviewModal isOpen={selected !== null} onClose={() => setSelected(null)} date={selected ?? ''} trades={selectedTrades} accountId={accountId} tradingDays={tradeDates} onNavigate={(d) => {
        setSelected(d, { replace: true });
        showMonth(d);
      }} />
    </div>
  );
}

function Fact({ k, v, sub, cls }: { k: string; v: string; sub?: string; cls?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-zinc-500">{k}</dt>
      <dd className={clsx('truncate text-[17px] font-semibold tabular-nums tracking-[-0.02em]', cls ?? 'text-zinc-100')}>{v}</dd>
      {sub && <dd className="truncate text-[11.5px] tabular-nums text-zinc-500">{sub}</dd>}
    </div>
  );
}

function Rail({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-white/[0.07] bg-tp-card/70 p-4">
      <h2 className="mb-2.5 flex items-center gap-2 text-[14.5px] font-semibold text-zinc-100"><span className="text-zinc-400">{icon}</span> {title}</h2>
      {children}
    </section>
  );
}

function Goal({ goal, onGoal, month, y, m, today, current }: { goal: number; onGoal: (g: number) => void; month: CalDay[]; y: number; m: number; today: string; current: boolean }) {
  const [text, setText] = useState('');
  const p = goal > 0 && today ? pace(goal, month, y, m, today) : null;
  return (
    <Rail icon={<Target className="h-4 w-4" />} title="Monthly goal">
      {!p ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          const g = Number(text.replace(/[$,\s]/g, ''));
          if (g > 0) onGoal(g);
        }} className="flex gap-2">
          <input aria-label="Monthly goal in dollars" inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} placeholder="$3,000" className="min-w-0 flex-1 rounded-[11px] bg-white/[0.06] px-3 py-2 text-[14px] text-zinc-100 outline-none ring-1 ring-inset ring-white/[0.07] placeholder:text-zinc-600 focus:ring-white/30" />
          <button className="rounded-full bg-white/[0.1] px-3.5 py-2 text-[13px] font-medium text-zinc-100 hover:bg-white/[0.15]">Set</button>
        </form>
      ) : (
        <>
          <p className="flex items-baseline justify-between text-[13px]"><span className={clsx('text-[20px] font-semibold tabular-nums tracking-[-0.02em]', tone(p.made))}>{money(p.made)}</span><span className="tabular-nums text-zinc-500">of {usd(goal)}</span></p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-tp-green transition-[width] duration-500" style={{ width: `${Math.min(100, p.share * 100)}%` }} /></div>
          <p className="mt-2 text-[12.5px] leading-snug text-zinc-400">
            {p.made >= goal ? 'Goal reached. A good month to protect, not to press.' : !current ? `${usd(p.left)} short of this goal.` : p.perDay ? `${usd(p.perDay)} a day over the ${p.daysLeft} weekdays left.${p.perDay > Math.abs(summarize(month).avgGreen || Infinity) ? ' That\'s more than your average green day, so don\'t force it.' : ''}` : 'No weekdays left this month.'}
          </p>
          {current && p.projected != null && p.made < goal && <p className="mt-1 text-[12px] tabular-nums text-zinc-500">At this pace: about {money(p.projected)}</p>}
          <button onClick={() => onGoal(0)} className="mt-1.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-200">Change goal</button>
        </>
      )}
    </Rail>
  );
}

function YearView({ days, y, onMonth, onDay, today }: { days: Map<string, CalDay>; y: number; onMonth: (m: number) => void; onDay: (d: string) => void; today: string }) {
  const all = useMemo(() => [...days.values()].filter((d) => d.date.startsWith(`${y}-`)), [days, y]);
  const top = Math.max(1, ...all.map((d) => Math.abs(d.pnl)));
  const s = summarize(all);
  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-tp-card/70 p-5">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className={clsx('text-[30px] font-semibold tracking-[-0.03em] tabular-nums', all.length ? tone(s.pnl) : 'text-zinc-500')}>{all.length ? money(s.pnl) : 'No trades'}</p>
        {all.length > 0 && <p className="text-[13px] tabular-nums text-zinc-400">{s.green} green and {s.red} red days, {Math.round(s.winRate * 100)}% of {s.trades} trades won</p>}
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {MONTHS.map((name, m) => {
          const list = all.filter((d) => d.date.startsWith(monthKey(y, m)));
          const net = list.reduce((a, d) => a + d.pnl, 0);
          const first = weekdayOf(ymd(y, m, 1));
          return (
            <div key={name}>
              <button onClick={() => onMonth(m)} className="mb-1.5 flex w-full items-baseline justify-between text-left hover:underline">
                <span className="text-[13.5px] font-medium text-zinc-200">{name}</span>
                {list.length > 0 && <span className={clsx('text-[13px] font-semibold tabular-nums', tone(net))}>{compact(net)}</span>}
              </button>
              <div className="grid grid-cols-7 gap-[3px]">
                {Array.from({ length: first }, (_, i) => <span key={`e${i}`} />)}
                {Array.from({ length: daysInMonth(y, m) }, (_, i) => {
                  const date = ymd(y, m, i + 1);
                  const d = days.get(date);
                  const a = d ? 0.25 + (Math.abs(d.pnl) / top) * 0.75 : 0;
                  const title = `${nice(date)}${d ? `: ${money(d.pnl)}` : ''}`;
                  return d ? (
                    <button key={date} aria-label={title} title={title} onClick={() => onDay(date)} className="aspect-square rounded-[4px] hover:ring-1 hover:ring-white" style={{ background: d.pnl >= 0 ? `rgb(var(--tp-green) / ${a})` : `rgb(var(--tp-red) / ${a})` }} />
                  ) : <span key={date} title={title} className={clsx('aspect-square rounded-[4px]', date === today ? 'ring-1 ring-tp-blue' : 'bg-white/[0.035]')} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Bars({ rows, unit = 'day' }: { rows: Bucket[]; unit?: string }) {
  const top = Math.max(1, ...rows.map((r) => Math.abs(unit === 'trade' ? r.pnl : r.avg)));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const v = unit === 'trade' ? r.pnl : r.avg;
        const few = r.days < MIN_SAMPLE;
        return (
          <li key={r.key} className={clsx('grid grid-cols-[122px_minmax(0,1fr)_60px] items-center gap-2 text-[12.5px]', few && 'opacity-45')} title={few ? `Only ${r.days}: too few to read much into` : undefined}>
            <span className="truncate text-zinc-300">{r.label}<span className="ml-1 text-[11px] tabular-nums text-zinc-600">{r.days}</span></span>
            <span className="relative h-2 rounded-full bg-white/[0.04]">{r.days > 0 && <span className={clsx('absolute inset-y-0 left-0 rounded-full', v >= 0 ? 'bg-tp-green/80' : 'bg-tp-red/80')} style={{ width: `${Math.max(3, (Math.abs(v) / top) * 100)}%` }} />}</span>
            <span className={clsx('text-right font-medium tabular-nums', r.days ? tone(v) : 'text-zinc-600')}>{r.days ? compact(v) : '—'}</span>
          </li>
        );
      })}
    </ul>
  );
}

function PatternsPanel({ p, total, streak }: { p: ReturnType<typeof patterns>; total: number; streak: ReturnType<typeof currentStreak> }) {
  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-tp-card/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.01em] text-zinc-50"><Sparkles className="h-4 w-4 text-zinc-400" /> What your days say</h2>
        <p className="text-[12.5px] tabular-nums text-zinc-500">All {total} trading days in this view{streak.n > 1 ? `. On a ${streak.n}-day ${streak.kind} streak` : ''}</p>
      </div>
      {p.findings.length > 0 ? (
        <ul className="mt-3 grid gap-x-6 gap-y-1.5 md:grid-cols-2">
          {p.findings.slice(0, 6).map((f) => (
            <li key={f.text} className="flex items-start gap-2 text-[13.5px] leading-snug text-zinc-200">
              {f.tone === 'good' ? <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-tp-green" /> : <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-tp-red" />} {f.text}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-[13.5px] text-zinc-400">Nothing stands out yet. Patterns show up here after at least {MIN_SAMPLE} days of a kind.</p>}
      <div className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
        <div><h3 className="mb-2 text-[13px] font-medium text-zinc-400">Average by weekday</h3><Bars rows={p.weekday} /></div>
        <div><h3 className="mb-2 text-[13px] font-medium text-zinc-400">Average by trades that day</h3><Bars rows={p.tradeCount} /></div>
        <div><h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-zinc-400"><Landmark className="h-3.5 w-3.5" /> Average on news days</h3><Bars rows={p.news} /></div>
        <div><h3 className="mb-2 text-[13px] font-medium text-zinc-400">Average after a…</h3><Bars rows={p.afterDay} /></div>
        {p.hour.length > 1 && <div className="md:col-span-2 xl:col-span-4"><h3 className="mb-2 text-[13px] font-medium text-zinc-400">Total by hour of entry, using your trades&apos; own timestamps</h3><div className="grid gap-x-8 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((k) => <Bars key={k} rows={p.hour.filter((_, i) => i % 3 === k)} unit="trade" />)}</div></div>}
      </div>
      <p className="mt-4 text-[11.5px] text-zinc-500">The small number is how many days or trades each bar has. Faded bars have under {MIN_SAMPLE}, too few to read much into.</p>
    </section>
  );
}
