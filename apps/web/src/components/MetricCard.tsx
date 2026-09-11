'use client';

import React, { useId } from 'react';
import clsx from 'clsx';
import { HelpTooltip } from '@/components/ui';

export type Tone = 'green' | 'red' | 'yellow' | 'blue' | 'neutral';

const TONE_TEXT: Record<Tone, string> = {
  green: 'text-tp-green',
  red: 'text-tp-red',
  yellow: 'text-tp-yellow',
  blue: 'text-tp-blue',
  neutral: 'text-zinc-50',
};
const TONE_CHIP: Record<Tone, string> = {
  green: 'bg-tp-green/10 text-tp-green ring-tp-green/20',
  red: 'bg-tp-red/10 text-tp-red ring-tp-red/20',
  yellow: 'bg-tp-yellow/10 text-tp-yellow ring-tp-yellow/20',
  blue: 'bg-tp-blue/10 text-tp-blue ring-tp-blue/20',
  neutral: 'bg-white/[0.05] text-zinc-300 ring-white/10',
};
const TONE_ICON: Record<Tone, string> = {
  green: 'bg-tp-green/10 text-tp-green',
  red: 'bg-tp-red/10 text-tp-red',
  yellow: 'bg-tp-yellow/10 text-tp-yellow',
  blue: 'bg-tp-blue/10 text-tp-blue',
  neutral: 'bg-white/[0.06] text-zinc-300',
};

interface MetricCardProps {
  title: string;
  icon: React.ElementType;
  value: string;
  suffix?: string;
  valueTone?: Tone;
  accent?: Tone;
  badge?: { label: string; tone: Tone };
  tooltip: string;
  context: React.ReactNode;
  children?: React.ReactNode;
  /** Visual runs to the card's edges (sparklines). */
  bleed?: boolean;
}

export function MetricCard({ title, icon: Icon, value, suffix, valueTone = 'neutral', accent = 'neutral', badge, tooltip, context, children, bleed }: MetricCardProps) {
  return (
    <div className="group relative flex h-full min-h-[148px] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-tp-card transition-colors duration-200 hover:border-white/[0.12]">
      <div className={clsx('pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-60 blur-2xl', accent === 'neutral' ? 'bg-white/[0.03]' : TONE_ICON[accent].split(' ')[0])} />
      <div className="relative flex flex-1 flex-col p-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-lg', TONE_ICON[accent])}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-xs font-medium text-zinc-400">{title}</span>
            <HelpTooltip content={tooltip} />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-1">
            <span className={clsx('text-[28px] font-semibold leading-none tracking-tight tabular-nums', TONE_TEXT[valueTone])}>{value}</span>
            {suffix && <span className="text-sm font-medium text-zinc-500">{suffix}</span>}
          </div>
          {badge && <span className={clsx('truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', TONE_CHIP[badge.tone])}>{badge.label}</span>}
        </div>
        <div className="mt-1.5 truncate text-xs text-zinc-500">{context}</div>

        {children && !bleed && <div className="mt-auto pt-3">{children}</div>}
      </div>
      {children && bleed && <div className="relative -mt-2">{children}</div>}
    </div>
  );
}

// ─── Visuals ─────────────────────────────────────────────────────────────────

export function AreaSpark({ points, positive }: { points: number[]; positive: boolean }) {
  const id = useId().replace(/:/g, '');
  const values = points.length >= 2 ? points : [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 200;
  const h = 44;
  const xy = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / range) * (h - 10)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const color = positive ? '#00D68F' : '#FF4868';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block h-12 w-full" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Profit factor on a 0–3 scale with losing / thin / healthy zones. */
export function PfScale({ value }: { value: number }) {
  const max = 3;
  const pos = Math.min(value, max) / max;
  return (
    <div>
      <div className="relative h-2 rounded-full">
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          <div className="h-full bg-tp-red/35" style={{ width: `${(1 / max) * 100}%` }} />
          <div className="h-full bg-tp-yellow/35" style={{ width: `${(0.5 / max) * 100}%` }} />
          <div className="h-full flex-1 bg-tp-green/35" />
        </div>
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tp-card bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.12)] transition-all duration-700"
          style={{ left: `${pos * 100}%` }}
        />
      </div>
      <div className="relative mt-1.5 h-3 text-[10px] text-zinc-600">
        {[1, 2, 3].map((t) => (
          <span key={t} className={clsx('absolute', t === 3 ? 'right-0' : '-translate-x-1/2')} style={t === 3 ? undefined : { left: `${(t / max) * 100}%` }}>
            {t === 3 ? '3+' : t}
          </span>
        ))}
        <span className="absolute left-0">0</span>
      </div>
    </div>
  );
}

export function OutcomeBar({ wins, breakeven, losses }: { wins: number; breakeven: number; losses: number }) {
  const total = wins + breakeven + losses || 1;
  const parts = [
    { n: wins, label: 'wins', bar: 'bg-tp-green', text: 'text-tp-green' },
    { n: breakeven, label: 'BE', bar: 'bg-zinc-500', text: 'text-zinc-400' },
    { n: losses, label: 'losses', bar: 'bg-tp-red', text: 'text-tp-red' },
  ];
  return (
    <div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {parts.map((p) => (p.n ? <div key={p.label} className={clsx('h-full first:rounded-l-full last:rounded-r-full', p.bar)} style={{ width: `${(p.n / total) * 100}%` }} /> : null))}
        {!wins && !breakeven && !losses && <div className="h-full w-full bg-white/[0.06]" />}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums">
        {parts.map((p) => (
          <span key={p.label} className={clsx(!p.n && 'opacity-40')}>
            <span className={clsx('font-semibold', p.text)}>{p.n}</span> <span className="text-zinc-500">{p.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function WinLossBars({ avgWin, avgLoss, fmt }: { avgWin: number; avgLoss: number; fmt: (n: number) => string }) {
  const win = Math.max(avgWin, 0);
  const loss = Math.abs(avgLoss);
  const max = Math.max(win, loss) || 1;
  return (
    <div className="space-y-1.5">
      {[
        { label: 'Avg win', v: win, bar: 'bg-tp-green', text: 'text-tp-green', sign: '' },
        { label: 'Avg loss', v: loss, bar: 'bg-tp-red', text: 'text-tp-red', sign: '-' },
      ].map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[11px]">
          <span className="w-12 shrink-0 text-zinc-500">{r.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
            <div className={clsx('h-full rounded-full transition-all duration-700', r.bar)} style={{ width: `${(r.v / max) * 100}%` }} />
          </div>
          <span className={clsx('w-12 shrink-0 text-right font-semibold tabular-nums', r.text)}>
            {r.sign}
            {fmt(r.v)}
          </span>
        </div>
      ))}
    </div>
  );
}
