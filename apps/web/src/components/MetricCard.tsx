'use client';

import React, { useId } from 'react';
import clsx from 'clsx';
import { HelpTooltip } from '@/components/ui';

const GREEN = '#00D68F';
const RED = '#FF4868';
const BLUE = '#4F9CF9';
const TRACK = 'rgba(255,255,255,0.07)';

export type Tone = 'green' | 'red' | 'neutral';

interface MetricCardProps {
  title: string;
  value: string;
  valueTone?: Tone;
  tooltip: string;
  context: React.ReactNode;
  visual?: React.ReactNode;
}

/** TradeZella-style KPI tile: label, big number and one line on the left; a compact visual on the right. */
export function MetricCard({ title, value, valueTone = 'neutral', tooltip, context, visual }: MetricCardProps) {
  return (
    <div className="group relative flex min-h-[124px] items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-tp-card px-4 py-4 2xl:px-5 transition-all duration-200 hover:-translate-y-px hover:border-white/[0.12] hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.9)]">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap text-[13px] font-medium text-zinc-400">{title}</span>
          <HelpTooltip content={tooltip} />
        </div>
        <div
          className={clsx(
            'mt-2.5 text-[26px] font-semibold 2xl:text-[28px] leading-none tracking-tight tabular-nums',
            valueTone === 'green' ? 'text-tp-green' : valueTone === 'red' ? 'text-tp-red' : 'text-zinc-50',
          )}
        >
          {value}
        </div>
        <div className="mt-2 truncate text-xs text-zinc-500">{context}</div>
      </div>
      {visual && <div className="flex shrink-0 items-center">{visual}</div>}
    </div>
  );
}

// ─── Visuals (all sized to sit in a ~60px-tall slot) ─────────────────────────

export function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const id = useId().replace(/:/g, '');
  const values = points.length >= 2 ? points : [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 88;
  const h = 46;
  const xy = values.map((v, i) => [(i / (values.length - 1)) * w, h - 6 - ((v - min) / range) * (h - 12)] as const);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const color = positive ? GREEN : RED;
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg width={w + 6} height={h} viewBox={`0 0 ${w + 6} ${h}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="5" fill={color} opacity="0.25" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

/** Green share = gross profit, red share = gross loss. */
export function Donut({ greenShare }: { greenShare: number }) {
  const size = 54;
  const sw = 6;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const g = Math.min(Math.max(greenShare, 0), 1);
  const gap = g > 0 && g < 1 ? 4 : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={sw} />
      {g < 1 && g > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RED} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${Math.max(0.1, c * (1 - g) - gap * 2)} ${c}`} strokeDashoffset={-(c * g + gap)} />
      )}
      {g > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GREEN} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${Math.max(0.1, c * g - gap * 2)} ${c}`} strokeDashoffset={-gap} className="transition-all duration-700" />
      )}
    </svg>
  );
}

/** Half-donut split into wins / breakeven / losses, with counts underneath. */
export function WinGauge({ wins, breakeven, losses }: { wins: number; breakeven: number; losses: number }) {
  const total = wins + breakeven + losses;
  const w = 80;
  const r = 32;
  const sw = 7;
  const cx = w / 2;
  const cy = r + sw / 2;
  const half = Math.PI * r;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const segs = [
    { n: wins, color: GREEN },
    { n: breakeven, color: BLUE },
    { n: losses, color: RED },
  ].filter((s) => s.n > 0);
  const gap = segs.length > 1 ? 3 : 0;
  let start = 0;
  return (
    <div className="flex flex-col items-center">
      <svg width={w} height={cy + 1} viewBox={`0 0 ${w} ${cy + 1}`} aria-hidden>
        <path d={arc} fill="none" stroke={TRACK} strokeWidth={sw} />
        {total > 0 &&
          segs.map((s, i) => {
            const len = (s.n / total) * half;
            const el = <path key={i} d={arc} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${Math.max(0.1, len - gap)} ${half * 2}`} strokeDashoffset={-(start + (i ? gap / 2 : 0))} />;
            start += len;
            return el;
          })}
      </svg>
      <div className="mt-1 flex gap-3 text-[11px] font-semibold tabular-nums">
        <span className="text-tp-green">{wins}</span>
        <span className="text-tp-blue">{breakeven}</span>
        <span className="text-tp-red">{losses}</span>
      </div>
    </div>
  );
}

export function WinLossBar({ avgWin, avgLoss, fmt }: { avgWin: number; avgLoss: number; fmt: (n: number) => string }) {
  const win = Math.max(avgWin, 0);
  const loss = Math.abs(avgLoss);
  const winPct = win + loss ? (win / (win + loss)) * 100 : 50;
  return (
    <div className="w-[96px]">
      <div className="mb-1.5 flex justify-between text-[11px] font-semibold tabular-nums">
        <span className="text-tp-green">{fmt(win)}</span>
        <span className="text-tp-red">-{fmt(loss)}</span>
      </div>
      <div className="flex h-2 gap-0.5">
        <div className="h-full rounded-l-full bg-tp-green transition-all duration-700" style={{ width: `${winPct}%` }} />
        <div className="h-full flex-1 rounded-r-full bg-tp-red" />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-zinc-600">
        <span>avg win</span>
        <span>avg loss</span>
      </div>
    </div>
  );
}
