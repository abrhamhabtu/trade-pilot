'use client';

import React, { useMemo } from 'react';
import { Donut, MetricCard, Sparkline, WinGauge, WinLossBar } from '../MetricCard';
import { Trade, TradingMetrics } from '../../store/tradingStore';

interface MetricsGridProps {
  metrics: TradingMetrics;
  trades?: Trade[];
  accountBalance?: number;
}

const usd = (value: number, cents = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value);

export const MetricsGrid: React.FC<MetricsGridProps> = React.memo(({ metrics, trades = [], accountBalance }) => {
  const balance = accountBalance !== undefined ? accountBalance : metrics.netPL;

  const { wins, breakeven, losses, curve, grossWin, grossLoss } = useMemo(() => {
    let w = 0;
    let b = 0;
    let l = 0;
    let gw = 0;
    let gl = 0;
    for (const t of trades) {
      if (t.netPL > 0) {
        w++;
        gw += t.netPL;
      } else if (t.netPL < 0) {
        l++;
        gl -= t.netPL;
      } else b++;
    }
    const tail = [...trades].sort((a, c) => `${a.date} ${a.time ?? ''}`.localeCompare(`${c.date} ${c.time ?? ''}`)).slice(-20);
    let run = balance - tail.reduce((s, t) => s + t.netPL, 0);
    const pts = [run];
    for (const t of tail) pts.push((run += t.netPL));
    return { wins: w, breakeven: b, losses: l, curve: pts, grossWin: gw, grossLoss: gl };
  }, [balance, trades]);

  const has = trades.length > 0;
  const rr = metrics.avgLoss > 0 ? metrics.avgWin / metrics.avgLoss : 0;

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Net P&L"
        value={usd(balance, true)}
        valueTone={balance > 0 ? 'green' : balance < 0 ? 'red' : 'neutral'}
        tooltip="Account balance including all trades and adjustments (payouts, deposits)."
        context={has ? `${trades.length} trades` : 'No trades yet'}
        visual={has ? <Sparkline points={curve} positive={balance >= 0} /> : undefined}
      />

      <MetricCard
        title="Profit factor"
        value={has ? metrics.profitFactor.toFixed(2) : '—'}
        tooltip="Gross profit ÷ gross loss. Above 1.0 is profitable; 1.5+ is healthy; 2.0+ is excellent."
        context={has ? `${usd(grossWin)} / ${usd(grossLoss)}` : 'Gross profit ÷ gross loss'}
        visual={<Donut greenShare={grossWin + grossLoss ? grossWin / (grossWin + grossLoss) : 0} />}
      />

      <MetricCard
        title="Trade win %"
        value={has ? `${metrics.winRate.toFixed(1)}%` : '—'}
        tooltip="Share of trades that closed in profit. The gauge splits wins (green), breakeven (blue) and losses (red)."
        context="wins · breakeven · losses"
        visual={<WinGauge wins={wins} breakeven={breakeven} losses={losses} />}
      />

      <MetricCard
        title="Avg win/loss"
        value={has && rr ? rr.toFixed(2) : '—'}
        tooltip="Average winning trade divided by average losing trade. Above 1 means your wins are bigger than your losses."
        context={has && rr ? `wins ${rr.toFixed(1)}× losses` : 'Average win vs average loss'}
        visual={<WinLossBar avgWin={metrics.avgWin} avgLoss={metrics.avgLoss} fmt={(n) => usd(n)} />}
      />
    </div>
  );
});

MetricsGrid.displayName = 'MetricsGrid';
