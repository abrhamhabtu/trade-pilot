'use client';

import React from 'react';
import clsx from 'clsx';
import { HelpTooltip, SurfaceCard } from '@/components/ui';

// Match the app palette instead of harsh neon.
const GREEN = '#30B886';
const RED = '#E5564F';
const BLUE = '#6E9BD1';
const TRACK = 'rgba(255,255,255,0.07)';

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const w = 90;
  const h = 44;
  const pad = 3;
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * stepX, h - pad - ((v - min) / range) * (h - pad * 2)] as const);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${h} L ${pts[0][0].toFixed(1)} ${h} Z`;
  const color = positive ? GREEN : RED;
  const gid = `spark-${positive ? 'g' : 'r'}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
    { n: wins, color: GREEN },
    { n: breakeven, color: BLUE },
    { n: losses, color: RED },
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
        {legend.map(({ n, color }, i) => (
          <div
            key={i}
            className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: color }}
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
      <div className="flex h-2.5 overflow-hidden rounded-full">
        <div style={{ width: `${winPct}%`, backgroundColor: GREEN }} />
        <div style={{ width: `${100 - winPct}%`, backgroundColor: RED }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold leading-none">
        <span className="text-tp-green">{fmt(win)}</span>
        <span className="text-tp-red">-{fmt(loss)}</span>
      </div>
    </div>
  );
}

export type MetricVisual =
  | { type: 'sparkline'; data: number[]; positive: boolean }
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
    if (trend === 'up') return 'text-tp-green';
    if (trend === 'down') return 'text-tp-red';
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
      className="!p-5"
    >
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="text-[13px] font-medium text-zinc-400">{title}</span>
        <HelpTooltip content={tooltipMap[title] ?? tooltip ?? ''} />
      </div>

      <div className="flex h-[60px] items-center justify-between gap-3">
        <div className={clsx('text-[1.75rem] font-bold tabular-nums leading-none tracking-tight', valueColor())}>
          {formatValue(value)}
        </div>

        <div className="flex h-full shrink-0 items-center">
          {visual?.type === 'sparkline' && <Sparkline data={visual.data} positive={visual.positive} />}
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
