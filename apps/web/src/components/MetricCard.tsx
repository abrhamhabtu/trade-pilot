'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { CardHeader, HelpTooltip, SurfaceCard } from '@/components/ui';

// ─── Ring Indicator ────────────────────────────────────────────────────────────
// Dual-color ring: green arc for the "positive" portion, red for the remainder.
// This matches the Tradesea style where both colors are always visible.
// pct: 0–1 float (green portion). Red fills the rest.
function RingIndicator({
  pct,
  size = 62,
}: {
  pct: number;
  size?: number;
}) {
  const strokeW = 5;
  const r  = (size - strokeW * 2 - 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped     = Math.min(Math.max(pct, 0), 1);
  const greenDash   = circumference * clamped;
  const greenOffset = 0;
  // Red arc starts where green ends and fills the rest
  const redDash     = circumference * (1 - clamped);
  const redOffset   = -(circumference * clamped);   // negative = start after green

  const GREEN = '#00FF9D';
  const RED   = '#FF3356';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', flexShrink: 0, overflow: 'visible' }}
    >
      <defs>
        <filter id="glow-g" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-r" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Dark track base */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} />

      {/* Red arc (remainder) */}
      {clamped < 1 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={RED}
          strokeWidth={strokeW}
          strokeDasharray={`${redDash} ${circumference}`}
          strokeDashoffset={redOffset}
          strokeLinecap="butt"
          filter="url(#glow-r)"
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      )}

      {/* Green arc (positive portion) */}
      {clamped > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={GREEN}
          strokeWidth={strokeW}
          strokeDasharray={`${greenDash} ${circumference}`}
          strokeDashoffset={greenOffset}
          strokeLinecap="butt"
          filter="url(#glow-g)"
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      )}
    </svg>
  );
}

// ─── MetricCard ────────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  format?: 'currency' | 'percentage' | 'number';
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  tooltip?: string;
  /** Pass a 0–100 number to show the dual-color ring indicator (green = pct, red = remainder) */
  ringPct?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = 'text-zinc-400',
  format = 'number',
  trend = 'neutral',
  subtitle,
  tooltip,
  ringPct,
}) => {
  const hasRing = ringPct !== undefined;

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
        return `${val.toFixed(1)}%`;
      case 'number':
        return val >= 1000 ? val.toFixed(2) : val.toLocaleString();
      default:
        return val.toLocaleString();
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':   return 'text-zinc-50';
      case 'down': return 'text-tp-red';
      default:     return 'text-zinc-100';
    }
  };

  const tooltipMap: Record<string, string> = {
    'Net P&L':          'Account balance including all trades and adjustments (payouts, deposits).',
    'Profit Factor':    'Gross profit ÷ gross loss. Above 1.0 = profitable. Above 2.0 = excellent.',
    'Trade Win %':      'Percentage of trades that closed in profit.',
    'Trade Expectancy': 'Average expected profit/loss per trade over time.',
    'Current Streak':   'Consecutive wins or losses — tracks trading momentum.',
    'Total Trades':     'Total closed trades. Larger sample = more reliable stats.',
  };

  return (
    <SurfaceCard padding="sm" hoverable>
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-white/40 text-xs font-medium tracking-wide uppercase">
            {title}
          </span>
          <HelpTooltip content={tooltipMap[title] ?? tooltip ?? ''} />
        </div>
        {/* Icon (non-ring cards) */}
        {!hasRing && Icon && (
          <Icon className={clsx('h-4 w-4 opacity-50', iconColor)} />
        )}
      </div>

      {/* Body */}
      <div className="flex items-end justify-between gap-3">
        {/* Value + subtitle */}
        <div className="min-w-0">
          <div className={clsx('text-2xl font-bold tabular-nums leading-none', getTrendColor())}>
            {formatValue(value)}
          </div>
          {subtitle && (
            <div className="mt-1.5 text-white/30 text-[10px] font-semibold tracking-widest uppercase">
              {subtitle}
            </div>
          )}
        </div>

        {/* Ring indicator */}
        {hasRing && (
          <RingIndicator
            pct={(ringPct ?? 0) / 100}
            size={62}
          />
        )}
      </div>
    </SurfaceCard>
  );
};
