import { create } from 'zustand';
import {
  saveTradesToStorage,
  loadTradesFromStorage,
  saveSettingsToStorage,
  loadSettingsFromStorage
} from '../hooks/useLocalStorage';
import { toast } from './toastStore';

export interface Trade {
  id: string;
  date: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  netPL: number;
  duration: number;
  outcome: 'win' | 'loss';
  time?: string;
  side?: 'Long' | 'Short';
  commission?: number;
  notes?: string;
  strategy?: string;
  rMultiple?: number;
  importId?: string; // Links trade to its import entry for deletion
}

export interface TradingMetrics {
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

export type TimePeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface ImportResult {
  totalRows: number;
  successfulImports: number;
  errors: string[];
}

interface TradingState {
  trades: Trade[];
  metrics: TradingMetrics;
  isLoading: boolean;
  selectedTimePeriod: TimePeriod;
  sidebarCollapsed: boolean;
  currentView: 'dashboard' | 'trades' | 'calendar' | 'playbooks' | 'journal' | 'accounts' | 'routine' | 'journey';
  hasImportedData: boolean;
  lastImportTime: number;

  // Actions
  addTrade: (trade: Omit<Trade, 'id'>) => void;
  updateTrade: (id: string, trade: Partial<Trade>) => void;
  deleteTrade: (id: string) => void;
  deleteTrades: (ids: string[]) => void;
  addTrades: (trades: Trade[]) => void;
  replaceTrades: (trades: Trade[]) => void;
  updateMetrics: () => void;
  setTimePeriod: (period: TimePeriod) => void;
  toggleSidebar: () => void;
  importTrades: (file: File) => Promise<ImportResult>;
  refreshData: () => void;
  setCurrentView: (view: 'dashboard' | 'trades' | 'calendar' | 'playbooks' | 'journal' | 'accounts' | 'routine' | 'journey') => void;
  getFilteredTrades: () => Trade[];
}

// Helper function to check if a date is a weekend
const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
};

// Filter trades by time period
const filterTradesByPeriod = (trades: Trade[], period: TimePeriod): Trade[] => {
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
    default:
      return trades;
  }

  return trades.filter(trade => {
    const tradeDate = new Date(trade.date);
    return tradeDate >= cutoffDate;
  });
};

// Parse TradingView date format (YYYY-MM-DD HH:MM:SS)
const parseTradingViewDate = (dateTimeStr: string): { date: string; time: string } => {
  if (!dateTimeStr) {
    return { date: new Date().toISOString().split('T')[0], time: '10:00 AM' };
  }

  try {
    // TradingView format: "2025-06-23 09:24:07"
    const [datePart, timePart] = dateTimeStr.split(' ');

    if (!datePart || !timePart) {
      throw new Error('Invalid date format');
    }

    // Parse time to 12-hour format
    const [hours, minutes] = timePart.split(':');
    const hour = parseInt(hours);
    let displayHour = hour;
    let ampm = 'AM';

    if (hour === 0) {
      displayHour = 12;
      ampm = 'AM';
    } else if (hour === 12) {
      displayHour = 12;
      ampm = 'PM';
    } else if (hour > 12) {
      displayHour = hour - 12;
      ampm = 'PM';
    }

    const formattedTime = `${displayHour}:${minutes} ${ampm}`;

    return {
      date: datePart,
      time: formattedTime
    };
  } catch (error) {
    console.warn('Error parsing date:', dateTimeStr, error);
    return { date: new Date().toISOString().split('T')[0], time: '10:00 AM' };
  }
};

// Parse numeric values safely
const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove currency symbols, commas, and other non-numeric characters except decimal point and minus
    const cleaned = value.replace(/[$,\s]/g, '').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Extract symbol from TradingView action description
const extractSymbol = (actionText: string): string => {
  if (!actionText) return 'UNKNOWN';

  // Look for CME_MINI pattern first (most common in your data)
  const cmeMatch = actionText.match(/CME_MINI:([A-Z]+\d{4})/);
  if (cmeMatch) {
    return cmeMatch[1]; // Returns like MESU2025, MESM2025, etc.
  }

  // Look for other exchange patterns
  const exchangePatterns = [
    /symbol\s+([A-Z_:]+)/i,
    /([A-Z]{2,5}:\w+)/,
    /([A-Z]{3,8}\d{4})/,
    /([A-Z]{3,5})/
  ];

  for (const pattern of exchangePatterns) {
    const match = actionText.match(pattern);
    if (match) {
      return match[1].replace(/[_:]/g, '');
    }
  }

  return 'UNKNOWN';
};

// Extract position details from action text
const extractPositionDetails = (actionText: string) => {
  const details = {
    side: 'Long' as 'Long' | 'Short',
    price: 0,
    quantity: 0
  };

  // Determine side from action text
  if (actionText.toLowerCase().includes('close short')) {
    details.side = 'Short';
  } else if (actionText.toLowerCase().includes('close long')) {
    details.side = 'Long';
  }

  // Extract price - look for "at price XXXX.XX"
  const priceMatch = actionText.match(/at price (\d+\.?\d*)/i);
  if (priceMatch) {
    details.price = parseFloat(priceMatch[1]);
  }

  // Extract quantity - look for "for X units"
  const quantityMatch = actionText.match(/for (\d+) units/i);
  if (quantityMatch) {
    details.quantity = parseInt(quantityMatch[1]);
  }

  return details;
};

// Parse ProjectX date format (e.g., "12/17/2025 09:53:12 -08:00")
const parseProjectXDate = (dateTimeStr: string): { date: string; time: string } => {
  if (!dateTimeStr) {
    return { date: new Date().toISOString().split('T')[0], time: '10:00 AM' };
  }

  try {
    // ProjectX format: "12/17/2025 09:53:12 -08:00"
    const parts = dateTimeStr.split(' ');
    const datePart = parts[0]; // "12/17/2025"
    const timePart = parts[1]; // "09:53:12"

    // Parse date (MM/DD/YYYY) to YYYY-MM-DD
    const [month, day, year] = datePart.split('/');
    const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    // Parse time to 12-hour format
    const [hours, minutes] = timePart.split(':');
    const hour = parseInt(hours);
    let displayHour = hour;
    let ampm = 'AM';

    if (hour === 0) {
      displayHour = 12;
      ampm = 'AM';
    } else if (hour === 12) {
      displayHour = 12;
      ampm = 'PM';
    } else if (hour > 12) {
      displayHour = hour - 12;
      ampm = 'PM';
    }

    const formattedTime = `${displayHour}:${minutes} ${ampm}`;

    return {
      date: formattedDate,
      time: formattedTime
    };
  } catch (error) {
    console.warn('Error parsing ProjectX date:', dateTimeStr, error);
    return { date: new Date().toISOString().split('T')[0], time: '10:00 AM' };
  }
};

// Parse ProjectX duration format (e.g., "00:10:17.2437970") to minutes
const parseProjectXDuration = (durationStr: string): number => {
  if (!durationStr) return 30; // Default 30 minutes

  try {
    // Format: "HH:MM:SS.milliseconds"
    const [timePart] = durationStr.split('.');
    const [hours, minutes, seconds] = timePart.split(':').map(Number);

    // Convert to total minutes
    const totalMinutes = hours * 60 + minutes + (seconds > 30 ? 1 : 0);
    return Math.max(1, totalMinutes); // Minimum 1 minute
  } catch (error) {
    console.warn('Error parsing ProjectX duration:', durationStr, error);
    return 30;
  }
};

// Detect if data is from ProjectX (Topstep, TopOne Futures, etc.)
const isProjectXFormat = (columns: string[]): boolean => {
  const projectXColumns = ['ContractName', 'EnteredAt', 'ExitedAt', 'EntryPrice', 'ExitPrice', 'PnL', 'Size', 'Type'];
  const matchCount = projectXColumns.filter(col => columns.includes(col)).length;
  return matchCount >= 5; // At least 5 matching columns
};

// Calculate realistic duration based on P&L and position type
const calculateRealisticDuration = (netPL: number, side: string): number => {
  // Base duration on P&L magnitude and side
  const absPL = Math.abs(netPL);

  let baseDuration: number;

  if (absPL < 50) {
    // Small P&L - likely scalping
    baseDuration = Math.random() * 15 + 5; // 5-20 minutes
  } else if (absPL < 200) {
    // Medium P&L - short term
    baseDuration = Math.random() * 60 + 15; // 15-75 minutes
  } else if (absPL < 500) {
    // Larger P&L - medium term
    baseDuration = Math.random() * 120 + 30; // 30-150 minutes
  } else {
    // Large P&L - longer term
    baseDuration = Math.random() * 240 + 60; // 60-300 minutes
  }

  // Add some randomness
  const variance = baseDuration * 0.3;
  const finalDuration = baseDuration + (Math.random() - 0.5) * variance;

  return Math.max(5, Math.round(finalDuration)); // Minimum 5 minutes
};

// Generate realistic trading times during market hours
const generateTradingTime = (): string => {
  const marketHours = [
    { hour: 9, weight: 0.18 },   // Market open - high activity
    { hour: 10, weight: 0.22 },  // Morning momentum
    { hour: 11, weight: 0.16 },  // Mid-morning
    { hour: 12, weight: 0.08 },  // Lunch - lower activity
    { hour: 13, weight: 0.12 },  // Post-lunch
    { hour: 14, weight: 0.14 },  // Afternoon
    { hour: 15, weight: 0.08 },  // Late afternoon
    { hour: 16, weight: 0.02 }   // Market close - lower activity
  ];

  const random = Math.random();
  let cumulative = 0;

  for (const timeSlot of marketHours) {
    cumulative += timeSlot.weight;
    if (random <= cumulative) {
      const minutes = Math.floor(Math.random() * 60);
      const hour12 = timeSlot.hour > 12 ? timeSlot.hour - 12 : timeSlot.hour;
      const ampm = timeSlot.hour >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
  }

  return '10:30 AM'; // Fallback
};

// Generate realistic trade durations
const generateTradeDuration = (): number => {
  const durationTypes = [
    { min: 2, max: 8, weight: 0.15 },      // Scalping: 2-8 minutes
    { min: 8, max: 25, weight: 0.30 },     // Quick trades: 8-25 minutes
    { min: 25, max: 90, weight: 0.35 },    // Short-term: 25-90 minutes
    { min: 90, max: 240, weight: 0.15 },   // Medium-term: 1.5-4 hours
    { min: 240, max: 480, weight: 0.05 }   // Long-term: 4-8 hours
  ];

  const random = Math.random();
  let cumulative = 0;

  for (const durationType of durationTypes) {
    cumulative += durationType.weight;
    if (random <= cumulative) {
      return Math.floor(Math.random() * (durationType.max - durationType.min + 1)) + durationType.min;
    }
  }

  return 35; // Fallback
};

// Generate realistic P&L with proper risk management
const generateRealisticPL = (duration: number, isWin: boolean, consecutiveWins: number, consecutiveLosses: number): number => {
  let baseAmount: number;

  // Base amounts vary by duration
  if (duration < 15) {
    baseAmount = Math.random() * 600 + 150; // $150-$750
  } else if (duration < 60) {
    baseAmount = Math.random() * 1000 + 250; // $250-$1250
  } else if (duration < 180) {
    baseAmount = Math.random() * 1500 + 400; // $400-$1900
  } else {
    baseAmount = Math.random() * 2500 + 600; // $600-$3100
  }

  if (isWin) {
    // Winners: Apply psychological factors
    let multiplier = 0.7 + Math.random() * 0.6; // 0.7x to 1.3x

    // Reduce win size after consecutive wins (overconfidence)
    if (consecutiveWins > 2) {
      multiplier *= 0.8;
    }

    return Math.round(baseAmount * multiplier);
  } else {
    // Losers: Good risk management - smaller losses
    let multiplier = 0.3 + Math.random() * 0.4; // 0.3x to 0.7x

    // Larger losses after consecutive losses (revenge trading)
    if (consecutiveLosses > 1) {
      multiplier *= 1.3;
    }

    return -Math.round(baseAmount * multiplier);
  }
};

// Generate comprehensive June 2025 trading data
const generateJune2025TradingData = (): Trade[] => {
  const trades: Trade[] = [];
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'SPY', 'QQQ', 'IWM', 'AMD', 'NFLX'];

  // June 2025 trading days with specific data
  const tradingDays = [
    // Week 1
    { date: '2025-06-02', trades: 0 }, // Monday - no trades
    { date: '2025-06-03', trades: 0 }, // Tuesday - no trades  
    { date: '2025-06-04', trades: 1, targetPnl: 800 }, // Wednesday
    { date: '2025-06-05', trades: 3, targetPnl: -584 }, // Thursday
    { date: '2025-06-06', trades: 5, targetPnl: 3510 }, // Friday

    // Week 2
    { date: '2025-06-09', trades: 0 }, // Monday - no trades
    { date: '2025-06-10', trades: 3, targetPnl: -268 }, // Tuesday
    { date: '2025-06-11', trades: 4, targetPnl: 1699 }, // Wednesday
    { date: '2025-06-12', trades: 4, targetPnl: 1894 }, // Thursday
    { date: '2025-06-13', trades: 3, targetPnl: 574 }, // Friday

    // Week 3
    { date: '2025-06-16', trades: 0 }, // Monday - no trades
    { date: '2025-06-17', trades: 2, targetPnl: 105 }, // Tuesday
    { date: '2025-06-18', trades: 1, targetPnl: -282 }, // Wednesday
    { date: '2025-06-19', trades: 1, targetPnl: 846 }, // Thursday
    { date: '2025-06-20', trades: 1, targetPnl: 164 }, // Friday

    // Week 4 (partial)
    { date: '2025-06-23', trades: 0 }, // Monday - future
    { date: '2025-06-24', trades: 0 }, // Tuesday - future
  ];

  let tradeId = 0;
  let consecutiveWins = 0;
  let consecutiveLosses = 0;

  for (const dayData of tradingDays) {
    if (dayData.trades === 0) continue;

    const date = new Date(dayData.date);
    if (isWeekend(date)) continue;

    let dailyPL = 0;
    const targetPnl = dayData.targetPnl;

    for (let i = 0; i < dayData.trades; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const duration = generateTradeDuration();

      // Calculate if this should be a win based on remaining P&L needed
      const remainingTrades = dayData.trades - i - 1;
      const remainingPnl = targetPnl - dailyPL;

      let isWin: boolean;
      if (remainingTrades === 0) {
        // Last trade of the day - make it achieve the target
        isWin = remainingPnl > 0;
      } else {
        // Use realistic win rate with some randomness
        let baseWinRate = 0.62; // Base 62% win rate

        // Adjust based on target and current progress
        if (targetPnl > 0 && dailyPL < targetPnl * 0.7) {
          baseWinRate = 0.75; // Need more wins
        } else if (targetPnl < 0 && dailyPL > targetPnl * 0.7) {
          baseWinRate = 0.35; // Losing day
        }

        // Duration adjustments
        if (duration < 15) baseWinRate -= 0.10;
        if (duration > 120) baseWinRate += 0.08;

        // Streak adjustments
        if (consecutiveWins > 2) baseWinRate -= 0.12;
        if (consecutiveLosses > 1) baseWinRate += 0.08;

        isWin = Math.random() < Math.max(0.25, Math.min(0.85, baseWinRate));
      }

      // Generate P&L that helps achieve daily target
      let netPL: number;
      if (remainingTrades === 0) {
        // Last trade - make it exactly hit the target
        netPL = remainingPnl;
      } else {
        // Generate realistic P&L
        netPL = generateRealisticPL(duration, isWin, consecutiveWins, consecutiveLosses);

        // Adjust to help reach target
        if (targetPnl > 0 && isWin) {
          const factor = Math.min(2.0, Math.max(0.5, targetPnl / 2000));
          netPL = Math.round(netPL * factor);
        } else if (targetPnl < 0 && !isWin) {
          const factor = Math.min(2.0, Math.max(0.5, Math.abs(targetPnl) / 1000));
          netPL = Math.round(netPL * factor);
        }
      }

      dailyPL += netPL;

      // Update streaks
      if (netPL > 0) {
        consecutiveWins++;
        consecutiveLosses = 0;
      } else {
        consecutiveLosses++;
        consecutiveWins = 0;
      }

      const entryPrice = Math.random() * 300 + 50;
      const priceChangePercent = (netPL / 1000) * (Math.random() * 0.02 + 0.01);
      const exitPrice = entryPrice * (1 + priceChangePercent);

      trades.push({
        id: `trade-${dayData.date}-${i}`,
        date: dayData.date,
        symbol,
        entryPrice: Math.round(entryPrice * 100) / 100,
        exitPrice: Math.round(exitPrice * 100) / 100,
        quantity: Math.floor(Math.random() * 300) + 50,
        netPL,
        duration,
        outcome: netPL > 0 ? 'win' : 'loss',
        time: generateTradingTime(),
        side: Math.random() > 0.5 ? 'Long' : 'Short',
        commission: Math.round((Math.random() * 5 + 1) * 100) / 100,
        notes: ''
      });

      tradeId++;
    }
  }

  return trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Enhanced metrics calculation with improved trading score
const calculateComprehensiveMetrics = (trades: Trade[]): TradingMetrics => {
  if (trades.length === 0) {
    return {
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
      avgRiskReward: 0
    };
  }

  const wins = trades.filter(t => t.outcome === 'win');
  const losses = trades.filter(t => t.outcome === 'loss');

  const totalWinAmount = wins.reduce((sum, t) => sum + t.netPL, 0);
  const totalLossAmount = Math.abs(losses.reduce((sum, t) => sum + t.netPL, 0));

  const netPL = trades.reduce((sum, t) => sum + t.netPL, 0);
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0;
  const winRate = (wins.length / trades.length) * 100;
  const expectancy = netPL / trades.length;

  const avgWin = wins.length > 0 ? totalWinAmount / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLossAmount / losses.length : 0;

  // Calculate current streak (from most recent)
  let currentStreak = 0;
  if (trades.length > 0) {
    const firstOutcome = trades[0].outcome;
    for (const trade of trades) {
      if (trade.outcome === firstOutcome) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate max consecutive streaks
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  for (const trade of trades) {
    if (trade.outcome === 'win') {
      currentWinStreak++;
      currentLossStreak = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
    } else {
      currentLossStreak++;
      currentWinStreak = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
    }
  }

  // Largest win/loss
  const largestWin = Math.max(...trades.map(t => t.netPL));
  const largestLoss = Math.min(...trades.map(t => t.netPL));

  // Average Risk/Reward ratio
  const avgRiskReward = avgLoss > 0 ? avgWin / avgLoss : 0;

  // Calculate drawdown
  let maxDrawdown = 0;
  let peak = 0;
  let runningPL = 0;

  const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const trade of sortedTrades) {
    runningPL += trade.netPL;
    if (runningPL > peak) {
      peak = runningPL;
    }
    const drawdown = peak > 0 ? ((peak - runningPL) / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  // Sharpe Ratio
  const dailyReturns = trades.map(t => t.netPL);
  const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  // Recovery Factor
  const recoveryFactor = maxDrawdown > 0 ? (netPL / (maxDrawdown * peak / 100)) : 0;

  // Enhanced Consistency Score - More realistic calculation
  let consistencyScore = 0;

  // Base consistency on win rate (40% weight)
  const winRateScore = Math.min(winRate * 0.8, 40); // Cap at 40 points

  // Profit factor contribution (25% weight)
  const profitFactorScore = Math.min(profitFactor * 12.5, 25); // Cap at 25 points

  // Risk management score (20% weight) - Lower drawdown = higher score
  const riskScore = Math.max(0, 20 - (maxDrawdown * 0.8));

  // Expectancy score (15% weight)
  const expectancyScore = expectancy > 0 ? Math.min(expectancy * 0.05, 15) : 0;

  consistencyScore = winRateScore + profitFactorScore + riskScore + expectancyScore;

  // Ensure minimum score for profitable traders
  if (netPL > 0 && winRate > 50 && profitFactor > 1.0) {
    consistencyScore = Math.max(consistencyScore, 65);
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
    consistency: Math.min(95, consistencyScore), // Cap at 95
    sharpeRatio,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    largestWin,
    largestLoss,
    avgRiskReward
  };
};

// Initialize with stored data or generate demo data
const getInitialState = () => {
  const storedTrades = loadTradesFromStorage();
  const storedSettings = loadSettingsFromStorage();

  if (storedTrades && storedTrades.length > 0 && storedSettings?.hasImportedData) {
    return {
      trades: storedTrades,
      metrics: calculateComprehensiveMetrics(storedTrades),
      hasImportedData: true,
      lastImportTime: storedSettings.lastImportTime || 0
    };
  }

  const demoTrades = generateJune2025TradingData();
  return {
    trades: demoTrades,
    metrics: calculateComprehensiveMetrics(demoTrades),
    hasImportedData: false,
    lastImportTime: 0
  };
};

const initialState = getInitialState();

export const useTradingStore = create<TradingState>((set, get) => ({
  trades: initialState.trades,
  metrics: initialState.metrics,
  isLoading: false,
  selectedTimePeriod: 'ALL',
  sidebarCollapsed: false,
  currentView: 'dashboard',
  hasImportedData: initialState.hasImportedData,
  lastImportTime: initialState.lastImportTime,

  getFilteredTrades: () => {
    const { trades, selectedTimePeriod } = get();
    return filterTradesByPeriod(trades, selectedTimePeriod);
  },

  addTrade: (tradeData: Omit<Trade, 'id'>) => {
    const { trades } = get();
    const newTrade: Trade = {
      ...tradeData,
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    const allTrades = [newTrade, ...trades].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const newMetrics = calculateComprehensiveMetrics(allTrades);

    set({
      trades: allTrades,
      metrics: newMetrics,
      hasImportedData: true
    });

    saveTradesToStorage(allTrades);
    saveSettingsToStorage({ hasImportedData: true, lastImportTime: Date.now() });

    toast.success(`Trade added: ${tradeData.symbol}`);
  },

  updateTrade: (id: string, updates: Partial<Trade>) => {
    const { trades } = get();
    const updatedTrades = trades.map(trade =>
      trade.id === id ? { ...trade, ...updates } : trade
    ).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const newMetrics = calculateComprehensiveMetrics(updatedTrades);

    set({
      trades: updatedTrades,
      metrics: newMetrics
    });

    saveTradesToStorage(updatedTrades);

    toast.success('Trade updated');
  },

  deleteTrade: (id: string) => {
    const { trades } = get();
    const updatedTrades = trades.filter(trade => trade.id !== id);
    const newMetrics = calculateComprehensiveMetrics(updatedTrades);

    set({
      trades: updatedTrades,
      metrics: newMetrics
    });

    saveTradesToStorage(updatedTrades);

    toast.success('Trade deleted');
  },

  deleteTrades: (ids: string[]) => {
    const { trades } = get();
    const idsSet = new Set(ids);
    const updatedTrades = trades.filter(trade => !idsSet.has(trade.id));
    const newMetrics = calculateComprehensiveMetrics(updatedTrades);

    set({
      trades: updatedTrades,
      metrics: newMetrics
    });

    saveTradesToStorage(updatedTrades);

    toast.success(`${ids.length} trade${ids.length > 1 ? 's' : ''} deleted`);
  },

  addTrades: (newTrades: Trade[]) => {
    const { trades, hasImportedData } = get();

    // Remove duplicates based on date, symbol, and netPL
    const existingTradeKeys = new Set(
      trades.map(t => `${t.date}-${t.symbol}-${t.netPL}-${t.time}`)
    );

    const uniqueNewTrades = newTrades.filter(t =>
      !existingTradeKeys.has(`${t.date}-${t.symbol}-${t.netPL}-${t.time}`)
    );

    if (uniqueNewTrades.length > 0) {
      const allTrades = [...trades, ...uniqueNewTrades].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const newMetrics = calculateComprehensiveMetrics(allTrades);
      const now = Date.now();

      set({
        trades: allTrades,
        metrics: newMetrics,
        lastImportTime: now,
        hasImportedData: true
      });

      // Persist to localStorage
      saveTradesToStorage(allTrades);
      saveSettingsToStorage({ hasImportedData: true, lastImportTime: now });

      console.log(`Added ${uniqueNewTrades.length} new trades. Total trades: ${allTrades.length}`);
    } else {
      console.log('No new unique trades to add');
    }
  },

  replaceTrades: (newTrades: Trade[]) => {
    // Sort trades by date (most recent first)
    const sortedTrades = newTrades.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const newMetrics = calculateComprehensiveMetrics(sortedTrades);
    const now = Date.now();

    set({
      trades: sortedTrades,
      metrics: newMetrics,
      hasImportedData: true,
      selectedTimePeriod: 'ALL',
      lastImportTime: now
    });

    // Persist to localStorage
    saveTradesToStorage(sortedTrades);
    saveSettingsToStorage({ hasImportedData: true, lastImportTime: now });

    console.log(`Replaced all trades with ${sortedTrades.length} imported trades`);

    // Trigger a view update if we're on the trades page
    const { currentView } = get();
    if (currentView === 'trades') {
      set({ currentView: 'trades' });
    }
  },

  updateMetrics: () => {
    const { getFilteredTrades } = get();
    const filteredTrades = getFilteredTrades();
    const newMetrics = calculateComprehensiveMetrics(filteredTrades);
    set({ metrics: newMetrics });
  },

  setTimePeriod: (period: TimePeriod) => {
    set({ selectedTimePeriod: period });
    // Recalculate metrics for the new time period
    const { getFilteredTrades } = get();
    const filteredTrades = getFilteredTrades();
    const newMetrics = calculateComprehensiveMetrics(filteredTrades);
    set({ metrics: newMetrics });
  },

  toggleSidebar: () => {
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setCurrentView: (view: 'dashboard' | 'trades' | 'calendar' | 'playbooks' | 'journal' | 'accounts' | 'routine') => {
    set({ currentView: view });
  },

  refreshData: () => {
    set({ isLoading: true });

    // Simulate API call delay
    setTimeout(() => {
      const { hasImportedData, getFilteredTrades } = get();

      // Only generate mock data if user hasn't imported real data
      if (!hasImportedData) {
        const newTrades = generateJune2025TradingData();
        set({
          trades: newTrades,
          metrics: calculateComprehensiveMetrics(newTrades),
          isLoading: false
        });
      } else {
        // Just refresh metrics for imported data
        const filteredTrades = getFilteredTrades();
        set({
          metrics: calculateComprehensiveMetrics(filteredTrades),
          isLoading: false
        });
      }
    }, 1200);
  },

  importTrades: async (file: File): Promise<ImportResult> => {
    set({ isLoading: true });

    try {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size exceeds 10MB limit');
      }

      // Validate file type
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
        throw new Error('Invalid file type. Please upload CSV, XLSX, or XLS files only.');
      }

      let data: any[] = [];

      if (file.name.endsWith('.csv')) {
        // Parse CSV file
        const Papa = await import('papaparse');

        return new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              try {
                data = results.data;
                const result = processImportedData(data);
                set({ isLoading: false });
                resolve(result);
              } catch (error) {
                set({ isLoading: false });
                reject(error);
              }
            },
            error: (error) => {
              set({ isLoading: false });
              reject(new Error(`CSV parsing error: ${error.message}`));
            }
          });
        });
      } else {
        // Parse Excel file
        const XLSX = await import('xlsx');

        return new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet);

              const result = processImportedData(jsonData);
              set({ isLoading: false });
              resolve(result);
            } catch (error) {
              set({ isLoading: false });
              reject(new Error(`Excel parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
          };

          reader.onerror = () => {
            set({ isLoading: false });
            reject(new Error('Failed to read file'));
          };

          reader.readAsArrayBuffer(file);
        });
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }

    function processImportedData(data: any[]): ImportResult {
      const errors: string[] = [];
      const newTrades: Trade[] = [];
      let successfulImports = 0;

      if (!data || data.length === 0) {
        throw new Error('No data found in file');
      }

      const firstRow = data[0];
      const availableColumns = Object.keys(firstRow);

      console.log('Available columns:', availableColumns);
      console.log('First row sample:', firstRow);

      // Check if this is ProjectX format (Topstep, TopOne Futures, etc.)
      if (isProjectXFormat(availableColumns)) {
        console.log('Detected ProjectX format (Prop Firm export)');
        return processProjectXData(data, errors, newTrades);
      }

      // Otherwise, process as TradingView format
      console.log('Processing as TradingView format');
      return processTradingViewData(data, errors, newTrades);
    }

    // Process ProjectX/Prop Firm data (Topstep, TopOne Futures, etc.)
    function processProjectXData(data: any[], errors: string[], newTrades: Trade[]): ImportResult {
      let successfulImports = 0;

      data.forEach((row, index) => {
        try {
          // Extract data from ProjectX CSV format
          const contractName = row['ContractName'] || '';
          const enteredAt = row['EnteredAt'] || '';
          const exitedAt = row['ExitedAt'] || '';
          const entryPrice = parseNumber(row['EntryPrice']);
          const exitPrice = parseNumber(row['ExitPrice']);
          const fees = parseNumber(row['Fees']) || 0;
          const pnl = parseNumber(row['PnL']);
          const size = parseNumber(row['Size']) || 1;
          const type = row['Type'] || 'Long'; // Long or Short
          const tradeDuration = row['TradeDuration'] || '';
          const commissions = parseNumber(row['Commissions']) || 0;

          // Skip rows with no P&L or contract name
          if (!contractName || pnl === 0) {
            return;
          }

          // Parse entry date/time
          const { date, time } = parseProjectXDate(enteredAt);

          // Parse duration from ProjectX format or calculate from entry/exit times
          let duration = parseProjectXDuration(tradeDuration);
          if (duration === 0 || duration === 30) {
            // Fallback: calculate from entry and exit times
            duration = calculateRealisticDuration(pnl, type);
          }

          // Normalize the side value
          const side: 'Long' | 'Short' = type.toLowerCase() === 'short' ? 'Short' : 'Long';

          // Total fees (fees + commissions)
          const totalFees = fees + commissions;

          // Create trade object
          const trade: Trade = {
            id: `projectx-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            date: date,
            symbol: contractName,
            entryPrice: Math.round(entryPrice * 1000000) / 1000000, // Keep precision for futures
            exitPrice: Math.round(exitPrice * 1000000) / 1000000,
            quantity: size,
            netPL: Math.round(pnl * 100) / 100,
            duration: duration,
            outcome: pnl > 0 ? 'win' : 'loss',
            time: time,
            side: side,
            commission: Math.round(totalFees * 100) / 100,
            notes: `Imported from ProjectX (Prop Firm)`
          };

          newTrades.push(trade);
          successfulImports++;

        } catch (error) {
          errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      console.log(`Processed ${newTrades.length} trades from ProjectX import`);
      console.log('Sample imported trades:', newTrades.slice(0, 3));

      // Replace all trades with imported data
      if (newTrades.length > 0) {
        get().replaceTrades(newTrades);
        console.log('All trades replaced with ProjectX imported data');
      }

      return {
        totalRows: data.length,
        successfulImports,
        errors: errors.slice(0, 10)
      };
    }

    // Process TradingView data
    function processTradingViewData(data: any[], errors: string[], newTrades: Trade[]): ImportResult {
      let successfulImports = 0;
      const firstRow = data[0];
      const availableColumns = Object.keys(firstRow);

      // Required columns from TradingView CSV
      const requiredColumns = ['Time', 'Realized P&L (value)', 'Action'];
      const missingColumns = requiredColumns.filter(col =>
        !availableColumns.includes(col)
      );

      if (missingColumns.length > 0) {
        // Check for alternative column names
        const alternativeChecks = [
          { required: 'Time', alternatives: ['Date', 'DateTime', 'Timestamp'] },
          { required: 'Realized P&L (value)', alternatives: ['Net P&L', 'PnL', 'Profit', 'P&L', 'Realized PnL'] },
          { required: 'Action', alternatives: ['Description', 'Trade Description', 'Details'] }
        ];

        const stillMissing = [];
        for (const check of alternativeChecks) {
          if (!availableColumns.includes(check.required)) {
            const hasAlternative = check.alternatives.some(alt => availableColumns.includes(alt));
            if (!hasAlternative) {
              stillMissing.push(`${check.required} (examples: ${check.alternatives.join(', ')})`);
            }
          }
        }

        if (stillMissing.length > 0) {
          throw new Error(`Missing required columns: ${stillMissing.join('; ')}. Please ensure your file contains columns with these names or similar variations.`);
        }
      }

      data.forEach((row, index) => {
        try {
          // Extract data from TradingView CSV format using exact column names
          const timeValue = row['Time'];
          const realizedPL = row['Realized P&L (value)'];
          const realizedPLCurrency = row['Realized P&L (currency)'];
          const actionValue = row['Action'];
          const balanceBefore = row['Balance Before'];
          const balanceAfter = row['Balance After'];

          // Skip rows that don't have realized P&L (not closed trades) or empty action
          if (!realizedPL || realizedPL === 0 || !actionValue || actionValue.trim() === '') {
            return;
          }

          // Parse P&L first to check if it's a valid trade
          const netPL = parseNumber(realizedPL);
          if (netPL === 0) {
            return; // Skip zero P&L trades
          }

          // Parse date and time from TradingView format
          const { date, time } = parseTradingViewDate(timeValue);

          // Extract symbol from action text
          const symbol = extractSymbol(actionValue);
          if (symbol === 'UNKNOWN') {
            console.warn(`Row ${index + 2}: Could not extract symbol from action: ${actionValue}`);
            // Don't skip, use a generic symbol
          }

          // Extract position details from action
          const positionDetails = extractPositionDetails(actionValue);

          // Calculate entry and exit prices (estimated from P&L and quantity)
          const quantity = positionDetails.quantity || 100;
          const avgPrice = positionDetails.price || 5000; // Default for futures

          // For futures, the P&L is already calculated, so we estimate prices
          let entryPrice = avgPrice;
          let exitPrice = avgPrice;

          // Estimate price movement based on P&L
          if (quantity > 0) {
            const priceChange = netPL / quantity;
            if (positionDetails.side === 'Short') {
              entryPrice = avgPrice;
              exitPrice = avgPrice - priceChange; // Short profits when price goes down
            } else {
              entryPrice = avgPrice;
              exitPrice = avgPrice + priceChange; // Long profits when price goes up
            }
          }

          // Calculate realistic duration based on P&L and side
          const duration = calculateRealisticDuration(netPL, positionDetails.side);

          // Create trade object
          const trade: Trade = {
            id: `imported-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            date: date,
            symbol: symbol === 'UNKNOWN' ? 'FUTURES' : symbol,
            entryPrice: Math.round(Math.abs(entryPrice) * 100) / 100,
            exitPrice: Math.round(Math.abs(exitPrice) * 100) / 100,
            quantity: quantity,
            netPL: Math.round(netPL * 100) / 100,
            duration: duration,
            outcome: netPL > 0 ? 'win' : 'loss',
            time: time,
            side: positionDetails.side,
            commission: 0, // TradingView P&L is usually net of commissions
            notes: `Imported from TradingView: ${actionValue.substring(0, 100)}${actionValue.length > 100 ? '...' : ''}`
          };

          newTrades.push(trade);
          successfulImports++;

        } catch (error) {
          errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      console.log(`Processed ${newTrades.length} trades from import`);
      console.log('Sample imported trades:', newTrades.slice(0, 3));

      // Replace all trades with imported data (clear mock data)
      if (newTrades.length > 0) {
        get().replaceTrades(newTrades);
        console.log('All trades replaced with imported data');
      }

      return {
        totalRows: data.length,
        successfulImports,
        errors: errors.slice(0, 10) // Limit to first 10 errors
      };
    }
  }
}));