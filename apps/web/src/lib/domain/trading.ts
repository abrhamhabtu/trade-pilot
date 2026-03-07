export type TimePeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface TradeMetricsInput {
  date: string;
  netPL: number;
  outcome: 'win' | 'loss';
}

export interface TradeSummaryMetrics {
  netPL: number;
  profitFactor: number;
  winRate: number;
  expectancy: number;
  currentStreak: number;
  totalTrades: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  recoveryFactor: number;
  consistency: number;
  sharpeRatio: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  largestWin: number;
  largestLoss: number;
  avgRiskReward: number;
}

export const EMPTY_TRADE_SUMMARY_METRICS: TradeSummaryMetrics = {
  netPL: 0,
  profitFactor: 0,
  winRate: 0,
  expectancy: 0,
  currentStreak: 0,
  totalTrades: 0,
  avgWin: 0,
  avgLoss: 0,
  maxDrawdown: 0,
  recoveryFactor: 0,
  consistency: 0,
  sharpeRatio: 0,
  maxConsecutiveWins: 0,
  maxConsecutiveLosses: 0,
  largestWin: 0,
  largestLoss: 0,
  avgRiskReward: 0,
};

export function filterTradesByPeriod<T extends { date: string }>(
  trades: T[],
  period: TimePeriod
): T[] {
  if (period === 'ALL') {
    return trades;
  }

  const now = new Date();
  const cutoffDate = new Date();

  switch (period) {
    case '1D':
      cutoffDate.setDate(now.getDate() - 1);
      break;
    case '1W':
      cutoffDate.setDate(now.getDate() - 7);
      break;
    case '1M':
      cutoffDate.setMonth(now.getMonth() - 1);
      break;
    case '3M':
      cutoffDate.setMonth(now.getMonth() - 3);
      break;
    case '6M':
      cutoffDate.setMonth(now.getMonth() - 6);
      break;
    case '1Y':
      cutoffDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  return trades.filter((trade) => new Date(trade.date) >= cutoffDate);
}

export function calculateTradeSummaryMetrics<T extends TradeMetricsInput>(
  trades: T[]
): TradeSummaryMetrics {
  if (trades.length === 0) {
    return EMPTY_TRADE_SUMMARY_METRICS;
  }

  const wins = trades.filter((trade) => trade.outcome === 'win');
  const losses = trades.filter((trade) => trade.outcome === 'loss');

  const totalWinAmount = wins.reduce((sum, trade) => sum + trade.netPL, 0);
  const totalLossAmount = Math.abs(losses.reduce((sum, trade) => sum + trade.netPL, 0));
  const netPL = trades.reduce((sum, trade) => sum + trade.netPL, 0);

  const profitFactor =
    totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0;
  const winRate = (wins.length / trades.length) * 100;
  const expectancy = netPL / trades.length;
  const avgWin = wins.length > 0 ? totalWinAmount / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLossAmount / losses.length : 0;

  let currentStreak = 0;
  if (trades.length > 0) {
    const firstOutcome = trades[0].outcome;
    for (const trade of trades) {
      if (trade.outcome === firstOutcome) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  for (const trade of trades) {
    if (trade.outcome === 'win') {
      currentWinStreak += 1;
      currentLossStreak = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
    } else {
      currentLossStreak += 1;
      currentWinStreak = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
    }
  }

  const largestWin = Math.max(...trades.map((trade) => trade.netPL));
  const largestLoss = Math.min(...trades.map((trade) => trade.netPL));
  const avgRiskReward = avgLoss > 0 ? avgWin / avgLoss : 0;

  let maxDrawdown = 0;
  let peak = 0;
  let runningPL = 0;

  const sortedTrades = [...trades].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
  );

  for (const trade of sortedTrades) {
    runningPL += trade.netPL;
    if (runningPL > peak) {
      peak = runningPL;
    }
    const drawdown = peak > 0 ? ((peak - runningPL) / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  const returns = trades.map((trade) => trade.netPL);
  const avgReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + Math.pow(value - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  const recoveryFactor = maxDrawdown > 0 ? netPL / ((maxDrawdown * peak) / 100) : 0;

  const winRateScore = Math.min(winRate * 0.8, 40);
  const profitFactorScore = Math.min(profitFactor * 12.5, 25);
  const riskScore = Math.max(0, 20 - maxDrawdown * 0.8);
  const expectancyScore = expectancy > 0 ? Math.min(expectancy * 0.05, 15) : 0;

  let consistency = winRateScore + profitFactorScore + riskScore + expectancyScore;
  if (netPL > 0 && winRate > 50 && profitFactor > 1.0) {
    consistency = Math.max(consistency, 65);
  }

  return {
    netPL,
    profitFactor,
    winRate,
    expectancy,
    currentStreak,
    totalTrades: trades.length,
    avgWin,
    avgLoss,
    maxDrawdown,
    recoveryFactor,
    consistency: Math.min(95, consistency),
    sharpeRatio,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    largestWin,
    largestLoss,
    avgRiskReward,
  };
}
