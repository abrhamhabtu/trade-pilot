'use client';

import React from 'react';
import clsx from 'clsx';
import { RefreshCw, Download } from 'lucide-react';
import { TimePeriod } from '../../store/tradingStore';
import { AppButton, SegmentedControl } from '@/components/ui';

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
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="overflow-x-auto pb-1">
          <SegmentedControl options={TIME_PERIODS} value={selectedTimePeriod} onChange={onTimePeriodChange} />
        </div>

        <div className="text-sm text-zinc-400">
          Showing: <span className="text-zinc-100 font-medium">{TIME_PERIOD_LABELS[selectedTimePeriod]}</span>
          {displayTradesCount !== totalTradesCount && (
            <span className="ml-2">({displayTradesCount} of {totalTradesCount} trades)</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
        <AppButton onClick={onRefresh} disabled={isLoading} variant="secondary" className="w-full sm:w-auto">
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          <span className="text-sm">{isLoading ? 'Refreshing...' : 'Refresh Data'}</span>
        </AppButton>
        <AppButton onClick={onImport} variant="primary" className="w-full sm:w-auto">
          <Download className="h-4 w-4" />
          <span className="text-sm">Import Trades from TradingView</span>
        </AppButton>
      </div>
    </div>
  );
});

DashboardHeader.displayName = 'DashboardHeader';
