'use client';

import React from 'react';
import { RadarChartComponent } from '../charts/RadarChart';
import { PLChart } from '../charts/PLChart';
import { BarChartComponent } from '../charts/BarChart';
import { ProgressTracker } from '../charts/ProgressTracker';
import { TradesTable } from '../TradesTable';
import { TimePerformanceChart } from '../charts/TimePerformanceChart';
import { DurationPerformanceChart } from '../charts/DurationPerformanceChart';
import { Calendar } from '../Calendar';
import { Trade } from '../../store/tradingStore';
import {
  RadarDataPoint,
  CumulativePLDataPoint,
  DailyPLDataPoint,
  CalendarDataPoint,
  TimePerformanceDataPoint,
  DurationPerformanceDataPoint
} from '../../hooks/useChartData';

interface ChartsContainerProps {
  radarData: RadarDataPoint[];
  cumulativePLData: CumulativePLDataPoint[];
  dailyPLData: DailyPLDataPoint[];
  calendarData: CalendarDataPoint[];
  timePerformanceData: TimePerformanceDataPoint[];
  durationPerformanceData: DurationPerformanceDataPoint[];
  trades: Trade[];
  consistencyScore: number;
  onNavigateToRoutine?: () => void;
  accountId?: string;
}

export const ChartsContainer: React.FC<ChartsContainerProps> = React.memo(({
  radarData,
  cumulativePLData,
  dailyPLData,
  calendarData,
  timePerformanceData,
  durationPerformanceData,
  trades,
  consistencyScore,
  onNavigateToRoutine,
  accountId
}) => {
  return (
    <>
      {/* Second Row - Trading Score and Daily net cumulative P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <RadarChartComponent
          data={radarData}
          score={Math.round(consistencyScore)}
        />
        <div className="lg:col-span-2 h-full">
          <PLChart data={cumulativePLData} type="cumulative" />
        </div>
      </div>

      {/* Third Row - Net daily P&L, Progress Tracker, and Recent trades */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        {/* Net daily P&L */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-4 h-[360px]">
          <BarChartComponent
            data={dailyPLData}
            title="Net daily P&L"
          />
        </div>

        {/* Progress Tracker - GitHub style heatmap */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-4 h-[360px]">
          <ProgressTracker onViewMore={onNavigateToRoutine} />
        </div>

        {/* Recent Trades */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-4 h-[360px]">
          <TradesTable trades={trades.slice(0, 6)} />
        </div>
      </div>

      {/* Calendar Section - Moved above performance charts */}
      <div className="mb-6">
        <Calendar data={calendarData} trades={trades} accountId={accountId} />
      </div>

      {/* Performance Analysis Section - Condensed 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="h-[400px]">
          <TimePerformanceChart data={timePerformanceData} />
        </div>
        <div className="h-[400px]">
          <DurationPerformanceChart data={durationPerformanceData} />
        </div>
      </div>
    </>
  );
});

ChartsContainer.displayName = 'ChartsContainer';
