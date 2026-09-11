'use client';

import React, { useId, useState } from 'react';
import clsx from 'clsx';
import { HelpTooltip } from '@/components/ui';

const GREEN = '#00D68F';
const RED = '#FF4868';
const BLUE = '#4F9CF9';
const TRACK = 'rgba(255,255,255,0.07)';

export type Tone = 'green' | 'red' | 'blue' | 'neutral';

/** What the card shows while the pointer is over part of its visual. */
export type Peek = {
  value: string;
  tone?: Tone;
  context: React.ReactNode;
} | null;
type SetPeek = (p: Peek) => void;

interface MetricCardProps {
  title: string;
  value: string;
  valueTone?: Tone;
  tooltip: string;
  context: React.ReactNode;
  /** Pass a function to let the visual drive the number and caption on hover. */
  visual?: React.ReactNode | ((peek: SetPeek) => React.ReactNode);
}

const TONE_TEXT: Record<Tone, string> = {
  green: 'text-tp-green',
  red: 'text-tp-red',
  blue: 'text-tp-blue',
  neutral: 'text-zinc-50',
};

const KEYFRAMES =
  '@keyframes mcDraw{from{stroke-dashoffset:var(--mc-len)}to{stroke-dashoffset:0}}@keyframes mcFade{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}@keyframes mcGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}@media (prefers-reduced-motion:reduce){.mc-anim{animation:none!important}}';

/** TradeZella-style KPI tile: label, number and caption on the left; an interactive visual on the right. */
export function MetricCard({ title, value, valueTone = 'neutral', tooltip, context, visual }: MetricCardProps) {
  const [peek, setPeek] = useState<Peek>(null);
  const shownValue = peek?.value ?? value;
  const shownTone = peek ? (peek.tone ?? 'neutral') : valueTone;
  return (
    <div className="group relative flex min-h-[124px] items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-tp-card px-4 py-4 transition-all duration-200 hover:-translate-y-px hover:border-white/[0.12] hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.9)] 2xl:px-5">
      <style>{KEYFRAMES}</style>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap text-[13px] font-medium text-zinc-400">{title}</span>
          <HelpTooltip content={tooltip} />
        </div>
        <div
          key={shownValue}
          className={clsx('mc-anim mt-2.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums [animation:mcFade_.18s_ease-out] 2xl:text-[28px]', TONE_TEXT[shownTone])}
        >
          {shownValue}
        </div>
        <div className={clsx('mt-2 truncate text-xs', peek ? 'text-zinc-300' : 'text-zinc-500')}>{peek?.context ?? context}</div>
      </div>
      {visual && <div className="flex shrink-0 items-center">{typeof visual === 'function' ? visual(setPeek) : visual}</div>}
    </div>
  );
}

// ─── Interactive visuals ─────────────────────────────────────────────────────

export interface SparkPoint {
  value: number;
  label: string;
}

/** Scrub along the line to read the balance after any trade. */
export function Sparkline({ points, positive, peek, format }: { points: SparkPoint[]; positive: boolean; peek: SetPeek; format: (n: number) => string }) {
  const id = useId().replace(/:/g, '');
  const [i, setI] = useState<number | null>(null);
  const values = points.length >= 2 ? points.map((p) => p.value) : [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 92;
  const h = 48;
  const xy = values.map((v, k) => [4 + (k / (values.length - 1)) * (w - 8), h - 7 - ((v - min) / range) * (h - 14)] as const);
  const line = xy.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const len = xy.reduce((n, [x, y], k) => (k ? n + Math.hypot(x - xy[k - 1][0], y - xy[k - 1][1]) : 0), 0);
  const color = positive ? GREEN : RED;
  const at = i ?? xy.length - 1;
  const [ax, ay] = xy[at];

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="cursor-crosshair overflow-visible"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const k = Math.round(((e.clientX - r.left - 4) / (w - 8)) * (values.length - 1));
        const idx = Math.max(0, Math.min(values.length - 1, k));
        setI(idx);
        const p = points[idx];
        if (p)
          peek({
            value: format(p.value),
            tone: p.value >= 0 ? 'green' : 'red',
            context: p.label,
          });
      }}
      onMouseLeave={() => {
        setI(null);
        peek(null);
      }}
      role="img"
      aria-label="Equity curve, hover to scrub"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${xy[xy.length - 1][0]},${h} L${xy[0][0]},${h} Z`} fill={`url(#${id})`} className="mc-anim [animation:mcFade_.8s_ease-out]" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={len}
        className="mc-anim [animation:mcDraw_1s_cubic-bezier(.3,.7,.3,1)]"
        style={{ ['--mc-len' as string]: len } as React.CSSProperties}
      />
      {i !== null && <line x1={ax} x2={ax} y1={2} y2={h} stroke="rgba(255,255,255,0.25)" strokeDasharray="2 2" />}
      <circle cx={ax} cy={ay} r={i !== null ? 7 : 5} fill={color} opacity="0.22" className={i === null ? 'animate-pulse' : undefined} />
      <circle cx={ax} cy={ay} r={i !== null ? 3.5 : 2.5} fill={color} stroke={i !== null ? '#fff' : 'none'} strokeWidth="1.5" />
    </svg>
  );
}

/** Profit (green) vs loss (red) ring; hover a side for its total. */
export function Donut({ won, lost, peek, format }: { won: number; lost: number; peek: SetPeek; format: (n: number) => string }) {
  const [on, setOn] = useState<'won' | 'lost' | null>(null);
  const size = 56;
  const r = 22;
  const c = 2 * Math.PI * r;
  const total = won + lost;
  const g = total ? won / total : 0;
  const gap = g > 0 && g < 1 ? 5 : 0;
  const seg = (which: 'won' | 'lost') => {
    const share = which === 'won' ? g : 1 - g;
    const offset = which === 'won' ? 0 : c * g;
    const active = on === which;
    const onEnter = () => {
      setOn(which);
      peek(
        which === 'won'
          ? {
              value: format(won),
              tone: 'green',
              context: `gross profit · ${Math.round(g * 100)}% of total`,
            }
          : {
              value: `-${format(lost)}`,
              tone: 'red',
              context: `gross loss · ${Math.round((1 - g) * 100)}% of total`,
            },
      );
    };
    return (
      <g key={which}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          pointerEvents="none"
          stroke={which === 'won' ? GREEN : RED}
          strokeWidth={active ? 9 : 6}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.1, c * share - gap)} ${c}`}
          strokeDashoffset={-(offset + gap / 2)}
          opacity={on && !active ? 0.35 : 1}
          className="transition-all duration-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="transparent"
          strokeWidth={18}
          strokeDasharray={`${Math.max(0.1, c * share)} ${c}`}
          strokeDashoffset={-offset}
          className="cursor-pointer"
          onMouseEnter={onEnter}
        />
      </g>
    );
  };
  return (
    <div
      className="relative"
      onMouseLeave={() => {
        setOn(null);
        peek(null);
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible" role="img" aria-label="Gross profit vs gross loss">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={6} />
        {total > 0 && g < 1 && seg('lost')}
        {total > 0 && g > 0 && seg('won')}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] font-semibold tabular-nums text-zinc-400">
        {on ? `${Math.round((on === 'won' ? g : 1 - g) * 100)}%` : total ? `${Math.round(g * 100)}%` : ''}
      </div>
    </div>
  );
}

/** Half-donut of wins / breakeven / losses, with a tick at the break-even win rate. */
export function WinGauge({ wins, breakeven, losses, breakEvenRate, peek }: { wins: number; breakeven: number; losses: number; breakEvenRate: number; peek: SetPeek }) {
  const [on, setOn] = useState<number | null>(null);
  const total = wins + breakeven + losses;
  const w = 84;
  const r = 32;
  const sw = 7;
  const cx = w / 2;
  const cy = r + sw / 2 + 2;
  const half = Math.PI * r;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const segs = [
    {
      key: 'win',
      n: wins,
      color: GREEN,
      tone: 'green' as const,
      label: 'wins',
    },
    {
      key: 'be',
      n: breakeven,
      color: BLUE,
      tone: 'blue' as const,
      label: 'breakeven',
    },
    {
      key: 'loss',
      n: losses,
      color: RED,
      tone: 'red' as const,
      label: 'losses',
    },
  ];
  const drawn = segs.filter((s) => s.n > 0);
  const gap = drawn.length > 1 ? 3 : 0;
  const hoverSeg = (k: number | null) => {
    setOn(k);
    if (k === null) return peek(null);
    const s = segs[k];
    peek({
      value: `${s.n}`,
      tone: s.tone,
      context: `${s.label} · ${total ? Math.round((s.n / total) * 100) : 0}% of trades`,
    });
  };
  // Break-even tick: angle along the arc (0% = left end, 100% = right end).
  const be = Math.min(Math.max(breakEvenRate, 0), 100) / 100;
  const ang = Math.PI - be * Math.PI;
  const tx = cx + Math.cos(ang) * r;
  const ty = cy - Math.sin(ang) * r;
  const nx = Math.cos(ang);
  const ny = -Math.sin(ang);
  let start = 0;

  return (
    <div className="flex flex-col items-center" onMouseLeave={() => hoverSeg(null)}>
      <svg width={w} height={cy + 2} viewBox={`0 0 ${w} ${cy + 2}`} className="overflow-visible" role="img" aria-label="Wins, breakeven and losses">
        <path d={arc} fill="none" stroke={TRACK} strokeWidth={sw} />
        {total > 0 &&
          segs.map((s, k) => {
            if (!s.n) return null;
            const len = (s.n / total) * half;
            const first = start === 0;
            const el = (
              <path
                key={s.key}
                d={arc}
                fill="none"
                stroke={s.color}
                strokeWidth={on === k ? sw + 3 : sw}
                strokeDasharray={`${Math.max(0.1, len - gap)} ${half * 2}`}
                strokeDashoffset={-(start + (first ? 0 : gap / 2))}
                opacity={on !== null && on !== k ? 0.3 : 1}
                pointerEvents="none"
                className="transition-all duration-200"
              />
            );
            const hit = (
              <path
                key={`${s.key}-hit`}
                d={arc}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                strokeDasharray={`${len} ${half * 2}`}
                strokeDashoffset={-start}
                className="cursor-pointer"
                onMouseEnter={() => hoverSeg(k)}
              />
            );
            start += len;
            return (
              <React.Fragment key={s.key}>
                {el}
                {hit}
              </React.Fragment>
            );
          })}
        {breakEvenRate > 0 && (
          <g
            className="cursor-help"
            onMouseEnter={() => {
              setOn(null);
              peek({
                value: `${Math.round(breakEvenRate)}%`,
                tone: 'neutral',
                context: 'needed to break even',
              });
            }}
          >
            <line x1={tx - nx * 7} y1={ty - ny * 7} x2={tx + nx * 7} y2={ty + ny * 7} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <circle cx={tx} cy={ty} r="9" fill="transparent" />
          </g>
        )}
      </svg>
      <div className="mt-1 flex gap-1 text-[11px] font-semibold tabular-nums">
        {segs.map((s, k) => (
          <button
            key={s.key}
            type="button"
            onMouseEnter={() => hoverSeg(k)}
            onFocus={() => hoverSeg(k)}
            onBlur={() => hoverSeg(null)}
            className={clsx('rounded px-1 transition-colors', on === k ? 'bg-white/10' : 'hover:bg-white/5', s.tone === 'green' ? 'text-tp-green' : s.tone === 'blue' ? 'text-tp-blue' : 'text-tp-red')}
          >
            {s.n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Avg win vs avg loss split; hover either side for its largest trade. */
export function WinLossBar({
  avgWin,
  avgLoss,
  largestWin,
  largestLoss,
  peek,
  fmt,
}: {
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  peek: SetPeek;
  fmt: (n: number) => string;
}) {
  const [on, setOn] = useState<'win' | 'loss' | null>(null);
  const win = Math.max(avgWin, 0);
  const loss = Math.abs(avgLoss);
  const winPct = win + loss ? (win / (win + loss)) * 100 : 50;
  const enter = (k: 'win' | 'loss') => {
    setOn(k);
    peek(
      k === 'win'
        ? {
            value: fmt(win),
            tone: 'green',
            context: `avg win · best ${fmt(Math.max(largestWin, 0))}`,
          }
        : {
            value: `-${fmt(loss)}`,
            tone: 'red',
            context: `avg loss · worst -${fmt(Math.abs(Math.min(largestLoss, 0)))}`,
          },
    );
  };
  return (
    <div
      className="w-[104px]"
      onMouseLeave={() => {
        setOn(null);
        peek(null);
      }}
    >
      <div className="mb-1.5 flex justify-between text-[11px] font-semibold tabular-nums">
        <span className={clsx('text-tp-green transition-opacity', on === 'loss' && 'opacity-40')}>{fmt(win)}</span>
        <span className={clsx('text-tp-red transition-opacity', on === 'win' && 'opacity-40')}>-{fmt(loss)}</span>
      </div>
      <div className="mc-anim -my-1.5 flex h-6 origin-left items-center gap-0.5 [animation:mcGrow_.8s_cubic-bezier(.3,.7,.3,1)]">
        <div onMouseEnter={() => enter('win')} className="flex h-full cursor-pointer items-center" style={{ width: `${winPct}%` }}>
          <div className={clsx('w-full rounded-l-full bg-tp-green transition-all duration-200', on === 'win' ? 'h-3 shadow-[0_0_12px_rgba(0,214,143,0.5)]' : 'h-2', on === 'loss' && 'opacity-35')} />
        </div>
        <div onMouseEnter={() => enter('loss')} className="flex h-full flex-1 cursor-pointer items-center">
          <div className={clsx('w-full rounded-r-full bg-tp-red transition-all duration-200', on === 'loss' ? 'h-3 shadow-[0_0_12px_rgba(255,72,104,0.5)]' : 'h-2', on === 'win' && 'opacity-35')} />
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-zinc-600">
        <span>avg win</span>
        <span>avg loss</span>
      </div>
    </div>
  );
}
