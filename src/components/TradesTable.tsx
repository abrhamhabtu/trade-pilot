import React, { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Trade } from '../store/tradingStore';
import clsx from 'clsx';

interface TradesTableProps {
  trades: Trade[];
}

export const TradesTable: React.FC<TradesTableProps> = ({ trades }) => {
  const [activeTab, setActiveTab] = useState<'recent' | 'open'>('recent');
  
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
  
  return (
    <div 
      className="rounded-xl border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group h-full"
      style={{
        background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
      }}
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
        <div 
          className="w-full h-full rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        />
      </div>
      
      <div className="relative z-10 h-full flex flex-col">
        {/* Tab Headers - Compact */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setActiveTab('recent')}
              className={clsx(
                'text-xs font-medium pb-1 border-b-2 transition-all duration-200 relative',
                activeTab === 'recent'
                  ? 'text-[#E5E7EB]'
                  : 'text-[#8B94A7] hover:text-[#E5E7EB]'
              )}
              style={activeTab === 'recent' ? {
                borderBottom: '2px solid',
                borderImage: 'linear-gradient(to right, #3BF68A, #A78BFA) 1'
              } : {
                borderBottom: '2px solid transparent'
              }}
            >
              Recent trades
            </button>
            <button
              onClick={() => setActiveTab('open')}
              className={clsx(
                'text-xs font-medium pb-1 border-b-2 transition-all duration-200 relative',
                activeTab === 'open'
                  ? 'text-[#E5E7EB]'
                  : 'text-[#8B94A7] hover:text-[#E5E7EB]'
              )}
              style={activeTab === 'open' ? {
                borderBottom: '2px solid',
                borderImage: 'linear-gradient(to right, #3BF68A, #A78BFA) 1'
              } : {
                borderBottom: '2px solid transparent'
              }}
            >
              Open positions
            </button>
          </div>
        </div>
        
        {/* Table Area - Compact */}
        <div className="flex-1 px-3 pb-2 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0" style={{ background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)' }}>
                <tr className="border-b border-[#1F2937]">
                  <th className="text-left py-1.5 text-[#8B94A7] text-[10px] font-medium">
                    <button className="flex items-center space-x-1 hover:text-[#E5E7EB] transition-colors">
                      <span>Close Date</span>
                      <ArrowUpDown className="h-2.5 w-2.5" />
                    </button>
                  </th>
                  <th className="text-center py-1.5 text-[#8B94A7] text-[10px] font-medium">
                    Symbol
                  </th>
                  <th className="text-right py-1.5 text-[#8B94A7] text-[10px] font-medium">
                    Net P&L
                  </th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-[#1F2937]/30 hover:bg-gradient-to-r hover:from-[#3BF68A]/5 hover:to-[#A78BFA]/5 transition-all duration-200"
                  >
                    <td className="py-2 text-[#8B94A7] text-xs">
                      {formatDate(trade.date)}
                    </td>
                    <td className="py-2 text-center text-[#E5E7EB] text-xs font-medium">
                      {trade.symbol}
                    </td>
                    <td className="py-2 text-right">
                      <span className={clsx(
                        'text-xs font-semibold',
                        trade.netPL >= 0 ? 'text-[#3BF68A]' : 'text-[#F45B69]'
                      )}>
                        {formatCurrency(trade.netPL)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};