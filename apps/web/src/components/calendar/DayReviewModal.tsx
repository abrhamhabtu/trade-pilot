'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ImagePlus,
  Maximize2,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useTradingStore, type Trade } from '@/store/tradingStore';
import { useAccountStore } from '@/store/accountStore';
import { useDailyNotesStore, type NoteImage } from '@/store/dailyNotesStore';
import { usePlaybookStore } from '@/store/playbookStore';
import { tradingStrategies } from '../Playbooks';
import { DEFAULT_SETTINGS, inspectTrade, orderedTrades } from '@/lib/pilot/workspace';

const GENERIC_SETUPS = ['Breakout', 'Breakdown', 'Trend Following', 'Mean Reversion', 'Scalp', 'Momentum', 'Range Trade', 'News Play', 'Reversal', 'Other'];
const GRADES = [
  { g: 'A', hint: 'Followed the plan perfectly', cls: 'bg-tp-green text-[#0D1628]' },
  { g: 'B', hint: 'Small slips', cls: 'bg-[#7ee0b8] text-[#0D1628]' },
  { g: 'C', hint: 'Mixed', cls: 'bg-tp-yellow text-[#0D1628]' },
  { g: 'D', hint: 'Broke rules', cls: 'bg-orange-400 text-[#0D1628]' },
  { g: 'F', hint: 'Tilted', cls: 'bg-tp-red text-white' },
];
const MOODS = ['Focused', 'Patient', 'Confident', 'FOMO', 'Revenge', 'Hesitant', 'Tired', 'Overtraded'];
const BAD_MOODS = new Set(['FOMO', 'Revenge', 'Hesitant', 'Tired', 'Overtraded']);
const PROMPTS = ['What went well:', 'What I’d do differently:', 'Did I follow my playbook?', 'Lesson for tomorrow:'];

const money = (n: number, cents = true) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
const signed = (n: number, cents = true) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n), cents)}`;
const hold = (min: number) =>
  !Number.isFinite(min) || min <= 0 ? '—' : min < 1 ? `${Math.round(min * 60)}s` : min < 60 ? `${Math.round(min)}m` : `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;

export interface DayReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  trades: Trade[];
  accountId?: string;
  /** Every date with trades, ascending — enables ←/→ navigation. */
  tradingDays?: string[];
  onNavigate?: (date: string) => void;
}

export function DayReviewModal({ isOpen, onClose, date, trades, accountId, tradingDays = [], onNavigate }: DayReviewModalProps) {
  const { updateTrade } = useTradingStore();
  const { accounts, selectedAccountId, updateAccount } = useAccountStore();
  const account = accounts.find((a) => a.id === (accountId || selectedAccountId));
  const custom = usePlaybookStore((s) => s.custom);
  const hydratePlaybooks = usePlaybookStore((s) => s.hydrate);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => hydratePlaybooks(), [hydratePlaybooks]);

  const idx = tradingDays.indexOf(date);
  const prev = idx > 0 ? tradingDays[idx - 1] : null;
  const next = idx >= 0 && idx < tradingDays.length - 1 ? tradingDays[idx + 1] : null;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && !!e.target.closest('input, textarea, select');
      if (e.key === 'Escape') onClose();
      else if (!typing && e.key === 'ArrowLeft' && prev) onNavigate?.(prev);
      else if (!typing && e.key === 'ArrowRight' && next) onNavigate?.(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, prev, next, onClose, onNavigate]);

  useEffect(() => setExpanded(null), [date]);

  const sorted = useMemo(() => orderedTrades(trades), [trades]);
  const stats = useMemo(() => {
    const wins = sorted.filter((t) => t.netPL > 0);
    const losses = sorted.filter((t) => t.netPL < 0);
    const grossWin = wins.reduce((s, t) => s + t.netPL, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPL, 0));
    let run = 0;
    let peak = 0;
    let dip = 0;
    for (const t of sorted) {
      run += t.netPL;
      peak = Math.max(peak, run);
      dip = Math.min(dip, run);
    }
    const net = run;
    return {
      net,
      count: sorted.length,
      wins: wins.length,
      losses: losses.length,
      winRate: sorted.length ? (wins.length / sorted.length) * 100 : 0,
      pf: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
      avgWin: wins.length ? grossWin / wins.length : 0,
      avgLoss: losses.length ? grossLoss / losses.length : 0,
      fees: sorted.reduce((s, t) => s + (t.commission || 0), 0),
      contracts: sorted.reduce((s, t) => s + t.quantity, 0),
      peak,
      dip,
      gaveBack: Math.max(0, peak - net),
    };
  }, [sorted]);

  const rules = account?.pilotSettings?.rules || DEFAULT_SETTINGS.rules;
  const checks = useMemo(() => sorted.map((t) => ({ trade: t, flags: inspectTrade(t, sorted, rules).flags })), [sorted, rules]);
  const flagCount = checks.reduce((n, c) => n + c.flags.length, 0);

  const playbookNames = useMemo(() => [...tradingStrategies, ...custom].map((s) => s.name), [custom]);

  const editTrade = (id: string, updates: Partial<Trade>) => {
    updateTrade(id, updates);
    const owner = accounts.find((a) => a.trades.some((t) => t.id === id));
    if (owner) updateAccount(owner.id, { trades: owner.trades.map((t) => (t.id === id ? { ...t, ...updates } : t)) });
  };

  if (!isOpen || !date) return null;
  const d = new Date(`${date}T12:00:00`);
  const green = stats.net >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Review of ${d.toDateString()}`} className="w-full max-w-6xl overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0f1a2b] shadow-2xl">
        {/* Header */}
        <header
          className="relative border-b border-white/[0.06] px-5 py-5 sm:px-7"
          style={{ background: `radial-gradient(60% 140% at 0% 0%, ${green ? 'rgba(0,214,143,0.14)' : 'rgba(255,72,104,0.14)'} 0%, transparent 60%)` }}
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1">
              <NavBtn label="Previous trading day" disabled={!prev} onClick={() => prev && onNavigate?.(prev)} icon={ChevronLeft} />
              <NavBtn label="Next trading day" disabled={!next} onClick={() => next && onNavigate?.(next)} icon={ChevronRight} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                  {d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h2>
                <span className="text-sm text-zinc-500">{d.getFullYear()}</span>
                <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', green ? 'bg-tp-green/15 text-tp-green' : 'bg-tp-red/15 text-tp-red')}>
                  {green ? 'Green day' : 'Red day'}
                </span>
              </div>
              {tradingDays.length > 1 && idx >= 0 && (
                <p className="mt-0.5 text-xs text-zinc-500">
                  Trading day {idx + 1} of {tradingDays.length} · use ← → to move between days
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-500">Net P&L</div>
              <div className={clsx('text-3xl font-semibold tabular-nums tracking-tight', green ? 'text-tp-green' : 'text-tp-red')}>{signed(stats.net)}</div>
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* KPI strip */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Trades" value={String(stats.count)} sub={`${stats.wins}W · ${stats.losses}L`} />
            <Kpi label="Win rate" value={`${stats.winRate.toFixed(0)}%`} bar={stats.winRate} />
            <Kpi label="Profit factor" value={stats.pf === Infinity ? '∞' : stats.pf.toFixed(2)} tone={stats.pf >= 1 ? 'green' : 'red'} />
            <Kpi label="Avg win / loss" value={`${money(stats.avgWin, false)} / ${money(stats.avgLoss, false)}`} small />
            <Kpi label="Best run-up" value={signed(stats.peak, false)} sub={stats.gaveBack > 0 ? `gave back ${money(stats.gaveBack, false)}` : 'closed at the high'} tone="green" />
            <Kpi label="Fees · size" value={money(stats.fees)} sub={`${stats.contracts} contracts`} />
          </div>
        </header>

        <div className="grid gap-0 lg:grid-cols-[1.45fr_1fr]">
          {/* Left: curve + trades */}
          <div className="min-w-0 space-y-5 border-b border-white/[0.06] p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <section>
              <SectionTitle icon={TrendingUp} title="How the day unfolded" hint={stats.dip < 0 ? `Worst point ${signed(stats.dip, false)}` : undefined} />
              <DayCurve trades={sorted} />
            </section>

            <section>
              <SectionTitle icon={Clock} title="Trades" hint="Click a trade to add a note" />
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <div className="min-w-[540px]">
                  <div className="grid grid-cols-[72px_1fr_36px_1.2fr_92px_1.35fr] gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs font-medium text-zinc-500">
                    <span>Time</span>
                    <span>Symbol</span>
                    <span className="text-right">Qty</span>
                    <span>Entry → Exit</span>
                    <span className="text-right">P&L</span>
                    <span>Playbook</span>
                  </div>
                  {checks.map(({ trade: t, flags }) => {
                    const open = expanded === t.id;
                    return (
                      <div key={t.id} className={clsx('border-b border-white/[0.04] last:border-0', open && 'bg-white/[0.02]')}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpanded(open ? null : t.id)}
                          onKeyDown={(e) => e.key === 'Enter' && setExpanded(open ? null : t.id)}
                          className="grid cursor-pointer grid-cols-[72px_1fr_36px_1.2fr_92px_1.35fr] items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.03]"
                        >
                          <span className="whitespace-nowrap tabular-nums text-zinc-400">{t.time || '—'}</span>
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="font-semibold text-zinc-100">{t.symbol.replace(/[A-Z]\d{1,2}$|\d{4}$/, '')}</span>
                            {t.side && (
                              <span className={clsx('rounded px-1.5 py-px text-[11px] font-medium', t.side === 'Long' ? 'bg-tp-green/10 text-tp-green' : 'bg-tp-red/10 text-tp-red')}>
                                {t.side}
                              </span>
                            )}
                            {flags.length > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-tp-yellow" aria-label={`${flags.length} rule breaks`} />}
                            {t.notes && <NotebookPen className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-label="Has note" />}
                          </span>
                          <span className="text-right tabular-nums text-zinc-300">{t.quantity}</span>
                          <span className="truncate tabular-nums text-zinc-400">
                            {t.entryPrice ? t.entryPrice.toLocaleString() : '—'} → {t.exitPrice ? t.exitPrice.toLocaleString() : '—'}
                          </span>
                          <span className={clsx('text-right font-semibold tabular-nums', t.netPL >= 0 ? 'text-tp-green' : 'text-tp-red')}>{signed(t.netPL)}</span>
                          <PlaybookSelect value={t.strategy || ''} names={playbookNames} onChange={(v) => editTrade(t.id, { strategy: v })} />
                        </div>
                        {open && (
                          <div className="space-y-3 px-4 pb-4">
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
                              <span>Held {hold(t.duration)}</span>
                              <span>Entry {t.entryPrice ? t.entryPrice.toLocaleString() : '—'}</span>
                              <span>Exit {t.exitPrice ? t.exitPrice.toLocaleString() : '—'}</span>
                              {t.rMultiple ? <span>{t.rMultiple.toFixed(2)}R</span> : null}
                              {t.commission ? <span>Fees {money(t.commission)}</span> : null}
                            </div>
                            {flags.length > 0 && (
                              <ul className="space-y-1">
                                {flags.map((f) => (
                                  <li key={f} className="flex items-center gap-2 text-sm text-tp-yellow">
                                    <AlertTriangle className="h-3.5 w-3.5" /> {f}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <TradeNote trade={t} onSave={(notes) => editTrade(t.id, { notes })} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* Right: review */}
          <div className="min-w-0 space-y-5 p-5 sm:p-7">
            <RuleCheck flagCount={flagCount} trades={stats.count} maxTrades={rules.maxTrades} net={stats.net} dailyLoss={rules.dailyLoss} custom={!!account?.pilotSettings} />
            <Reflection date={date} accountId={accountId} />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4 sm:px-7">
          <p className="text-xs text-zinc-500">Notes save automatically when you click away.</p>
          <div className="flex gap-2">
            <Link href="/app/pilot" className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] px-3.5 py-2 text-sm font-medium text-zinc-200 hover:bg-white/[0.05]">
              <Sparkles className="h-4 w-4 text-tp-green" /> Review with Pilot AI
            </Link>
            <Link href="/app/journal" className="inline-flex items-center gap-1.5 rounded-xl bg-tp-green px-3.5 py-2 text-sm font-semibold text-[#0D1628] hover:brightness-110">
              Open journal <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function NavBtn({ label, disabled, onClick, icon: Icon }: { label: string; disabled: boolean; onClick: () => void; icon: React.ElementType }) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] disabled:opacity-30"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Kpi({ label, value, sub, tone, bar, small }: { label: string; value: string; sub?: string; tone?: 'green' | 'red'; bar?: number; small?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3.5 py-2.5">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={clsx('mt-0.5 truncate font-semibold tabular-nums', small ? 'text-base' : 'text-lg', tone === 'green' ? 'text-tp-green' : tone === 'red' ? 'text-tp-red' : 'text-zinc-50')}>
        {value}
      </div>
      {bar !== undefined ? (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-tp-red/30">
          <div className="h-full rounded-full bg-tp-green" style={{ width: `${bar}%` }} />
        </div>
      ) : (
        sub && <div className="truncate text-xs text-zinc-500">{sub}</div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-100">
        <Icon className="h-4 w-4 text-zinc-500" /> {title}
      </h3>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  );
}

/** Cumulative P&L through the day, one point per trade. */
function DayCurve({ trades }: { trades: Trade[] }) {
  const W = 640;
  const H = 180;
  const pad = { l: 44, r: 16, t: 14, b: 26 };
  const pts = [{ y: 0, label: 'Open', t: null as Trade | null }];
  let run = 0;
  for (const t of trades) {
    run += t.netPL;
    pts.push({ y: run, label: t.time || '', t });
  }
  const max = Math.max(0, ...pts.map((p) => p.y));
  const min = Math.min(0, ...pts.map((p) => p.y));
  const span = max - min || 1;
  const x = (i: number) => pad.l + (i / Math.max(1, pts.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((max - v) / span) * (H - pad.t - pad.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.y)}`).join(' ');
  const green = run >= 0;
  const color = green ? '#00D68F' : '#FF4868';

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Intraday cumulative P&L">
        <defs>
          <linearGradient id="dayCurveFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[max, 0, min].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.07)" strokeDasharray={v === 0 ? '' : '4 4'} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#71717a">
              {v === 0 ? '$0' : `${v > 0 ? '+' : '−'}$${Math.abs(Math.round(v)).toLocaleString()}`}
            </text>
          </g>
        ))}
        <path d={`${line} L${x(pts.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#dayCurveFill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) =>
          p.t ? (
            <g key={i}>
              <circle cx={x(i)} cy={y(p.y)} r="5" fill="#0f1a2b" stroke={p.t.netPL >= 0 ? '#00D68F' : '#FF4868'} strokeWidth="2.5">
                <title>{`${p.t.time || ''} ${p.t.symbol} ${p.t.side || ''}: ${signed(p.t.netPL)} → ${signed(p.y)} on the day`}</title>
              </circle>
              {pts.length <= 12 && (
                <text x={x(i)} y={H - 6} textAnchor={i === pts.length - 1 ? 'end' : 'middle'} fontSize="11" fill="#71717a">
                  {p.label}
                </text>
              )}
            </g>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function PlaybookSelect({ value, names, onChange }: { value: string; names: string[]; onChange: (v: string) => void }) {
  const known = value && !names.includes(value) && !GENERIC_SETUPS.includes(value);
  return (
    <label className="relative min-w-0" onClick={(e) => e.stopPropagation()}>
      <span className="sr-only">Playbook</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'w-full cursor-pointer appearance-none truncate rounded-lg bg-white/[0.04] py-1.5 pl-2.5 pr-7 text-sm ring-1 ring-inset ring-white/[0.07] focus:outline-none focus:ring-tp-green/40',
          value ? 'text-zinc-100' : 'text-zinc-500',
        )}
      >
        <option value="">Tag a playbook…</option>
        {known && <option value={value}>{value}</option>}
        <optgroup label="Your playbooks">
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </optgroup>
        <optgroup label="General">
          {GENERIC_SETUPS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </optgroup>
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
    </label>
  );
}

function TradeNote({ trade, onSave }: { trade: Trade; onSave: (notes: string) => void }) {
  const [text, setText] = useState(trade.notes || '');
  const [saved, setSaved] = useState(false);
  useEffect(() => setText(trade.notes || ''), [trade.id, trade.notes]);
  const commit = () => {
    if (text === (trade.notes || '')) return;
    onSave(text);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
        <span>Note on this trade</span>
        {saved && <span className="text-tp-green">Saved</span>}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        rows={2}
        placeholder="Why did you take it? Was it an A+ setup? What would you change?"
        className="block w-full resize-y rounded-lg bg-black/25 p-2.5 text-sm text-zinc-100 ring-1 ring-inset ring-white/[0.08] placeholder:text-zinc-600 focus:outline-none focus:ring-tp-green/40"
      />
    </div>
  );
}

function RuleCheck({ flagCount, trades, maxTrades, net, dailyLoss, custom }: { flagCount: number; trades: number; maxTrades: number; net: number; dailyLoss: number; custom: boolean }) {
  const used = Math.min(100, Math.max(0, (-Math.min(0, net) / dailyLoss) * 100));
  return (
    <section className={clsx('rounded-2xl border p-4', flagCount ? 'border-tp-yellow/25 bg-tp-yellow/[0.04]' : 'border-tp-green/20 bg-tp-green/[0.04]')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-100">
          <ShieldCheck className={clsx('h-4 w-4', flagCount ? 'text-tp-yellow' : 'text-tp-green')} /> Rule check
        </h3>
        <span className={clsx('text-sm font-semibold', flagCount ? 'text-tp-yellow' : 'text-tp-green')}>
          {flagCount ? `${flagCount} break${flagCount === 1 ? '' : 's'}` : 'All rules kept'}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-zinc-500">Trades taken</div>
          <div className={clsx('font-semibold tabular-nums', trades > maxTrades ? 'text-tp-yellow' : 'text-zinc-100')}>
            {trades} <span className="font-normal text-zinc-500">/ {maxTrades}</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Loss budget used</div>
          <div className="font-semibold tabular-nums text-zinc-100">{used.toFixed(0)}%</div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div className={clsx('h-full rounded-full', used > 66 ? 'bg-tp-red' : used > 33 ? 'bg-tp-yellow' : 'bg-tp-green')} style={{ width: `${Math.max(used, 2)}%` }} />
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {custom ? 'Using your rules from Pilot AI.' : 'Starter rules —'}{' '}
        <Link href="/app/pilot" className="text-zinc-300 underline-offset-2 hover:underline">
          {custom ? 'edit' : 'set your own in Pilot AI'}
        </Link>
        {flagCount > 0 && ' · open a trade to see what was broken.'}
      </p>
    </section>
  );
}

function Reflection({ date, accountId }: { date: string; accountId?: string }) {
  const { getNote, saveNote, addImage, removeImage, setNoteMeta } = useDailyNotesStore();
  const note = getNote(date, accountId);
  const [content, setContent] = useState(note?.content || '');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<NoteImage | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setContent(note?.content || ''), [date, note?.content]);

  const save = useCallback(() => {
    if (content === (note?.content || '')) return;
    saveNote(date, content, accountId);
    setSavedAt(Date.now());
  }, [content, note?.content, saveNote, date, accountId]);

  const readFiles = (files: FileList | File[]) => {
    Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .forEach((f) => {
        const r = new FileReader();
        r.onload = () => typeof r.result === 'string' && addImage(date, r.result, accountId);
        r.readAsDataURL(f);
      });
  };

  const insertPrompt = (p: string) => {
    const el = areaRef.current;
    const nextText = `${content}${content && !content.endsWith('\n') ? '\n' : ''}${p} `;
    setContent(nextText);
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(nextText.length, nextText.length);
    }, 0);
  };

  const tags = note?.tags || [];
  const toggleMood = (m: string) => setNoteMeta(date, { tags: tags.includes(m) ? tags.filter((t) => t !== m) : [...tags, m] }, accountId);

  return (
    <div className="space-y-5">
      {/* Grade */}
      <section>
        <SectionTitle icon={Star} title="Grade your execution" hint="Process, not P&L" />
        <div className="grid grid-cols-5 gap-2">
          {GRADES.map(({ g, hint, cls }) => {
            const on = note?.grade === g;
            return (
              <button
                key={g}
                title={hint}
                aria-pressed={on}
                onClick={() => setNoteMeta(date, { grade: on ? undefined : g }, accountId)}
                className={clsx(
                  'rounded-xl py-2.5 text-lg font-bold transition-all',
                  on ? `${cls} scale-105 shadow-lg` : 'bg-white/[0.04] text-zinc-400 ring-1 ring-inset ring-white/[0.07] hover:text-zinc-100',
                )}
              >
                {g}
              </button>
            );
          })}
        </div>
        {note?.grade && <p className="mt-2 text-xs text-zinc-500">{GRADES.find((x) => x.g === note.grade)?.hint}</p>}
      </section>

      {/* Mood */}
      <section>
        <SectionTitle icon={Sparkles} title="How were you trading?" />
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => {
            const on = tags.includes(m);
            const bad = BAD_MOODS.has(m);
            return (
              <button
                key={m}
                onClick={() => toggleMood(m)}
                aria-pressed={on}
                className={clsx(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  on
                    ? bad
                      ? 'border-tp-red/40 bg-tp-red/10 text-tp-red'
                      : 'border-tp-green/40 bg-tp-green/10 text-tp-green'
                    : 'border-white/[0.08] text-zinc-400 hover:text-zinc-100',
                )}
              >
                {on && <Check className="-ml-0.5 mr-1 inline h-3.5 w-3.5" />}
                {m}
              </button>
            );
          })}
        </div>
      </section>

      {/* Journal */}
      <section>
        <SectionTitle icon={NotebookPen} title="Journal" hint={savedAt ? 'Saved' : undefined} />
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PROMPTS.map((p) => (
            <button key={p} onClick={() => insertPrompt(p)} className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100">
              + {p.replace(':', '').replace('?', '')}
            </button>
          ))}
        </div>
        <textarea
          ref={areaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSavedAt(null);
          }}
          onBlur={save}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData?.files || []);
            if (files.some((f) => f.type.startsWith('image/'))) {
              e.preventDefault();
              readFiles(files);
            }
          }}
          rows={6}
          placeholder="What happened today? Tap a prompt above to get started. Paste a chart screenshot straight in."
          className="block w-full resize-y rounded-xl bg-black/25 p-3 text-[15px] leading-relaxed text-zinc-100 ring-1 ring-inset ring-white/[0.08] placeholder:text-zinc-600 focus:outline-none focus:ring-tp-green/40"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={save}
            disabled={content === (note?.content || '')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-1.5 text-sm font-medium text-zinc-100 hover:bg-white/[0.12] disabled:opacity-40"
          >
            {savedAt && content === (note?.content || '') ? <CheckCircle2 className="h-4 w-4 text-tp-green" /> : null}
            {savedAt && content === (note?.content || '') ? 'Saved' : 'Save note'}
          </button>
        </div>
      </section>

      {/* Screenshots */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          readFiles(e.dataTransfer.files);
        }}
      >
        <SectionTitle icon={Camera} title="Charts & screenshots" hint={note?.images.length ? `${note.images.length}` : undefined} />
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && readFiles(e.target.files)} />
        {note?.images.length ? (
          <div className="grid grid-cols-3 gap-2">
            {note.images.map((img) => (
              <div key={img.id} className="group relative aspect-video overflow-hidden rounded-lg ring-1 ring-white/[0.08]">
                <img src={img.dataUrl} alt="Chart screenshot" className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => setLightbox(img)} aria-label="Enlarge" className="rounded-md bg-white/10 p-1.5 text-zinc-100 hover:bg-white/20">
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => removeImage(date, img.id, accountId)} aria-label="Delete screenshot" className="rounded-md bg-tp-red/20 p-1.5 text-tp-red hover:bg-tp-red/30">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()} className="grid aspect-video place-items-center rounded-lg border border-dashed border-white/[0.12] text-zinc-500 hover:border-tp-green/40 hover:text-tp-green">
              <ImagePlus className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className={clsx(
              'flex w-full flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
              dragging ? 'border-tp-green/50 bg-tp-green/[0.05]' : 'border-white/[0.1] hover:border-white/[0.2]',
            )}
          >
            <ImagePlus className="h-6 w-6 text-zinc-500" />
            <span className="text-sm text-zinc-300">Drop, paste or click to add charts</span>
            <span className="text-xs text-zinc-500">⌘/Ctrl + V works in the journal box too</span>
          </button>
        )}
      </section>

      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox.dataUrl} alt="Chart screenshot" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
          <button aria-label="Close" onClick={() => setLightbox(null)} className="absolute right-6 top-6 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
