'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { DashboardHeader } from './DashboardHeader';
import { MetricsGrid } from './MetricsGrid';
import { CoachingTipCard } from './CoachingTipCard';
import { ChartsContainer } from './ChartsContainer';
import { useChartData } from '../../hooks/useChartData';
import { useCoachingTips } from '../../hooks/useCoachingTips';
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

  const {
    topCoachingTip,
    performanceCoachingTip
  } = useCoachingTips(metrics, timePerformanceData, durationPerformanceData);

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

      <CoachingTipCard
        title="Trading Coach Tip"
        tip={topCoachingTip}
        variant="default"
      />

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

      <CoachingTipCard
        title="Performance Insights"
        tip={performanceCoachingTip}
        variant="performance"
        icon={Clock}
      />
    </PageSection>
  );
};

export default Dashboard;
