'use client';

import React, { useState } from 'react';
import { 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Activity,
  Zap,
  Eye,
  Play,
  BookOpen,
  Lightbulb,
  Shield,
  Timer,
  TrendingDown as Reversal,
  BarChart2
} from 'lucide-react';
import clsx from 'clsx';

interface PlaybookStrategy {
  id: string;
  name: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  timeframe: string;
  winRate: number;
  riskReward: string;
  marketCondition: string;
  overview: string;
  entryRules: string[];
  exitRules: string[];
  riskManagement: string[];
  examples: {
    title: string;
    description: string;
    setup: string;
    entry: string;
    exit: string;
    result: string;
  }[];
  tips: string[];
  commonMistakes: string[];
}

const tradingStrategies: PlaybookStrategy[] = [
  {
    id: 'support-resistance',
    name: 'Support & Resistance Trading',
    description: 'Trade bounces and breaks of key support and resistance levels with high probability setups',
    difficulty: 'Beginner',
    timeframe: '15m - 4H',
    winRate: 65,
    riskReward: '1:2',
    marketCondition: 'Trending & Range-bound',
    overview: 'Support and resistance trading is one of the most fundamental and reliable trading strategies. It\'s based on the principle that price tends to respect certain levels where buying or selling pressure has historically been strong. These levels act as psychological barriers where traders make decisions.',
    entryRules: [
      'Identify clear support/resistance levels with at least 3 touches',
      'Wait for price to approach the level with momentum',
      'Look for rejection signals: long wicks, doji candles, or reversal patterns',
      'Enter on the bounce with confirmation candle',
      'For breakouts: wait for clean break with volume and retest'
    ],
    exitRules: [
      'Take profit at next major support/resistance level',
      'Use trailing stop once in 1:1 profit',
      'Exit if price closes back through the level',
      'Scale out at 1:1 and 1:2 risk/reward ratios'
    ],
    riskManagement: [
      'Stop loss 10-20 pips beyond the support/resistance level',
      'Risk no more than 1-2% of account per trade',
      'Use proper position sizing based on stop distance',
      'Avoid trading during major news events'
    ],
    examples: [
      {
        title: 'Support Bounce Setup',
        description: 'EURUSD bouncing off daily support level',
        setup: 'Price approaching 1.0850 daily support level for the 4th time',
        entry: 'Long at 1.0855 after hammer candle formation',
        exit: 'Target 1.0920 resistance, stop at 1.0830',
        result: '+70 pips profit (1:2.8 R/R)'
      },
      {
        title: 'Resistance Breakout',
        description: 'GBPUSD breaking above weekly resistance',
        setup: 'Price consolidating below 1.2650 resistance for 2 weeks',
        entry: 'Long at 1.2655 on breakout with volume confirmation',
        exit: 'Target 1.2750, stop at 1.2620',
        result: '+95 pips profit (1:2.7 R/R)'
      }
    ],
    tips: [
      'The more times a level is tested, the stronger it becomes',
      'Look for confluence with moving averages, trendlines, or Fibonacci levels',
      'Best setups occur at round numbers (1.3000, 1.2500, etc.)',
      'Volume confirmation increases probability of successful breakouts',
      'Be patient - wait for clear signals rather than forcing trades'
    ],
    commonMistakes: [
      'Entering too early without confirmation',
      'Placing stops too close to the level',
      'Trading weak levels with only 1-2 touches',
      'Ignoring overall market trend direction',
      'Not waiting for proper risk/reward setups'
    ]
  },
  {
    id: 'orb',
    name: 'Opening Range Breakout (ORB)',
    description: 'Capture momentum moves by trading breakouts of the first 30-60 minutes of market open',
    difficulty: 'Intermediate',
    timeframe: '5m - 15m',
    winRate: 58,
    riskReward: '1:3',
    marketCondition: 'High volatility sessions',
    overview: 'The Opening Range Breakout (ORB) strategy capitalizes on the increased volatility and momentum that occurs during the first hour of major market sessions. It\'s based on the principle that significant moves often begin with a breakout from the opening range, especially when there\'s overnight news or market sentiment shifts.',
    entryRules: [
      'Define opening range: first 30-60 minutes of NY/London session',
      'Mark the high and low of this range clearly',
      'Wait for a clean breakout above high or below low',
      'Enter immediately on breakout with market order',
      'Confirm with volume spike (if available) and momentum'
    ],
    exitRules: [
      'Initial target: 2-3x the opening range height',
      'Trail stop to breakeven once 1:1 is reached',
      'Exit if price returns to opening range',
      'Take partial profits at key resistance/support levels'
    ],
    riskManagement: [
      'Stop loss: opposite side of opening range + 5-10 pips',
      'Risk 1-2% of account per trade maximum',
      'Avoid trading on low volatility days',
      'Don\'t trade if opening range is too wide (>50 pips major pairs)'
    ],
    examples: [
      {
        title: 'EURUSD Morning Breakout',
        description: 'Strong upward breakout during London open',
        setup: 'Opening range 1.0850-1.0880 (30 pips) during London session',
        entry: 'Long at 1.0882 on breakout above range high',
        exit: 'Target 1.0940 (2x range), stop at 1.0845',
        result: '+58 pips profit (1:1.9 R/R)'
      },
      {
        title: 'GBPJPY Volatility Play',
        description: 'News-driven breakout during NY session',
        setup: 'Opening range 185.20-185.80 (60 pips) with BOE news pending',
        entry: 'Short at 185.15 on breakdown below range low',
        exit: 'Target 184.00 (2x range), stop at 185.85',
        result: '+115 pips profit (1:1.8 R/R)'
      }
    ],
    tips: [
      'Best results during high-impact news sessions',
      'London (8-9 AM GMT) and NY (1-2 PM GMT) opens are most reliable',
      'Smaller opening ranges often lead to bigger breakouts',
      'Watch for false breakouts - wait for momentum confirmation',
      'Combine with overall daily/weekly trend direction for higher probability'
    ],
    commonMistakes: [
      'Trading every breakout without considering market conditions',
      'Using too wide opening ranges (>1 hour)',
      'Not waiting for momentum confirmation',
      'Placing stops too tight relative to volatility',
      'Trading during low-volume holiday sessions'
    ]
  },
  {
    id: 'vwap',
    name: 'VWAP Trading Strategy',
    description: 'Trade around the Volume Weighted Average Price for institutional-level entries and exits',
    difficulty: 'Intermediate',
    timeframe: '5m - 1H',
    winRate: 72,
    riskReward: '1:2.5',
    marketCondition: 'Trending markets',
    overview: 'VWAP (Volume Weighted Average Price) is the average price weighted by volume, showing where institutions are likely to enter and exit positions. It acts as dynamic support/resistance and provides high-probability reversal points. Professional traders use VWAP as a benchmark for execution quality.',
    entryRules: [
      'Wait for price to approach VWAP line with momentum',
      'Look for rejection at VWAP: long wicks, doji, or reversal patterns',
      'Enter long above VWAP when price bounces with volume',
      'Enter short below VWAP when price rejects with volume',
      'Confirm with overall trend direction for higher probability'
    ],
    exitRules: [
      'Take profit at next significant level or VWAP bands',
      'Trail stop using VWAP as dynamic support/resistance',
      'Exit if price closes decisively through VWAP against position',
      'Scale out at 1:1.5 and 1:2.5 risk/reward levels'
    ],
    riskManagement: [
      'Stop loss 15-25 pips beyond VWAP depending on volatility',
      'Risk 1-2% of account per trade',
      'Avoid trading during low volume periods (lunch hours)',
      'Don\'t trade VWAP during major news events'
    ],
    examples: [
      {
        title: 'VWAP Bounce Long',
        description: 'AAPL bouncing off VWAP during uptrend',
        setup: 'AAPL in strong uptrend, price pulling back to VWAP at $150.25',
        entry: 'Long at $150.30 after hammer candle at VWAP',
        exit: 'Target $152.50 (upper VWAP band), stop at $149.75',
        result: '+$2.20 profit (1:2.4 R/R)'
      },
      {
        title: 'VWAP Rejection Short',
        description: 'TSLA rejecting VWAP resistance in downtrend',
        setup: 'TSLA in downtrend, price rallying to VWAP resistance at $185.50',
        entry: 'Short at $185.40 after shooting star at VWAP',
        exit: 'Target $182.00 (lower VWAP band), stop at $186.25',
        result: '+$3.40 profit (1:2.8 R/R)'
      }
    ],
    tips: [
      'VWAP is most effective during the first 2-3 hours of trading',
      'Look for confluence with other technical levels for best setups',
      'Volume spikes at VWAP often indicate institutional activity',
      'VWAP bands (standard deviations) provide additional targets',
      'Works best on liquid stocks and major forex pairs'
    ],
    commonMistakes: [
      'Trading VWAP during low volume periods',
      'Ignoring the overall trend direction',
      'Not waiting for proper rejection signals',
      'Using VWAP on illiquid instruments',
      'Placing stops too close to VWAP line'
    ]
  },
  {
    id: 'breakout',
    name: 'Momentum Breakout Trading',
    description: 'Capture explosive moves by trading breakouts from consolidation patterns with volume confirmation',
    difficulty: 'Intermediate',
    timeframe: '15m - 4H',
    winRate: 62,
    riskReward: '1:3',
    marketCondition: 'Volatile trending markets',
    overview: 'Momentum breakout trading focuses on capturing explosive price movements when an asset breaks out of a consolidation pattern. This strategy works on the principle that periods of low volatility are often followed by periods of high volatility, creating significant profit opportunities for prepared traders.',
    entryRules: [
      'Identify clear consolidation patterns: triangles, rectangles, flags',
      'Wait for volume to dry up during consolidation phase',
      'Enter on breakout with 2x average volume confirmation',
      'Ensure breakout occurs with strong momentum candle',
      'Confirm breakout direction aligns with overall trend'
    ],
    exitRules: [
      'Initial target: height of pattern projected from breakout point',
      'Trail stop using 20-period EMA or pattern support/resistance',
      'Take partial profits at 1:2 and let remainder run',
      'Exit if price returns to consolidation range'
    ],
    riskManagement: [
      'Stop loss: opposite side of consolidation pattern',
      'Risk 1.5-2% of account per trade',
      'Avoid trading breakouts during major news events',
      'Don\'t chase breakouts that are already extended'
    ],
    examples: [
      {
        title: 'Bull Flag Breakout',
        description: 'NVDA breaking out of bull flag pattern',
        setup: 'NVDA consolidating in bull flag after 15% rally, volume declining',
        entry: 'Long at $425 on breakout with 3x volume',
        exit: 'Target $445 (flag height), stop at $415',
        result: '+$20 profit (1:2.0 R/R)'
      },
      {
        title: 'Triangle Breakout',
        description: 'EURUSD breaking ascending triangle',
        setup: 'EURUSD forming ascending triangle over 2 weeks at 1.0950',
        entry: 'Long at 1.0955 on breakout with momentum',
        exit: 'Target 1.1050 (triangle height), stop at 1.0920',
        result: '+95 pips profit (1:2.7 R/R)'
      }
    ],
    tips: [
      'The longer the consolidation, the bigger the potential breakout',
      'Volume confirmation is crucial - avoid low volume breakouts',
      'Best breakouts occur in direction of prevailing trend',
      'Wait for retest of breakout level for safer entry',
      'Use multiple timeframes to confirm pattern validity'
    ],
    commonMistakes: [
      'Chasing breakouts without volume confirmation',
      'Trading against the overall trend direction',
      'Not waiting for proper consolidation to form',
      'Placing stops too close to breakout level',
      'Entering on false breakouts without momentum'
    ]
  },
  {
    id: 'mean-reversion',
    name: 'Mean Reversion Strategy',
    description: 'Profit from price returning to average levels using RSI and Bollinger Bands for precise entries',
    difficulty: 'Advanced',
    timeframe: '1H - Daily',
    winRate: 68,
    riskReward: '1:2',
    marketCondition: 'Range-bound & oversold/overbought',
    overview: 'Mean reversion trading is based on the statistical principle that prices tend to return to their average over time. This strategy identifies when an asset has moved too far from its mean and positions for a return to normal levels. It requires patience and precise timing but can be highly profitable in ranging markets.',
    entryRules: [
      'RSI must be below 30 (oversold) for long or above 70 (overbought) for short',
      'Price must touch or exceed Bollinger Band extremes',
      'Look for divergence between price and RSI for confirmation',
      'Enter on first sign of reversal: hammer, doji, or engulfing pattern',
      'Ensure overall market is not in strong trending phase'
    ],
    exitRules: [
      'Take profit when RSI returns to 50 (neutral zone)',
      'Exit when price reaches Bollinger Band middle line (20 SMA)',
      'Use trailing stop once RSI crosses back through 50',
      'Scale out at 1:1 and 1:2 risk/reward ratios'
    ],
    riskManagement: [
      'Stop loss beyond recent swing high/low',
      'Risk no more than 1% of account per trade',
      'Avoid during strong trending markets or news events',
      'Don\'t trade if RSI shows continued momentum'
    ],
    examples: [
      {
        title: 'Oversold Bounce',
        description: 'AAPL oversold bounce from Bollinger Band',
        setup: 'AAPL RSI at 25, price touching lower Bollinger Band at $145',
        entry: 'Long at $145.50 after hammer candle formation',
        exit: 'Target $150 (middle BB), stop at $143',
        result: '+$4.50 profit (1:1.8 R/R)'
      },
      {
        title: 'Overbought Reversal',
        description: 'EURUSD overbought reversal at resistance',
        setup: 'EURUSD RSI at 78, price at upper Bollinger Band 1.1050',
        entry: 'Short at 1.1045 after shooting star pattern',
        exit: 'Target 1.0980 (middle BB), stop at 1.1070',
        result: '+65 pips profit (1:2.6 R/R)'
      }
    ],
    tips: [
      'Works best in ranging or sideways trending markets',
      'Combine RSI with Bollinger Bands for higher probability',
      'Look for bullish/bearish divergence to confirm reversals',
      'Be patient - wait for extreme readings before entering',
      'Use multiple timeframes to confirm mean reversion setup'
    ],
    commonMistakes: [
      'Trading mean reversion in strong trending markets',
      'Entering too early without proper reversal signals',
      'Not waiting for RSI extreme readings (below 30/above 70)',
      'Ignoring overall market sentiment and news',
      'Using too tight stops that get hit by normal volatility'
    ]
  },
  {
    id: 'trend-following',
    name: 'Trend Following Strategy',
    description: 'Ride major trends using moving average crossovers and momentum indicators for sustained profits',
    difficulty: 'Beginner',
    timeframe: '4H - Daily',
    winRate: 55,
    riskReward: '1:4',
    marketCondition: 'Strong trending markets',
    overview: 'Trend following is one of the most profitable long-term trading strategies. It\'s based on the principle that "the trend is your friend" and focuses on capturing large portions of major price movements. While win rates may be lower, the large winners more than compensate for smaller losses.',
    entryRules: [
      'Wait for 20 EMA to cross above 50 EMA for uptrend (or below for downtrend)',
      'Price must be above both moving averages for long entries',
      'MACD must be positive and rising for long entries',
      'Enter on pullback to 20 EMA with bounce confirmation',
      'Ensure overall market sentiment supports trend direction'
    ],
    exitRules: [
      'Exit when 20 EMA crosses back below 50 EMA',
      'Use trailing stop at 20 EMA or recent swing low/high',
      'Take partial profits at major resistance/support levels',
      'Hold core position until trend clearly reverses'
    ],
    riskManagement: [
      'Stop loss below recent swing low (long) or above swing high (short)',
      'Risk 1-2% of account per trade',
      'Position size smaller due to wider stops',
      'Don\'t trade against major trend direction'
    ],
    examples: [
      {
        title: 'EURUSD Uptrend',
        description: 'Riding major EURUSD uptrend for 6 weeks',
        setup: '20 EMA crosses above 50 EMA, MACD positive at 1.0850',
        entry: 'Long at 1.0875 on pullback to 20 EMA',
        exit: 'Partial at 1.1200, final exit at 1.1350 on EMA cross',
        result: '+475 pips profit (1:3.8 R/R)'
      },
      {
        title: 'AAPL Downtrend',
        description: 'Capturing AAPL bear market decline',
        setup: '20 EMA below 50 EMA, MACD negative at $175',
        entry: 'Short at $172 on bounce to 20 EMA resistance',
        exit: 'Cover at $145 when trend shows signs of reversal',
        result: '+$27 profit (1:4.5 R/R)'
      }
    ],
    tips: [
      'Patience is key - wait for clear trend establishment',
      'Use multiple timeframes to confirm trend direction',
      'Don\'t try to pick tops and bottoms - follow the trend',
      'Trail stops to lock in profits as trend progresses',
      'Focus on major currency pairs and liquid stocks'
    ],
    commonMistakes: [
      'Trying to catch falling knives or pick tops',
      'Using stops that are too tight for trend following',
      'Not being patient enough for trends to develop',
      'Trading against the major trend direction',
      'Taking profits too early instead of letting winners run'
    ]
  }
];

export const Playbooks: React.FC = () => {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'examples' | 'tips'>('overview');

  if (selectedStrategy) {
    const strategy = tradingStrategies.find(s => s.id === selectedStrategy);
    if (!strategy) return null;

    return (
      <div 
        className="rounded-xl border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
        style={{
          background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
        }}
      >
        {/* Gradient border on hover */}
        <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
          <div 
            className="w-full h-full rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
            }}
          />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="p-6 border-b border-[#1F2937]">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setSelectedStrategy(null)}
                className="flex items-center space-x-2 text-[#8B94A7] hover:text-[#E5E7EB] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Back to Strategies</span>
              </button>
            </div>

            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <h1 className="text-3xl font-bold text-[#E5E7EB]">{strategy.name}</h1>
                  <span className={clsx(
                    'px-3 py-1 rounded-full text-sm font-medium border',
                    strategy.difficulty === 'Beginner' 
                      ? 'bg-[#3BF68A]/20 text-[#3BF68A] border-[#3BF68A]/30'
                      : strategy.difficulty === 'Intermediate'
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30'
                      : 'bg-[#F45B69]/20 text-[#F45B69] border-[#F45B69]/30'
                  )}>
                    {strategy.difficulty}
                  </span>
                </div>
                <p className="text-[#8B94A7] text-lg mb-4">{strategy.description}</p>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-sm text-[#8B94A7] mb-1">Win Rate</div>
                    <div className="text-xl font-bold text-[#3BF68A]">{strategy.winRate}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-[#8B94A7] mb-1">Risk/Reward</div>
                    <div className="text-xl font-bold text-[#E5E7EB]">{strategy.riskReward}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-[#8B94A7] mb-1">Timeframe</div>
                    <div className="text-xl font-bold text-[#E5E7EB]">{strategy.timeframe}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-[#8B94A7] mb-1">Market Condition</div>
                    <div className="text-sm font-medium text-[#E5E7EB]">{strategy.marketCondition}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: BookOpen },
                { id: 'rules', label: 'Trading Rules', icon: Target },
                { id: 'examples', label: 'Examples', icon: Play },
                { id: 'tips', label: 'Tips & Mistakes', icon: Lightbulb }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={clsx(
                      'flex items-center space-x-2 text-sm font-medium pb-3 border-b-2 transition-all duration-200',
                      activeTab === tab.id
                        ? 'text-[#E5E7EB] border-[#3BF68A]'
                        : 'text-[#8B94A7] hover:text-[#E5E7EB] border-transparent'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-[#E5E7EB] mb-4">Strategy Overview</h3>
                  <p className="text-[#8B94A7] leading-relaxed text-lg">{strategy.overview}</p>
                </div>
              </div>
            )}

            {activeTab === 'rules' && (
              <div className="space-y-8">
                {/* Entry Rules */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-[#3BF68A]" />
                    <h3 className="text-xl font-bold text-[#E5E7EB]">Entry Rules</h3>
                  </div>
                  <div className="space-y-3">
                    {strategy.entryRules.map((rule, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-[#3BF68A]/20 text-[#3BF68A] rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                          {index + 1}
                        </div>
                        <p className="text-[#8B94A7] leading-relaxed">{rule}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exit Rules */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <TrendingDown className="h-5 w-5 text-[#F59E0B]" />
                    <h3 className="text-xl font-bold text-[#E5E7EB]">Exit Rules</h3>
                  </div>
                  <div className="space-y-3">
                    {strategy.exitRules.map((rule, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-[#F59E0B]/20 text-[#F59E0B] rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                          {index + 1}
                        </div>
                        <p className="text-[#8B94A7] leading-relaxed">{rule}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk Management */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Shield className="h-5 w-5 text-[#F45B69]" />
                    <h3 className="text-xl font-bold text-[#E5E7EB]">Risk Management</h3>
                  </div>
                  <div className="space-y-3">
                    {strategy.riskManagement.map((rule, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-[#F45B69]/20 text-[#F45B69] rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                          {index + 1}
                        </div>
                        <p className="text-[#8B94A7] leading-relaxed">{rule}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'examples' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-[#E5E7EB] mb-6">Real Trading Examples</h3>
                {strategy.examples.map((example, index) => (
                  <div 
                    key={index}
                    className="p-6 rounded-xl border border-[#1F2937] hover:border-[#3BF68A]/30 transition-all duration-200"
                    style={{
                      background: 'linear-gradient(135deg, #1A1D25 0%, #1F2937 100%)'
                    }}
                  >
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] rounded-full flex items-center justify-center text-black font-bold">
                        {index + 1}
                      </div>
                      <h4 className="text-lg font-bold text-[#E5E7EB]">{example.title}</h4>
                    </div>
                    
                    <p className="text-[#8B94A7] mb-4">{example.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-[#3BF68A] mb-2">Setup</div>
                        <p className="text-[#8B94A7] text-sm">{example.setup}</p>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#3BF68A] mb-2">Entry</div>
                        <p className="text-[#8B94A7] text-sm">{example.entry}</p>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#F59E0B] mb-2">Exit</div>
                        <p className="text-[#8B94A7] text-sm">{example.exit}</p>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#3BF68A] mb-2">Result</div>
                        <p className="text-[#3BF68A] text-sm font-semibold">{example.result}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'tips' && (
              <div className="space-y-8">
                {/* Pro Tips */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Lightbulb className="h-5 w-5 text-[#3BF68A]" />
                    <h3 className="text-xl font-bold text-[#E5E7EB]">Pro Tips</h3>
                  </div>
                  <div className="space-y-3">
                    {strategy.tips.map((tip, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-[#3BF68A] mt-0.5 flex-shrink-0" />
                        <p className="text-[#8B94A7] leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Common Mistakes */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-[#F45B69]" />
                    <h3 className="text-xl font-bold text-[#E5E7EB]">Common Mistakes to Avoid</h3>
                  </div>
                  <div className="space-y-3">
                    {strategy.commonMistakes.map((mistake, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <AlertTriangle className="h-5 w-5 text-[#F45B69] mt-0.5 flex-shrink-0" />
                        <p className="text-[#8B94A7] leading-relaxed">{mistake}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="rounded-xl border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
      style={{
        background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
      }}
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
        <div 
          className="w-full h-full rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="p-6 border-b border-[#1F2937]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-[#E5E7EB] mb-2">Trading Playbooks</h2>
              <p className="text-[#8B94A7] text-lg">Master proven trading strategies with step-by-step guides</p>
            </div>
          </div>

          {/* Educational Banner */}
          <div 
            className="rounded-xl p-6 mb-6 border border-[#3BF68A]/30 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #3BF68A/10 0%, #A78BFA/10 100%)'
            }}
          >
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] rounded-full flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-black" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-[#E5E7EB] text-xl font-bold mb-2">Learn Professional Trading Strategies</h3>
                <p className="text-[#8B94A7] leading-relaxed">
                  Each playbook contains detailed entry/exit rules, risk management guidelines, real examples, and pro tips. 
                  These strategies are used by professional traders worldwide and have been proven effective across different market conditions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Strategy Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tradingStrategies.map((strategy) => (
              <div
                key={strategy.id}
                className="rounded-xl p-6 border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #1A1D25 0%, #1F2937 100%)'
                }}
                onClick={() => setSelectedStrategy(strategy.id)}
              >
                {/* Gradient border on hover */}
                <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
                  <div 
                    className="w-full h-full rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, #1A1D25 0%, #1F2937 100%)'
                    }}
                  />
                </div>

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-[#E5E7EB]">{strategy.name}</h3>
                        <span className={clsx(
                          'px-2 py-1 rounded-full text-xs font-medium border',
                          strategy.difficulty === 'Beginner' 
                            ? 'bg-[#3BF68A]/20 text-[#3BF68A] border-[#3BF68A]/30'
                            : strategy.difficulty === 'Intermediate'
                            ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30'
                            : 'bg-[#F45B69]/20 text-[#F45B69] border-[#F45B69]/30'
                        )}>
                          {strategy.difficulty}
                        </span>
                      </div>
                      <p className="text-[#8B94A7] text-sm mb-4">{strategy.description}</p>
                    </div>
                    <button className="p-2 text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-[#1F2937] rounded-lg transition-all">
                      <Eye className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-xs text-[#8B94A7] mb-1">Win Rate</div>
                      <div className="text-lg font-bold text-[#3BF68A]">{strategy.winRate}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[#8B94A7] mb-1">Risk/Reward</div>
                      <div className="text-lg font-bold text-[#E5E7EB]">{strategy.riskReward}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[#8B94A7] mb-1">Timeframe</div>
                      <div className="text-sm font-medium text-[#E5E7EB]">{strategy.timeframe}</div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center space-x-2 text-sm">
                      <Target className="h-4 w-4 text-[#3BF68A]" />
                      <span className="text-[#8B94A7]">Detailed entry & exit rules</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Shield className="h-4 w-4 text-[#F45B69]" />
                      <span className="text-[#8B94A7]">Risk management guidelines</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Play className="h-4 w-4 text-[#F59E0B]" />
                      <span className="text-[#8B94A7]">Real trading examples</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Lightbulb className="h-4 w-4 text-[#A78BFA]" />
                      <span className="text-[#8B94A7]">Pro tips & common mistakes</span>
                    </div>
                  </div>

                  {/* Market Condition */}
                  <div className="flex items-center justify-between pt-4 border-t border-[#1F2937]">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-[#8B94A7]" />
                      <span className="text-sm text-[#8B94A7]">Best for: {strategy.marketCondition}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-[#3BF68A] hover:text-[#E5E7EB] transition-colors">
                      <span className="text-sm font-medium">Learn Strategy</span>
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};