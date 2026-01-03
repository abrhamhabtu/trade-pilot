import React, { useState } from 'react';
import clsx from 'clsx';
import { Sidebar } from './components/Sidebar';
import { MetricCard } from './components/MetricCard';
import { RadarChartComponent } from './components/charts/RadarChart';
import { PLChart } from './components/charts/PLChart';
import { BarChartComponent } from './components/charts/BarChart';
import { Calendar } from './components/Calendar';
import { TradesTable } from './components/TradesTable';
import { TimePerformanceChart } from './components/charts/TimePerformanceChart';
import { DurationPerformanceChart } from './components/charts/DurationPerformanceChart';
import { TradeSummaryTable } from './components/TradeSummaryTable';
import { TradeLog } from './components/TradeLog';
import { Playbooks } from './components/Playbooks';
import { ImportModal } from './components/ImportModal';
import { BuiltOnBoltBadge } from './components/BuiltOnBoltBadge';
import { useTradingStore, TimePeriod } from './store/tradingStore';
import { 
  DollarSign, 
  TrendingUp, 
  Target, 
  Zap, 
  BarChart2, 
  Activity,
  RefreshCw,
  Download,
  Clock,
  Timer
} from 'lucide-react';

function App() {
  const { 
    trades, 
    metrics, 
    sidebarCollapsed, 
    refreshData, 
    isLoading, 
    currentView, 
    hasImportedData,
    selectedTimePeriod,
    setTimePeriod,
    getFilteredTrades
  } = useTradingStore();
  const [showImportModal, setShowImportModal] = useState(false);

  // Get filtered trades based on selected time period
  const displayTrades = getFilteredTrades();

  // Process data for charts using filtered trades
  const radarData = [
    { category: 'Win %', value: metrics.winRate, fullMark: 100 },
    { category: 'Consistency', value: metrics.consistency, fullMark: 100 },
    { category: 'Profit factor', value: Math.min(metrics.profitFactor * 20, 100), fullMark: 100 },
    { category: 'Risk/Reward', value: Math.min(metrics.avgRiskReward * 25, 100), fullMark: 100 },
    { category: 'Drawdown Mgmt', value: Math.max(0, 100 - metrics.maxDrawdown * 2), fullMark: 100 },
    { category: 'Sharpe Ratio', value: Math.min(Math.max(0, (metrics.sharpeRatio + 2) * 25), 100), fullMark: 100 }
  ];

  // Generate cumulative P&L data using filtered trades
  const cumulativePLData = displayTrades
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc, trade, index) => {
      const cumulative = index === 0 ? trade.netPL : acc[index - 1].cumulative + trade.netPL;
      acc.push({
        date: trade.date,
        cumulative,
        daily: trade.netPL
      });
      return acc;
    }, [] as Array<{ date: string; cumulative: number; daily: number }>);

  // Generate daily P&L data for bar chart
  const dailyPLData = displayTrades.reduce((acc, trade) => {
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
  }, [] as Array<{ date: string; value: number }>)
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Generate calendar data using filtered trades
  const calendarData = displayTrades.reduce((acc, trade) => {
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
  }, [] as Array<{ date: string; pnl: number; trades: number }>);

  // Generate time performance data using filtered trades
  const timePerformanceData = displayTrades.map(trade => {
    let hour = 10; // Default fallback
    if (trade.time) {
      const timeParts = trade.time.split(':');
      hour = parseInt(timeParts[0]);
      if (trade.time.includes('PM') && hour !== 12) {
        hour += 12;
      } else if (trade.time.includes('AM') && hour === 12) {
        hour = 0;
      }
    }
    
    return {
      time: hour,
      pnl: trade.netPL,
      outcome: trade.outcome
    };
  });

  // Generate duration performance data using filtered trades
  const durationPerformanceData = displayTrades.map(trade => ({
    duration: trade.duration,
    pnl: trade.netPL,
    outcome: trade.outcome
  }));

  // Generate summary data based on filtered trades
  const calculateSummaryData = () => {
    const durationRanges = [
      { label: 'Under 5 min', min: 0, max: 5 },
      { label: '5-15 min', min: 5, max: 15 },
      { label: '15-60 min', min: 15, max: 60 },
      { label: '1-3 hours', min: 60, max: 180 },
      { label: '3-6 hours', min: 180, max: 360 },
      { label: '6+ hours', min: 360, max: Infinity }
    ];

    return durationRanges.map(range => {
      const tradesInRange = displayTrades.filter(trade => 
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
  };

  const summaryData = calculateSummaryData();

  // Generate top coaching tip
  const getTopCoachingTip = () => {
    const tips = [
      "Trade the size that your mindset will support. If you find that your emotions kick in when you start adding size to a position, it's likely an indicator that you're trading too much size. Less is more!",
      "The best traders are not right all the time - they're just excellent at cutting their losses quickly and letting their winners run.",
      "Your trading plan is your roadmap to success. Stick to it even when emotions try to take the wheel.",
      "Risk management isn't just about stop losses - it's about position sizing, diversification, and knowing when to step away.",
      "The market will always be there tomorrow. Don't force trades when conditions aren't favorable.",
      "Consistency beats perfection. Focus on executing your strategy with discipline rather than trying to catch every move.",
      "Your worst enemy in trading is often your own psychology. Master your emotions before trying to master the markets."
    ];
    
    // Use metrics for tip selection
    if (metrics.winRate < 50) {
      return "Focus on your risk management and trade selection. A lower win rate can still be profitable with proper risk/reward ratios.";
    } else if (metrics.maxDrawdown > 15) {
      return "Consider reducing your position sizes. Large drawdowns can be psychologically damaging and impact future performance.";
    } else if (metrics.avgRiskReward < 1.5) {
      return "Work on improving your risk/reward ratio. Aim for at least 1.5:1 to maintain profitability even with moderate win rates.";
    }
    
    // Use a simple hash of current date to get consistent tip for the day
    const today = new Date().toDateString();
    const hash = today.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return tips[Math.abs(hash) % tips.length];
  };

  // Generate performance-specific AI coach tip based on actual data analysis
  const getPerformanceCoachingTip = () => {
    if (displayTrades.length === 0) {
      return "Start tracking your trades to get personalized performance insights and coaching tips.";
    }

    // Analyze time performance data
    const timeAnalysis = analyzeTimePerformance(timePerformanceData);
    const durationAnalysis = analyzeDurationPerformance(durationPerformanceData);
    
    // Priority order: time insights, duration insights, then general insights
    if (timeAnalysis.insight) {
      return timeAnalysis.insight;
    } else if (durationAnalysis.insight) {
      return durationAnalysis.insight;
    }
    
    // Fallback to general performance insights
    return getGeneralPerformanceInsight();
  };

  // Analyze time performance patterns
  const analyzeTimePerformance = (data: typeof timePerformanceData) => {
    if (data.length < 5) return { insight: null };

    // Group trades by time periods
    const morningTrades = data.filter(t => t.time >= 9 && t.time <= 11);
    const midDayTrades = data.filter(t => t.time >= 11 && t.time <= 14);
    const afternoonTrades = data.filter(t => t.time >= 14 && t.time <= 16);
    
    const periods = [
      { name: 'morning (9-11 AM)', trades: morningTrades, timeRange: '9-11 AM' },
      { name: 'midday (11 AM-2 PM)', trades: midDayTrades, timeRange: '11 AM-2 PM' },
      { name: 'afternoon (2-4 PM)', trades: afternoonTrades, timeRange: '2-4 PM' }
    ].filter(p => p.trades.length >= 3); // Only analyze periods with sufficient data

    if (periods.length < 2) return { insight: null };

    // Calculate performance metrics for each period
    const periodStats = periods.map(period => {
      const totalPnL = period.trades.reduce((sum, t) => sum + t.pnl, 0);
      const avgPnL = totalPnL / period.trades.length;
      const winRate = (period.trades.filter(t => t.outcome === 'win').length / period.trades.length) * 100;
      
      return {
        ...period,
        totalPnL,
        avgPnL,
        winRate,
        tradeCount: period.trades.length
      };
    });

    // Find best and worst performing periods
    const bestPeriod = periodStats.reduce((best, current) => 
      current.avgPnL > best.avgPnL ? current : best
    );
    
    const worstPeriod = periodStats.reduce((worst, current) => 
      current.avgPnL < worst.avgPnL ? current : worst
    );

    // Generate insights based on significant differences
    const performanceDiff = bestPeriod.avgPnL - worstPeriod.avgPnL;
    const winRateDiff = bestPeriod.winRate - worstPeriod.winRate;

    if (performanceDiff > 200 && bestPeriod.tradeCount >= 3) {
      return {
        insight: `Your ${bestPeriod.name} trading sessions are significantly more profitable (avg $${bestPeriod.avgPnL.toFixed(0)} vs $${worstPeriod.avgPnL.toFixed(0)}). Consider focusing more of your trading activity during the ${bestPeriod.timeRange} window when you seem to perform best.`
      };
    }

    if (winRateDiff > 20 && bestPeriod.tradeCount >= 3) {
      return {
        insight: `Your ${bestPeriod.name} sessions show a ${bestPeriod.winRate.toFixed(0)}% win rate compared to ${worstPeriod.winRate.toFixed(0)}% during ${worstPeriod.name}. Your decision-making appears sharper during ${bestPeriod.timeRange}.`
      };
    }

    return { insight: null };
  };

  // Analyze duration performance patterns
  const analyzeDurationPerformance = (data: typeof durationPerformanceData) => {
    if (data.length < 5) return { insight: null };

    // Group trades by duration
    const shortTrades = data.filter(t => t.duration <= 30);
    const mediumTrades = data.filter(t => t.duration > 30 && t.duration <= 120);
    const longTrades = data.filter(t => t.duration > 120);

    const groups = [
      { name: 'short-duration trades (under 30 min)', trades: shortTrades, type: 'scalping' },
      { name: 'medium-duration trades (30min-2h)', trades: mediumTrades, type: 'swing' },
      { name: 'long-duration trades (over 2h)', trades: longTrades, type: 'position' }
    ].filter(g => g.trades.length >= 3);

    if (groups.length < 2) return { insight: null };

    // Calculate performance for each group
    const groupStats = groups.map(group => {
      const totalPnL = group.trades.reduce((sum, t) => sum + t.pnl, 0);
      const avgPnL = totalPnL / group.trades.length;
      const winRate = (group.trades.filter(t => t.outcome === 'win').length / group.trades.length) * 100;
      
      return {
        ...group,
        totalPnL,
        avgPnL,
        winRate,
        tradeCount: group.trades.length
      };
    });

    // Find best performing duration group
    const bestGroup = groupStats.reduce((best, current) => 
      current.avgPnL > best.avgPnL ? current : best
    );

    const worstGroup = groupStats.reduce((worst, current) => 
      current.avgPnL < worst.avgPnL ? current : worst
    );

    const performanceDiff = bestGroup.avgPnL - worstGroup.avgPnL;

    if (performanceDiff > 150 && bestGroup.tradeCount >= 3) {
      if (bestGroup.type === 'scalping') {
        return {
          insight: `Your ${bestGroup.name} are significantly more profitable (avg $${bestGroup.avgPnL.toFixed(0)}). Consider focusing on scalping strategies and quick entries/exits to maximize your edge.`
        };
      } else if (bestGroup.type === 'position') {
        return {
          insight: `Your ${bestGroup.name} show better average returns ($${bestGroup.avgPnL.toFixed(0)}). Consider letting your winners run longer and being more patient with position management.`
        };
      } else {
        return {
          insight: `Your ${bestGroup.name} perform best with an average of $${bestGroup.avgPnL.toFixed(0)} per trade. This appears to be your optimal holding period sweet spot.`
        };
      }
    }

    return { insight: null };
  };

  // Generate general performance insights
  const getGeneralPerformanceInsight = () => {
    const insights = [
      "Track your performance by time of day to identify your most profitable trading hours. Energy levels and market conditions vary throughout the day.",
      "Analyze your trade duration patterns. Some traders excel at quick scalps while others profit more from swing trades. Find your sweet spot.",
      "Notice if you're more profitable during specific market sessions. The first hour after open and the last hour before close often have different characteristics.",
      "Consider the relationship between trade duration and profit size. Sometimes holding longer doesn't always mean bigger profits.",
      "Your performance charts reveal patterns that aren't obvious in raw P&L numbers. Use these insights to optimize your trading schedule.",
      "Time-based performance analysis can help you avoid trading during your historically weak periods and focus on your strongest hours."
    ];

    const today = new Date().toDateString();
    const hash = today.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return insights[Math.abs(hash) % insights.length];
  };

  // Get the appropriate time period label
  const getTimePeriodLabel = (period: TimePeriod): string => {
    const labels = {
      '1D': 'Last Day',
      '1W': 'Last Week', 
      '1M': 'Last Month',
      '3M': 'Last 3 Months',
      '6M': 'Last 6 Months',
      '1Y': 'Last Year',
      'ALL': 'All Time'
    };
    return labels[period];
  };

  // Render different views based on currentView
  const renderCurrentView = () => {
    switch (currentView) {
      case 'trades':
        return (
          <div className="p-6">
            <TradeLog trades={displayTrades} />
          </div>
        );
      
      case 'playbooks':
        return (
          <div className="p-6">
            <Playbooks />
          </div>
        );
      
      case 'calendar':
        return (
          <div className="p-6">
            <Calendar data={calendarData} />
          </div>
        );
      
      case 'journal':
        return (
          <div className="p-6">
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-[#E5E7EB] mb-4">Trading Journal</h2>
              <p className="text-[#8B94A7]">Coming soon...</p>
            </div>
          </div>
        );
      
      default: // dashboard
        return (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-6">
                <div 
                  className="flex items-center space-x-2 rounded-lg px-3 py-2 border border-[#1F2937]"
                  style={{
                    background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
                  }}
                >
                  {(['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'] as TimePeriod[]).map((period) => (
                    <button
                      key={period}
                      onClick={() => setTimePeriod(period)}
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
                
                {/* Show current period info */}
                <div className="text-sm text-[#8B94A7]">
                  Showing: <span className="text-[#E5E7EB] font-medium">{getTimePeriodLabel(selectedTimePeriod)}</span>
                  {displayTrades.length !== trades.length && (
                    <span className="ml-2">({displayTrades.length} of {trades.length} trades)</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button 
                  onClick={refreshData}
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
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium rounded-lg hover:opacity-90 hover:shadow-lg transition-all duration-200"
                >
                  <Download className="h-4 w-4" />
                  <span className="text-sm">Import Trades from TradingView</span>
                </button>
              </div>
            </div>

            {/* Top Metric Cards - 6 cards in a row */}
            <div className="grid grid-cols-6 gap-4 mb-6">
              <MetricCard
                title="Net P&L"
                value={metrics.netPL}
                format="currency"
                trend={metrics.netPL >= 0 ? "up" : "down"}
                icon={DollarSign}
                iconColor="text-[#3BF68A]"
                tooltip="Total profit and loss from all closed trades. This represents your overall trading performance in dollar terms."
              />
              <MetricCard
                title="Profit Factor"
                value={metrics.profitFactor}
                format="number"
                trend={metrics.profitFactor >= 1.5 ? "up" : metrics.profitFactor >= 1.0 ? "neutral" : "down"}
                icon={BarChart2}
                iconColor="text-[#3BF68A]"
                tooltip="Ratio of gross profit to gross loss. A profit factor above 1.0 means you're profitable. Values above 2.0 are considered excellent."
              />
              <MetricCard
                title="Trade Win %"
                value={metrics.winRate}
                format="percentage"
                trend={metrics.winRate >= 60 ? "up" : metrics.winRate >= 50 ? "neutral" : "down"}
                icon={Target}
                iconColor="text-[#3BF68A]"
                tooltip="Percentage of trades that were profitable. A higher win rate indicates more consistent trading, though it should be balanced with risk-reward ratios."
              />
              <MetricCard
                title="Trade Expectancy"
                value={metrics.expectancy}
                format="currency"
                trend={metrics.expectancy >= 0 ? "up" : "down"}
                icon={TrendingUp}
                iconColor="text-[#3BF68A]"
                tooltip="Average amount you can expect to win or lose per trade. Positive expectancy means your trading strategy is profitable over time."
              />
              <MetricCard
                title="Current Streak"
                value={metrics.currentStreak}
                format="number"
                trend="neutral"
                icon={Zap}
                iconColor="text-[#3BF68A]"
                subtitle={displayTrades.length > 0 ? (displayTrades[0].outcome === 'win' ? 'WINS' : 'LOSSES') : 'TRADES'}
                tooltip="Number of consecutive winning or losing trades. Helps track momentum and psychological state in your trading."
              />
              <MetricCard
                title="Total Trades"
                value={metrics.totalTrades}
                format="number"
                trend="neutral"
                icon={Activity}
                iconColor="text-[#8B94A7]"
                tooltip="Total number of completed trades. A larger sample size provides more reliable statistics for performance analysis."
              />
            </div>

            {/* Trading Coach Tip */}
            <div 
              className="rounded-xl p-6 mb-6 border border-[#1F2937] relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
              }}
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="px-4 py-2 bg-[#E5E7EB] text-[#15181F] rounded-full text-sm font-medium">
                    Trading Coach Tip
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-[#E5E7EB] text-base leading-relaxed">
                    {getTopCoachingTip()}
                  </p>
                </div>
              </div>
            </div>

            {/* Second Row - Trading Score and Daily net cumulative P&L */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Radar Chart - Takes 1 column */}
              <RadarChartComponent 
                data={radarData} 
                score={Math.round(metrics.consistency)}
              />

              {/* Daily net cumulative P&L Chart - Takes 2 columns */}
              <div className="lg:col-span-2">
                <PLChart data={cumulativePLData} type="cumulative" />
              </div>
            </div>

            {/* Third Row - Net daily P&L bar chart (70%) and Recent trades (30%) */}
            <div className="grid grid-cols-10 gap-6 mb-8">
              {/* Net daily P&L Bar Chart - Takes 7 columns (70%) */}
              <div className="col-span-7">
                <BarChartComponent 
                  data={dailyPLData} 
                  title="Net daily P&L" 
                />
              </div>

              {/* Recent Trades Table - Takes 3 columns (30%) */}
              <div className="col-span-3">
                <TradesTable trades={displayTrades.slice(0, 6)} />
              </div>
            </div>

            {/* Calendar Section */}
            <div className="mb-8">
              <Calendar data={calendarData} />
            </div>

            {/* Performance AI Coach Tip - Now data-driven and synced with charts below */}
            <div 
              className="rounded-xl p-6 mb-6 border border-[#1F2937] relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
              }}
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#3BF68A]/20 to-[#A78BFA]/20 text-[#3BF68A] rounded-full text-sm font-medium border border-[#3BF68A]/30">
                    <Clock className="h-4 w-4" />
                    <span>Performance Insights</span>
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-[#E5E7EB] text-base leading-relaxed">
                    {getPerformanceCoachingTip()}
                  </p>
                </div>
              </div>
            </div>

            {/* Performance Analysis Section - Condensed 2-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Time Performance Chart - Condensed height */}
              <div className="h-[350px]">
                <TimePerformanceChart data={timePerformanceData} />
              </div>
              
              {/* Duration Performance Chart - Condensed height */}
              <div className="h-[350px]">
                <DurationPerformanceChart data={durationPerformanceData} />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className="min-h-screen"
      style={{
        background: 'linear-gradient(135deg, #0B0D10 0%, #0F1419 50%, #0B0D10 100%)'
      }}
    >
      <Sidebar />
      
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {renderCurrentView()}
      </main>

      {/* Import Modal */}
      <ImportModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
      />

      {/* Built on Bolt Badge - Required for hackathon */}
      <BuiltOnBoltBadge />
    </div>
  );
}

export default App;