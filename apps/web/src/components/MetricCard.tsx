'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { HelpTooltip, SurfaceCard } from '@/components/ui';

const GREEN = '#00FF9D';
const RED = '#FF3356';
const TRACK = 'rgba(255,255,255,0.08)';

function Sparkline({
  points,
  positive,
}: {
  points: number[];
  positive: boolean;
}) {
  const width = 96;
  const height = 40;
  const values = points.length >= 2 ? points : [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);
  const path = values
    .map((point, index) => {
      const x = index * step;
      const y = height - ((point - min) / range) * (height - 8) - 4;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  const stroke = positive ? GREEN : RED;
  const fill = positive ? 'rgba(0,255,157,0.10)' : 'rgba(255,51,86,0.10)';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <path d={areaPath} fill={fill} />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DonutIndicator({ pct, size = 54 }: { pct: number; size?: number }) {
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
  const total = wins + breakeven + losses || 1;
  const segments = [
    {
      label: 'W',
      count: wins,
      width: (wins / total) * 100,
      barClassName: 'bg-emerald-400',
      textClassName: 'text-emerald-400',
    },
    {
      label: 'BE',
      count: breakeven,
      width: (breakeven / total) * 100,
      barClassName: 'bg-blue-500',
      textClassName: 'text-blue-400',
    },
    {
      label: 'L',
      count: losses,
      width: (losses / total) * 100,
      barClassName: 'bg-rose-500',
      textClassName: 'text-rose-400',
    },
  ];

  return (
    <div className="w-[112px] shrink-0">
      <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
        {segments.map((segment) =>
          segment.count > 0 ? (
            <div
              key={segment.label}
              className={segment.barClassName}
              style={{ width: `${segment.width}%` }}
            />
          ) : null
        )}
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px] font-semibold leading-none">
        {segments.map((segment) => (
          <div key={segment.label} className="text-center">
            <span className={segment.textClassName}>{segment.count}</span>
            <span className="ml-0.5 text-zinc-600">{segment.label}</span>
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
    <div className="w-[112px] shrink-0">
      <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
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
  | { type: 'sparkline'; points: number[]; positive: boolean }
  | { type: 'donut'; pct: number }
  | { type: 'gauge'; wins: number; breakeven: number; losses: number }
  | { type: 'winloss-bar'; avgWin: number; avgLoss: number };

interface MetricCardProps {
  title: string;
  value: string | number;
  format?: 'currency' | 'percentage' | 'number';
  trend?: 'up' | 'down' | 'neutral';
  tooltip?: string;
  context?: string;
  visual?: MetricVisual;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  format = 'number',
  trend = 'neutral',
  tooltip,
  context,
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

  const accentStyles = () => {
    if (trend === 'up') {
      return {
        rail: 'from-emerald-400/80 to-emerald-400/5',
        wash: 'bg-emerald-400/[0.035]',
        icon: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20',
      };
    }
    if (trend === 'down') {
      return {
        rail: 'from-rose-400/80 to-rose-400/5',
        wash: 'bg-rose-400/[0.035]',
        icon: 'bg-rose-400/10 text-rose-300 ring-rose-400/20',
      };
    }
    if (title === 'Trade win %') {
      return {
        rail: 'from-blue-400/80 to-blue-400/5',
        wash: 'bg-blue-400/[0.03]',
        icon: 'bg-blue-400/10 text-blue-300 ring-blue-400/20',
      };
    }
    return {
      rail: 'from-zinc-300/55 to-zinc-300/0',
      wash: 'bg-white/[0.018]',
      icon: 'bg-white/[0.045] text-zinc-300 ring-white/10',
    };
  };

  const accent = accentStyles();

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
      className="group min-h-[126px] !border-white/[0.075] !bg-[#0c1424]/95 !p-0"
    >
      <div className={clsx('pointer-events-none absolute inset-0 opacity-100', accent.wash)} />
      <div className={clsx('absolute inset-x-4 top-0 h-px bg-gradient-to-r', accent.rail)} />

      <div className="relative flex h-full min-h-[126px] flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              {title}
            </span>
            <HelpTooltip content={tooltipMap[title] ?? tooltip ?? ''} />
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div
              className={clsx(
                'text-[1.7rem] font-bold tabular-nums leading-none tracking-tight',
                valueColor()
              )}
            >
              {formatValue(value)}
            </div>
            {context && (
              <div className="mt-2 truncate text-[11px] font-medium text-zinc-500">
                {context}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-end">
          {visual?.type === 'icon-box' && (
            <div
              className={clsx(
                'flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition-transform group-hover:scale-105',
                accent.icon
              )}
            >
              <visual.icon className="h-5 w-5" />
            </div>
          )}
          {visual?.type === 'sparkline' && (
            <Sparkline points={visual.points} positive={visual.positive} />
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
      </div>
    </SurfaceCard>
  );
};
