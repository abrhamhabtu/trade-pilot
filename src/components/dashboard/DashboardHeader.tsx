import React from 'react';
import clsx from 'clsx';
import { RefreshCw, Download } from 'lucide-react';
import { TimePeriod } from '../../store/tradingStore';

interface DashboardHeaderProps {
  selectedTimePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
  displayTradesCount: number;
  totalTradesCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  onImport: () => void;
}

const TIME_PERIODS: TimePeriod[] = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'];

const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  '1D': 'Last Day',
  '1W': 'Last Week',
  '1M': 'Last Month',
  '3M': 'Last 3 Months',
  '6M': 'Last 6 Months',
  '1Y': 'Last Year',
  'ALL': 'All Time'
};

export const DashboardHeader: React.FC<DashboardHeaderProps> = React.memo(({
  selectedTimePeriod,
  onTimePeriodChange,
  displayTradesCount,
  totalTradesCount,
  isLoading,
  onRefresh,
  onImport
}) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-6">
        <div
          className="flex items-center space-x-2 rounded-lg px-3 py-2 border border-[#1F2937]"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        >
          {TIME_PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => onTimePeriodChange(period)}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-all duration-200',
                period === selectedTimePeriod
                  ? 'bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium shadow-lg'
                  : 'text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-gradient-to-r hover:from-[#3BF68A]/10 hover:to-[#A78BFA]/10'
              )}
            >
              {period}
            </button>
          ))}
        </div>

        <div className="text-sm text-[#8B94A7]">
          Showing: <span className="text-[#E5E7EB] font-medium">{TIME_PERIOD_LABELS[selectedTimePeriod]}</span>
          {displayTradesCount !== totalTradesCount && (
            <span className="ml-2">({displayTradesCount} of {totalTradesCount} trades)</span>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 border border-[#1F2937] rounded-lg text-[#8B94A7] hover:text-[#E5E7EB] hover:border-transparent hover:bg-gradient-to-r hover:from-[#3BF68A]/10 hover:to-[#A78BFA]/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          <span className="text-sm">{isLoading ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
        <button
          onClick={onImport}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium rounded-lg hover:opacity-90 hover:shadow-lg transition-all duration-200"
        >
          <Download className="h-4 w-4" />
          <span className="text-sm">Import Trades from TradingView</span>
        </button>
      </div>
    </div>
  );
});

DashboardHeader.displayName = 'DashboardHeader';
