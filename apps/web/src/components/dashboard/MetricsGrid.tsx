'use client';

import React, { useMemo } from 'react';
import { Donut, MetricCard, Sparkline, WinGauge, WinLossBar, type SparkPoint } from '../MetricCard';
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

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${usd(Math.abs(v))}`;
const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
    const pts: SparkPoint[] = [{ value: run, label: `${tail.length} trades ago` }];
    for (const t of tail) {
      run += t.netPL;
      pts.push({ value: run, label: `${day(t.date)} · ${t.symbol} ${signed(t.netPL)}` });
    }
    return { wins: w, breakeven: b, losses: l, curve: pts, grossWin: gw, grossLoss: gl };
  }, [balance, trades]);

  const has = trades.length > 0;
  const rr = metrics.avgLoss > 0 ? metrics.avgWin / metrics.avgLoss : 0;
  const breakEvenRate = metrics.avgWin + metrics.avgLoss > 0 ? (metrics.avgLoss / (metrics.avgWin + metrics.avgLoss)) * 100 : 0;

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Net P&L"
        value={usd(balance, true)}
        valueTone={balance > 0 ? 'green' : balance < 0 ? 'red' : 'neutral'}
        tooltip="Account balance including all trades and adjustments. Hover the line to see your balance after any recent trade."
        context={has ? `${trades.length} trades` : 'No trades yet'}
        visual={has ? (peek) => <Sparkline points={curve} positive={balance >= 0} peek={peek} format={(n) => usd(n, true)} /> : undefined}
      />

      <MetricCard
        title="Profit factor"
        value={has ? metrics.profitFactor.toFixed(2) : '—'}
        tooltip="Gross profit ÷ gross loss. Above 1.0 is profitable; 1.5+ is healthy; 2.0+ is excellent. Hover the ring for each side."
        context={has ? `${usd(metrics.profitFactor, true)} made per $1 lost` : 'Gross profit ÷ gross loss'}
        visual={(peek) => <Donut won={grossWin} lost={grossLoss} peek={peek} format={(n) => usd(n)} />}
      />

      <MetricCard
        title="Trade win %"
        value={has ? `${metrics.winRate.toFixed(1)}%` : '—'}
        tooltip="Share of trades that closed in profit. The white tick marks the win rate you need to break even at your average win and loss size."
        context={has && breakEvenRate ? `${Math.abs(metrics.winRate - breakEvenRate).toFixed(0)} pts ${metrics.winRate >= breakEvenRate ? 'above' : 'below'} break-even` : 'wins · breakeven · losses'}
        visual={(peek) => <WinGauge wins={wins} breakeven={breakeven} losses={losses} breakEvenRate={has ? breakEvenRate : 0} peek={peek} />}
      />

      <MetricCard
        title="Avg win/loss"
        value={has && rr ? rr.toFixed(2) : '—'}
        tooltip="Average winning trade divided by average losing trade. Above 1 means your wins are bigger than your losses. Hover each side for your largest."
        context={has && rr ? `wins ${rr.toFixed(1)}× losses` : 'Average win vs average loss'}
        visual={(peek) => (
          <WinLossBar avgWin={metrics.avgWin} avgLoss={metrics.avgLoss} largestWin={metrics.largestWin} largestLoss={metrics.largestLoss} peek={peek} fmt={(n) => usd(n)} />
        )}
      />
    </div>
  );
});

MetricsGrid.displayName = 'MetricsGrid';
