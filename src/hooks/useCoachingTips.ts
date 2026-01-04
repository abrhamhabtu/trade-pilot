import { useMemo } from 'react';
import { TradingMetrics } from '../store/tradingStore';
import { TimePerformanceDataPoint, DurationPerformanceDataPoint } from './useChartData';

interface TimeAnalysisResult {
  insight: string | null;
}

interface DurationAnalysisResult {
  insight: string | null;
}

function analyzeTimePerformance(data: TimePerformanceDataPoint[]): TimeAnalysisResult {
  if (data.length < 5) return { insight: null };

  const morningTrades = data.filter(t => t.time >= 9 && t.time <= 11);
  const midDayTrades = data.filter(t => t.time >= 11 && t.time <= 14);
  const afternoonTrades = data.filter(t => t.time >= 14 && t.time <= 16);

  const periods = [
    { name: 'morning (9-11 AM)', trades: morningTrades, timeRange: '9-11 AM' },
    { name: 'midday (11 AM-2 PM)', trades: midDayTrades, timeRange: '11 AM-2 PM' },
    { name: 'afternoon (2-4 PM)', trades: afternoonTrades, timeRange: '2-4 PM' }
  ].filter(p => p.trades.length >= 3);

  if (periods.length < 2) return { insight: null };

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

  const bestPeriod = periodStats.reduce((best, current) =>
    current.avgPnL > best.avgPnL ? current : best
  );

  const worstPeriod = periodStats.reduce((worst, current) =>
    current.avgPnL < worst.avgPnL ? current : worst
  );

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
}

function analyzeDurationPerformance(data: DurationPerformanceDataPoint[]): DurationAnalysisResult {
  if (data.length < 5) return { insight: null };

  const shortTrades = data.filter(t => t.duration <= 30);
  const mediumTrades = data.filter(t => t.duration > 30 && t.duration <= 120);
  const longTrades = data.filter(t => t.duration > 120);

  const groups = [
    { name: 'short-duration trades (under 30 min)', trades: shortTrades, type: 'scalping' as const },
    { name: 'medium-duration trades (30min-2h)', trades: mediumTrades, type: 'swing' as const },
    { name: 'long-duration trades (over 2h)', trades: longTrades, type: 'position' as const }
  ].filter(g => g.trades.length >= 3);

  if (groups.length < 2) return { insight: null };

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
}

function getGeneralPerformanceInsight(): string {
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
}

export function useCoachingTips(
  metrics: TradingMetrics,
  timePerformanceData: TimePerformanceDataPoint[],
  durationPerformanceData: DurationPerformanceDataPoint[]
) {
  const topCoachingTip = useMemo(() => {
    const tips = [
      "Trade the size that your mindset will support. If you find that your emotions kick in when you start adding size to a position, it's likely an indicator that you're trading too much size. Less is more!",
      "The best traders are not right all the time - they're just excellent at cutting their losses quickly and letting their winners run.",
      "Your trading plan is your roadmap to success. Stick to it even when emotions try to take the wheel.",
      "Risk management isn't just about stop losses - it's about position sizing, diversification, and knowing when to step away.",
      "The market will always be there tomorrow. Don't force trades when conditions aren't favorable.",
      "Consistency beats perfection. Focus on executing your strategy with discipline rather than trying to catch every move.",
      "Your worst enemy in trading is often your own psychology. Master your emotions before trying to master the markets."
    ];

    if (metrics.winRate < 50) {
      return "Focus on your risk management and trade selection. A lower win rate can still be profitable with proper risk/reward ratios.";
    } else if (metrics.maxDrawdown > 15) {
      return "Consider reducing your position sizes. Large drawdowns can be psychologically damaging and impact future performance.";
    } else if (metrics.avgRiskReward < 1.5) {
      return "Work on improving your risk/reward ratio. Aim for at least 1.5:1 to maintain profitability even with moderate win rates.";
    }

    const today = new Date().toDateString();
    const hash = today.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    return tips[Math.abs(hash) % tips.length];
  }, [metrics]);

  const performanceCoachingTip = useMemo(() => {
    if (timePerformanceData.length === 0) {
      return "Start tracking your trades to get personalized performance insights and coaching tips.";
    }

    const timeAnalysis = analyzeTimePerformance(timePerformanceData);
    const durationAnalysis = analyzeDurationPerformance(durationPerformanceData);

    if (timeAnalysis.insight) {
      return timeAnalysis.insight;
    } else if (durationAnalysis.insight) {
      return durationAnalysis.insight;
    }

    return getGeneralPerformanceInsight();
  }, [timePerformanceData, durationPerformanceData]);

  return {
    topCoachingTip,
    performanceCoachingTip
  };
}
