export type BotMode = 'dry-run' | 'live';
export type BotStatus = 'idle' | 'running' | 'paused' | 'halted';
export type TrendDirection = 'up' | 'down' | 'neutral';
export type RiskLayerStatus = 'ok' | 'warning' | 'breached';

export interface RiskLimits {
  dailyMaxLossPct: number;
  monthlyMaxLossPct: number;
  maxDrawdownPct: number;
  totalMaxLossPct: number;
}

export interface StrategyConfig {
  enabled: boolean;
  allocationPct: number;
}

export interface SmartMoneyConfig extends StrategyConfig {
  topN: number;
  minWinRate: number;
  minPnl: number;
  minTrades: number;
  minProfitFactor: number;
  minConsistencyScore: number;
  maxSingleTradeExposure: number;
  customWallets: string[];
}

export interface ArbitrageConfig extends StrategyConfig {
  profitThreshold: number;
  minTradeSize: number;
  maxTradeSize: number;
  autoExecute: boolean;
}

export interface DipArbConfig extends StrategyConfig {
  coins: string[];
  shares: number;
  sumTarget: number;
  autoRotate: boolean;
  minTradeValueUSD: number;
}

export interface DirectTradingConfig extends StrategyConfig {
  stopLossPct: number;
  takeProfitPct: number;
  maxHoldDays: number;
}

export interface BotConfig {
  capital: {
    totalUsd: number;
    maxPerTradePct: number;
    maxPerMarketPct: number;
    maxTotalExposurePct: number;
    minOrderUsd: number;
  };
  risk: RiskLimits & {
    enableDynamicSizing: boolean;
    minPositionPct: number;
    maxPositionPct: number;
    lossSizingReduction: number;
    winSizingIncrease: number;
  };
  strategies: {
    smartMoney: SmartMoneyConfig;
    arbitrage: ArbitrageConfig;
    dipArb: DipArbConfig;
    directTrading: DirectTradingConfig;
  };
  wallet: {
    privateKey: string;
    address: string;
  } | null;
}

export interface BotState {
  mode: BotMode;
  status: BotStatus;
  startTime: number | null;
  pauseUntil: number | null;

  // PnL tracking
  dailyPnL: number;
  monthlyPnL: number;
  totalPnL: number;
  peakCapital: number;
  currentCapital: number;
  currentDrawdown: number;

  // Streaks
  consecutiveLosses: number;
  consecutiveWins: number;

  // Trade counts
  tradesExecuted: number;
  smartMoneyTrades: number;
  arbTrades: number;
  dipArbTrades: number;
  directTrades: number;

  // Markets
  activeArbMarket: string | null;
  activeDipArbMarket: string | null;

  // Balances
  usdcBalance: number;
  maticBalance: number;

  // Trends
  btcTrend: TrendDirection;
  ethTrend: TrendDirection;
  solTrend: TrendDirection;

  // Logs
  logs: BotLogEntry[];
}

export interface BotLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'trade' | 'signal';
  message: string;
  data?: Record<string, unknown>;
}

export interface RiskStatus {
  daily: { used: number; limit: number; status: RiskLayerStatus };
  monthly: { used: number; limit: number; status: RiskLayerStatus };
  drawdown: { used: number; limit: number; status: RiskLayerStatus };
  total: { used: number; limit: number; status: RiskLayerStatus };
}

export interface MarketOpportunity {
  id: string;
  marketName: string;
  type: 'arbitrage' | 'dip' | 'trend';
  profitPotential: number;
  confidence: number;
  side: 'yes' | 'no' | 'both';
  price: number;
  volume24h: number;
}

export interface SmartMoneyWallet {
  address: string;
  rank: number;
  pnl: number;
  volume: number;
  winRate: number;
  profitFactor: number;
  consistencyScore: number;
  tradeCount: number;
  following: boolean;
}

export interface Position {
  id: string;
  marketName: string;
  side: 'yes' | 'no';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  openedAt: number;
}
