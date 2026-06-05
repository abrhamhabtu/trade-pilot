'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { HelpTooltip, SurfaceCard } from '@/components/ui';

const GREEN = '#00FF9D';
const RED = '#FF3356';
const BLUE = '#4F9CF9';
const TRACK = 'rgba(255,255,255,0.08)';

function DonutIndicator({ pct, size = 64 }: { pct: number; size?: number }) {
  const strokeW = 6;
  const r = (size - strokeW * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(pct, 0), 1);
  const greenDash = circumference * clamped;
  const redDash = circumference * (1 - clamped);
  const redOffset = -(circumference * clamped);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={TRACK} strokeWidth={strokeW} />
      {clamped < 1 && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={RED}
          strokeWidth={strokeW}
          strokeDasharray={`${redDash} ${circumference}`}
          strokeDashoffset={redOffset}
          strokeLinecap="butt"
        />
      )}
      {clamped > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={GREEN}
          strokeWidth={strokeW}
          strokeDasharray={`${greenDash} ${circumference}`}
          strokeLinecap="butt"
        />
      )}
    </svg>
  );
}

function WinRateGauge({
  wins,
  breakeven,
  losses,
}: {
  wins: number;
  breakeven: number;
  losses: number;
}) {
  const width = 92;
  const height = 54;
  const total = wins + breakeven + losses || 1;
  const cx = width / 2;
  const cy = height - 8;
  const r = 34;
  const strokeW = 8;

  // Top semicircle: left → right along the upper arc
  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const arcLength = Math.PI * r;

  const segments: { count: number; color: string }[] = [
    { count: wins, color: GREEN },
    { count: breakeven, color: BLUE },
    { count: losses, color: RED },
  ];

  const legend = [
    { n: wins, bg: 'bg-emerald-400' },
    { n: breakeven, bg: 'bg-blue-500' },
    { n: losses, bg: 'bg-rose-500' },
  ];

  let offset = 0;

  return (
    <div className="flex shrink-0 flex-col items-end">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path
          d={trackPath}
          fill="none"
          stroke={TRACK}
          strokeWidth={strokeW}
          strokeLinecap="butt"
        />
        {segments.map(({ count, color }, i) => {
          if (count <= 0) return null;
          const segLen = (count / total) * arcLength;
          const dashOffset = offset;
          offset += segLen;
          return (
            <path
              key={i}
              d={trackPath}
              fill="none"
              stroke={color}
              strokeWidth={strokeW}
              strokeDasharray={`${segLen} ${arcLength * 2}`}
              strokeDashoffset={-dashOffset}
              strokeLinecap="butt"
              pathLength={arcLength}
            />
          );
        })}
      </svg>
      <div className="mt-1.5 flex items-center gap-1">
        {legend.map(({ n, bg }, i) => (
          <div
            key={i}
            className={clsx(
              'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
              bg
            )}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

function WinLossBar({ avgWin, avgLoss }: { avgWin: number; avgLoss: number }) {
  const win = Math.max(avgWin, 0);
  const loss = Math.abs(avgLoss);
  const total = win + loss || 1;
  const winPct = (win / total) * 100;

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <div className="w-[84px] shrink-0">
      <div className="flex h-2.5 overflow-hidden rounded-sm">
        <div className="bg-emerald-400" style={{ width: `${winPct}%` }} />
        <div className="bg-rose-500" style={{ width: `${100 - winPct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold leading-none">
        <span className="text-emerald-400">{fmt(win)}</span>
        <span className="text-rose-400">-{fmt(loss)}</span>
      </div>
    </div>
  );
}

export type MetricVisual =
  | { type: 'icon-box'; icon: LucideIcon }
  | { type: 'donut'; pct: number }
  | { type: 'gauge'; wins: number; breakeven: number; losses: number }
  | { type: 'winloss-bar'; avgWin: number; avgLoss: number };

interface MetricCardProps {
  title: string;
  value: string | number;
  format?: 'currency' | 'percentage' | 'number';
  trend?: 'up' | 'down' | 'neutral';
  tooltip?: string;
  visual?: MetricVisual;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  format = 'number',
  trend = 'neutral',
  tooltip,
  visual,
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(2)}%`;
      case 'number':
        return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
      default:
        return val.toLocaleString();
    }
  };

  const valueColor = () => {
    if (trend === 'up') return 'text-emerald-400';
    if (trend === 'down') return 'text-rose-400';
    return 'text-zinc-50';
  };

  const tooltipMap: Record<string, string> = {
    'Net P&L': 'Account balance including all trades and adjustments (payouts, deposits).',
    'Profit factor': 'Gross profit ÷ gross loss. Above 1.0 = profitable. Above 2.0 = excellent.',
    'Trade win %': 'Percentage of trades that closed in profit.',
    'Avg win/loss trade': 'Average winning trade size divided by average losing trade size.',
  };

  return (
    <SurfaceCard
      padding="sm"
      hoverable
      className="!border-white/[0.06] !bg-[#0c1424]/90 !p-4"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[13px] font-medium text-zinc-400">{title}</span>
        <HelpTooltip content={tooltipMap[title] ?? tooltip ?? ''} />
      </div>

      <div className="flex h-[76px] items-center justify-between gap-3">
        <div className={clsx('text-[1.65rem] font-bold tabular-nums leading-none tracking-tight', valueColor())}>
          {formatValue(value)}
        </div>

        <div className="flex h-full shrink-0 items-center">
          {visual?.type === 'icon-box' && (
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-500/20">
              <visual.icon className="h-5 w-5 text-indigo-300" />
            </div>
          )}
          {visual?.type === 'donut' && <DonutIndicator pct={visual.pct / 100} />}
          {visual?.type === 'gauge' && (
            <WinRateGauge wins={visual.wins} breakeven={visual.breakeven} losses={visual.losses} />
          )}
          {visual?.type === 'winloss-bar' && (
            <WinLossBar avgWin={visual.avgWin} avgLoss={visual.avgLoss} />
          )}
        </div>
      </div>
    </SurfaceCard>
  );
};
