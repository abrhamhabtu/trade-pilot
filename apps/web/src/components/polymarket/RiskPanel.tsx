'use client';

import React from 'react';
import clsx from 'clsx';
import { Shield, TrendingDown, Calendar, AlertTriangle } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { usePolymarketStore } from '@/store/polymarketStore';

export const RiskPanel: React.FC = () => {
  const { theme } = useThemeStore();
  const { state, config, riskStatus } = usePolymarketStore();
  const isDark = theme === 'dark';

  const layers = [
    {
      label: 'Daily Loss',
      icon: Calendar,
      data: riskStatus.daily,
      pct: config.risk.dailyMaxLossPct * 100,
    },
    {
      label: 'Monthly Loss',
      icon: Calendar,
      data: riskStatus.monthly,
      pct: config.risk.monthlyMaxLossPct * 100,
    },
    {
      label: 'Drawdown',
      icon: TrendingDown,
      data: riskStatus.drawdown,
      pct: config.risk.maxDrawdownPct * 100,
    },
    {
      label: 'Total Loss',
      icon: AlertTriangle,
      data: riskStatus.total,
      pct: config.risk.totalMaxLossPct * 100,
    },
  ];

  return (
    <div
      className={clsx(
        'rounded-2xl border p-5',
        isDark
          ? 'border-white/[0.06] bg-white/[0.02]'
          : 'border-slate-200 bg-white'
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        <Shield className={clsx('h-5 w-5', isDark ? 'text-white/50' : 'text-slate-500')} />
        <h2 className="text-lg font-semibold">Risk Management</h2>
      </div>

      <div className="space-y-4">
        {layers.map((layer) => (
          <RiskLayer key={layer.label} {...layer} isDark={isDark} />
        ))}
      </div>

      {/* Consecutive Tracker */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
        <div className="text-center">
          <p className={clsx('text-xs', isDark ? 'text-white/30' : 'text-slate-400')}>Consecutive Losses</p>
          <p className="text-lg font-semibold text-red-400">{state.consecutiveLosses}</p>
        </div>
        <div className="text-center">
          <p className={clsx('text-xs', isDark ? 'text-white/30' : 'text-slate-400')}>Consecutive Wins</p>
          <p className="text-lg font-semibold text-emerald-400">{state.consecutiveWins}</p>
        </div>
      </div>
    </div>
  );
};

function RiskLayer({
  label,
  icon: Icon,
  data,
  pct,
  isDark,
}: {
  label: string;
  icon: React.ElementType;
  data: { used: number; limit: number; status: string };
  pct: number;
  isDark: boolean;
}) {
  const progress = Math.min((data.used / data.limit) * 100, 100);

  const statusColors = {
    ok: 'bg-emerald-500',
    warning: 'bg-amber-500',
    breached: 'bg-red-500',
  };

  const statusText = {
    ok: 'text-emerald-400',
    warning: 'text-amber-400',
    breached: 'text-red-400',
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={clsx('h-3.5 w-3.5', isDark ? 'text-white/30' : 'text-slate-400')} />
          <span className={clsx('text-sm', isDark ? 'text-white/60' : 'text-slate-600')}>{label}</span>
        </div>
        <span className={clsx('text-xs font-medium', statusText[data.status as keyof typeof statusText])}>
          {data.status === 'ok' ? 'OK' : data.status === 'warning' ? 'Warning' : 'Breached'}
        </span>
      </div>
      <div className={clsx('h-2 w-full overflow-hidden rounded-full', isDark ? 'bg-white/[0.06]' : 'bg-slate-100')}>
        <div
          className={clsx('h-full rounded-full transition-all', statusColors[data.status as keyof typeof statusColors])}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-xs">
        <span className={isDark ? 'text-white/30' : 'text-slate-400'}>
          ${data.used.toFixed(2)} / ${data.limit.toFixed(2)}
        </span>
        <span className={isDark ? 'text-white/30' : 'text-slate-400'}>{pct}% limit</span>
      </div>
    </div>
  );
}
