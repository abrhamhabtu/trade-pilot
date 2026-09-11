'use client';

import React, { useMemo } from 'react';
import { MetricCard } from '../MetricCard';
import { Trade, TradingMetrics } from '../../store/tradingStore';

interface MetricsGridProps {
  metrics: TradingMetrics;
  trades?: Trade[];
  accountBalance?: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export const MetricsGrid: React.FC<MetricsGridProps> = React.memo(({ metrics, trades = [], accountBalance }) => {
  const displayBalance = accountBalance !== undefined ? accountBalance : metrics.netPL;

  const { wins, breakeven, losses } = useMemo(() => {
    let w = 0;
    let b = 0;
    let l = 0;
    for (const t of trades) {
      if (t.netPL > 0) w++;
      else if (t.netPL < 0) l++;
      else b++;
    }
    return { wins: w, breakeven: b, losses: l };
  }, [trades]);

  const equitySparkline = useMemo(() => {
    const recentTrades = [...trades]
      .sort((a, b) => {
        const aTime = new Date(`${a.date} ${a.time ?? ''}`).getTime();
        const bTime = new Date(`${b.date} ${b.time ?? ''}`).getTime();
        return aTime - bTime;
      })
      .slice(-12);

    let running = displayBalance - recentTrades.reduce((sum, trade) => sum + trade.netPL, 0);
    const points = [running];
    for (const trade of recentTrades) {
      running += trade.netPL;
      points.push(running);
    }
    return points;
  }, [displayBalance, trades]);

  // Map profit factor to ring fill so green + red are always visible (like reference)
  const pfRingPct =
    metrics.profitFactor > 0
      ? (metrics.profitFactor / (metrics.profitFactor + 1)) * 100
      : 0;
  const avgWinLossRatio = metrics.avgLoss > 0 ? metrics.avgWin / metrics.avgLoss : 0;

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Net P&L"
        value={displayBalance}
        format="currency"
        trend={displayBalance >= 0 ? 'up' : 'down'}
        context={`${trades.length} trades tracked`}
        visual={{
          type: 'sparkline',
          points: equitySparkline,
          positive: displayBalance >= 0,
        }}
      />

      <MetricCard
        title="Profit factor"
        value={metrics.profitFactor}
        format="number"
        trend="neutral"
        context="gross profit / gross loss"
        visual={{ type: 'donut', pct: pfRingPct }}
      />

      <MetricCard
        title="Trade win %"
        value={metrics.winRate}
        format="percentage"
        trend="neutral"
        context="wins / breakeven / losses"
        visual={{ type: 'gauge', wins, breakeven, losses }}
      />

      <MetricCard
        title="Avg win/loss trade"
        value={avgWinLossRatio}
        format="number"
        trend="neutral"
        context={`${formatCurrency(metrics.avgWin)} avg win`}
        visual={{ type: 'winloss-bar', avgWin: metrics.avgWin, avgLoss: metrics.avgLoss }}
      />
    </div>
  );
});

MetricsGrid.displayName = 'MetricsGrid';
