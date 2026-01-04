import React from 'react';
import { RadarChartComponent } from '../charts/RadarChart';
import { PLChart } from '../charts/PLChart';
import { BarChartComponent } from '../charts/BarChart';
import { TradesTable } from '../TradesTable';
import { TimePerformanceChart } from '../charts/TimePerformanceChart';
import { DurationPerformanceChart } from '../charts/DurationPerformanceChart';
import { Trade } from '../../store/tradingStore';
import {
  RadarDataPoint,
  CumulativePLDataPoint,
  DailyPLDataPoint,
  TimePerformanceDataPoint,
  DurationPerformanceDataPoint
} from '../../hooks/useChartData';

interface ChartsContainerProps {
  radarData: RadarDataPoint[];
  cumulativePLData: CumulativePLDataPoint[];
  dailyPLData: DailyPLDataPoint[];
  timePerformanceData: TimePerformanceDataPoint[];
  durationPerformanceData: DurationPerformanceDataPoint[];
  trades: Trade[];
  consistencyScore: number;
}

export const ChartsContainer: React.FC<ChartsContainerProps> = React.memo(({
  radarData,
  cumulativePLData,
  dailyPLData,
  timePerformanceData,
  durationPerformanceData,
  trades,
  consistencyScore
}) => {
  return (
    <>
      {/* Second Row - Trading Score and Daily net cumulative P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <RadarChartComponent
          data={radarData}
          score={Math.round(consistencyScore)}
        />
        <div className="lg:col-span-2">
          <PLChart data={cumulativePLData} type="cumulative" />
        </div>
      </div>

      {/* Third Row - Net daily P&L bar chart (70%) and Recent trades (30%) */}
      <div className="grid grid-cols-10 gap-6 mb-8">
        <div className="col-span-7">
          <BarChartComponent
            data={dailyPLData}
            title="Net daily P&L"
          />
        </div>
        <div className="col-span-3">
          <TradesTable trades={trades.slice(0, 6)} />
        </div>
      </div>

      {/* Performance Analysis Section - Condensed 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="h-[350px]">
          <TimePerformanceChart data={timePerformanceData} />
        </div>
        <div className="h-[350px]">
          <DurationPerformanceChart data={durationPerformanceData} />
        </div>
      </div>
    </>
  );
});

ChartsContainer.displayName = 'ChartsContainer';
