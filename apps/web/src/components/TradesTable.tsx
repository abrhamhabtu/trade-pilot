'use client';

import React, { useState } from 'react';
import { ArrowUpDown, TrendingUp } from 'lucide-react';
import { Trade } from '../store/tradingStore';
import clsx from 'clsx';

interface TradesTableProps {
  trades: Trade[];
}

export const TradesTable: React.FC<TradesTableProps> = ({ trades }) => {
  const [activeTab, setActiveTab] = useState<'recent' | 'open'>('recent');
  const [sortAsc, setSortAsc] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const sortedTrades = [...trades].sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    return sortAsc ? -diff : diff;
  });

  const totalPL = trades.reduce((sum, t) => sum + t.netPL, 0);
  const winCount = trades.filter(t => t.netPL >= 0).length;

  return (
    <div
      className="rounded-xl border border-white/5 hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group h-full flex flex-col"
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-xl border border-white/0 group-hover:border-white/10 pointer-events-none transition-colors duration-300" />

      <div className="relative z-10 h-full flex flex-col">
        {/* Tab Headers */}
        <div className="px-4 pt-3 pb-0 flex-shrink-0">
          <div className="flex items-center space-x-4 border-b border-white/5 pb-2">
            <button
              onClick={() => setActiveTab('recent')}
              className={clsx(
                'text-xs font-semibold pb-1 border-b-2 -mb-[9px] transition-all duration-200',
                activeTab === 'recent'
                  ? 'text-zinc-100 border-emerald-500'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              )}
            >
              Recent trades
            </button>
            <button
              onClick={() => setActiveTab('open')}
              className={clsx(
                'text-xs font-semibold pb-1 border-b-2 -mb-[9px] transition-all duration-200',
                activeTab === 'open'
                  ? 'text-zinc-100 border-emerald-500'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              )}
            >
              Open positions
            </button>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 px-3 pt-1 pb-2 overflow-hidden flex flex-col">
          {sortedTrades.length === 0 ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-2 opacity-50">
              <TrendingUp className="w-8 h-8 text-zinc-500" />
              <p className="text-zinc-500 text-xs text-center">No trades yet<br />Import or log a trade to get started</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0" style={{ background: '#1E2130' }}>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-2 text-zinc-500 text-[10px] font-medium">
                        <button
                          className="flex items-center space-x-1 hover:text-zinc-300 transition-colors"
                          onClick={() => setSortAsc(p => !p)}
                        >
                          <span>Close Date</span>
                          <ArrowUpDown className="h-2.5 w-2.5" />
                        </button>
                      </th>
                      <th className="text-center py-2 text-zinc-500 text-[10px] font-medium">Symbol</th>
                      <th className="text-right py-2 text-zinc-500 text-[10px] font-medium">Net P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTrades.map((trade) => (
                      <tr
                        key={trade.id}
                        className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors duration-150"
                      >
                        <td className="py-2 text-zinc-400 text-xs">{formatDate(trade.date)}</td>
                        <td className="py-2 text-center text-zinc-100 text-xs font-medium">{trade.symbol}</td>
                        <td className="py-2 text-right">
                          <span className={clsx(
                            'text-xs font-semibold',
                            trade.netPL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          )}>
                            {formatCurrency(trade.netPL)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary footer */}
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between flex-shrink-0">
                <span className="text-zinc-500 text-[10px]">
                  {winCount}/{trades.length} wins
                </span>
                <span className={clsx(
                  'text-xs font-bold',
                  totalPL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                )}>
                  {formatCurrency(totalPL)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
