'use client';

import React, { useMemo } from 'react';
import { Percent, Scale, TrendingUp, Wallet } from 'lucide-react';
import { AreaSpark, MetricCard, OutcomeBar, PfScale, WinLossBars, type Tone } from '../MetricCard';
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

const signedUsd = (v: number) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${usd(Math.abs(v))}`;

export const MetricsGrid: React.FC<MetricsGridProps> = React.memo(({ metrics, trades = [], accountBalance }) => {
  const balance = accountBalance !== undefined ? accountBalance : metrics.netPL;

  const { wins, breakeven, losses, curve, recent } = useMemo(() => {
    let w = 0;
    let b = 0;
    let l = 0;
    for (const t of trades) {
      if (t.netPL > 0) w++;
      else if (t.netPL < 0) l++;
      else b++;
    }
    const sorted = [...trades].sort((a, c) => `${a.date} ${a.time ?? ''}`.localeCompare(`${c.date} ${c.time ?? ''}`));
    const tail = sorted.slice(-30);
    let run = balance - tail.reduce((s, t) => s + t.netPL, 0);
    const pts = [run];
    for (const t of tail) pts.push((run += t.netPL));
    const last5 = sorted.slice(-5).reduce((s, t) => s + t.netPL, 0);
    return { wins: w, breakeven: b, losses: l, curve: pts, recent: last5 };
  }, [balance, trades]);

  const has = trades.length > 0;
  const pf = metrics.profitFactor;
  const pfBadge: { label: string; tone: Tone } = !has
    ? { label: 'No data', tone: 'neutral' }
    : pf >= 2
      ? { label: 'Excellent', tone: 'green' }
      : pf >= 1.5
        ? { label: 'Healthy', tone: 'green' }
        : pf >= 1
          ? { label: 'Thin edge', tone: 'yellow' }
          : { label: 'Losing', tone: 'red' };

  const rr = metrics.avgLoss > 0 ? metrics.avgWin / metrics.avgLoss : 0;
  // Win rate needed to break even at your current win/loss size.
  const breakEvenWR = metrics.avgWin + metrics.avgLoss > 0 ? (metrics.avgLoss / (metrics.avgWin + metrics.avgLoss)) * 100 : 0;
  const cushion = metrics.winRate - breakEvenWR;

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Net P&L"
        icon={Wallet}
        accent={balance >= 0 ? 'green' : 'red'}
        value={usd(balance, true)}
        valueTone={balance > 0 ? 'green' : balance < 0 ? 'red' : 'neutral'}
        badge={has ? { label: `${signedUsd(recent)} last 5`, tone: recent >= 0 ? 'green' : 'red' } : undefined}
        tooltip="Account balance including all trades and adjustments (payouts, deposits)."
        context={has ? `${trades.length} trades · ${wins} green` : 'Import trades to get started'}
        bleed
      >
        <AreaSpark points={curve} positive={balance >= 0} />
      </MetricCard>

      <MetricCard
        title="Profit factor"
        icon={Scale}
        accent={pfBadge.tone}
        value={has ? pf.toFixed(2) : '—'}
        badge={pfBadge}
        tooltip="Gross profit ÷ gross loss. Above 1.0 is profitable; 1.5+ is healthy; 2.0+ is excellent."
        context={has ? `${usd(pf, true)} made for every $1 lost` : 'Gross profit ÷ gross loss'}
      >
        <PfScale value={has ? pf : 0} />
      </MetricCard>

      <MetricCard
        title="Win rate"
        icon={Percent}
        accent="blue"
        value={has ? metrics.winRate.toFixed(1) : '—'}
        suffix={has ? '%' : undefined}
        badge={has && breakEvenWR > 0 ? { label: `${cushion >= 0 ? '+' : ''}${cushion.toFixed(0)} pts cushion`, tone: cushion >= 10 ? 'green' : cushion >= 0 ? 'yellow' : 'red' } : undefined}
        tooltip="Share of trades that closed in profit. The badge compares it to the win rate you need to break even at your average win and loss size."
        context={has && breakEvenWR > 0 ? `You need ${breakEvenWR.toFixed(0)}% to break even` : 'Wins ÷ all trades'}
      >
        <OutcomeBar wins={wins} breakeven={breakeven} losses={losses} />
      </MetricCard>

      <MetricCard
        title="Win / loss size"
        icon={TrendingUp}
        accent={!has ? 'neutral' : rr >= 1.5 ? 'green' : rr >= 1 ? 'yellow' : 'red'}
        value={has && rr ? rr.toFixed(2) : '—'}
        suffix={has && rr ? ': 1' : undefined}
        badge={has && rr ? { label: rr >= 1.5 ? 'Winners run' : rr >= 1 ? 'Even-ish' : 'Losers bigger', tone: rr >= 1.5 ? 'green' : rr >= 1 ? 'yellow' : 'red' } : undefined}
        tooltip="Average winning trade divided by average losing trade. Above 1 means your wins are bigger than your losses."
        context={has && rr ? `Wins are ${rr.toFixed(1)}× the size of losses` : 'Average win vs average loss'}
      >
        <WinLossBars avgWin={metrics.avgWin} avgLoss={metrics.avgLoss} fmt={(n) => usd(n)} />
      </MetricCard>
    </div>
  );
});

MetricsGrid.displayName = 'MetricsGrid';
