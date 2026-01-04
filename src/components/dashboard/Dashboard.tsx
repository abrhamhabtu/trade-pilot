import React from 'react';
import { Clock } from 'lucide-react';
import { DashboardHeader } from './DashboardHeader';
import { MetricsGrid } from './MetricsGrid';
import { CoachingTipCard } from './CoachingTipCard';
import { ChartsContainer } from './ChartsContainer';
import { Calendar } from '../Calendar';
import { useChartData } from '../../hooks/useChartData';
import { useCoachingTips } from '../../hooks/useCoachingTips';
import { Trade, TradingMetrics, TimePeriod } from '../../store/tradingStore';

interface DashboardProps {
  trades: Trade[];
  allTrades: Trade[];
  metrics: TradingMetrics;
  selectedTimePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onImport: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  trades,
  allTrades,
  metrics,
  selectedTimePeriod,
  onTimePeriodChange,
  isLoading,
  onRefresh,
  onImport
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
    <div className="p-6">
      <DashboardHeader
        selectedTimePeriod={selectedTimePeriod}
        onTimePeriodChange={onTimePeriodChange}
        displayTradesCount={trades.length}
        totalTradesCount={allTrades.length}
        isLoading={isLoading}
        onRefresh={onRefresh}
        onImport={onImport}
      />

      <MetricsGrid metrics={metrics} trades={trades} />

      <CoachingTipCard
        title="Trading Coach Tip"
        tip={topCoachingTip}
        variant="default"
      />

      <ChartsContainer
        radarData={radarData}
        cumulativePLData={cumulativePLData}
        dailyPLData={dailyPLData}
        timePerformanceData={timePerformanceData}
        durationPerformanceData={durationPerformanceData}
        trades={trades}
        consistencyScore={metrics.consistency}
      />

      {/* Calendar Section */}
      <div className="mb-8">
        <Calendar data={calendarData} />
      </div>

      <CoachingTipCard
        title="Performance Insights"
        tip={performanceCoachingTip}
        variant="performance"
        icon={Clock}
      />
    </div>
  );
};

export default Dashboard;
