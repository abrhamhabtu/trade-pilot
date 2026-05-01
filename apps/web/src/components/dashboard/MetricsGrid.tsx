'use client';

import React from 'react';
import { MetricCard } from '../MetricCard';
import { TradingMetrics } from '../../store/tradingStore';
import { DollarSign, TrendingUp, Target, BarChart2 } from 'lucide-react';

interface MetricsGridProps {
  metrics: TradingMetrics;
  trades?: unknown[];
  accountBalance?: number;
}

export const MetricsGrid: React.FC<MetricsGridProps> = React.memo(({ metrics, accountBalance }) => {
  const displayBalance = accountBalance !== undefined ? accountBalance : metrics.netPL;

  // Win Rate ring: green portion = winRate%, red = rest
  const winRatePct = metrics.winRate;

  // Profit Factor ring: cap at 3.0 = full circle
  const pfPct = Math.min((metrics.profitFactor / 3) * 100, 100);

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Net P&L"
        value={displayBalance}
        format="currency"
        trend={displayBalance >= 0 ? 'up' : 'down'}
        icon={DollarSign}
        iconColor="text-tp-green"
        tooltip="Account balance including all trades and adjustments (payouts, deposits)."
      />

      <MetricCard
        title="Trade Win %"
        value={metrics.winRate}
        format="percentage"
        trend={metrics.winRate >= 50 ? 'up' : 'down'}
        icon={Target}
        iconColor="text-tp-green"
        ringPct={winRatePct}
        tooltip="Percentage of trades that closed in profit."
      />

      <MetricCard
        title="Profit Factor"
        value={metrics.profitFactor}
        format="number"
        trend={metrics.profitFactor >= 1.5 ? 'up' : metrics.profitFactor >= 1.0 ? 'neutral' : 'down'}
        icon={BarChart2}
        iconColor="text-tp-green"
        ringPct={pfPct}
        tooltip="Gross profit ÷ gross loss. Above 1.0 = profitable. Above 2.0 = excellent."
      />

      <MetricCard
        title="Trade Expectancy"
        value={metrics.expectancy}
        format="currency"
        trend={metrics.expectancy >= 0 ? 'up' : 'down'}
        icon={TrendingUp}
        iconColor="text-tp-green"
        tooltip="Average expected profit or loss per trade over time."
      />

    </div>
  );
});

MetricsGrid.displayName = 'MetricsGrid';
