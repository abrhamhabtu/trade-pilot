'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { Search, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { usePolymarketStore } from '@/store/polymarketStore';
import { MarketOpportunity } from '@/lib/polymarket';

export const MarketScanner: React.FC = () => {
  const { theme } = useThemeStore();
  const { opportunities, setOpportunities } = usePolymarketStore();
  const isDark = theme === 'dark';
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    // Simulate scan - in real impl, this would call the Polymarket SDK
    await new Promise((r) => setTimeout(r, 1500));

    const mockOpps: MarketOpportunity[] = [
      {
        id: '1',
        marketName: 'BTC above $65k on Friday?',
        type: 'arbitrage',
        profitPotential: 1.2,
        confidence: 0.95,
        side: 'both',
        price: 0.52,
        volume24h: 125000,
      },
      {
        id: '2',
        marketName: 'ETH ETF approval by June?',
        type: 'trend',
        profitPotential: 8.5,
        confidence: 0.72,
        side: 'yes',
        price: 0.34,
        volume24h: 89000,
      },
      {
        id: '3',
        marketName: 'SOL breaks $150 this week?',
        type: 'dip',
        profitPotential: 4.2,
        confidence: 0.68,
        side: 'yes',
        price: 0.28,
        volume24h: 45000,
      },
    ];

    setOpportunities(mockOpps);
    setScanning(false);
  };

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
        <div className="flex items-center gap-2">
          <Search className={clsx('h-5 w-5', isDark ? 'text-white/50' : 'text-slate-500')} />
          <h2 className="text-lg font-semibold">Market Scanner</h2>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
            scanning
              ? 'opacity-50 cursor-not-allowed'
              : isDark
                ? 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {scanning ? 'Scanning...' : 'Scan Markets'}
        </button>
      </div>

      {opportunities.length === 0 && !scanning && (
        <div className="py-12 text-center">
          <Search className={clsx('mx-auto mb-3 h-8 w-8', isDark ? 'text-white/10' : 'text-slate-300')} />
          <p className={clsx('text-sm', isDark ? 'text-white/30' : 'text-slate-400')}>
            Click scan to find opportunities
          </p>
        </div>
      )}

      <div className="space-y-3">
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opp={opp} isDark={isDark} />
        ))}
      </div>
    </div>
  );
};

function OpportunityCard({
  opp,
  isDark,
}: {
  opp: MarketOpportunity;
  isDark: boolean;
}) {
  const typeConfig = {
    arbitrage: { label: 'Arb', color: 'bg-blue-500/15 text-blue-400' },
    dip: { label: 'Dip', color: 'bg-amber-500/15 text-amber-400' },
    trend: { label: 'Trend', color: 'bg-purple-500/15 text-purple-400' },
  };

  const tc = typeConfig[opp.type];

  return (
    <div
      className={clsx(
        'flex items-center gap-4 rounded-xl border p-4 transition-all',
        isDark
          ? 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08]'
          : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
      )}
    >
      <div className={clsx('rounded-lg px-2 py-1 text-xs font-medium', tc.color)}>
        {tc.label}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{opp.marketName}</p>
        <div className="mt-1 flex items-center gap-3 text-xs">
          <span className={isDark ? 'text-white/30' : 'text-slate-400'}>
            Price: ${opp.price.toFixed(2)}
          </span>
          <span className={isDark ? 'text-white/30' : 'text-slate-400'}>
            Vol: ${(opp.volume24h / 1000).toFixed(0)}k
          </span>
        </div>
      </div>

      <div className="text-right">
        <div className="flex items-center gap-1 text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="text-sm font-semibold">+{opp.profitPotential.toFixed(1)}%</span>
        </div>
        <p className={clsx('text-xs', isDark ? 'text-white/30' : 'text-slate-400')}>
          {Math.round(opp.confidence * 100)}% confidence
        </p>
      </div>

      <button
        className={clsx(
          'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
          isDark
            ? 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white'
            : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
        )}
      >
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
