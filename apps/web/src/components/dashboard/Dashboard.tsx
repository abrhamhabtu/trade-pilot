'use client';

import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { MetricsGrid } from './MetricsGrid';
import { CoachCard } from './CoachCard';
import { ChartsContainer } from './ChartsContainer';
import { useChartData } from '../../hooks/useChartData';
import { Trade, TradingMetrics, TimePeriod } from '../../store/tradingStore';
import { PageSection } from '@/components/ui';

interface DashboardProps {
  trades: Trade[];
  allTrades: Trade[];
  metrics: TradingMetrics;
  selectedTimePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onImport: () => void;
  onNavigateToRoutine?: () => void;
  accountId?: string;
  accountBalance?: number;
}

export const Dashboard: React.FC<DashboardProps> = ({
  trades,
  allTrades,
  metrics,
  selectedTimePeriod,
  onTimePeriodChange,
  isLoading,
  onRefresh,
  onImport,
  onNavigateToRoutine,
  accountId,
  accountBalance
}) => {
  const {
    radarData,
    cumulativePLData,
    dailyPLData,
    calendarData,
    timePerformanceData,
    durationPerformanceData
  } = useChartData(trades, metrics);

  return (
    <PageSection>
      <DashboardHeader
        selectedTimePeriod={selectedTimePeriod}
        onTimePeriodChange={onTimePeriodChange}
        displayTradesCount={trades.length}
        totalTradesCount={allTrades.length}
        isLoading={isLoading}
        onRefresh={onRefresh}
        onImport={onImport}
      />

      <MetricsGrid metrics={metrics} trades={trades} accountBalance={accountBalance} />

      <CoachCard trades={trades} />

      <ChartsContainer
        radarData={radarData}
        cumulativePLData={cumulativePLData}
        dailyPLData={dailyPLData}
        calendarData={calendarData}
        timePerformanceData={timePerformanceData}
        durationPerformanceData={durationPerformanceData}
        trades={trades}
        consistencyScore={metrics.consistency}
        onNavigateToRoutine={onNavigateToRoutine}
        accountId={accountId}
      />

    </PageSection>
  );
};

export default Dashboard;
