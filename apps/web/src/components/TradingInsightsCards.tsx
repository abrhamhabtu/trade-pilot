'use client';

import React from 'react';
import { Trade } from '../store/tradingStore';
import { Tooltip } from './Tooltip';

interface TradingInsightsCardsProps {
  trades: Trade[];
}

export const TradingInsightsCards: React.FC<TradingInsightsCardsProps> = ({ trades }) => {
  // Calculate insights from trades data
  const calculateInsights = () => {
    if (trades.length === 0) {
      return {
        mostActiveDay: { day: 'N/A', activeDays: 0, totalTrades: 0, avgTradesPerDay: 0 },
        mostProfitableDay: { day: 'N/A', profit: 0 },
        leastProfitableDay: { day: 'N/A', loss: 0 },
        totalTrades: 0,
        totalLots: 0,
        avgTradeDuration: { minutes: 0, seconds: 0 },
        avgWinDuration: { minutes: 0, seconds: 0 },
        avgLossDuration: { minutes: 0, seconds: 0 }
      };
    }

    // Group trades by day of week
    const dayGroups = trades.reduce((acc, trade) => {
      const date = new Date(trade.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

      if (!acc[dayName]) {
        acc[dayName] = { trades: [], totalPnl: 0 };
      }

      acc[dayName].trades.push(trade);
      acc[dayName].totalPnl += trade.netPL;

      return acc;
    }, {} as Record<string, { trades: Trade[]; totalPnl: number }>);

    // Find most active day
    const mostActiveDay = Object.entries(dayGroups).reduce((max, [day, data]) => {
      return data.trades.length > max.totalTrades ?
        { day, activeDays: 1, totalTrades: data.trades.length, avgTradesPerDay: data.trades.length } :
        max;
    }, { day: 'N/A', activeDays: 0, totalTrades: 0, avgTradesPerDay: 0 });

    // Find most and least profitable days
    const mostProfitableDay = Object.entries(dayGroups).reduce((max, [day, data]) => {
      return data.totalPnl > max.profit ? { day, profit: data.totalPnl } : max;
    }, { day: 'N/A', profit: -Infinity });

    const leastProfitableDay = Object.entries(dayGroups).reduce((min, [day, data]) => {
      return data.totalPnl < min.pnl ? { day, pnl: data.totalPnl } : min;
    }, { day: 'N/A', pnl: Infinity });

    // Calculate durations
    const winningTrades = trades.filter(t => t.outcome === 'win');
    const losingTrades = trades.filter(t => t.outcome === 'loss');

    const avgDuration = trades.reduce((sum, t) => sum + t.duration, 0) / trades.length;
    const avgWinDuration = winningTrades.length > 0 ?
      winningTrades.reduce((sum, t) => sum + t.duration, 0) / winningTrades.length : 0;
    const avgLossDuration = losingTrades.length > 0 ?
      losingTrades.reduce((sum, t) => sum + t.duration, 0) / losingTrades.length : 0;

    const formatDuration = (totalMinutes: number) => {
      const minutes = Math.floor(totalMinutes);
      const seconds = Math.round((totalMinutes - minutes) * 60);
      return { minutes, seconds };
    };

    return {
      mostActiveDay,
      mostProfitableDay,
      leastProfitableDay: { day: leastProfitableDay.day, loss: leastProfitableDay.pnl === Infinity ? 0 : leastProfitableDay.pnl },
      totalTrades: trades.length,
      totalLots: Math.floor(trades.reduce((sum, t) => sum + t.quantity, 0) / 100), // Rough lots calculation
      avgTradeDuration: formatDuration(avgDuration),
      avgWinDuration: formatDuration(avgWinDuration),
      avgLossDuration: formatDuration(avgLossDuration)
    };
  };

  const insights = calculateInsights();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDuration = (duration: { minutes: number; seconds: number }) => {
    return `${duration.minutes} min ${duration.seconds} sec`;
  };

  return (
    <div className="mb-8">
      {/* Insights Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Most Active Day */}
        <div
          className="rounded-xl p-6 border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        >
          <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
            <div
              className="w-full h-full rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
              }}
            />
          </div>

          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-[#8B94A7] text-sm font-medium">Most Active Day</span>
              <Tooltip content="The day of the week when you execute the most trades" position="top">
                <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                  <span className="text-[#8B94A7] text-xs">?</span>
                </div>
              </Tooltip>
            </div>
            <div className="text-2xl font-bold text-[#E5E7EB] mb-2">{insights.mostActiveDay.day}</div>
            <div className="space-y-1 text-sm text-[#8B94A7]">
              <div>{insights.mostActiveDay.activeDays} active days</div>
              <div>{insights.mostActiveDay.totalTrades} total trades</div>
              <div>{insights.mostActiveDay.avgTradesPerDay.toFixed(1)} avg trades/day</div>
            </div>
          </div>
        </div>

        {/* Most Profitable Day */}
        <div
          className="rounded-xl p-6 border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        >
          <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
            <div
              className="w-full h-full rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
              }}
            />
          </div>

          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-[#8B94A7] text-sm font-medium">Most Profitable Day</span>
              <Tooltip content="The day of the week with the highest total profits" position="top">
                <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                  <span className="text-[#8B94A7] text-xs">?</span>
                </div>
              </Tooltip>
            </div>
            <div className="text-2xl font-bold text-[#E5E7EB] mb-2">{insights.mostProfitableDay.day}</div>
            <div className="text-lg font-bold bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] bg-clip-text text-transparent">
              {formatCurrency(insights.mostProfitableDay.profit)}
            </div>
          </div>
        </div>

        {/* Least Profitable Day */}
        <div
          className="rounded-xl p-6 border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        >
          <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
            <div
              className="w-full h-full rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
              }}
            />
          </div>

          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-[#8B94A7] text-sm font-medium">Least Profitable Day</span>
              <Tooltip content="The day of the week with the lowest total profits or highest losses" position="top">
                <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                  <span className="text-[#8B94A7] text-xs">?</span>
                </div>
              </Tooltip>
            </div>
            <div className="text-2xl font-bold text-[#E5E7EB] mb-2">{insights.leastProfitableDay.day}</div>
            <div className="text-lg font-bold text-[#F45B69]">
              {formatCurrency(insights.leastProfitableDay.loss)}
            </div>
          </div>
        </div>
      </div>

      {/* Second Row of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Total Number of Trades */}
        <div
          className="rounded-xl p-6 border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        >
          <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
            <div
              className="w-full h-full rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
              }}
            />
          </div>

          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-[#8B94A7] text-sm font-medium">Total Number of Trades</span>
              <Tooltip content="Total count of all executed trades in the selected period" position="top">
                <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                  <span className="text-[#8B94A7] text-xs">?</span>
                </div>
              </Tooltip>
            </div>
            <div className="text-3xl font-bold text-[#E5E7EB]">{insights.totalTrades}</div>
          </div>
        </div>

        {/* Total Number of Lots Traded */}
        <div
          className="rounded-xl p-6 border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        >
          <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
            <div
              className="w-full h-full rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
              }}
            />
          </div>

          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-[#8B94A7] text-sm font-medium">Total Number of Lots Traded</span>
              <Tooltip content="Total volume of lots traded across all positions" position="top">
                <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                  <span className="text-[#8B94A7] text-xs">?</span>
                </div>
              </Tooltip>
            </div>
            <div className="text-3xl font-bold text-[#E5E7EB]">{insights.totalLots}</div>
          </div>
        </div>

        {/* Average Trade Duration */}
        <div
          className="rounded-xl p-6 border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        >
          <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
            <div
              className="w-full h-full rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
              }}
            />
          </div>

          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-[#8B94A7] text-sm font-medium">Average Trade Duration</span>
              <Tooltip content="Average time you hold positions from entry to exit" position="top">
                <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                  <span className="text-[#8B94A7] text-xs">?</span>
                </div>
              </Tooltip>
            </div>
            <div className="text-xl font-bold text-[#E5E7EB]">
              {formatDuration(insights.avgTradeDuration)}
            </div>
          </div>
        </div>

        {/* Average Win Duration */}
        <div
          className="rounded-xl p-6 border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        >
          <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
            <div
              className="w-full h-full rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
              }}
            />
          </div>

          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-[#8B94A7] text-sm font-medium">Average Win Duration</span>
              <Tooltip content="Average duration of your winning trades" position="top">
                <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                  <span className="text-[#8B94A7] text-xs">?</span>
                </div>
              </Tooltip>
            </div>
            <div className="text-xl font-bold text-[#E5E7EB]">
              {formatDuration(insights.avgWinDuration)}
            </div>
          </div>
        </div>

        {/* Average Loss Duration */}
        <div
          className="rounded-xl p-6 border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        >
          <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
            <div
              className="w-full h-full rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
              }}
            />
          </div>

          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-[#8B94A7] text-sm font-medium">Average Loss Duration</span>
              <Tooltip content="Average duration of your losing trades" position="top">
                <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                  <span className="text-[#8B94A7] text-xs">?</span>
                </div>
              </Tooltip>
            </div>
            <div className="text-xl font-bold text-[#E5E7EB]">
              {formatDuration(insights.avgLossDuration)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};