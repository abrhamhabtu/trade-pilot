'use client';

import React from 'react';
import { MetricCard } from '../MetricCard';
import { TradingMetrics, Trade } from '../../store/tradingStore';
import {
  DollarSign,
  TrendingUp,
  Target,
  Zap,
  BarChart2,
  Activity
} from 'lucide-react';

interface MetricsGridProps {
  metrics: TradingMetrics;
  trades: Trade[];
  accountBalance?: number;
}

export const MetricsGrid: React.FC<MetricsGridProps> = React.memo(({ metrics, trades, accountBalance }) => {
  // Use account balance if provided (includes adjustments like payouts), otherwise fall back to trade P&L
  const displayBalance = accountBalance !== undefined ? accountBalance : metrics.netPL;
  
  return (
    <div className="grid grid-cols-6 gap-4 mb-6">
      <MetricCard
        title="Net P&L"
        value={displayBalance}
        format="currency"
        trend={displayBalance >= 0 ? "up" : "down"}
        icon={DollarSign}
        iconColor="text-emerald-500"
        tooltip="Your account balance including all trades and adjustments (payouts, deposits). This matches your Accounts page balance."
      />
      <MetricCard
        title="Profit Factor"
        value={metrics.profitFactor}
        format="number"
        trend={metrics.profitFactor >= 1.5 ? "up" : metrics.profitFactor >= 1.0 ? "neutral" : "down"}
        icon={BarChart2}
        iconColor="text-emerald-500"
        tooltip="Ratio of gross profit to gross loss. A profit factor above 1.0 means you're profitable. Values above 2.0 are considered excellent."
      />
      <MetricCard
        title="Trade Win %"
        value={metrics.winRate}
        format="percentage"
        trend={metrics.winRate >= 60 ? "up" : metrics.winRate >= 50 ? "neutral" : "down"}
        icon={Target}
        iconColor="text-emerald-500"
        tooltip="Percentage of trades that were profitable. A higher win rate indicates more consistent trading, though it should be balanced with risk-reward ratios."
      />
      <MetricCard
        title="Trade Expectancy"
        value={metrics.expectancy}
        format="currency"
        trend={metrics.expectancy >= 0 ? "up" : "down"}
        icon={TrendingUp}
        iconColor="text-emerald-500"
        tooltip="Average amount you can expect to win or lose per trade. Positive expectancy means your trading strategy is profitable over time."
      />
      <MetricCard
        title="Current Streak"
        value={metrics.currentStreak}
        format="number"
        trend="neutral"
        icon={Zap}
        iconColor="text-emerald-500"
        subtitle={trades.length > 0 ? (trades[0].outcome === 'win' ? 'WINS' : 'LOSSES') : 'TRADES'}
        tooltip="Number of consecutive winning or losing trades. Helps track momentum and psychological state in your trading."
      />
      <MetricCard
        title="Total Trades"
        value={metrics.totalTrades}
        format="number"
        trend="neutral"
        icon={Activity}
        iconColor="text-zinc-400"
        tooltip="Total number of completed trades. A larger sample size provides more reliable statistics for performance analysis."
      />
    </div>
  );
});

MetricsGrid.displayName = 'MetricsGrid';
