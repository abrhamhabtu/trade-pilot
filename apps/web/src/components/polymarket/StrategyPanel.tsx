'use client';

import React from 'react';
import clsx from 'clsx';
import { Brain, Scale, Zap, TrendingUp, Check, X } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { usePolymarketStore } from '@/store/polymarketStore';

export const StrategyPanel: React.FC = () => {
  const { theme } = useThemeStore();
  const { config, updateStrategyConfig, state } = usePolymarketStore();
  const isDark = theme === 'dark';

  const strategies = [
    {
      key: 'smartMoney' as const,
      label: 'Smart Money',
      description: 'Copy top traders with quality filtering',
      icon: Brain,
      stats: `${state.smartMoneyTrades} trades`,
    },
    {
      key: 'arbitrage' as const,
      label: 'Arbitrage',
      description: 'Find YES+NO < $1.00 opportunities',
      icon: Scale,
      stats: `${state.arbTrades} trades`,
    },
    {
      key: 'dipArb' as const,
      label: 'Dip Arb',
      description: 'Buy crypto dips in 15m markets',
      icon: Zap,
      stats: `${state.dipArbTrades} trades`,
    },
    {
      key: 'directTrading' as const,
      label: 'Direct Trading',
      description: 'Trend-based manual orders',
      icon: TrendingUp,
      stats: `${state.directTrades} trades`,
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Strategies</h2>
        <span className={clsx('text-xs', isDark ? 'text-white/30' : 'text-slate-400')}>
          Allocation
        </span>
      </div>

      <div className="space-y-3">
        {strategies.map((s) => {
          const strategy = config.strategies[s.key];
          const Icon = s.icon;
          const enabled = strategy.enabled;

          return (
            <div
              key={s.key}
              className={clsx(
                'flex items-center gap-3 rounded-xl border p-3 transition-all',
                enabled
                  ? isDark
                    ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                    : 'border-emerald-200 bg-emerald-50/50'
                  : isDark
                    ? 'border-white/[0.04] bg-white/[0.02] opacity-50'
                    : 'border-slate-100 bg-slate-50/50 opacity-50'
              )}
            >
              <div
                className={clsx(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  enabled
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : isDark
                      ? 'bg-white/[0.04] text-white/20'
                      : 'bg-slate-100 text-slate-400'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{s.label}</span>
                  {enabled ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-white/20" />
                  )}
                </div>
                <p className={clsx('text-xs truncate', isDark ? 'text-white/30' : 'text-slate-400')}>
                  {s.description}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold">{Math.round(strategy.allocationPct * 100)}%</p>
                <p className={clsx('text-xs', isDark ? 'text-white/30' : 'text-slate-400')}>
                  {s.stats}
                </p>
              </div>

              <button
                onClick={() =>
                  updateStrategyConfig(s.key, { enabled: !enabled })
                }
                className={clsx(
                  'h-8 w-14 rounded-full transition-all relative',
                  enabled
                    ? 'bg-emerald-500'
                    : isDark
                      ? 'bg-white/[0.08]'
                      : 'bg-slate-200'
                )}
              >
                <div
                  className={clsx(
                    'absolute top-1 h-6 w-6 rounded-full transition-all',
                    enabled
                      ? 'left-7 bg-white'
                      : 'left-1 bg-white/50'
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
