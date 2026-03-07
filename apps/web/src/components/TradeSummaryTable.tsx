'use client';

import React from 'react';
import { CardHeader, HelpTooltip, SurfaceCard } from '@/components/ui';

interface SummaryData {
  duration: string;
  netProfits: number;
  winningPercent: number;
  totalProfits: number;
}

interface TradeSummaryTableProps {
  data: SummaryData[];
}

export const TradeSummaryTable: React.FC<TradeSummaryTableProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const tooltipContent = `Summary of trading performance by duration ranges.\n\nShows net profits, win rates, and total profits for different holding periods.\n\nHelps identify most profitable trade durations.`;

  return (
    <SurfaceCard hoverable fullHeight>
      <div className="relative z-10 h-full flex flex-col">
        <CardHeader
          title={
            <>
              <h3 className="text-zinc-100 text-lg font-semibold">SUMMARY</h3>
              <HelpTooltip content={tooltipContent} />
            </>
          }
          className="mb-6"
        />

        <div className="flex-1 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-3 px-2 text-zinc-400 text-xs font-medium">Duration</th>
                <th className="text-right py-3 px-2 text-zinc-400 text-xs font-medium">Net Profits</th>
                <th className="text-right py-3 px-2 text-zinc-400 text-xs font-medium">Winning %</th>
                <th className="text-right py-3 px-2 text-zinc-400 text-xs font-medium">Total Profits</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 8).map((row, index) => (
                <tr
                  key={index}
                  className="border-b border-white/5/50 hover:bg-gradient-to-r hover:from-[#3BF68A]/5 hover:to-[#A78BFA]/5 transition-all duration-200"
                >
                  <td className="py-3 px-2 text-zinc-100 text-sm font-medium">
                    {row.duration}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className={`text-sm font-semibold ${
                      row.netProfits >= 0 
                        ? 'text-zinc-50' 
                        : 'text-rose-500'
                    }`}>
                      {formatCurrency(row.netProfits)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right text-zinc-400 text-sm">
                    {row.winningPercent.toFixed(0)}%
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className={`text-sm font-semibold ${
                      row.totalProfits >= 0 
                        ? 'text-zinc-50' 
                        : 'text-rose-500'
                    }`}>
                      {formatCurrency(row.totalProfits)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SurfaceCard>
  );
};
