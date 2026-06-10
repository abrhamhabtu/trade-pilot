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
  BarChart2,
  Search,
  Sparkles,
  ChevronRight,
  Star
} from 'lucide-react';
import clsx from 'clsx';
import Image from 'next/image';
import { PlaybookStrategyView } from './PlaybookStrategyView';
import { buildStrategyChart } from '@/lib/strategyChart';

// Strategy categories — futures only for now; "Options" is coming later.
const CATEGORY_BY_ID: Record<string, string> = {
  'support-resistance': 'Support/Resistance',
  orb: 'Breakout',
  vwap: 'VWAP',
  breakout: 'Breakout',
  'mean-reversion': 'Mean Reversion',
  'trend-following': 'Trend',
  'vwap-reclaim': 'VWAP',
  'failed-breakout': 'Reversal',
  'order-blocks': 'Smart Money',
  'liquidity-sweep': 'Smart Money',
  'ict-fvg': 'Smart Money',
};
const CHART_DIR_BY_ID: Record<string, { dir: 'Long' | 'Short'; variant: number }> = {
  'support-resistance': { dir: 'Long', variant: 0 },
  orb: { dir: 'Long', variant: 2 },
  vwap: { dir: 'Long', variant: 0 },
  breakout: { dir: 'Long', variant: 2 },
  'mean-reversion': { dir: 'Short', variant: 1 },
  'trend-following': { dir: 'Long', variant: 2 },
};
const DIFFICULTY_STYLE: Record<string, string> = {
  Beginner: 'bg-tp-green/15 text-tp-green',
  Intermediate: 'bg-tp-yellow/15 text-tp-yellow',
  Advanced: 'bg-tp-red/15 text-tp-red',
};

const TAGLINE_BY_ID: Record<string, string> = {
  'support-resistance': 'Trade the bounce, not the hope',
  orb: 'Trade the first breakout of the day',
  vwap: 'Buy the reclaim of VWAP from below',
  breakout: 'Ride the break, cut the fake',
  'mean-reversion': 'Fade the stretch, bank the snap',
  'trend-following': 'The trend is your only friend',
  'vwap-reclaim': 'Buy the flip, not the chop',
  'failed-breakout': 'Trade the trap, not the breakout',
  'order-blocks': 'Buy where the size loaded up',
  'liquidity-sweep': 'Fade the stop hunt',
  'ict-fvg': 'Let price fill the gap, then go',
};

const RANK_FILTERS = ['All', 'Futures', 'Options', 'Beginner', 'Intermediate', 'Advanced'];

const MEDALS = [
  { label: 'Champion', color: '#D9A03F', emoji: '🥇' },
  { label: 'Silver', color: '#C7CDD6', emoji: '🥈' },
  { label: 'Bronze', color: '#CD7F46', emoji: '🥉' },
];

// Deterministic per-strategy "community" numbers so cards are stable across renders.
function seedFor(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function recommendationFor(wr: number) {
  if (wr >= 70) return { label: 'Strongly recommended', cls: 'bg-tp-green/15 text-tp-green', star: true };
  if (wr >= 65) return { label: 'Highly recommended', cls: 'bg-tp-green/15 text-tp-green', star: true };
  if (wr >= 60) return { label: 'Recommended', cls: 'bg-tp-blue/15 text-tp-blue', star: false };
  return { label: 'Situational', cls: 'bg-white/[0.06] text-zinc-400', star: false };
}
function communityStats(s: PlaybookStrategy) {
  const seed = seedFor(s.id);
  const rrNum = parseFloat(s.riskReward.split(':')[1] || '2') || 2;
  return {
    avgR: Math.max(1, rrNum - 0.6).toFixed(1),
    trades: (1800 + (seed % 3200)).toLocaleString(),
    traders: 220 + (seed % 480),
    communityWR: Math.min(95, s.winRate + 1 + (seed % 4)),
  };
}

const RankStat: React.FC<{ label: string; value: string; green?: boolean }> = ({ label, value, green }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-zinc-500">{label}</span>
    <span className={clsx('text-right', green ? 'text-tp-green' : 'text-zinc-200')}>{value}</span>
  </div>
);

const RankCard: React.FC<{ strategy: PlaybookStrategy; rank: number; podium: boolean; onSelect: () => void }> = ({ strategy, rank, podium, onSelect }) => {
  const medal = MEDALS[rank];
  const cs = communityStats(strategy);
  const rec = recommendationFor(strategy.winRate);
  const cat = CATEGORY_BY_ID[strategy.id] ?? 'Strategy';
  const champion = rank === 0;
  return (
    <button
      onClick={onSelect}
      className={clsx(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-tp-card p-5 text-left transition-all hover:border-tp-green/30 hover:shadow-lg',
        medal ? 'border-white/[0.08]' : 'border-white/[0.06]',
        champion && podium && 'md:-translate-y-3'
      )}
      style={champion ? { boxShadow: '0 0 0 1px rgba(217, 160, 63,0.35)' } : undefined}
    >
      {medal && <div className="absolute inset-x-0 top-0 h-1" style={{ background: medal.color }} />}

      <div className="mb-3 flex flex-col items-center">
        {medal ? (
          <>
            <div className="text-3xl leading-none">{medal.emoji}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: medal.color }}>{medal.label}</div>
          </>
        ) : (
          <div className="text-sm font-bold text-zinc-500">#{rank + 1}</div>
        )}
      </div>

      <h3 className="text-lg font-bold text-zinc-100">{strategy.name}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded bg-tp-green/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-tp-green">Futures</span>
        <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', DIFFICULTY_STYLE[strategy.difficulty])}>{strategy.difficulty}</span>
        <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">{cat}</span>
      </div>

      <p className="mt-3 text-sm italic text-zinc-500">&ldquo;{TAGLINE_BY_ID[strategy.id] ?? strategy.marketCondition}&rdquo;</p>

      <div className="mt-3">
        <span className={clsx('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold', rec.cls)}>
          {rec.star && <Star className="h-3 w-3 fill-current" />}
          {rec.label}
        </span>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3 font-mono text-xs">
        <RankStat label="AI BACKTEST" value={`${strategy.winRate}% WR`} />
        <RankStat label="COMMUNITY" value={`${cs.communityWR}% WR · ${cs.avgR}R · ${cs.trades} trades`} green />
        <RankStat label="USING" value={`${cs.traders} traders`} />
      </div>

      <div className="mt-4 inline-flex items-center gap-1 self-end text-sm font-medium text-tp-green opacity-70 transition-opacity group-hover:opacity-100">
        View details <ChevronRight className="h-4 w-4" />
      </div>
    </button>
  );
};

export interface PlaybookStrategy {
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

export const tradingStrategies: PlaybookStrategy[] = [
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
  },
  {
    id: 'vwap-reclaim',
    name: 'VWAP Reclaim',
    description: 'Buy the reclaim of VWAP from below (or short the loss from above) once price flips the session mean and holds it',
    difficulty: 'Intermediate',
    timeframe: '1m - 15m',
    winRate: 67,
    riskReward: '1:2.5',
    marketCondition: 'Intraday trend / rotation',
    overview: 'VWAP is the session’s fair-value anchor, so institutions lean on it for entries and exits. The reclaim plays the moment sentiment flips: price has been trading below VWAP, pushes back up through it, and then holds on a retest instead of rejecting. That hold is the tell that buyers have taken control of the session. You enter on the retest with a tight stop under the reclaim, because if VWAP fails again you want out cheap.',
    entryRules: [
      'Mark session VWAP; confirm price has spent time on one side of it',
      'Wait for a decisive cross back through VWAP on rising volume',
      'Let price pull back and retest VWAP from the new side',
      'Enter when the retest holds (higher low above VWAP for longs)',
      'Skip it if price is chopping back and forth across VWAP — no edge in the mush'
    ],
    exitRules: [
      'First target: the prior session high/low or the next intraday level',
      'Trail under each higher low (longs) once past 1R',
      'Exit immediately on a clean close back below VWAP',
      'Scale out half at 1.5R, let the rest run with the trend'
    ],
    riskManagement: [
      'Stop just beyond the reclaim swing — usually 4–8 NQ points',
      'Risk 0.5–1% of the account per attempt; the reclaim can fake once',
      'Avoid the first 2 minutes after the open until VWAP settles',
      'One re-entry max if the first reclaim fails and re-reclaims'
    ],
    examples: [
      {
        title: 'NQ Morning Reclaim',
        description: 'Nasdaq flips VWAP after the open and holds the retest',
        setup: 'Price trades below VWAP for 20 min, then crosses up on a volume spike',
        entry: 'Long on the retest as price sets a higher low 3 pts above VWAP',
        exit: 'Target prior day high, stop under the reclaim low',
        result: '+42 pts (1:2.6 R/R)'
      },
      {
        title: 'ES Afternoon Loss',
        description: 'S&P loses VWAP and fails the reclaim — short setup',
        setup: 'Price rejects VWAP from below twice into the afternoon',
        entry: 'Short the failed reclaim with stop above VWAP',
        exit: 'Target session low, trailed the move down',
        result: '+18 pts (1:2.2 R/R)'
      }
    ],
    tips: [
      'The hold on the retest matters more than the cross itself',
      'Best reclaims happen after a higher-timeframe level lines up with VWAP',
      'Rising volume on the cross separates real reclaims from drifts',
      'Anchored VWAP from the day’s high/low adds confluence'
    ],
    commonMistakes: [
      'Chasing the cross instead of waiting for the retest',
      'Trading reclaims in a dead, low-volume chop zone',
      'Stops so tight a normal VWAP wick takes you out',
      'Fighting a strong trend just because price tapped VWAP'
    ]
  },
  {
    id: 'failed-breakout',
    name: 'Failed Breakout / Breakdown',
    description: 'Fade the trap when price breaks a key level, sucks in breakout traders, then snaps back inside the range',
    difficulty: 'Intermediate',
    timeframe: '5m - 1H',
    winRate: 63,
    riskReward: '1:2.5',
    marketCondition: 'Range / liquidity traps',
    overview: 'Most breakouts fail, and the failure is its own high-probability setup. Price pokes above resistance (or below support), triggers stops and breakout orders, then reverses back through the level — trapping everyone who chased. You fade that reversal back into the range, targeting the opposite side. The trap is most reliable at obvious levels everyone is watching, because that is where the stops are stacked.',
    entryRules: [
      'Identify a clean, well-tested range or level lots of traders see',
      'Watch for a break that lacks follow-through (long wick, quick rejection)',
      'Wait for price to close back inside the range/level',
      'Enter on the reclaim with the move heading back into the range',
      'Volume that spikes on the break then dies confirms the trap'
    ],
    exitRules: [
      'Target the opposite end of the range',
      'Take partials at the range midpoint',
      'Exit if price reclaims the breakout level again with conviction',
      'Trail behind structure once price is back inside and moving'
    ],
    riskManagement: [
      'Stop just beyond the failed-break extreme (the wick high/low)',
      'Risk 1% max — traps can re-test before they resolve',
      'Avoid fading breaks that come with major news momentum',
      'Best on the second failed poke, not the first'
    ],
    examples: [
      {
        title: 'ES Range High Trap',
        description: 'S&P pokes the range high, rejects, and falls back inside',
        setup: 'Price wicks 4 pts above a 2-day range high on a volume spike, then closes back in',
        entry: 'Short the reclaim back inside with stop above the wick',
        exit: 'Target range low, partial at midpoint',
        result: '+31 pts (1:2.8 R/R)'
      }
    ],
    tips: [
      'The cleaner and more obvious the level, the better the trap',
      'A fast rejection wick is worth more than a slow grind back',
      'Failed breakdowns into support are some of the best long setups',
      'If everyone expects the breakout, expect the trap'
    ],
    commonMistakes: [
      'Fading a real breakout backed by strong momentum/news',
      'Entering before price actually closes back inside',
      'Stops inside the wick where a re-test stops you out',
      'Holding past the opposite end of the range hoping for more'
    ]
  },
  {
    id: 'order-blocks',
    name: 'Order Block Retest',
    description: 'Trade the retest of the last institutional candle before a strong move — the zone where big orders were placed',
    difficulty: 'Advanced',
    timeframe: '5m - 1H',
    winRate: 60,
    riskReward: '1:3',
    marketCondition: 'Trending / institutional',
    overview: 'An order block is the last down-candle before a strong up-move (or last up-candle before a strong down-move) — the footprint of institutions loading a position. Price often returns to that zone to fill remaining orders before continuing. You wait for price to retrace into the block and enter on a reaction in the direction of the original impulse, with a stop on the far side of the block. It demands patience and clean reading of where the real move began.',
    entryRules: [
      'Find a strong, impulsive move that broke structure',
      'Mark the last opposite-color candle before that move as the order block',
      'Wait for price to retrace back into the block',
      'Enter on a reaction (rejection wick / lower-timeframe shift) inside the zone',
      'Confluence with a higher-timeframe level strengthens it'
    ],
    exitRules: [
      'Target the prior swing high/low the impulse created',
      'Take partials at 2R; the third R is the bonus',
      'Exit if price closes fully through the order block',
      'Trail behind lower-timeframe structure as it runs'
    ],
    riskManagement: [
      'Stop on the far side of the order block, not mid-zone',
      'Risk 0.5–1% — not every block holds',
      'Only trade blocks aligned with the higher-timeframe trend',
      'Pass on blocks that have already been tapped once'
    ],
    examples: [
      {
        title: 'NQ Bullish Order Block',
        description: 'Nasdaq leaves a demand block, returns, and continues up',
        setup: 'Strong impulse up off a final red candle that broke structure',
        entry: 'Long on the rejection wick as price retests the block',
        exit: 'Target the swing high; trailed the rest',
        result: '+71 pts (1:3.2 R/R)'
      }
    ],
    tips: [
      'Fresh, untapped blocks react far better than re-tested ones',
      'The block should have caused a break of structure to be valid',
      'Use a lower timeframe to time the entry inside the zone',
      'Align with the trend — counter-trend blocks fail more often'
    ],
    commonMistakes: [
      'Marking random candles as order blocks with no impulse',
      'Trading blocks against the higher-timeframe trend',
      'Entering the instant price touches without a reaction',
      'Stops inside the block that get run before the move'
    ]
  },
  {
    id: 'liquidity-sweep',
    name: 'Liquidity Sweep Reversal',
    description: 'Fade the stop hunt — price spikes through an obvious high/low to grab liquidity, then reverses hard',
    difficulty: 'Advanced',
    timeframe: '1m - 15m',
    winRate: 64,
    riskReward: '1:3',
    marketCondition: 'Reversals / stop hunts',
    overview: 'Resting stops cluster just beyond obvious swing highs and lows. Price often spikes through those levels to fill large orders against the trapped traders, then reverses sharply — a liquidity sweep. You wait for the spike past the level, the lack of continuation, and the snap back, then enter in the reversal direction. Done right, your stop is tiny (just past the sweep extreme) and the move can run for multiples.',
    entryRules: [
      'Mark obvious equal highs/lows where stops are likely resting',
      'Wait for a fast spike through the level (the sweep)',
      'Confirm no follow-through — price stalls and snaps back inside',
      'Enter on the reversal with a market shift on the lower timeframe',
      'Best when the sweep happens into a higher-timeframe level'
    ],
    exitRules: [
      'Target the opposite liquidity pool (the next equal high/low)',
      'Partial at 2R; sweeps can run far when stops cascade',
      'Exit if price reclaims and holds beyond the swept level',
      'Trail behind the reversal structure'
    ],
    riskManagement: [
      'Stop just beyond the sweep wick — often only 5–10 pts',
      'Risk 0.5–1%; sweeps are sharp but can extend',
      'Avoid during high-impact news when spikes are real moves',
      'Only one attempt — if it sweeps again, stand aside'
    ],
    examples: [
      {
        title: 'NQ Sell-Side Sweep',
        description: 'Nasdaq runs the prior lows, grabs stops, and reverses up',
        setup: 'Equal lows from the morning; price spikes 8 pts below then stalls',
        entry: 'Long on the snap-back with stop under the sweep wick',
        exit: 'Target the opposite equal highs',
        result: '+58 pts (1:3.4 R/R)'
      }
    ],
    tips: [
      'Equal highs/lows are magnets — the more obvious, the better',
      'The reversal should be fast; a slow grind back is weaker',
      'Sweeps into HTF levels are the highest-probability version',
      'Patience — most of the day there is no clean sweep to trade'
    ],
    commonMistakes: [
      'Front-running the sweep instead of waiting for the snap back',
      'Treating a genuine news-driven break as a sweep',
      'Stops inside the wick that the re-test takes out',
      'Over-trading sweeps that aren’t at meaningful levels'
    ]
  },
  {
    id: 'ict-fvg',
    name: 'Fair Value Gap (FVG)',
    description: 'Trade the retrace into an imbalance — a three-candle gap left by a fast move — where price tends to return before continuing',
    difficulty: 'Advanced',
    timeframe: '1m - 15m',
    winRate: 62,
    riskReward: '1:3',
    marketCondition: 'Trending / institutional',
    overview: 'A fair value gap is an imbalance left behind when price moves so fast that one candle’s range doesn’t overlap the candle two bars back — the market skipped a price zone without trading it cleanly. Those gaps act like magnets: price often retraces to fill the imbalance before continuing in the original direction. You wait for price to tap into the FVG in line with the trend, then enter on a reaction, stopping on the far side of the gap. It rewards patience and only taking gaps that sit with the higher-timeframe bias.',
    entryRules: [
      'Spot a strong, impulsive move that breaks structure',
      'Mark the FVG: the gap between candle 1’s wick and candle 3’s wick around the big candle',
      'Only take gaps aligned with the higher-timeframe trend',
      'Wait for price to retrace and tap into the gap',
      'Enter on a reaction inside the gap (rejection wick / lower-timeframe shift)'
    ],
    exitRules: [
      'Target the swing the impulse created, or the next liquidity pool',
      'Take partials at 2R; let a runner work toward 3R+',
      'Exit if price closes fully through the gap against you',
      'Trail behind lower-timeframe structure as it continues'
    ],
    riskManagement: [
      'Stop just beyond the far edge of the gap, not in the middle',
      'Risk 0.5–1% — not every gap gets respected',
      'Skip fully-filled or already-tapped gaps; favour fresh ones',
      'Avoid FVGs formed purely on a news spike'
    ],
    examples: [
      {
        title: 'NQ Bullish FVG Fill',
        description: 'Nasdaq leaves an imbalance on the push up, retraces, and continues',
        setup: 'Impulsive up-move breaks structure and leaves a clean 3-candle gap',
        entry: 'Long on the rejection as price taps the top of the gap',
        exit: 'Target the prior swing high; trailed the rest',
        result: '+64 pts (1:3.1 R/R)'
      },
      {
        title: 'ES Bearish FVG',
        description: 'S&P drops hard, leaves a gap above, and sells off from the retrace',
        setup: 'Down impulse with an unfilled imbalance above the move',
        entry: 'Short the tap into the gap with stop above it',
        exit: 'Target the session low',
        result: '+22 pts (1:2.7 R/R)'
      }
    ],
    tips: [
      'Fresh, untapped gaps react far better than re-tested ones',
      'The strongest fills line up with an order block or key level',
      'Use a lower timeframe to time the entry inside the gap',
      'A gap that forms while breaking structure is the highest quality'
    ],
    commonMistakes: [
      'Trading every tiny gap instead of the meaningful imbalances',
      'Taking FVGs against the higher-timeframe trend',
      'Entering the instant price touches without a reaction',
      'Stops in the middle of the gap that get tagged before the move'
    ]
  }
];

export const Playbooks: React.FC = () => {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');

  if (selectedStrategy) {
    const strategy = tradingStrategies.find(s => s.id === selectedStrategy);
    if (!strategy) return null;
    return <PlaybookStrategyView strategy={strategy} onBack={() => setSelectedStrategy(null)} />;
  }

  // Rank every strategy by win rate; medals go to the global top 3.
  const ranked = [...tradingStrategies].sort((a, b) => b.winRate - a.winRate);
  const rankOf = new Map(ranked.map((s, i) => [s.id, i]));
  const showPodium = filter === 'All' || filter === 'Futures';
  const visible = ranked.filter((s) => {
    if (filter === 'All' || filter === 'Futures') return true;
    if (filter === 'Options') return false;
    return s.difficulty === filter;
  });

  return (
    <div className="space-y-7">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
          Strategy <span className="italic text-tp-green">Rankings</span>
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
          Every futures strategy, ranked by backtested win rate — with the rules, risk, and worked examples behind each. Pick your edge and study the playbook.
        </p>

        {/* Filters */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {RANK_FILTERS.map((f) => {
            const soon = f === 'Options';
            return (
              <button
                key={f}
                onClick={() => !soon && setFilter(f)}
                disabled={soon}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  filter === f
                    ? 'border-tp-green/50 bg-tp-green/10 text-tp-green'
                    : soon
                      ? 'cursor-not-allowed border-white/[0.06] text-zinc-600'
                      : 'border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-zinc-100'
                )}
              >
                {f}
                {soon && <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide">Soon</span>}
              </button>
            );
          })}
        </div>
      </div>

      {filter === 'Options' ? (
        <div className="rounded-2xl border border-white/[0.06] bg-tp-card p-12 text-center text-sm text-zinc-400">
          Options strategies are coming soon. For now, every playbook here is futures.
        </div>
      ) : (
        <>
          {/* Podium — global top 3 */}
          {showPodium && (
            <div className="grid gap-5 pt-3 sm:grid-cols-3 sm:items-start">
              {[0, 1, 2].map((idx) => {
                const s = visible[idx];
                if (!s) return null;
                // Mobile: champion first (DOM order). Desktop: champion centered.
                const orderCls = idx === 0 ? 'sm:order-2' : idx === 1 ? 'sm:order-1' : 'sm:order-3';
                return (
                  <div key={s.id} className={clsx('h-full', orderCls)}>
                    <RankCard strategy={s} rank={rankOf.get(s.id)!} podium onSelect={() => setSelectedStrategy(s.id)} />
                  </div>
                );
              })}
            </div>
          )}

          {/* The rest (or the full filtered list) */}
          {(showPodium ? visible.slice(3) : visible).length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {(showPodium ? visible.slice(3) : visible).map((s) => (
                <RankCard key={s.id} strategy={s} rank={rankOf.get(s.id)!} podium={false} onSelect={() => setSelectedStrategy(s.id)} />
              ))}
            </div>
          )}

          {visible.length === 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-tp-card p-12 text-center text-sm text-zinc-400">
              No {filter.toLowerCase()} strategies yet.
            </div>
          )}
        </>
      )}
    </div>
  );
};