'use client';

import React, { useMemo } from 'react';
import { MetricCard } from '../MetricCard';
import { Trade, TradingMetrics } from '../../store/tradingStore';

interface MetricsGridProps {
  metrics: TradingMetrics;
  trades?: Trade[];
  accountBalance?: number;
}

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

  // Map profit factor to ring fill so green + red are always visible (like reference)
  const pfRingPct =
    metrics.profitFactor > 0
      ? (metrics.profitFactor / (metrics.profitFactor + 1)) * 100
      : 0;
  const avgWinLossRatio = metrics.avgLoss > 0 ? metrics.avgWin / metrics.avgLoss : 0;

  // Cumulative P&L series for the Net P&L mini equity sparkline.
  const equitySeries = useMemo(() => {
    const sorted = [...trades].sort((a, b) => {
      const d = (a.date || '').localeCompare(b.date || '');
      return d !== 0 ? d : (a.time || '').localeCompare(b.time || '');
    });
    let cum = 0;
    const series = [0, ...sorted.map((t) => (cum += t.netPL))];
    return series.length >= 2 ? series : [];
  }, [trades]);

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Net P&L"
        value={displayBalance}
        format="currency"
        trend={displayBalance >= 0 ? 'up' : 'down'}
        visual={{ type: 'sparkline', data: equitySeries, positive: displayBalance >= 0 }}
      />

      <MetricCard
        title="Profit factor"
        value={metrics.profitFactor}
        format="number"
        trend="neutral"
        visual={{ type: 'donut', pct: pfRingPct }}
      />

      <MetricCard
        title="Trade win %"
        value={metrics.winRate}
        format="percentage"
        trend="neutral"
        visual={{ type: 'gauge', wins, breakeven, losses }}
      />

      <MetricCard
        title="Avg win/loss trade"
        value={avgWinLossRatio}
        format="number"
        trend="neutral"
        visual={{ type: 'winloss-bar', avgWin: metrics.avgWin, avgLoss: metrics.avgLoss }}
      />
    </div>
  );
});

MetricsGrid.displayName = 'MetricsGrid';
