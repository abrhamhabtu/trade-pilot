import { useMemo } from 'react';
import { Trade, TradingMetrics } from '../store/tradingStore';

interface RadarDataPoint {
  category: string;
  value: number;
  fullMark: number;
}

interface CumulativePLDataPoint {
  date: string;
  cumulative: number;
  daily: number;
}

interface DailyPLDataPoint {
  date: string;
  value: number;
}

interface CalendarDataPoint {
  date: string;
  pnl: number;
  trades: number;
}

interface TimePerformanceDataPoint {
  time: number;
  pnl: number;
  outcome: 'win' | 'loss';
}

interface DurationPerformanceDataPoint {
  duration: number;
  pnl: number;
  outcome: 'win' | 'loss';
}

interface SummaryDataPoint {
  duration: string;
  netProfits: number;
  winningPercent: number;
  totalProfits: number;
}

export function useChartData(trades: Trade[], metrics: TradingMetrics) {
  const radarData = useMemo<RadarDataPoint[]>(() => [
    { category: 'Win %', value: metrics.winRate, fullMark: 100 },
    { category: 'Consistency', value: metrics.consistency, fullMark: 100 },
    { category: 'Profit factor', value: Math.min(metrics.profitFactor * 20, 100), fullMark: 100 },
    { category: 'Risk/Reward', value: Math.min(metrics.avgRiskReward * 25, 100), fullMark: 100 },
    { category: 'Drawdown Mgmt', value: Math.max(0, 100 - metrics.maxDrawdown * 2), fullMark: 100 },
    { category: 'Sharpe Ratio', value: Math.min(Math.max(0, (metrics.sharpeRatio + 2) * 25), 100), fullMark: 100 }
  ], [metrics]);

  const cumulativePLData = useMemo<CumulativePLDataPoint[]>(() => {
    return trades
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .reduce((acc, trade, index) => {
        const cumulative = index === 0 ? trade.netPL : acc[index - 1].cumulative + trade.netPL;
        acc.push({
          date: trade.date,
          cumulative,
          daily: trade.netPL
        });
        return acc;
      }, [] as CumulativePLDataPoint[]);
  }, [trades]);

  const dailyPLData = useMemo<DailyPLDataPoint[]>(() => {
    return trades
      .reduce((acc, trade) => {
        const existingDate = acc.find(d => d.date === trade.date);
        if (existingDate) {
          existingDate.value += trade.netPL;
        } else {
          acc.push({
            date: trade.date,
            value: trade.netPL
          });
        }
        return acc;
      }, [] as DailyPLDataPoint[])
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [trades]);

  const calendarData = useMemo<CalendarDataPoint[]>(() => {
    return trades.reduce((acc, trade) => {
      const existingDate = acc.find(d => d.date === trade.date);
      if (existingDate) {
        existingDate.pnl += trade.netPL;
        existingDate.trades += 1;
      } else {
        acc.push({
          date: trade.date,
          pnl: trade.netPL,
          trades: 1
        });
      }
      return acc;
    }, [] as CalendarDataPoint[]);
  }, [trades]);

  const timePerformanceData = useMemo<TimePerformanceDataPoint[]>(() => {
    return trades.map(trade => {
      let hour = 10;
      let minutes = 0;
      if (trade.time) {
        // Parse time like "9:27 AM" or "2:15 PM"
        const timeMatch = trade.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (timeMatch) {
          hour = parseInt(timeMatch[1]);
          minutes = parseInt(timeMatch[2]) || 0;
          const period = timeMatch[3]?.toUpperCase();

          if (period === 'PM' && hour !== 12) {
            hour += 12;
          } else if (period === 'AM' && hour === 12) {
            hour = 0;
          }
        }
      }
      // Convert to decimal hours (e.g., 9:30 AM = 9.5)
      const decimalTime = hour + (minutes / 60);
      return {
        time: decimalTime,
        pnl: trade.netPL,
        outcome: trade.outcome
      };
    });
  }, [trades]);

  const durationPerformanceData = useMemo<DurationPerformanceDataPoint[]>(() => {
    return trades.map(trade => ({
      duration: trade.duration,
      pnl: trade.netPL,
      outcome: trade.outcome
    }));
  }, [trades]);

  const summaryData = useMemo<SummaryDataPoint[]>(() => {
    const durationRanges = [
      { label: 'Under 5 min', min: 0, max: 5 },
      { label: '5-15 min', min: 5, max: 15 },
      { label: '15-60 min', min: 15, max: 60 },
      { label: '1-3 hours', min: 60, max: 180 },
      { label: '3-6 hours', min: 180, max: 360 },
      { label: '6+ hours', min: 360, max: Infinity }
    ];

    return durationRanges.map(range => {
      const tradesInRange = trades.filter(trade =>
        trade.duration >= range.min && trade.duration < range.max
      );

      if (tradesInRange.length === 0) {
        return {
          duration: range.label,
          netProfits: 0,
          winningPercent: 0,
          totalProfits: 0
        };
      }

      const netProfits = tradesInRange.reduce((sum, trade) => sum + trade.netPL, 0);
      const winningTrades = tradesInRange.filter(trade => trade.outcome === 'win').length;
      const winningPercent = (winningTrades / tradesInRange.length) * 100;
      const totalProfits = tradesInRange.filter(trade => trade.outcome === 'win')
        .reduce((sum, trade) => sum + trade.netPL, 0);

      return {
        duration: range.label,
        netProfits,
        winningPercent,
        totalProfits
      };
    }).filter(item => item.netProfits !== 0 || item.totalProfits !== 0).slice(0, 6);
  }, [trades]);

  return {
    radarData,
    cumulativePLData,
    dailyPLData,
    calendarData,
    timePerformanceData,
    durationPerformanceData,
    summaryData
  };
}

export type {
  RadarDataPoint,
  CumulativePLDataPoint,
  DailyPLDataPoint,
  CalendarDataPoint,
  TimePerformanceDataPoint,
  DurationPerformanceDataPoint,
  SummaryDataPoint
};
