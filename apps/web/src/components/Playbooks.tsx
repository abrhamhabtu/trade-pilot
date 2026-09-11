'use client';

import React, { useEffect, useState } from 'react';
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
  Star,
  Trophy,
  Medal,
  Users,
  MonitorPlay,
  Wand2,
  Plus
} from 'lucide-react';
import clsx from 'clsx';
import Image from 'next/image';
import { PlaybookStrategyView } from './PlaybookStrategyView';
import { TradingViewGuide } from './playbooks/TradingViewGuide';
import { CreatePlaybook } from './playbooks/CreatePlaybook';
import { usePlaybookStore, withEdits } from '@/store/playbookStore';
import type { SizingDefault, TvSetup } from '@/lib/tradingviewSetup';
import { buildStrategyChart } from '@/lib/strategyChart';

// Strategy categories — futures only for now; "Options" is coming later.
const CATEGORY_BY_ID: Record<string, string> = {
  'support-resistance': 'Support/Resistance',
  orb: 'Breakout',
  vwap: 'VWAP',
  breakout: 'Breakout',
  'mean-reversion': 'Mean Reversion',
  'trend-following': 'Trend',
  'vwap-pullback': 'VWAP',
  'vwap-reclaim': 'VWAP',
  'failed-breakout': 'Reversal',
  'order-blocks': 'Smart Money',
  'liquidity-sweep': 'Smart Money',
  'ict-fvg': 'Smart Money',
  'failed-auction': 'Auction',
};
const CHART_DIR_BY_ID: Record<string, { dir: 'Long' | 'Short'; variant: number }> = {
  'support-resistance': { dir: 'Long', variant: 0 },
  orb: { dir: 'Long', variant: 2 },
  vwap: { dir: 'Long', variant: 0 },
  'vwap-pullback': { dir: 'Long', variant: 0 },
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
  'vwap-pullback': 'Pullback, do not chase',
  'vwap-reclaim': 'Buy the flip, not the chop',
  'failed-breakout': 'Trade the trap, not the breakout',
  'order-blocks': 'Buy where the size loaded up',
  'liquidity-sweep': 'Fade the stop hunt',
  'ict-fvg': 'Let price fill the gap, then go',
  'failed-auction': 'Fade the failed extreme, magnet back to POC',
};

const RANK_FILTERS = ['All', 'Futures', 'Options', 'Beginner', 'Intermediate', 'Advanced'];

const MEDALS = [
  { label: 'Champion', color: '#FFB800', emoji: '🥇' },
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

const RankStat: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="min-w-0 px-3 py-2.5">
    <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
    <div className={clsx('mt-0.5 text-base font-semibold tabular-nums', accent ? 'text-tp-green' : 'text-zinc-100')}>{value}</div>
  </div>
);

const SectionHeader: React.FC<{ title: string; hint?: string; count?: number }> = ({ title, hint, count }) => (
  <div className="mb-3 flex items-baseline justify-between gap-4">
    <div className="flex items-baseline gap-2">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      {count !== undefined && <span className="text-xs tabular-nums text-zinc-500">{count}</span>}
    </div>
    {hint && <span className="hidden text-xs text-zinc-500 sm:block">{hint}</span>}
  </div>
);

const RankCard: React.FC<{ strategy: PlaybookStrategy; rank: number; onSelect: () => void }> = ({ strategy, rank, onSelect }) => {
  const medal = MEDALS[rank];
  const cs = communityStats(strategy);
  const rec = recommendationFor(strategy.winRate);
  const cat = CATEGORY_BY_ID[strategy.id] ?? 'Strategy';
  const champion = rank === 0;
  const MedalIcon = champion ? Trophy : Medal;
  return (
    <button
      onClick={onSelect}
      className={clsx(
        'group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-tp-card p-5 text-left transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.7)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tp-green/50',
        champion ? 'border-tp-yellow/30' : 'border-white/[0.06]'
      )}
      style={medal ? { backgroundImage: `radial-gradient(120% 70% at 0% 0%, ${medal.color}17 0%, transparent 55%)` } : undefined}
    >
      {medal && (
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${medal.color}, transparent)` }}
        />
      )}

      {/* Rank + recommendation */}
      <div className="flex items-center justify-between gap-3">
        {medal ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: medal.color, background: `${medal.color}1A`, boxShadow: `inset 0 0 0 1px ${medal.color}33` }}
          >
            <MedalIcon className="h-3.5 w-3.5" />
            {medal.label}
          </span>
        ) : (
          <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-full bg-white/[0.04] px-2 text-xs font-semibold tabular-nums text-zinc-400 ring-1 ring-inset ring-white/[0.06]">
            #{rank + 1}
          </span>
        )}
        <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', rec.cls)}>
          {rec.star && <Star className="h-3 w-3 fill-current" />}
          {rec.label}
        </span>
      </div>

      {/* Title + tagline */}
      <h3 className="mt-4 line-clamp-2 text-[17px] font-semibold leading-6 tracking-tight text-zinc-50">
        {strategy.name}
      </h3>
      <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{TAGLINE_BY_ID[strategy.id] ?? strategy.marketCondition}</p>

      <div className="mb-5 mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-tp-blue/10 px-2 py-0.5 text-[11px] font-medium text-tp-blue">Futures</span>
        <span className={clsx('rounded-md px-2 py-0.5 text-[11px] font-medium', DIFFICULTY_STYLE[strategy.difficulty])}>{strategy.difficulty}</span>
        <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-zinc-400">{cat}</span>
        <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-zinc-400">{strategy.timeframe}</span>
      </div>

      {/* Key stats — pinned to the bottom so every card in a row lines up */}
      <div className="mt-auto grid grid-cols-3 divide-x divide-white/[0.06] rounded-xl bg-black/20 ring-1 ring-inset ring-white/[0.05]">
        <RankStat label="Backtest" value={`${strategy.winRate}%`} />
        <RankStat label="Community" value={`${cs.communityWR}%`} accent />
        <RankStat label="Avg R" value={`${cs.avgR}R`} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-4 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Users className="h-3.5 w-3.5" />
          {cs.traders} traders · {cs.trades} trades
        </span>
        <span className="inline-flex items-center gap-0.5 font-medium text-zinc-300 transition-colors group-hover:text-tp-green">
          Open
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
};

const CustomCard: React.FC<{ strategy: PlaybookStrategy; onSelect: () => void }> = ({ strategy, onSelect }) => (
  <button
    onClick={onSelect}
    className="group flex h-full w-full flex-col rounded-2xl border border-tp-green/20 bg-tp-card p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-tp-green/40"
    style={{ backgroundImage: 'radial-gradient(120% 70% at 0% 0%, rgba(0,214,143,0.08) 0%, transparent 55%)' }}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-tp-green/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-tp-green">
        <Wand2 className="h-3.5 w-3.5" /> Your playbook
      </span>
      <span className="text-xs text-zinc-500">Not backtested</span>
    </div>
    <h3 className="mt-4 line-clamp-2 text-[17px] font-semibold leading-6 tracking-tight text-zinc-50">{strategy.name}</h3>
    <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{strategy.tagline || strategy.description}</p>
    <div className="mb-4 mt-3 flex flex-wrap gap-1.5">
      <span className={clsx('rounded-md px-2 py-0.5 text-[11px] font-medium', DIFFICULTY_STYLE[strategy.difficulty])}>{strategy.difficulty}</span>
      <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-zinc-400">{strategy.timeframe}</span>
      <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-zinc-400">{strategy.riskReward}</span>
    </div>
    <div className="mt-auto flex items-center justify-between gap-3 text-xs text-zinc-500">
      <span className="truncate">{strategy.source?.title ? `From: ${strategy.source.title}` : 'From your notes'}</span>
      <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-zinc-300 group-hover:text-tp-green">
        Open <ChevronRight className="h-4 w-4" />
      </span>
    </div>
  </button>
);

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
  /** Optional hand-written anatomy: exactly four stages (context, confirmation, invalidation, objective). */
  anatomy?: { title: string; points: string[] }[];
  /** Plain-English definitions shown as "Key terms". */
  glossary?: { term: string; meaning: string }[];
  /** Per-playbook overrides for the sizer / TradingView card (custom playbooks carry their own). */
  sizing?: SizingDefault;
  tvSetup?: TvSetup;
  // AI-created playbooks
  custom?: boolean;
  createdAt?: string;
  tagline?: string;
  source?: { url?: string; title: string };
  sourceClaims?: string[];
  openQuestions?: string[];
  seed?: {
    videos?: { id: string; title: string; url: string; notes: string }[];
    revisions?: {
      id: string;
      title: string;
      code: string;
      notes: string;
      status: 'Draft' | 'Testing' | 'Ready';
      createdAt: string;
    }[];
  };
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
      },
      {
        title: 'NY VWAP Pullback Long (Evan Dyer)',
        description: 'NQ futures pullback to NY VWAP in uptrend - clean bounce, right-side trade (itsevandyer reel Jun 2026)',
        setup: 'NQ in uptrend above NY VWAP, price pulls back to VWAP line on 3min chart, candle closes with rejection wick',
        entry: 'Long at VWAP bounce on 3min candle close above VWAP, right-side of VWAP only',
        exit: 'Target prior session high / range structure ahead, stop below the pullback low or below VWAP',
        result: 'Textbook clean - $1,200+ on funded account (1:2.5 R/R estimated)'
      }
    ],
    tips: [
      'VWAP is most effective during the first 2-3 hours of trading',
      'Look for confluence with other technical levels for best setups',
      'Volume spikes at VWAP often indicate institutional activity',
      'VWAP bands (standard deviations) provide additional targets',
      'Works best on liquid stocks and major forex pairs',
      'Right-side only: long above VWAP, short below VWAP - never fight the session mean',
      'NY VWAP (New York session) is often cleaner than the default session VWAP on futures',
      '3min timeframe gives clean entries without the noise of 1min',
      'The simplest setups that are easy to repeat win long-term - don\'t overcomplicate VWAP'
    ],
    commonMistakes: [
      'Trading VWAP during low volume periods',
      'Ignoring the overall trend direction',
      'Not waiting for proper rejection signals',
      'Using VWAP on illiquid instruments',
      'Placing stops too close to VWAP line',
      'Chasing VWAP after it already bounced - wait for the pullback',
      'Trading both sides of VWAP without conviction (must pick a direction)',
      'Overcomplicating with too many indicators - VWAP + structure + volume is enough'
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
    id: 'vwap-pullback',
    name: 'VWAP Pullback in Trend (Evan Dyer)',
    description: 'Let price pull back to NY VWAP in an established intraday trend and enter on the bounce - one setup, one trade, repeat.',
    difficulty: 'Intermediate',
    timeframe: '1m - 5m',
    winRate: 74,
    riskReward: '1:2.5',
    marketCondition: 'Trending intraday (NQ, ES, YM)',
    overview: 'Evan Dyer (@itsevandyer) teaches that the cleanest trades come from letting the market come to you. Price establishes a clear intraday trend, pulls back to the New York VWAP line, and bounces off it with volume. You enter with the trend and a tight stop under the VWAP touch. No chasing, no forcing - if price does not come to VWAP, you sit on your hands. The June 2026 reel that inspired this playbook shows $2.74K profit across 8 trading days with an extremely high win rate, tagged "Pullback to VWAP." The philosophy: simple trading is easy to repeat.',
    entryRules: [
      'Confirm the intraday trend direction on a 5-min chart (higher highs / higher lows for long)',
      'Mark NY VWAP as your key level - wait for price to pull all the way back to it',
      'Do NOT enter while price is still falling toward VWAP - let it tap and bounce',
      'Enter on the bounce candle once price clearly rejects VWAP and reverses in trend direction',
      'Rising volume on the bounce separates real entries from head-fakes',
      'If price slices through VWAP with momentum, skip - the trend is gone'
    ],
    exitRules: [
      'First target: the most recent swing high/low before the pullback',
      'Trail stop to breakeven once price puts 1R of distance',
      'Scale out half at 1.5R, let the rest run to 2R+',
      'Exit immediately if price comes back to VWAP and closes through it',
      'In strong trends, hold for the prior day high/low as the outer target'
    ],
    riskManagement: [
      'Stop 4-8 NQ points (or equivalent) below the VWAP touch wick',
      'Risk 0.5-1% of account per trade - this is a one-trade-a-day setup',
      'Do not trade this in choppy, range-bound conditions',
      'Skip the first 5 minutes after the open until VWAP settles',
      'One attempt per session - if it fails, the trend is breaking down'
    ],
    examples: [
      {
        title: 'MNQ Pullback to VWAP (June 2026)',
        description: 'Nasdaq micros in an intraday uptrend, pullback to NY VWAP, bounce entry',
        setup: 'MNQ trending higher with higher lows through the morning. Price pulls back 15 pts to NY VWAP around 19,450 and stalls with a doji.',
        entry: 'Long on the next 1-min candle as price bounces off VWAP with a volume spike',
        exit: 'Target the session high at 19,520 (+70 pts). Trail under each higher low after 1R.',
        result: '+70 pts (1:2.5 R/R) - textbook pullback to VWAP'
      },
      {
        title: 'YM VWAP Alignment (Evan Dyer Setup)',
        description: 'Dow futures aligned with VWAP for a trend continuation entry',
        setup: 'YM in a clear downtrend, price rallies back to NY VWAP resistance at 34,120. Overnight VWAP and PD VWAP also line up at the same zone.',
        entry: 'Short on the rejection candle as price bounces off the VWAP cluster',
        exit: 'Target the session low at 33,880. Stop above the VWAP wick at 34,150.',
        result: '+240 pts (1:3.0 R/R) - VWAP alignment with multiple anchors'
      }
    ],
    tips: [
      'NY VWAP is the most important anchor for intraday - it represents where institutions were trading at the open',
      'Confluence with Overnight VWAP or PD VWAP at the same level is a high-probability signal',
      'The best setups happen in the first 2 hours after NY open when volume is highest',
      'Do not force it - if price does not come to VWAP, that is a valid non-trade',
      'Simple trading is easy to repeat: one setup, one trade, one result. Over and over.',
      'Track your pullback setups in a daily journal - this strategy compounds with screen time'
    ],
    commonMistakes: [
      'Chasing price instead of waiting for the pullback to VWAP',
      'Entering while price is still falling to VWAP (catching a falling knife)',
      'Trading this in a choppy, range-bound market where VWAP has no polarity',
      'Taking a second attempt after VWAP failed - the trend is breaking down, stand aside',
      'Using too wide a stop that makes the R/R unfavorable (< 1:2)',
      'Ignoring the higher-timeframe context (daily trend, news events)'
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
  },
  {
    id: 'failed-auction',
    name: 'Failed Auction (Chanelle)',
    description:
      'Price gets pushed to the edge of the day’s value (VAL or VAH), stalls, and nobody follows through. You fade it back toward the middle for a quick, fixed 1.5R.',
    difficulty: 'Intermediate',
    timeframe: '1m - 5m',
    winRate: 73,
    riskReward: '1:1.5',
    marketCondition: 'Any session — Globex, Asia, London, New York',
    overview:
      'The market is an auction. A Fixed Range Volume Profile shows where most of the session’s volume traded: the value area. Its top edge (VAH) is “expensive”, its bottom edge (VAL) is “cheap”, and the point of control (POC) in the middle is “fair value”.\n\nWhen price pushes to an edge and then runs out of buyers or sellers, the auction has failed. Price usually rotates back toward fair value. You wait for proof of that failure — a candle body closing back through the last imbalance — then take a quick, fixed 1.5R.\n\nThis is the model behind Chanelle the Trader’s $59,890 NZD month of prop payouts. It is mechanical on purpose: same stop, same target, every time. Many setups a day means missing one is no big deal.',
    glossary: [
      { term: 'FRVP', meaning: 'Fixed Range Volume Profile — a TradingView drawing tool. Drag it across a session and it shows how much volume traded at each price.' },
      { term: 'VAH', meaning: 'Value Area High — the top of where ~70% of volume traded. Think “expensive”. Shorts only come from here.' },
      { term: 'VAL', meaning: 'Value Area Low — the bottom of the value area. Think “cheap”. Longs only come from here.' },
      { term: 'POC', meaning: 'Point of Control — the single price with the most volume. “Fair value.” Never trade at it; it is the magnet price returns to.' },
      { term: 'Failed auction', meaning: 'Price reaches VAH or VAL (or beyond), stalls, prints wicks, and fails to keep going. Buyers (or sellers) have dried up.' },
      { term: 'FVG inversion', meaning: 'The trigger. A candle BODY closes back through the last fair value gap / imbalance. A wick poking through does not count.' },
    ],
    anatomy: [
      {
        title: 'Price is pushed to the cheap edge',
        points: [
          'Drag the FRVP from the session open to now. Mark VAH, POC and VAL.',
          'Price trades down into VAL (or below it). This is the only place longs are allowed.',
          'Near POC? Do nothing — that is two-way chop with no edge.',
        ],
      },
      {
        title: 'The auction fails, then a body closes back through',
        points: [
          'Selling dries up: a rounded “U” bottom, long lower wicks, candles getting smaller.',
          'Then a strong bullish candle whose BODY closes above the last imbalance (the inversion).',
          'Enter on that candle close. No body close = no trade.',
        ],
      },
      {
        title: 'A fixed stop — the same every trade',
        points: [
          'Use one static stop in points from your backtest (e.g. 20 MNQ points). Do not move it to “structure”.',
          'If price makes a fresh low and closes back below VAL, the idea is wrong — the stop handles it.',
          'Size so that stop equals your fixed $ risk (use the sizer below).',
        ],
      },
      {
        title: 'Take the 1.5R base hit',
        points: [
          'Target a fixed 1.5R, set as a TradingView bracket before you enter.',
          'POC is the natural magnet. If it is further than 1.5R, you may let a small runner go there — only once you’re consistent.',
          'Flat by the session close. Next setup is coming.',
        ],
      },
    ],
    entryRules: [
      'Before trading, drag the Fixed Range Volume Profile across the session you trade (Globex open, Asia, London or New York) and mark VAH, POC and VAL',
      'Stay out while price is near POC — that is fair value, where two-way chop lives',
      'Wait for price to reach VAL (for a long) or VAH (for a short), or push beyond it',
      'Look for the auction to fail: price stalls in a rounded U (or ∩) shape with long wicks as pressure dries up',
      'Entry trigger: a candle BODY closes back through the last FVG / imbalance (an inversion). Enter on that close — a wick through is not enough',
      'Longs only from VAL. Shorts only from VAH. Never the other way round.',
    ],
    exitRules: [
      'Default take profit: a fixed 1.5R, set as a bracket order so it fills without you',
      'Optional runner to POC if POC sits beyond 1.5R and the move is clean — only after you are consistent',
      'Do not sit for a home run. Take the base hit; another setup is coming',
      'Be flat by the session close — this is a day trade, and most prop firms ban holding overnight',
    ],
    riskManagement: [
      'Static stop in points, the same every trade, so live results match the backtest',
      'Static take profit for the same reason. Prop firms have a number to hit, not a vibe',
      'On a 50k eval: $1,000 risk at 1.5R = $1,500 — halfway to a $3,000 target. Smaller risk per trade = more attempts before the drawdown',
      'If a box on the checklist is not ticked, there is no trade. Discretion comes later',
      'Missed a setup? There are plenty per session. Don’t revenge the one you skipped',
    ],
    examples: [
      {
        title: 'MNQ long off a VAL failed auction',
        description: 'Illustrative numbers showing the full plan on micros.',
        setup: 'FRVP on the NY session: VAH 19,510 · POC 19,465 · VAL 19,420. Price dips to 19,405, stalls for several minutes with long lower wicks.',
        entry: 'A bullish candle body closes above the imbalance at 19,418. Long 19,418. Static stop 20 pts → 19,398.',
        exit: 'TP 1.5R = 30 pts → 19,448 (POC at 19,465 is the magnet above). With $200 risk: 20 pts × $2 = $40 per MNQ → 5 contracts.',
        result: '+$300 target (1:1.5 R/R) · illustrative',
      },
      {
        title: 'NQ long from the source video',
        description: 'Price dumps through value area low, sellers exhaust, displacement candle inverts the FVG.',
        setup: 'FRVP on Globex. Price trades POC (no trade), then sells into VAL. U-shape stall and big wicks at the cheap extreme.',
        entry: 'Long when a strong bullish candle body closes above the imbalance / FVG',
        exit: 'Static 1.5R. The trade also ran toward POC (~2.4R in the video example).',
        result: 'Base hit 1.5R — walkthrough at 20:18',
      },
      {
        title: 'VAH short — the mirror image',
        description: 'The auction fails at the expensive edge. Short back toward fair value.',
        setup: 'Price tags VAH or pushes above it. Rounded ∩ top with upper wicks as buyers dry up.',
        entry: 'Short on the bearish body close back below the imbalance, not the first wick',
        exit: '1.5R static, or POC if it is still the magnet',
        result: 'Same model, opposite edge — take only what presents',
      },
    ],
    tips: [
      'FRVP lines move as volume comes in. Re-drag the profile every 30–60 minutes',
      'Works in Globex, Asia, London and NY. Pick the session that fits your life',
      'You do not need every setup. Put alerts on VAH and VAL and walk away',
      'Mechanical first, discretion later — great for stopping tilt and revenge trading',
      'The source clip starts the worked example at 20:18',
    ],
    commonMistakes: [
      'Trading off POC because “it looks like support” — that is fair value chop',
      'Entering on a wick through the FVG instead of a body close',
      'Buying the first touch of VAL before the auction has actually failed',
      'Moving to a “structure” stop you never used in the backtest',
      'Holding for POC every time and turning a 1.5R winner into a scratch',
    ],
    seed: {
      videos: [
        {
          id: 'failed-auction-source',
          title: 'this SIMPLE strategy made me $59,890 in prop payouts last month',
          url: 'https://www.youtube.com/watch?v=5Fd5ivtIEG0&t=1218s',
          notes:
            'Chanelle the Trader — Failed Auction. Worked example starts at 20:18. Paste your Pine in the Draft version below.',
        },
      ],
      revisions: [
        {
          id: 'failed-auction-pine-draft',
          title: 'Paste your Pine here',
          code: `//@version=5
indicator("Failed Auction", overlay=true)

// Paste your TradingView Pine Script below this line.
`,
          notes: 'Empty on purpose — drop your indicator/strategy code here when you are ready.',
          status: 'Draft',
          createdAt: '2026-09-10T00:00:00.000Z',
        },
      ],
    },
  },
];

export const Playbooks: React.FC = () => {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');
  const [section, setSection] = useState<'strategies' | 'toolkit'>('strategies');
  const [creating, setCreating] = useState(false);
  const { custom, edits, hydrate, removeCustom } = usePlaybookStore();
  useEffect(() => hydrate(), [hydrate]);
  const openToolkit = () => {
    setSelectedStrategy(null);
    setSection('toolkit');
    document.querySelector('main')?.scrollTo({ top: 0 });
  };

  if (selectedStrategy) {
    const base = [...tradingStrategies, ...custom].find(s => s.id === selectedStrategy);
    if (!base) return null;
    return (
      <PlaybookStrategyView
        strategy={withEdits(base, edits)}
        base={base}
        onBack={() => setSelectedStrategy(null)}
        onOpenToolkit={openToolkit}
        onDelete={base.custom ? () => { removeCustom(base.id); setSelectedStrategy(null); } : undefined}
      />
    );
  }

  const pageTabs = (
    <nav aria-label="Playbook sections" className="flex gap-1 border-b border-white/[0.06]">
      {([
        { id: 'strategies', label: 'Strategies', icon: BookOpen, count: tradingStrategies.length },
        { id: 'toolkit', label: 'TradingView toolkit', icon: MonitorPlay },
      ] as const).map((t) => {
        const active = section === t.id;
        return (
          <button
            key={t.id}
            aria-current={active ? 'page' : undefined}
            onClick={() => setSection(t.id)}
            className={clsx(
              '-mb-px inline-flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm font-medium',
              active ? 'border-tp-green text-zinc-50' : 'border-transparent text-zinc-500 hover:text-zinc-200'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {'count' in t && <span className="text-xs tabular-nums text-zinc-500">{t.count}</span>}
          </button>
        );
      })}
    </nav>
  );

  if (section === 'toolkit') {
    return (
      <div className="mx-auto max-w-7xl space-y-8">
        {pageTabs}
        <header className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
            <MonitorPlay className="h-3.5 w-3.5 text-tp-green" />
            Tips & tricks
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            TradingView <span className="text-tp-green">toolkit</span>
          </h1>
          <p className="mt-3 text-base leading-relaxed text-zinc-400">
            Everything you need to run these playbooks on TradingView with micros: automatic take profit and stop loss,
            how many contracts to trade, chart setup, alerts and practice.
          </p>
        </header>
        <TradingViewGuide />
      </div>
    );
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

  const rest = showPodium ? visible.slice(3) : visible;
  const countFor = (f: string) =>
    f === 'All' || f === 'Futures' ? tradingStrategies.length
      : f === 'Options' ? 0
      : tradingStrategies.filter((s) => s.difficulty === f).length;

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      {pageTabs}
      {/* Hero */}
      <header className="flex flex-col items-center pt-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
          <BookOpen className="h-3.5 w-3.5 text-tp-green" />
          {tradingStrategies.length} playbooks · ranked by win rate
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Your trading <span className="text-tp-green">playbooks</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
          A home for every setup. Study the rules, evolve your Pine Script, collect chart examples, and build your own video library.
        </p>
        <button
          onClick={() => setCreating(true)}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-tp-green to-[#3fe0b0] px-4 py-2 text-sm font-semibold text-[#0D1628] shadow-[0_8px_24px_-8px_rgba(0,214,143,0.6)] hover:brightness-110"
        >
          <Wand2 className="h-4 w-4" />
          Create a playbook from a video
        </button>

        {/* Filters — segmented control */}
        <div className="mt-6 max-w-full overflow-x-auto">
          <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.03] p-1 ring-1 ring-inset ring-white/[0.07]">
            {RANK_FILTERS.map((f) => {
              const soon = f === 'Options';
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => !soon && setFilter(f)}
                  disabled={soon}
                  className={clsx(
                    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-white/[0.09] text-zinc-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                      : soon
                        ? 'cursor-not-allowed text-zinc-600'
                        : 'text-zinc-400 hover:text-zinc-100'
                  )}
                >
                  {f}
                  {soon ? (
                    <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide">Soon</span>
                  ) : (
                    <span className={clsx('text-xs tabular-nums', active ? 'text-tp-green' : 'text-zinc-600')}>{countFor(f)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {filter === 'Options' ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-tp-card/60 p-12 text-center text-sm text-zinc-400">
          Options strategies are coming soon. For now, every playbook here is futures.
        </div>
      ) : (
        <>
          {/* Your AI-built playbooks */}
          {(() => {
            const mine = custom.filter((c) => filter === 'All' || filter === 'Futures' || c.difficulty === filter);
            return mine.length > 0 ? (
              <section>
                <SectionHeader title="My playbooks" count={mine.length} hint="Built with Pilot AI · saved on this device" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {mine.map((c) => (
                    <CustomCard key={c.id} strategy={withEdits(c, edits)} onSelect={() => setSelectedStrategy(c.id)} />
                  ))}
                  <button
                    onClick={() => setCreating(true)}
                    className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.1] text-sm text-zinc-400 hover:border-tp-green/40 hover:text-tp-green"
                  >
                    <Plus className="h-5 w-5" />
                    New from a video or idea
                  </button>
                </div>
              </section>
            ) : null;
          })()}

          {/* Podium — global top 3 */}
          {showPodium && visible.length > 0 && (
            <section>
              <SectionHeader title="Top performers" hint="Highest AI-backtest win rate" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((idx) => {
                  const s = visible[idx];
                  if (!s) return null;
                  // Mobile: champion first (DOM order). Desktop: champion centered.
                  const orderCls = idx === 0 ? 'lg:order-2' : idx === 1 ? 'lg:order-1' : 'lg:order-3';
                  return (
                    <div key={s.id} className={orderCls}>
                      <RankCard strategy={s} rank={rankOf.get(s.id)!} onSelect={() => setSelectedStrategy(s.id)} />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* The rest (or the full filtered list) */}
          {rest.length > 0 && (
            <section>
              <SectionHeader
                title={showPodium ? 'All playbooks' : `${filter} playbooks`}
                count={rest.length}
                hint="Click any playbook to open its guide and workspace"
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((s) => (
                  <RankCard key={s.id} strategy={s} rank={rankOf.get(s.id)!} onSelect={() => setSelectedStrategy(s.id)} />
                ))}
              </div>
            </section>
          )}

          {visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-tp-card/60 p-12 text-center text-sm text-zinc-400">
              No {filter.toLowerCase()} strategies yet.
            </div>
          )}
        </>
      )}
      {creating && (
        <CreatePlaybook
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelectedStrategy(id);
            document.querySelector('main')?.scrollTo({ top: 0 });
          }}
        />
      )}
    </div>
  );
};