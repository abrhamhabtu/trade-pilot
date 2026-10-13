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
  Plus,
  LayoutGrid,
  List
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
  'supply-demand-zones': 'Support/Resistance',
  'law-of-10-risk': 'Prop Firm',
  'prop-firm-copy-trading': 'Prop Firm',
  'prop-firm-eval-first-mindset': 'Prop Firm',
  'london-prev-day-levels': 'London & Prev Day',
  'prop-firm-funding-scaling': 'Prop Firm',
  'vwap-double-break': 'VWAP',
  'prop-firm-payout-discipline': 'Prop Firm',
  'opt-vwap-double-break': 'VWAP',
  'opt-orb-0dte': 'Breakout',
  'opt-trend-pullback-spread': 'VWAP',
  'opt-failed-break-reversal': 'Reversal',
};
const CHART_DIR_BY_ID: Record<string, { dir: 'Long' | 'Short'; variant: number }> = {
  'support-resistance': { dir: 'Long', variant: 0 },
  orb: { dir: 'Long', variant: 2 },
  vwap: { dir: 'Long', variant: 0 },
  'vwap-pullback': { dir: 'Long', variant: 0 },
  breakout: { dir: 'Long', variant: 2 },
  'mean-reversion': { dir: 'Short', variant: 1 },
  'trend-following': { dir: 'Long', variant: 2 },
  'supply-demand-zones': { dir: 'Long', variant: 0 },
  'law-of-10-risk': { dir: 'Long', variant: 1 },
  'prop-firm-copy-trading': { dir: 'Long', variant: 1 },
  'prop-firm-eval-first-mindset': { dir: 'Long', variant: 0 },
  'london-prev-day-levels': { dir: 'Long', variant: 2 },
  'prop-firm-funding-scaling': { dir: 'Long', variant: 0 },
  'vwap-double-break': { dir: 'Long', variant: 2 },
  'prop-firm-payout-discipline': { dir: 'Long', variant: 0 },
  'opt-vwap-double-break': { dir: 'Long', variant: 2 },
  'opt-orb-0dte': { dir: 'Short', variant: 1 },
  'opt-trend-pullback-spread': { dir: 'Long', variant: 0 },
  'opt-failed-break-reversal': { dir: 'Short', variant: 1 },
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
  'supply-demand-zones': 'Short the supply, buy the demand',
  'law-of-10-risk': 'Protect the cushion, scale the risk',
  'prop-firm-copy-trading': 'Straight to funded, scale in, respect the risk',
  'prop-firm-eval-first-mindset': 'Learn on play money before your own funds',
  'london-prev-day-levels': 'Long or short off London and prior day levels',
  'prop-firm-funding-scaling': 'Build the buffer, take the min payout, reinvest',
  'vwap-double-break': 'Break the range AND VWAP, with VWAP inside the range',
  'prop-firm-payout-discipline': 'Get payouts the right way, psychology first',
  'opt-vwap-double-break': 'Both breaks, then buy the same-day contract',
  'opt-orb-0dte': 'Close outside the range, one range height out',
  'opt-trend-pullback-spread': 'Pullback to VWAP, defined risk both ways',
  'opt-failed-break-reversal': 'Back inside the range, target the far side',
};

const RANK_FILTERS = ['All', 'Futures', 'Options', 'Beginner', 'Intermediate', 'Advanced'];
// Category filters create their own browsable sections (e.g. Prop Firm Strategy).
const CATEGORY_FILTERS = ['Prop Firm', 'London & Prev Day'];
const ALL_FILTERS = [...RANK_FILTERS, ...CATEGORY_FILTERS];

const MEDALS = [
  { label: 'Champion', color: 'rgb(var(--tp-yellow))', emoji: '🥇' },
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

const DIFFICULTY_LEVEL: Record<string, number> = { Beginner: 1, Intermediate: 2, Advanced: 3 };

// Three bars, filled to the level — reads like a signal meter instead of a traffic light.
const DifficultyMeter: React.FC<{ difficulty: string; label?: boolean }> = ({ difficulty, label = true }) => {
  const level = DIFFICULTY_LEVEL[difficulty] ?? 1;
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-zinc-400">
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={clsx('w-[3px] rounded-full', n <= level ? 'bg-zinc-200' : 'bg-white/[0.14]')}
            style={{ height: 4 + n * 3 }}
          />
        ))}
      </span>
      {label && difficulty}
    </span>
  );
};

// Win rate as a closing ring. The arc draws itself in on mount.
const WinRing: React.FC<{ value: number; size: number; stroke: number; children?: React.ReactNode }> = ({ value, size, stroke, children }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--tp-green))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c.toFixed(2)}
          strokeDashoffset={(c * (1 - value / 100)).toFixed(2)}
          className="tp-ring"
          style={{ ['--c' as string]: c.toFixed(2) }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
};

// An illustrative price path for the setup — seeded by id so it never changes between renders.
const SetupSketch: React.FC<{ id: string; className?: string }> = ({ id, className }) => {
  const short = CHART_DIR_BY_ID[id]?.dir === 'Short';
  let h = seedFor(id) || 1;
  const rnd = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
  const n = 38;
  let price = 50;
  const candles = Array.from({ length: n }, (_, i) => {
    const pullback = i > 11 && i < 18;
    const drift = (short ? -1 : 1) * (pullback ? -1.5 : 1.15);
    const move = (rnd() - 0.5) * 6 + drift;
    const o = price;
    const c = price + move;
    const hi = Math.max(o, c) + rnd() * 2.4;
    const lo = Math.min(o, c) - rnd() * 2.4;
    price = c;
    return { o, c, hi, lo };
  });
  const max = Math.max(...candles.map((k) => k.hi));
  const min = Math.min(...candles.map((k) => k.lo));
  const W = 420, H = 200;
  const y = (p: number) => 8 + ((max - p) / (max - min || 1)) * (H - 16);
  const slot = W / n;
  const level = candles[17].c;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      <line x1="0" x2={W} y1={y(level).toFixed(1)} y2={y(level).toFixed(1)} stroke="rgba(255,255,255,0.22)" strokeDasharray="2 5" />
      {candles.map((k, i) => {
        const up = k.c >= k.o;
        const x = i * slot + slot / 2;
        const top = y(Math.max(k.o, k.c));
        const bodyH = Math.max(1.5, Math.abs(y(k.o) - y(k.c)));
        const fill = up ? 'rgb(var(--tp-green))' : 'rgba(255,255,255,0.3)';
        return (
          <g key={i}>
            <line x1={x.toFixed(1)} x2={x.toFixed(1)} y1={y(k.hi).toFixed(1)} y2={y(k.lo).toFixed(1)} stroke={fill} strokeWidth="1" />
            <rect x={(x - slot * 0.28).toFixed(1)} y={top.toFixed(1)} width={(slot * 0.56).toFixed(1)} height={bodyH.toFixed(1)} rx="1.2" fill={fill} />
          </g>
        );
      })}
    </svg>
  );
};

const shortFrame = (tf: string) => tf.split(' / ')[0];

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={clsx('text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500', className)}>{children}</div>
);

const SectionHeader: React.FC<{ title: string; hint?: string; count?: number }> = ({ title, hint, count }) => (
  <div className="mb-3 flex items-baseline justify-between gap-4 px-1">
    <div className="flex items-baseline gap-2">
      <h2 className="text-[20px] font-bold tracking-tight text-white">{title}</h2>
      {count !== undefined && <span className="text-[15px] tabular-nums text-zinc-500">{count}</span>}
    </div>
    {hint && <span className="hidden text-[13px] text-zinc-500 sm:block">{hint}</span>}
  </div>
);

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0">
    <Eyebrow>{label}</Eyebrow>
    <div className="mt-1 truncate text-[17px] font-semibold tabular-nums text-white">{value}</div>
  </div>
);

// The number-one playbook gets the room: the win rate ring, the setup sketch, and the facts that matter.
const FeatureCard: React.FC<{ strategy: PlaybookStrategy; onSelect: () => void }> = ({ strategy, onSelect }) => {
  const cs = communityStats(strategy);
  const rec = recommendationFor(strategy.winRate);
  return (
    <button
      onClick={onSelect}
      className="tp-press tp-rise group relative flex h-full min-h-[340px] w-full flex-col overflow-hidden rounded-3xl bg-tp-card text-left shadow-lift ring-1 ring-inset ring-white/[0.07] hover:bg-tp-raised/60"
    >
      <div className="relative flex items-start justify-between gap-6 p-7 pb-0">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-tp-orange">
            <Trophy className="h-4 w-4" />
            No. 1 by win rate
          </div>
          <h3 className="mt-3 text-balance text-[26px] font-bold leading-[1.12] tracking-[-0.03em] text-white xl:text-[30px]">{strategy.name}</h3>
          <p className="mt-2 text-[17px] leading-snug text-zinc-400">{TAGLINE_BY_ID[strategy.id] ?? strategy.marketCondition}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-zinc-400">
            <DifficultyMeter difficulty={strategy.difficulty} />
            <span>{CATEGORY_BY_ID[strategy.id] ?? 'Strategy'}</span>
            <span className="tabular-nums">{shortFrame(strategy.timeframe)}</span>
          </div>
        </div>
        <WinRing value={strategy.winRate} size={108} stroke={9}>
          <span className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-white">{strategy.winRate}<span className="text-[16px] text-zinc-400">%</span></span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Backtest</span>
        </WinRing>
      </div>
      <SetupSketch
        id={strategy.id}
        className="pointer-events-none mt-2 min-h-[96px] w-full flex-1 opacity-70 transition-opacity duration-500 group-hover:opacity-100 [mask-image:linear-gradient(90deg,transparent,black_45%)]"
      />
      <div className="relative grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.07] bg-black/25 px-7 py-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
        <Fact label="Community" value={`${cs.communityWR}%`} />
        <Fact label="Avg R" value={`${cs.avgR}R`} />
        <Fact label="Risk : reward" value={strategy.riskReward} />
        <span className="col-span-2 inline-flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
          <span className="text-[13px] text-zinc-500 sm:hidden">{rec.label}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-black transition-transform duration-500 ease-spring group-hover:translate-x-0.5">
            Open
            <ChevronRight className="h-4 w-4" strokeWidth={2.6} />
          </span>
        </span>
      </div>
    </button>
  );
};

const RunnerUpCard: React.FC<{ strategy: PlaybookStrategy; rank: number; delay: number; onSelect: () => void }> = ({ strategy, rank, delay, onSelect }) => (
  <button
    onClick={onSelect}
    style={{ animationDelay: `${delay}ms` }}
    className="tp-press tp-rise group flex w-full flex-1 items-center gap-5 rounded-3xl bg-tp-card p-6 text-left shadow-lift ring-1 ring-inset ring-white/[0.07] hover:bg-tp-raised/60"
  >
    <div className="min-w-0 flex-1">
      <div className="text-[13px] font-semibold text-zinc-500">No. {rank + 1}</div>
      <h3 className="mt-1.5 line-clamp-2 text-[20px] font-bold leading-tight tracking-tight text-white">{strategy.name}</h3>
      <p className="mt-1 line-clamp-1 text-[15px] text-zinc-400">{TAGLINE_BY_ID[strategy.id] ?? strategy.marketCondition}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-zinc-400">
        <DifficultyMeter difficulty={strategy.difficulty} />
        <span className="tabular-nums">{shortFrame(strategy.timeframe)}</span>
      </div>
    </div>
    <WinRing value={strategy.winRate} size={72} stroke={7}>
      <span className="text-[19px] font-bold leading-none tabular-nums text-white">{strategy.winRate}<span className="text-[11px] text-zinc-400">%</span></span>
    </WinRing>
  </button>
);

const LIST_GRID =
  'grid items-center gap-x-4 grid-cols-[1.75rem_minmax(0,1fr)_4.5rem_1rem] md:grid-cols-[1.75rem_minmax(0,1fr)_8rem_6.5rem_3.5rem_8.5rem_1rem] xl:grid-cols-[1.75rem_minmax(0,1.5fr)_9rem_8rem_7.5rem_3.5rem_9rem_1rem]';

const PlaybookRow: React.FC<{ strategy: PlaybookStrategy; rank: number; first: boolean; onSelect: () => void }> = ({ strategy, rank, first, onSelect }) => {
  const cs = communityStats(strategy);
  return (
    <button
      onClick={onSelect}
      className={clsx(LIST_GRID, 'group relative w-full px-5 py-3.5 text-left hover:bg-white/[0.04] active:bg-white/[0.07]')}
    >
      {!first && <span className="absolute left-[4rem] right-0 top-0 h-px bg-white/[0.06]" aria-hidden />}
      <span className={clsx('text-[15px] font-semibold tabular-nums', rank < 3 ? 'text-tp-orange' : 'text-zinc-500')}>{rank + 1}</span>
      <span className="min-w-0">
        <span className="block truncate text-[16px] font-semibold tracking-tight text-white">{strategy.name}</span>
        <span className="mt-0.5 block truncate text-[13px] text-zinc-500">{TAGLINE_BY_ID[strategy.id] ?? strategy.marketCondition}</span>
      </span>
      <span className="hidden truncate text-[13px] text-zinc-400 xl:block">{CATEGORY_BY_ID[strategy.id] ?? 'Strategy'}</span>
      <span className="hidden md:block"><DifficultyMeter difficulty={strategy.difficulty} /></span>
      <span className="hidden truncate text-[13px] tabular-nums text-zinc-400 md:block">{shortFrame(strategy.timeframe)}</span>
      <span className="hidden text-[15px] font-medium tabular-nums text-zinc-300 md:block">{cs.avgR}R</span>
      <span className="flex items-center justify-end gap-3 md:justify-start">
        <span className="w-10 text-right text-[16px] font-semibold tabular-nums text-white md:text-left">{strategy.winRate}%</span>
        <span className="hidden h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08] md:block" aria-hidden>
          <span className="block h-full rounded-full bg-tp-green" style={{ width: `${strategy.winRate}%` }} />
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-zinc-600 transition-transform duration-500 ease-spring group-hover:translate-x-0.5 group-hover:text-zinc-300" />
    </button>
  );
};

// Gallery view: every playbook leads with its setup sketch.
const GalleryCard: React.FC<{ strategy: PlaybookStrategy; rank: number; onSelect: () => void }> = ({ strategy, rank, onSelect }) => (
  <button
    onClick={onSelect}
    className="tp-press group flex h-full w-full flex-col overflow-hidden rounded-3xl bg-tp-card text-left shadow-lift ring-1 ring-inset ring-white/[0.07] hover:bg-tp-raised/60"
  >
    <div className="relative h-[136px] w-full overflow-hidden bg-tp-base/70">
      <SetupSketch
        id={strategy.id}
        className="absolute inset-x-0 bottom-0 h-[78%] w-full opacity-60 transition-[opacity,transform] duration-700 ease-spring group-hover:scale-[1.04] group-hover:opacity-100 [mask-image:linear-gradient(180deg,black_55%,transparent)]"
      />
      <span className={clsx('absolute left-5 top-4 text-[13px] font-semibold tabular-nums', strategy.untested ? 'text-tp-blue' : rank < 3 ? 'text-tp-orange' : 'text-zinc-400')}>
        {strategy.untested ? 'Options' : `No. ${rank + 1}`}
      </span>
      <span className="tp-material-thin absolute right-4 top-3.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-zinc-200">
        {CATEGORY_BY_ID[strategy.id] ?? 'Strategy'}
      </span>
    </div>
    <div className="flex flex-1 items-center gap-4 p-5">
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[18px] font-bold leading-tight tracking-tight text-white">{strategy.name}</h3>
        <p className="mt-1 line-clamp-1 text-[14px] text-zinc-400">{TAGLINE_BY_ID[strategy.id] ?? strategy.marketCondition}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-zinc-400">
          <DifficultyMeter difficulty={strategy.difficulty} />
          <span className="tabular-nums">{shortFrame(strategy.timeframe)}</span>
        </div>
      </div>
      {strategy.untested ? (
        <span className="shrink-0 rounded-full bg-tp-fill px-2.5 py-1 text-[12px] font-semibold text-zinc-300">Not tested</span>
      ) : (
        <WinRing value={strategy.winRate} size={60} stroke={6}>
          <span className="text-[16px] font-bold leading-none tabular-nums text-white">{strategy.winRate}<span className="text-[10px] text-zinc-400">%</span></span>
        </WinRing>
      )}
    </div>
  </button>
);

const CustomCard: React.FC<{ strategy: PlaybookStrategy; onSelect: () => void }> = ({ strategy, onSelect }) => (
  <button
    onClick={onSelect}
    className="tp-press group flex h-full min-h-[168px] w-full flex-col rounded-3xl bg-tp-card p-6 text-left shadow-lift ring-1 ring-inset ring-white/[0.07] hover:bg-tp-raised/60"
  >
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-tp-green">
        <Wand2 className="h-3.5 w-3.5" /> Yours
      </span>
      <span className="text-[13px] text-zinc-500">Not backtested</span>
    </div>
    <h3 className="mt-3 line-clamp-2 text-[20px] font-bold leading-tight tracking-tight text-white">{strategy.name}</h3>
    <p className="mt-1 line-clamp-2 text-[15px] text-zinc-400">{strategy.tagline || strategy.description}</p>
    <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[13px] text-zinc-500">
      <span className="flex min-w-0 items-center gap-4">
        <DifficultyMeter difficulty={strategy.difficulty} />
        <span className="truncate tabular-nums">{strategy.timeframe} · {strategy.riskReward}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 group-hover:text-zinc-300" />
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
  /** Options playbooks trade contracts on stocks and ETFs; everything else is futures. */
  market?: 'options';
  /** A starter template with no backtest behind it. Kept out of the win-rate ranking. */
  untested?: boolean;
  /** How an options playbook is traded: what to buy and where it is wrong. */
  optionsPlan?: { underlying: string; contract: string; short: string; stop: string; target: string; stopPct: number };
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
    id: 'supply-demand-zones',
    name: 'Supply & Demand Zones (Octavia)',
    description:
      'Short from fresh supply zones, long from fresh demand zones, drawn off the basing candle before the impulsive move. How Abe likes to trade S/R, from octavia.trades.',
    difficulty: 'Intermediate',
    timeframe: '1m - 5m',
    winRate: 73,
    riskReward: '1:2',
    marketCondition: 'NQ & ES morning rush — trending and range-bound',
    overview:
      'Supply and demand zones are price areas where institutions loaded so much size that the move became a vertical impulse. The sellers left a supply zone above; the buyers left a demand zone below. When price returns to that zone, the same side steps in again, and the auction fails there — that is the setup.\n\nThe rule from octavia.trades (8 years on the same instrument): draw the zone from the small basing candle that sits RIGHT BEFORE the larger impulsive candle. For a demand zone, a small bullish basing candle before a larger bullish candle. For a supply zone, the mirror. Then you only trade fresh zones: short from supply, long from demand, on the first meaningful retest.\n\nAbe adaptation: her clean version runs on the 5-minute chart. The same logic works on 1m for tighter entries once the 5m zone and rejection are confirmed. Her chart background also shows FVG and CHoCH labels, so confluence is welcome but the zone is the edge.',
    glossary: [
      { term: 'Supply zone', meaning: 'An area where big selling overwhelmed buying and price launched downward. Sellers defend it on the retest. Shorts only.' },
      { term: 'Demand zone', meaning: 'An area where big buying overwhelmed selling and price launched upward. Buyers defend it on the retest. Longs only.' },
      { term: 'Fresh zone', meaning: 'A zone price has not yet returned to. The first retest is the highest probability; the second and third are weaker.' },
      { term: 'Basing candle', meaning: 'The small consolidation candle right before the impulsive move. The zone is drawn from this base, not from the whole impulse.' },
      { term: 'CHoCH', meaning: 'Change of character. A 1m/5m structure break that confirms the rejection is real and the retest is turning.' },
    ],
    anatomy: [
      {
        title: 'Mark the zones off the base, not the impulse',
        points: [
          'On the 5m chart, find vertical moves where price shot away from a small basing candle.',
          'Demand zone = the base of an up-impulse. Supply zone = the base of a down-impulse.',
          'Keep zones tight. A zone spanning the whole impulse is too wide and useless.',
        ],
      },
      {
        title: 'Price returns to the zone (the retest)',
        points: [
          'Only trade fresh zones. If price has already been back once, the edge drops fast.',
          'Wait for price to trade INTO the zone. Do not enter halfway to it.',
          'Supply zones only short. Demand zones only long. Never the other way around.',
        ],
      },
      {
        title: 'The rejection confirms the zone holds',
        points: [
          'Look for a long wick, an engulfing candle, or a clear 1m structure break (CHoCH) inside the zone.',
          'Enter on the confirmation candle close, not the first wick.',
          'On 1m, the entry candle is tighter and the stop is tighter — that is the Abe adaptation of her 5m style.',
        ],
      },
      {
        title: 'Stop beyond the zone, target the next one',
        points: [
          'Stop above/below the zone edge plus a small buffer for wick noise (e.g. 10-20 NQ points).',
          'Target the next conflicting zone or a measured move of the original impulse.',
          'Scale: 1:1 partial to breakeven, then trail the rest with 1m structure.',
        ],
      },
    ],
    entryRules: [
      'Only trade fresh zones — the first retest is the highest probability',
      'Draw the zone from the small basing candle right before the larger impulsive candle (bullish basing candle for demand, bearish for supply)',
      'Find the zone and the setup on the 5m chart (her clean level). Drop to 1m for the precise entry (Abe preference)',
      'Wait for price to return INTO the zone, then look for rejection: long wick, engulfing, or a 1m CHoCH',
      'Enter on the confirmation candle close in the zone direction — a wick poke through is not entry',
      'Supply zones = shorts only. Demand zones = longs only.',
    ],
    exitRules: [
      'Target the next opposite zone, or a measured move of the impulsive leg',
      'Take partial profits at 1:1 and move the stop to breakeven',
      'Trail the remainder along 1m structure once in profit',
      'Exit if price closes back through the zone against you — the level failed',
    ],
    riskManagement: [
      'Stop beyond the zone edge plus a buffer (e.g. 10-20 NQ points on micros) — never inside the zone where the wick will tag it',
      'Risk 0.5-1% per trade and size with the sizer; a 20-point NQ stop with $200 risk = 5 micros',
      'After a zone is retested once, demote it. Fresh is the whole game',
      'Morning rush on NQ & ES has the cleanest zones; stale midday zones are chop traps',
      'Journal every zone trade (she uses Tradezella) so the first-retest edge is measurable',
    ],
    examples: [
      {
        title: 'NQ long from a fresh demand zone',
        description: 'Illustrative numbers on micro NQ.',
        setup: '5m demand zone drawn off a bullish basing candle at 19,850 that preceded a 120-point up-impulse. Price rotates back into 19,845-19,860 on the 5m.',
        entry: '1m CHoCH up inside the zone with a strong body close. Long 19,860. Stop 20 pts below zone → 19,825.',
        exit: 'Target prior supply zone / measured move ~20,000. Partial at +40, breakeven, trail the rest.',
        result: 'Illustrative: full script pays close to 1:2.5; partial+trail typical 1:2',
      },
      {
        title: 'ES short from a fresh supply zone',
        description: 'The mirror image on micro ES.',
        setup: '5m supply zone at 6,075 from a bearish basing candle before a 60-point down-impulse. Price rallies back into the zone late session.',
        entry: '1m CHoCH down with a rejection candle close. Short 6,074. Stop 12 pts above zone edge → 6,089.',
        exit: 'Target the demand zone below at 6,020 / measured move. Partial at 1:1, trail the rest.',
        result: 'Illustrative: zone rejects and price dumps to the measured target',
      },
      {
        title: 'Daily tape replay from her reel',
        description: 'From the octavia.trades IG reel.',
        setup: 'She marks both SUPPLY and DEMAND zones on the chart, labels SELLING INTEREST on supply and BUYING PRESSURE on demand, and shows fresh demand drawn from a smaller bullish basing candle before a larger bullish candle.',
        entry: 'Short from supply on the retest, long from demand on the retest — with the smaller basing candle as the zone origin',
        exit: 'Next zone or structure target; trade the morning rush NQ & ES',
        result: 'Her claim: 8 years on the same instrument, same strategy, journaled on Tradezella',
      },
    ],
    tips: [
      'The zone is the base candle, not the whole move — this is the single most important lesson from the reel',
      '5m zone context with a 1m entry is the sweet spot on micros; pure 5m entries are also fine when the rejection is obvious',
      'Confluence helps: her charts carry FVG and CHoCH labels alongside the zones',
      'Fresh zones at the morning open of NQ & ES are the cleanest trades of the day',
      'If you can mark zones on a clean chart with three lines, you can trade this — it is not an indicator, it is structure',
    ],
    commonMistakes: [
      'Trading zones that have already been retested — old S/R gets picked over fast',
      'Drawing the zone across the whole impulse instead of the basing candle',
      'Entering mid-zone instead of waiting for price to reach it',
      'Buying the wick instead of the confirmation candle close',
      'Fighting the zone direction: shorting a demand zone or longing a supply zone',
      'Zones too wide or drawn on a messy timeframe — 5m keeps them tight',
    ],
    source: {
      url: 'https://www.instagram.com/reel/DdUGLpAv5V3/',
      title: 'octavia.trades — super simple supply & demand explanation (IG reel)',
    },
    sourceClaims: [
      'Same instrument and same strategy for 8 years',
      'Demand zones drawn from a smaller bullish basing candle right before a larger bullish candle (mirror for supply)',
      'Short from fresh supply zones, long from fresh demand zones',
      'Journaled on Tradezella',
    ],
    openQuestions: [
      'Exact stop placement relative to the zone in her version is inferred, not stated',
      'Whether she enters on candle close or waits for a full retest candle is inferred from frames',
    ],
    seed: {
      videos: [
        {
          id: 'vid-octavia-sd',
          title: 'Supply & Demand Zones — octavia.trades (IG reel)',
          url: 'https://www.instagram.com/reel/DdUGLpAv5V3/',
          notes:
            'Text-overlay explanation reel. Short from fresh SUPPLY zones (selling interest), long from fresh DEMAND zones (buying pressure). Draw demand zones from a smaller bullish basing candle right before the larger bullish candle; mirror for supply. 5m execution, NQ & ES morning rush. Her chart background also shows FVG + CHoCH labels. 8 years same instrument, journaled on Tradezella. 582 likes, posted 2026-09-15.',
        },
        {
          id: 'vid-octavia-consistency-post',
          title: '8 years of consistency + Tradezella journaling — octavia.trades (IG post)',
          url: 'https://www.instagram.com/p/DdtvDZIDo11/?img_index=10',
          notes:
            '15-image carousel from Octavia Grace on the same Supply & Demand zone style. Theme: "I have been trading the same instrument using the same strategy for the past 8 years and that consistency has led to my success." Slides also promote her Tradezella journaling setup: trade logs, detailed analytics, performance reports, replay, psychology tracking, 20% off via her bio link. The journaling point matters for this playbook: the first-retest edge has to be measured, and this is where she measures it. 1,437 likes.',
        },
      ],
    },
  },
  {
    id: 'law-of-10-risk',
    name: 'The Law of 10 (Risk Sizing)',
    description:
      'Prop-firm risk model: risk 1/10th of your max drawdown on every trade, recompiled after every trade. Protect payouts, scale as the cushion grows. From saiyan_trades.',
    difficulty: 'Intermediate',
    timeframe: 'Any timeframe',
    winRate: 70,
    riskReward: 'Risk model — not a fixed R',
    marketCondition: 'Any — built for prop firm evals',
    overview:
      'The Law of 10 is a risk management framework, not an entry strategy. It answers one question: how much do I risk on the next trade? You take your max drawdown, divide it by 10, and that number is your per-trade risk. Then you recompile it after EVERY trade, so a loss shrinks your risk and a win grows it.\n\nThe reel walks a $50k account with a $2,000 max drawdown: trade one risks $200. A loss drops the cushion to $1,800, so trade two risks $180. A $400 win brings it to $2,200, so the next trade risks $220. You are always protecting the downside while scaling up as you build more drawdown to work with.\n\nThe math behind it: at a 50% win rate over 100 trades, the probability of hitting 10 straight losses is around 4.4% (exact computation: 4.37%), which is low enough to survive rough patches without blowing the account. saiyan_trades says it took him two years to land on this and that most consistently paying prop traders he knows use some form of it.\n\nAbe adaptation on $100k futures evals: a $3,000 drawdown means $300 risk per trade; a $4,000 drawdown means $400. On MNQ (about $2 per point) a 20-point stop fits $300 with 7 micros; on MES (about $5 per point) it fits 3 micros.',
    glossary: [
      { term: 'Max drawdown', meaning: 'The most your prop account can lose before failing the eval or payout eligibility. The denominator of the Law of 10.' },
      { term: 'Cushion', meaning: 'The drawdown you still have left to work with after wins and losses. Risk is always 1/10th of the CURRENT cushion, not the original number.' },
      { term: 'Dynamic risk', meaning: 'Per-trade risk that recompiles after every trade instead of staying fixed forever.' },
      { term: 'Trailing drawdown', meaning: 'A max loss that follows your account balance up (common in futures evals). The cushion is measured from the trailing balance.' },
      { term: 'Streak risk', meaning: 'The probability of a long losing streak in your sample. At 50/50 over 100 trades, 10 straight losses is about a 4.4% event.' },
    ],
    anatomy: [
      {
        title: 'Find your max drawdown',
        points: [
          'On a prop eval it is stated: $50k account, $2,000 max drawdown is the classic example.',
          'For Abe on $100k futures evals: $3,000 to $4,000 drawdown.',
          'If the drawdown is trailing, measure it from the live balance after each trade.',
        ],
      },
      {
        title: 'Divide by 10 — that is the per-trade risk',
        points: [
          '$2,000 / 10 = $200 risk on the first trade.',
          '$3,000 / 10 = $300. $4,000 / 10 = $400.',
          'This is the maximum you can lose on that single trade, stop included.',
        ],
      },
      {
        title: 'Recompile after every single trade',
        points: [
          'Loss: cushion $1,800 -> next risk $180. You risk LESS after a loss.',
          'Win: cushion $2,200 -> next risk $220. You risk MORE after a win.',
          'The engine is the recompile. Fixed risk forever is a different, worse game.',
        ],
      },
      {
        title: 'Protect payouts, scale as the cushion grows',
        points: [
          'The framework is built for prop firm economics: keep the account alive and paying.',
          'As the account grows, the cushion grows, and your risk number grows with it.',
          'Never over-leverage: size the micros so the stop distance equals the risk number exactly.',
        ],
      },
    ],
    entryRules: [
      'Risk = current cushion / 10 for the next trade, nothing else',
      '$50k eval with $2,000 max drawdown -> $200 risk on trade one',
      'After a loss, risk less ($1,800 cushion -> $180)',
      'After a win, risk more ($2,200 cushion -> $220)',
      'Size micros so the stop distance in points times point value equals the risk number: 20pt stop on MNQ at $2/pt with $300 risk = 7 micros; on MES at $5/pt = 3 micros',
      'Pair with any entry playbook; this only decides size',
    ],
    exitRules: [
      'The stop is always the risk number from the Law of 10, never wider',
      'Cut losers at the stop; the next trade automatically risks less',
      'Scale out at targets, then recompile risk for the next trade',
      'If you hit the cushion limit, stop for the day — the account is the business',
    ],
    riskManagement: [
      'Law of 10: max drawdown / 10 = per-trade risk, recompiled after every trade',
      'Streak math: at 50% win rate over 100 trades, 10 straight losses is about a 4.4% event (exact: 4.37%), which is survivable',
      'Adapt to your own data: his caption says if your journal shows 7-loss streaks are rare, you can tune the divisor; the key is managing from risk, not profits',
      'Protect the payout first: risk off the cushion, never off hoped-for profits',
      'No martingale: never double risk after a loss — the Law already shrinks you',
      'Abe adaptation: $100k futures with $3,000 drawdown = $300 risk; $4,000 = $400 risk (MNQ ~$2/pt, MES ~$5/pt)',
    ],
    examples: [
      {
        title: 'The reel walkthrough: $50k eval, $2,000 drawdown',
        description: 'Direct from saiyan_trades.',
        setup: '$50,000 account, $2,000 max drawdown. First trade risks $200 (2,000 / 10).',
        entry: 'Trade one loses -> balance cushion $1,800 -> next risk $180. Trade two wins $400 -> cushion $2,200 -> next risk $220.',
        exit: 'Constants: divide the live cushion by 10 after every fill.',
        result: 'Downside always protected, upside scaled as the cushion grows',
      },
      {
        title: 'Abe adaptation: $100k futures, $3,000 drawdown',
        description: 'Micro futures example.',
        setup: '$100,000 eval with $3,000 max drawdown -> $300 risk on the first trade.',
        entry: 'Trade plan with a 20-point stop on MNQ (~$2/pt): $300 / (20 x $2) = 7 micros. On MES (~$5/pt): $300 / (20 x $5) = 3 micros.',
        exit: 'If the trade loses, cushion is $2,700 -> next risk $270. If it wins $600, cushion $3,600 -> next risk $360.',
        result: 'Ten straight losses (a ~4.4% event at 50% win rate) costs roughly the eval before you adapt — survivable by design',
      },
      {
        title: 'Why it beats fixed risk',
        description: 'The edge is the recompile.',
        setup: 'Fixed risk keeps risking the same amount after losses; Law of 10 de-risks after losses and compounds after wins.',
        entry: 'Losses shrink exposure automatically, which is what actually protects the drawdown line.',
        exit: 'Wins grow exposure only after the cushion is proven.',
        result: 'Designed for prop firm payout economics, not max profit per trade',
      },
    ],
    tips: [
      'This is a risk engine, not an edge. Run it on top of any playbook you already trust',
      'Recompile after EVERY trade. Skipping the recompile breaks the whole point',
      'Journal to find YOUR streak data, then tune the divisor to it (his caption says exactly this)',
      'Take payouts when earned — the cushion resets and the Law keeps protecting you',
      'Write the risk number down BEFORE the trade; do not compute it while in the trade',
    ],
    commonMistakes: [
      'Risking 1/10 of the ORIGINAL drawdown even after losses instead of the live cushion',
      'Doubling risk after losses to chase (martingale) — the Law shrinks you on purpose',
      'Never tuning the divisor because you have no streak data from a journal',
      'Wide stops with oversized micros that break the risk number',
      'Treating it as an entry signal — it is size only',
    ],
    source: {
      url: 'https://www.instagram.com/reel/Db51M6lBdkX/',
      title: 'saiyan_trades — the Law of 10 risk management for prop firms (IG reel)',
    },
    sourceClaims: [
      'Took two years to figure out; most successful prop traders he knows use some form of it',
      '$50k account, $2,000 max drawdown example: risk $200, then $180 after a loss, $220 after a win',
      'At 50% win rate over 100 trades, 10 losses in a row is about a 4.41% event (exact computation: 4.37%)',
      'He calls it the Law of 10',
    ],
    openQuestions: [
      'Exact handling of trailing vs static drawdown in his version is inferred from the caption',
      'His exact tuning rule for the divisor beyond the base example is not stated in the reel',
    ],
    seed: {
      videos: [
        {
          id: 'vid-law-of-10',
          title: 'The Law of 10 — saiyan_trades (IG reel)',
          url: 'https://www.instagram.com/reel/Db51M6lBdkX/',
          notes:
            'Risk management for prop firms. Divide your max drawdown by 10 = per-trade risk; recompile after every trade ($50k/$2k -> $200, then $180 after a loss, $220 after a win). At 50% win rate over 100 trades, 10 straight losses is ~4.4%. Protect payouts, never over-leverage, scale as the cushion grows. His caption adds: tune the divisor to your own streak data, manage the business from risk not profits. 2,024 likes, posted 2026-09-18 by saiyan_trades (SSJ).',
        },
      ],
    },
  },
  {
    id: 'prop-firm-copy-trading',
    name: 'Prop Firm Copy Trading Blueprint',
    description:
      'Copy trade across prop firms: straight-to-funded 150K, fixed base size, scale into winners, risk as the only edge. A workflow and discipline model, not an entry signal. From thestrongtrader.',
    difficulty: 'Intermediate',
    timeframe: 'Any timeframe',
    winRate: 60,
    riskReward: 'Scaling — low win rate, high avg multiple',
    marketCondition: 'Prop firm accounts — MNQ, YM',
    overview:
      'Tanner Owings (thestrongtrader) turnover earning $40,000 in payouts over two months copy trading multiple prop firms without blowing any account. The blueprint is three pillars. One, go straight to funded 150K accounts — the biggest size, with the 20% consistency rule, which stops home-run hunting and gives exact daily target and daily max loss. Two, scale into trades: every trade starts at the same base size (YM 1 contract, MNQ 3 contracts on a 150K), and only once you are on the right side of the move with higher expected value do you add, moving the original stop up to the next structure. Three, emotional regulation: risk is the only thing that matters, and if you lose sight of it for one day you are done. For copy trading he is explicit: do not copy trade until you can take a payout with one firm first, scale within a single firm before mixing firms, and respect risk day in and day out. He names Top 1 Futures for within-firm copy trading scaling with code STRONG.',
    glossary: [
      { term: 'Straight to funded', meaning: 'Skipping the eval grind and trading 150K funded accounts directly for payouts. He finds more breathing room there.' },
      { term: '20% consistency rule', meaning: 'A prop rule capping how much any one day may contribute to profit. He treats it as protection that stops him hunting home runs.' },
      { term: 'Copy trading', meaning: 'Running the same strategy across multiple funded accounts, often within one prop firm, to multiply payouts.' },
      { term: 'Scale in', meaning: 'Starting a trade at a fixed base size and adding contracts only once the move is working in your favor, moving the stop up each time.' },
      { term: 'Average multiple', meaning: 'The size of average winners relative to average losers. A lower win rate is fine when winners are larger.' },
    ],
    anatomy: [
      {
        title: 'Go straight to funded 150K',
        points: [
          'Skip the eval grind: trade the largest funded size directly.',
          'The 20% consistency rule keeps you from chasing home runs.',
          'You always know the daily target and the daily loss that could ruin you.',
        ],
      },
      {
        title: 'Fixed base size on every trade',
        points: [
          'YM: 1 contract on a 150K account. MNQ: 3 contracts.',
          'The starting size never changes — consistency is the foundation.',
          'A lower win rate is acceptable because the average winner is bigger.',
        ],
      },
      {
        title: 'Scale in on the right side of the V',
        points: [
          'Add size only once the move is working and expected value is higher.',
          'Do not scale into losers — that is pyramiding the wrong way.',
          'Move the original stop up to the next structure that could take you out.',
        ],
      },
      {
        title: 'Risk is the only thing that matters',
        points: [
          'One careless day can blow the accounts (his words).',
          'Emotional regulation: if the market has you upset, walk away — that is a valid non-trade.',
          'Scale within one firm before mixing firms in a copy trade.',
        ],
      },
    ],
    entryRules: [
      'Trade straight-to-funded 150K accounts with the 20% consistency rule for breathing room',
      'Start EVERY trade at the same base size: YM 1 contract, MNQ 3 contracts on a 150K',
      'Accept a lower win rate as long as the average winner multiple is higher',
      'Scale in only once you are on the right side of the move, odds are in your favor, and expected value is higher',
      'After scaling, move the original stop up to the next structure, never down',
      'Do not copy trade until you can first take a payout with a single firm',
    ],
    exitRules: [
      'Base stop stays where the single-contract plan put it; trail to structure after scaling',
      'Do not go for home runs — the daily target and daily max loss are fixed commitments',
      'If the market has you angry, step away: emotional regulation is part of the exit',
      'Take payouts when available; this business is built on them',
    ],
    riskManagement: [
      'Fixed base size per account: YM 1 contract / MNQ 3 contracts on 150K',
      'Exposure grows only by scaling into confirmed winners (right side of the V), never into losers',
      'Stops move up to structure after adding, never wider than the base plan',
      'Risk is the only thing that matters — a single careless day can end the run',
      'Copy trade within one firm first (5-10-20 accounts) before mixing firms',
      'Daily consistency cap gives a hard target and a hard max loss',
    ],
    examples: [
      {
        title: 'The source run: $40k payouts, two months',
        description: 'From thestrongtrader reel.',
        setup: 'Copy trading multiple prop firms, straight-to-funded 150K accounts, MNQ and YM.',
        entry: 'Same base size every trade, scale in on the right side of the V, stop moved up to structure.',
        exit: 'Takes payouts as they come; knows his daily consistency number.',
        result: '$40,000 in payouts, none of the accounts blown',
      },
      {
        title: 'MNQ scale-in example',
        description: 'Micro Nasdaq on a 150K funded account.',
        setup: 'Short bias, three MNQ at the base entry, stop at the swing high.',
        entry: 'Price confirms lower high / higher EV, close above the low: add more MNQ and trail the stop to the next structure.',
        exit: 'Original stop moved up; risk is now carried by the winners, not the base entry.',
        result: 'Base sized by the account, exposure scaled by evidence (illustrative mechanics)',
      },
      {
        title: 'YM single-contract base',
        description: 'Dow, one YM contract on a 150K.',
        setup: 'Base position is a single YM contract; R is one contract worth.',
        entry: 'Adds a second contract only after the move proves it is on the right side of the V.',
        exit: 'Dollar risk stays the base contract plan because the stop tightens as you add.',
        result: 'Scaling changes the R multiple without raising the plan risk',
      },
    ],
    tips: [
      'This is a blueprint, not a signal: sizing, scaling and discipline across funded accounts',
      'Straight-to-funded skips the eval grind; the consistency rule is your friend, not a limit',
      'Scaling in trades a lower win rate for a higher average multiple — test it against your own journal before trusting it',
      'Emotional regulation is a valid exit rule: walk away the day the market tilts you',
      'He runs the strategy on MNQ and YM (sometimes oil)',
      'Top 1 Futures for within-firm copy trading scaling (3-5-10-20 accounts), code STRONG',
    ],
    commonMistakes: [
      'Copy trading before you can take a payout with one firm — he calls that a waste of money',
      'Scaling into losing trades, which inverts the whole method',
      'Widening the stop after adding instead of tightening to structure',
      'Chasing home runs and violating the daily consistency cap',
      'Letting tilt override the risk plan for a single day',
    ],
    source: {
      url: 'https://www.instagram.com/reel/DduBqiYOiAs/',
      title: 'thestrongtrader — the exact blueprint to copy trading and 20k months from prop firms',
    },
    sourceClaims: [
      '$40,000 in payouts in two months copy trading multiple prop firms, none blown',
      'Straight-to-funded 150K accounts with a 20% consistency rule',
      'Fixed base size (YM 1 contract, MNQ 3 contracts), scale in on the right side of the V',
      'Risk is the only thing that matters; emotional regulation daily',
    ],
    openQuestions: [
      'His exact 20% consistency daily number is not stated in the reel',
      'The specific add-on contract counts and exact stop structure are implied, not spelled out',
    ],
    seed: {
      videos: [
        {
          id: 'vid-prop-firm-blueprint',
          title: 'The exact blueprint for copy trading / 20k prop months — thestrongtrader (IG reel)',
          url: 'https://www.instagram.com/reel/DduBqiYOiAs/',
          notes:
            'Tanner Owings (thestrongtrader). $40k payouts in 2 months copy trading multiple prop firms, none blown. Three pillars: (1) straight to funded 150K with the 20% consistency rule, (2) scale IN — fixed base size (YM 1 contract, MNQ 3 contracts), add on the right side of the V and move the stop up to structure, (3) emotional regulation — respect risk daily, walk away when tilted. Copy trade rules: prove one payout first, scale within a firm (5-10-20 accounts), then mix firms. Names Top 1 Futures, code STRONG. 290 likes. This is a prop firm gameplay/risk model, not an entry signal.',
        },
      ],
    },
  },
  {
    id: 'prop-firm-eval-first-mindset',
    name: 'Eval-First Mindset (theerosee)',
    description:
      'Why some traders run evaluation accounts first: practice on play money, learn the charts and your own FOMO, before risking real funds. A mindset clip, not an entry strategy.',
    difficulty: 'Beginner',
    timeframe: 'Any timeframe',
    winRate: 65,
    riskReward: 'N/A — mindset only',
    marketCondition: 'Prop firm evaluations',
    overview:
      'A personal reel from theerosee. on why she does evaluation accounts before trading funded or with her own money. Her logic is that she learns by doing under supervision first, the way she spent a year or two under a mentor in real estate before taking on her own deals. On an eval account she plays with play money, in the process learning herself (the FOMO, the impatience), learning the charts and candles, and learning to judge whether it is a smart time to move in or whether the setup favors a long or a short. Good days and bad days do not cost her real money on the eval, but every day teaches something. She is upfront that the trading world splits around 50-50 on evaluations: some appreciate doing evals first, some call it a waste of time, and she says you have to know yourself. This clip contains no mechanical setup and no entry rules; it is a process and mindset argument for using evaluations as a low-cost training ground.',
    glossary: [
      { term: 'Evaluation account', meaning: 'A prop firm practice account funded with virtual money that, if you pass the rules, leads to a funded account. Here she uses it as cheap tuition.' },
      { term: 'Play money', meaning: 'Funds on an eval are simulation money, so losses do not touch your bankroll while you learn.' },
      { term: 'Mindset learning', meaning: 'Using the eval to expose your own FOMO, impatience and discipline before the stakes are real.' },
    ],
    anatomy: [
      {
        title: 'Learn yourself first',
        points: [
          'Use the eval to experience and name your FOMO and impatience without paying for it.',
          'She compares it to a year or two under a real-estate mentor before her own deals.',
          'The point is self-knowledge before real capital.',
        ],
      },
      {
        title: 'Learn the charts second',
        points: [
          'Read candles and price action in real time on the eval.',
          'Build the skill of judging whether a moment favors a long or a short.',
          'Reps compound without risking your bankroll.',
        ],
      },
      {
        title: 'Zero real-money risk while learning',
        points: [
          'Bad days and good days on the eval are play money; the lesson is the return.',
          'You progress to funded or live only after the process is second nature.',
          'Acknowledge the other camp: many call evals a waste of time — know which learner you are.',
        ],
      },
    ],
    entryRules: [
      'Treat the evaluation as your sandbox: it costs play money, it pays in reps',
      'Name what you feel (FOMO, impatience) on the eval before it can hurt you live',
      'Practice reading candles and judging long vs short setups on every eval trade',
      'Go funded or live only after the eval process feels routine',
    ],
    exitRules: [
      'This is not a strategy, so there is no mechanical exit to run',
      'The real exit rule is personal: walk away from evals when you are just gambling them for validation',
      'Move to funded when your eval process is consistent, not when you feel lucky',
    ],
    riskManagement: [
      'The eval caps your downside to practice money while the learning is real',
      'Your own funds stay protected until you have reps on the process',
      'Best used as cheap tuition for the FOMO, impatience and discipline you will face live',
    ],
    examples: [
      {
        title: 'The real estate analogy',
        description: 'Her core argument.',
        setup: 'Mentored in real estate for a year or two before her own deals.',
        entry: 'Applied the same rule to trading: learn on evals before funded or own money.',
        exit: 'Proceed when the process is second nature.',
        result: 'Low-cost training before real stakes (perspective, not a mechanical trade)',
      },
      {
        title: 'A bad week on the eval',
        description: 'What an eval losing streak is for.',
        setup: 'Multiple losing eval trades in a row, all play money.',
        entry: 'She reviews the losses, watches her own reactions, notes the impatience.',
        exit: 'No real capital lost; the lesson is banked.',
        result: 'The downside is capped; the learning is the payoff',
      },
    ],
    tips: [
      'Use evals as tuition, not as a second job or a gambling fix',
      'Watch your own tilt on the eval — that is the real data it produces',
      'If you already trade funded cleanly, this mindset clip is not for you',
      'Pair it with the Prop Firm Copy Trading and Law of 10 cards for the full prop-firm process picture',
    ],
    commonMistakes: [
      'Treating eval losses as if they were real and refusing to take the lesson',
      'Rushing straight to funded with no reps just because evals feel slow',
      'Confusing this mindset clip with a mechanical strategy',
    ],
    source: {
      url: 'https://www.instagram.com/reel/Dd5dmbrg9q5/',
      title: 'theerosee. — why I do evaluation accounts before trading (mindset reel)',
    },
    sourceClaims: [
      'She practices on evaluation accounts before funded or own funds',
      'Compares it to a year or two under a real-estate mentor before her own deals',
      'On evals she learns the charts, candles, FOMO and impatience with play money',
    ],
    openQuestions: [
      'This is a personal perspective, not a strategy — there are no mechanical rules to apply',
    ],
    seed: {
      videos: [
        {
          id: 'vid-prop-firm-eval-first',
          title: 'Why I do evaluation accounts first — theerosee. (IG reel)',
          url: 'https://www.instagram.com/reel/Dd5dmbrg9q5/',
          notes:
            'Personal mindset take on prop firm eval accounts (752 likes, no caption). She prefers to learn before her own funds, like the mentor-first years in her real estate career. Evals = play money while you learn yourself (FOMO, impatience), read charts/candles, and judge long vs short timing with no real downside. She flags the 50-50 debate on evals and says you have to know yourself. Contains no mechanical strategy or entry rules.',
        },
      ],
    },
  },
  {
    id: 'london-prev-day-levels',
    name: 'London & Previous Day Levels (Jope)',
    description:
      'Long or short off the London open and previous day high/low: front-run price into a prior daily level, enter on the reaction or 50% retracement, target 2R+. From jopetrades.',
    difficulty: 'Advanced',
    timeframe: '5m - 15m / London and NY sessions',
    winRate: 72,
    riskReward: '1:2+',
    marketCondition: 'London open + NY session, trending or reactive at PD levels',
    overview:
      'Jope (jopetrades) trades long or short off the London open and the previous day high and low (PDH / PDL). The core repeat is to wait until price drives INTO a prior daily level, then front-run it or enter on the reaction: the momentum push to the level, a 50% retracement of the push, or a retest confirmation. His Tuesday Sep 8 recap is the textbook example: he wanted the 50% retracement of the push up, did not get that exact fill, entered as price came back into the prior daily level around 10:15 AM Eastern, and banked a touch over 2R (2.23R, risking 45 points to make 98, $29,400 PNL) in about 45 minutes. His Friday Sep 25 clip shows the discipline side: a quick retest-based long that paid a modest scalp, then he stopped because he did not see a second set up he loved. Lesson: the edge is trading the level with a reaction and taking the base hit, not grinding for home runs.',
    glossary: [
      { term: 'PDH / PDL', meaning: 'Previous day high and previous day low. The prior session extremes that price routinely reacts to on the next day.' },
      { term: 'London open', meaning: 'The 2-3am ET session high/low. Treasured as a source of levels and directional bias before New York.' },
      { term: 'Front-run', meaning: 'Entering before price completes a move into a known level, riding the momentum push toward it (his style on the Tuesday trade).' },
      { term: '50% retracement', meaning: 'Halfway back through the impulsive push. His preferred zone if price pulls back before resuming toward the level.' },
      { term: 'Retest', meaning: 'Price returning to a level it just broke or tagged, confirming it holds before the continuation.' },
      { term: 'Base hit', meaning: 'Taking a solid 2R+ target and moving on rather than forcing more trades.' },
    ],
    anatomy: [
      {
        title: 'Mark the London and prior day levels',
        points: [
          'Plot PDH and PDL from the previous session.',
          'Add the London open high/low for the day as your session levels.',
          'These are the prices that matter to you for the whole day.',
        ],
      },
      {
        title: 'Let price drive into a prior daily level',
        points: [
          'Do not chase; wait for the push toward PDH or PDL.',
          'The trade happens at the level, not halfway to it.',
          'His Tuesday trade: a momentum push up into a previous daily level.',
        ],
      },
      {
        title: 'Enter on the reaction, retracement, or retest',
        points: [
          'Preferred: the 50% retracement of the push (his first choice, when you get it).',
          'Fallback: enter as price comes back into the level (what he did).',
          'Or the retest confirm: price re-tags the level and instantly reacts.',
        ],
      },
      {
        title: 'Take the 2R+ base hit and stop',
        points: [
          'He banked around 2.18-2.23R in roughly 45 minutes.',
          'After the win he is done unless a second clear setup appears.',
          'On his Friday clip he stopped after the first scalp because nothing else looked clean.',
        ],
      },
    ],
    entryRules: [
      'Plot PDH, PDL and the London open high/low before the session',
      'Long off PDL / London low in an up context, short off PDH / London high in a down context',
      'Prefer the 50% retracement of the push; if it never comes, take the fill as price returns to the level',
      'A retest that instantly reacts is a valid entry (his Friday long)',
      'He front-runs price into a previous daily level when momentum is strong',
      'After one clean trade, only take a second if it is obvious — otherwise call it',
    ],
    exitRules: [
      'Target 2R+; his wins came in around 2.18-2.23R',
      'Hold time is short — his textbook trade cleared in about 45 minutes',
      'Take the base hit; do not sit for the full low-to-high move',
      'When the market offers nothing else clean, close and move on (his Friday discipline)',
    ],
    riskManagement: [
      'Risk per trade sized to the level and the point stop (his Tue: 45 points risk)',
      'One clean trade a day is a good day — more asks for trouble',
      'Level trading without a reaction is a coin flip; require the push/retest first',
      'Do not add to a dead trade; if the level is not defending, it is not a trade',
      'Both the winner and the call-it behavior matter, not just the PNL',
    ],
    examples: [
      {
        title: 'Tuesday Sep 8 — the 2.23R level front-run',
        description: 'From the source recap.',
        setup: 'Momentum push up developing. Wanted the 50% retracement of the push, did not get down that far.',
        entry: 'Entered long as price came back into the previous daily level, filled around 10:15 AM Eastern.',
        exit: 'Exit just over 2R: 98 points booked, 45 points risked.',
        result: '+$29,400 PNL, ~2.23R in ~45 minutes',
      },
      {
        title: 'Friday Sep 25 — the disciplined scalp',
        description: 'From the second clip.',
        setup: 'Retest forming at a level; he questions whether the retest is right, then commits.',
        entry: 'Long filled, price reacts instantly, no threat below.',
        exit: 'Quick close at a decent profit, then he stops because no second setup looks clean.',
        result: '+$7,365 scalp, then a flat rest of day by choice',
      },
      {
        title: 'The level thesis',
        description: 'Why the level, not the trend, is the trade.',
        setup: 'Price drives into PDH/PDL or the London range edge.',
        entry: 'Front-run or enter the reaction/retest at the level.',
        exit: 'Min 2R, short hold.',
        result: 'Level + reaction is the edge; chasing is not',
      },
    ],
    tips: [
      'PDH/PDL and the London open are your daily map — mark them before price moves',
      'The 50% retracement of the push is the zone he prefers; take the level fill if it does not come',
      'Front-running a strong momentum push into a prior daily level is a repeatable pattern for him',
      'A retest that instantly reacts is stronger than one that waffles',
      'After one clean 2R+ trade, only a clear second setup earns another order',
      'He does live trading streams (free) and has a premium room — verify the level reads against your own charts',
    ],
    commonMistakes: [
      'Chasing price instead of waiting for it to reach the prior daily level',
      'Entering halfway to the level instead of at it or at the 50% retracement',
      'Taking a second trade just because the first one felt good',
      'Holding for a maximum move instead of the 2R+ base hit',
      'Ignoring the London open high/low as a level source',
    ],
    source: {
      url: 'https://www.instagram.com/reel/DdDLIq0IRzZ/',
      title: 'jopetrades — London & previous day level recaps (TUES Sep 8, 2026 / FRI Sep 25, 2026)',
    },
    sourceClaims: [
      'Tuesday Sep 8: $29,400 PNL risking $13,500; 45 points risk to make 98 points (~2.18R), closed ~2.23R',
      'Long entered ~10:15 AM Eastern, wanted the 50% retracement of the push, got the level fill instead',
      'Friday Sep 25: +$7,365 quick scalp on a retest long, then stopped for the week',
      'Strategy is long/short off London and previous day high and low',
    ],
    openQuestions: [
      'His exact entry/level plotting rules beyond the two recaps are not fully stated',
      'Exact stop placement relative to PDH/PDL is inferred from the 45-point risk number',
    ],
    seed: {
      videos: [
        {
          id: 'vid-london-pdh-1',
          title: 'London & PD level trade — jopetrades (01, Tue Sep 8, 2026)',
          url: 'https://www.instagram.com/reel/DdDLIq0IRzZ/',
          notes:
            'Recap: $29,400 PNL risking $13,500 (45pt risk to make 98pt, ~2.18R closed ~2.23R). 2nd trade of day, long entered 10:15 AM Eastern. Wanted a 50% retracement entry of the push up, did not get it, entered as price came back into a previous daily level. Front-ran the push into the level. About 45-minute hold. Thesis: long/short off London and previous day high/low.',
        },
        {
          id: 'vid-london-pdh-2',
          title: 'London & PD level trade — jopetrades (02, Fri Sep 25, 2026)',
          url: 'https://www.instagram.com/reel/DduDIDsIjrm/',
          notes:
            'Recap: +$7,365 quick scalp. Friday end-of-week trade: questioned whether a retest was right, committed to a long, price reacted instantly, quick close. Then stopped because he did not see a second setup he loved, calling it for the week. Discipline: take one clean trade, respect the level, do not force a second. 108 likes.',
        },
      ],
    },
  },
  {
    id: 'prop-firm-funding-scaling',
    name: 'Funding to Payout Scaling System (Trenlines)',
    description:
      'Get funded small, build a buffer, take only the minimum payout, reinvest into more accounts. 2% risk, 1:1 R/R, one trade a day. A prop firm money system, not an entry signal. From trenlines.',
    difficulty: 'Intermediate',
    timeframe: 'Any timeframe',
    winRate: 65,
    riskReward: '1:1 + minimum payout scaling',
    marketCondition: 'Prop firm evals and funded accounts',
    overview:
      'Sam Gilkes (trenlines) lays out the exact prop firm system he says made over $31,000 in 28 days. Funding phase: he invested $1,000, used his shotgun method to run Topstep accounts up to 250K each, totaling $1M in funding, trading 2% risk at a 1:1 risk to reward. Funded phase: build a buffer first, then stay aggressive but smart, one trade per account per day, risking 1-2% (not full porting). As you approach the buffer the winning-day target is only $200. Scaling phase: he rides the minimum payout loop — on Topstep that is 5 winning days to a 2,000 balance, then request the minimum payout around $1,000, rebuild back to 2,000 using a $150 maximum winning day, and repeat. He kept withdrawing the minimum, did not blow any accounts, and reinvested the payouts into more funded accounts, now targeting $2M in funding. The point is that the number, the payout, is engineered: min withdrawal, buffer protection, and reinvestment beat chasing max draws.',
    glossary: [
      { term: 'Shotgun method', meaning: 'His way of spooling up many funded accounts cheaply (here $1,000 in, $1M in funding across Topstep) instead of one big eval.' },
      { term: 'Buffer', meaning: 'The funded balance cushion you build before you feel safe taking payouts.' },
      { term: 'Min payout', meaning: 'Requesting only the smallest withdrawable amount, over and over, instead of waiting for a max draw.' },
      { term: '5 winning days', meaning: 'The Topstep rule a funded trader must hit to stay payout eligible.' },
      { term: 'Max winning day', meaning: 'The cap on any single day\'s profit for payout purposes (his scale loop used $150), which he deliberately stays under.' },
      { term: 'Reinvest', meaning: 'Folding payouts back into more funded accounts to compound total funding.' },
    ],
    anatomy: [
      {
        title: 'Get funded lean',
        points: [
          'Invest small (his example: $1,000), spread across accounts with the shotgun method.',
          'Trade 2% risk at a 1:1 risk to reward through the eval.',
          'Result: 250K on Topstep, $1M in total funding.',
        ],
      },
      {
        title: 'Build the buffer, stay aggressive but safe',
        points: [
          'Once funded, first job is a buffer of profit so a losing day cannot hurt.',
          'He was aggressive early, but never full-porting — 1-2% risk.',
          'One trade per account per day from then on.',
        ],
      },
      {
        title: 'Ride the minimum payout loop',
        points: [
          'Close to the buffer, a $200 winning day is all you need.',
          'On Topstep: hit 5 winning days, build the 2,000 balance, request the minimum payout (~$1,000).',
          'Rebuild back to 2,000 using a $150 max winning day, then request again.',
        ],
      },
      {
        title: 'Reinvest and compound',
        points: [
          'Payouts go back into more funded accounts rather than leaving the system.',
          'None of his accounts blew on this run, he says.',
          'Current target: $2M in total funding.',
        ],
      },
    ],
    entryRules: [
      'Fund through the eval trading 2% risk at a 1:1 risk to reward',
      'After funding, one trade per account per day — no overtrading',
      'Build the buffer before scaling, but stay aggressive within 1-2% risk (not full porting)',
      'When approaching the buffer, a $200 winning day is the whole day',
      'During scale, keep each winning day under the firm cap (Topstep: $150)',
    ],
    exitRules: [
      'Take the minimum payout, not the max — repeatedly',
      'On Topstep that is ~5 winning days to a 2,000 balance, then request ~$1,000 and rebuild to 2,000',
      'Never withdraw so much that the buffer disappears',
      'Reinvest payouts into more accounts instead of cashing the run out',
    ],
    riskManagement: [
      '2% risk per trade, 1:1 target through the eval',
      'Post-funded: 1-2% risk, no full porting, one trade per account per day',
      'Build a profit buffer before withdrawing',
      'The minimum payout loop protects the balance while still paying out',
      'He did not blow any accounts on the run and is compounding toward $2M funding',
    ],
    examples: [
      {
        title: 'The source run: $31k in 28 days',
        description: 'From the trenlines reel.',
        setup: '$1,000 invested, shotgun method to 250K on Topstep, $1M total funding.',
        entry: '2% risk, 1:1 R/R through the eval; one trade per account per day once funded.',
        exit: 'Minimum payout loop: 5 winning days, 2,000 balance, ~$1,000 payout, rebuild, repeat.',
        result: '$31,000 in 28 days, no blown accounts, reinvesting',
      },
      {
        title: 'The min payout loop, step by step',
        description: 'The engine that produces consistent payouts.',
        setup: 'Funded Topstep account at 2,000.',
        entry: '5 winning days logged, each capped within the firm limit.',
        exit: 'Request the ~$1,000 minimum payout, withdraw, then rebuild to 2,000.',
        result: 'Steady cash out without risking the buffer (mechanics from the reel)',
      },
      {
        title: 'Compounding to $2M funding',
        description: 'Where reinvestment leads.',
        setup: 'Payouts from many accounts pooled back in.',
        entry: 'Fund additional accounts with the payouts.',
        exit: 'More funded size, more payout loops.',
        result: 'Total funding target now $2M',
      },
    ],
    tips: [
      'This is a money and process system, not a trade signal — pair it with any entry playbook',
      'The minimum payout loop is engineered so you cash out while protecting the buffer',
      'Know your firm\'s exact numbers: winning-day count, balance target, payout minimum, max winning day',
      'Aggressive early, then one trade a day — simplicity is what lets it scale',
      'Reinvest rather than spend the whole run; that is how funding compounds',
      'Verify the $31k / $1M claims against your own firms before mirroring the size',
    ],
    commonMistakes: [
      'Full-porting the eval because the profits are tempting',
      'Ignoring the 2% / 1:1 baseline',
      'Requesting the max payout and destroying the buffer',
      'Overtrading one account instead of one trade a day',
      'Forgetting the reinvest step that compounds the funding',
    ],
    source: {
      url: 'https://www.instagram.com/reel/DRrWP1uiG1U/',
      title: 'trenlines (Sam Gilkes) — my $30k/mo. prop firm trading system',
    },
    sourceClaims: [
      'Over $31,000 in 28 days trading prop firms',
      'Invested $1,000, shotgun method to 250K on Topstep, $1M total funding',
      '2% risk, 1:1 risk to reward, one trade per account per day after funding',
      'Topstep scale loop: 5 winning days to a 2,000 balance, ~$1,000 minimum payout, $150 max winning day',
      'Did not blow any accounts; reinvesting toward $2M funding',
    ],
    openQuestions: [
      'The shotgun method mechanics are named but not fully explained on-screen',
      'Exact firm rules (payout minimum, winning-day caps) are cited from Topstep and may vary by firm',
    ],
    seed: {
      videos: [
        {
          id: 'vid-prop-firm-funding-scaling',
          title: 'My $30k/mo prop firm system — trenlines / Sam Gilkes (IG reel)',
          url: 'https://www.instagram.com/reel/DRrWP1uiG1U/',
          notes:
            'Sam Gilkes (trenlines), 685 likes. $31k in 28 days trading prop firms. Funding: $1,000 in, shotgun method to 250K on Topstep, $1M total funding, 2% risk at 1:1 R/R. Funded: build a buffer, aggressive but not full porting (1-2%), one trade per account per day, $200 winning days near the buffer. Scale: minimum payout loop on Topstep (5 winning days to a 2,000 balance, request ~$1,000 min payout, rebuild using $150 max winning day, repeat). Reinvest payouts into more accounts, no blown accounts, now targeting $2M funding. This is a funding/payout system, not an entry strategy. CTA: comment "payout" for his free breakdown.',
        },
      ],
    },
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
    ],
    seed: {
      videos: [
        {
          id: 'vid-vwap-pullback-es-reel',
          title: 'Pullback to VWAP — Evan Dyer (IG reel, ES)',
          url: 'https://www.instagram.com/reel/Ddo5vCsKVFY/',
          notes:
            'Evan Dyer (itsevandyer) live example, made over $1,100 that day on ES. All sellers in control all morning, but do not FOMO a short off no level: wait for the pullback to New York VWAP, see sellers defend it with a break back below, then trade it back down toward the low of day. Second touch: after sellers held another lower high and reclaimed NY VWAP, he added more and exited near max profit. Base hit mentality: take the base hit, rinse and repeat, no need to hold all the way to the low of day — "see money and take money" because heavy open selling may not have gas for another low. Level is always clear: VWAP in a trend. He live streams mornings free on ASFX TV.',
        },
        {
          id: 'vid-vwap-pullback-msft-options',
          title: 'VWAP bounce on MSFT for first payout — Evan Dyer (IG reel, options)',
          url: 'https://www.instagram.com/reel/Ddw5iz4io-k/',
          notes:
            'Evan Dyer applies the same pullback to VWAP on single stocks via a vanquishtrader options prop account. ES and NQ do not trend every day, so instead of forcing a long on NQ trading beneath VWAP, he found the asset in trend (Microsoft, his first MSFT trade ever) and took the standard setup: wait for the pullback, see buyers defend VWAP, trade it up toward previous structure. Day six on the options account, $2,300 profit, first payout. Lesson: trade what is moving cleanly that day, not the instrument you are used to; your VWAP read transfers to any asset. He also mentions his "double break" setup as an alternative. Ad: 20% off vanquishtrader with code ASFX.',
        },
        {
          id: 'vid-vwap-pullback-overnight-ny',
          title: 'Using overnight and NY VWAP together — Evan Dyer (IG reel, NQ/ES)',
          url: 'https://www.instagram.com/reel/DduksPZKjur/',
          notes:
            'Evan Dyer session read on NQ and ES combining BOTH VWAPs. Overnight context: pre-market was all sellers under the overnight VWAP (lower highs/lower lows), yet the open prints bullish. His first idea is a short off the overnight VWAP, but he does not fight the New York session: he waits for the 15-minute opening range to set, and only sells if price breaks the range AND breaks back below NY VWAP. No break below NY VWAP = no short, which avoids getting face ripped off by the move back higher. No long either right at VWAP because price just drifts away. Rule: once price is away from VWAP, only take entries at the VWAP pullback, particularly the New York VWAP. Bias note: even though buyers led since 8am pre-market, the overnight structure is what justified the short interest. Takeaway: overnight VWAP gives the bias, NY VWAP gives the execution level, the opening range is the filter.',
        },
      ],
    },
  },
  {
    id: 'vwap-double-break',
    name: 'VWAP Double Break (Evan Dyer)',
    description:
      'True double break: price breaks the opening range AND takes New York VWAP in the same direction, with VWAP inside the range. If VWAP sits outside the range it is a false break. From Evan Dyer.',
    difficulty: 'Advanced',
    timeframe: '1m - 15m / NY open',
    winRate: 72,
    riskReward: '1:2',
    marketCondition: 'NQ and ES, first hours after NY open',
    overview:
      'Evan Dyer explains the double break setup: a long requires price to break above the opening range high AND break above New York VWAP, with VWAP sitting inside the opening range. When VWAP is outside the range, the breakout is not a true double break, and the move tends to be short lived. His clip shows exactly why he skipped a live long signal: a long looked nice because price was overextended from the overnight VWAP, but on ES the New York VWAP had broken outside the opening range low, and that kills longs for him. The NQ break above VWAP was very short lived because ES held its overnight VWAP, making a lower high, and both rotated back down. With ES VWAP outside the range he is only looking for shorts: wait for sellers to retake control of the New York VWAP and play it down into previous structure. The other half of the lesson is discipline: he passed on taking his first trade of the day at 12:30 on a Monday, flat, so he could set the tone for the week, holding out for something better tomorrow. One trade does not define the week.',
    glossary: [
      { term: 'Double break', meaning: 'Price breaking out of the opening range AND through New York VWAP in the same direction, with VWAP inside the range. Long = break above range high + above VWAP; short = below range low + below VWAP.' },
      { term: 'Opening range', meaning: 'The trading range established in the first 15 minutes of the NY session. Its high and low become the breakout triggers.' },
      { term: 'NY VWAP inside the range', meaning: 'The key filter. If VWAP is inside the opening range the double break is valid; if it is outside, the break is false and often fails.' },
      { term: 'Overnight VWAP', meaning: 'The session mean built outside NY hours. Price overextended from it can mean a mean-reversion pull, but that is not a trade by itself.' },
      { term: 'False double break', meaning: 'A range break where VWAP is outside the range. Do not chase it; expect a short-lived move back.' },
      { term: 'Set the tone', meaning: 'Discipline of not forcing the first trade of the day/week when the setup is not clean.' },
    ],
    anatomy: [
      {
        title: 'Mark the opening range and NY VWAP',
        points: [
          'The opening range is the first 15 minutes of New York.',
          'Plot New York VWAP and note where it sits relative to the range.',
          'VWAP must be INSIDE the range for a true double break.',
        ],
      },
      {
        title: 'Long: break the range high AND clear VWAP',
        points: [
          'Price pushes above the opening range high.',
          'Buyers retake New York VWAP to the upside.',
          'The two breaks together, VWAP inside the range, make it real.',
        ],
      },
      {
        title: 'Short: sellers retake VWAP and break the range low',
        points: [
          'If VWAP is outside the range, longs are dead.',
          'Wait for sellers to retake control of New York VWAP.',
          'Play it down into previous structure.',
        ],
      },
      {
        title: 'The false break is the trap',
        points: [
          'A break with VWAP outside the range is short lived, not a trend.',
          'His example: NQ broke VWAP but ES held the overnight VWAP, made a lower high, and both fell.',
          'When ES and NQ disagree, stand aside.',
        ],
      },
    ],
    entryRules: [
      'Require BOTH breaks to confirm: price out of the opening range AND through NY VWAP in the same direction',
      'New York VWAP must sit INSIDE the opening range for a true setup',
      'Long: push above the opening range high while buyers clear New York VWAP',
      'Short: sellers retake New York VWAP, then price breaks the opening range low into previous structure',
      'If ES shows VWAP outside the range, the NQ long is not worth it (his live walkthrough)',
      'Signal can come hours into the session, not just at the open',
    ],
    exitRules: [
      'With a true double break, target the range extension and prior structure',
      'When it is a false break, longs may pay only to the overnight VWAP — do not expect the range high to hold',
      'Take the clean trade and do not force a second',
      'Discipline: no-trade is a result — he passed at 12:30 Monday to set the tone for the week',
    ],
    riskManagement: [
      'The main risk is the false double break (VWAP outside the range) — skip it',
      'Do not take your first trade of the day just because a signal prints; it must be clean',
      'One trade does not define your week — keep size normal and wait for better setups',
      'ES and NQ must agree; divergence is a reason to pass',
    ],
    examples: [
      {
        title: 'The live skip: NQ double break long he passed on',
        description: 'From the source clip.',
        setup: 'All sellers at the open, then a double break long signal two hours into the session. Price overextended from the overnight VWAP.',
        entry: 'He wanted to see longs get back to the overnight VWAP but did not take the long.',
        exit: 'Reason: ES New York VWAP broke outside the opening range low, which kills longs; NQ break above VWAP was short lived as ES held its overnight VWAP (lower high).',
        result: 'No-trade. His plan from there: only shorts, sellers retake NY VWAP, into previous structure (illustrative)',
      },
      {
        title: 'The true long double break',
        description: 'The version he actually trades.',
        setup: 'Opening range set, New York VWAP inside the range.',
        entry: 'Price breaks above the opening range high and buyers clear New York VWAP.',
        exit: 'Target the range extension / previous structure.',
        result: 'The clean version of the setup (mechanics from the clip)',
      },
      {
        title: 'The short re-entry after a false long',
        description: 'Where the bias goes after a failed long.',
        setup: 'NQ long failed because ES VWAP sat outside the range.',
        entry: 'Wait for sellers to retake control of New York VWAP.',
        exit: 'Play it down into previous structure.',
        result: 'Sell the range break only when the short double break is true',
      },
    ],
    tips: [
      'The filter is everything: VWAP must be inside the opening range, or the break is not a double break',
      'Watch both NQ and ES — if one shows VWAP outside the range, the other is suspect',
      'Overextension from overnight VWAP is not a reason to enter a long by itself',
      'A clean no-trade sets a better tone than a forced first trade',
      'One trade does not define your week',
      'He teaches this live on ASFX TV streams (free via his bio)',
    ],
    commonMistakes: [
      'Chasing a range break when New York VWAP is outside the range (false double break)',
      'Entering the first signal of the day at a bad time just to be in',
      'Ignoring ES when trading NQ, or vice versa',
      'Treating a short-lived VWAP break (price reverting) as a real breakout',
      'Letting one poor or missed trade ruin the week',
    ],
    source: {
      url: 'https://www.instagram.com/reel/DeZ4DRhiYox/',
      title: 'Evan Dyer — the little things I look for with VWAP (double break)',
    },
    sourceClaims: [
      'Double break long: opening range high AND above New York VWAP, with VWAP inside the range',
      'ES VWAP outside the opening range low kills longs',
      'NQ break above VWAP was short lived because ES held the overnight VWAP (lower high)',
      'After a false setup he looks only for shorts and plays into previous structure',
      'He skipped the first trade of the day at 12:30 Monday to set the tone for the week',
    ],
    openQuestions: [
      'Exact stop placement and R target for the double break are not fully specified in this clip',
    ],
    seed: {
      videos: [
        {
          id: 'vid-vwap-double-break',
          title: 'The little things I look for with VWAP — Evan Dyer double break (IG reel)',
          url: 'https://www.instagram.com/reel/DeZ4DRhiYox/',
          notes:
            'Evan Dyer (itsevandyer). The double break long requires price to break the opening range high AND clear New York VWAP with VWAP inside the range. He passed on a live long because ES NY VWAP broke outside the opening range low; the NQ VWAP break was short lived (ES held overnight VWAP, lower high) and both came back down. With VWAP outside the range, only shorts: wait for sellers to retake NY VWAP and play down into previous structure. Discipline: he skipped the 12:30 Monday first trade to set the tone (one trade does not define your week). Teaches live on ASFX TV.',
        },
      ],
    },
  },
  {
    id: 'prop-firm-payout-discipline',
    name: 'Prop Firm Payout Discipline (fittraderdad)',
    description:
      'Mindset clip on getting prop firm payouts the right way. Persistent message: "This is how you rinse these prop firms." Trading psychology first. Not a mechanical method.',
    difficulty: 'Beginner',
    timeframe: 'Any timeframe',
    winRate: 62,
    riskReward: 'N/A — mindset only',
    marketCondition: 'Prop firm payouts',
    overview:
      'A short TikTok from fittraderdad framed around getting prop firm payouts the right way. There is no audio narration and no detailed on-screen method; the persistent headline is "This is how you rinse these prop firms" over a payout result screen, and the caption leans hard on trading psychology (#tradingpsychology). Treat it as motivation and a process reminder, not a teachable entry or money system: the takeaways that survive are that payout consistency comes from discipline and psychology, not from chasing a single hit. Pair it with the mechanical prop firm systems in this section (Funding to Payout Scaling, Law of 10, Copy Trading Blueprint) which supply the actual numbers.',
    glossary: [
      { term: 'Payout', meaning: 'A withdrawal from a funded prop account. The unit of success in this clip.' },
      { term: 'Trading psychology', meaning: 'The mental discipline side of trading he emphasizes — the real lever for repeated payouts.' },
      { term: 'Rinse', meaning: 'Colloquial for repeatedly extracting payouts from prop firms by executing the process correctly.' },
    ],
    anatomy: [
      {
        title: 'The message is repeated, the visual is payouts',
        points: [
          'The whole clip hammers one line: this is how you rinse these prop firms.',
          'The screens shown are payout results, not entry setups.',
          'The teaching is psychological: get payouts right, not just get payouts.',
        ],
      },
      {
        title: 'Psychology is the stated edge',
        points: [
          'The caption is tagged trading psychology and the right way to take payouts.',
          'Repeated payout consistency is a discipline outcome, not a luck outcome.',
          'Watch it as a motivator between real prop firm systems.',
        ],
      },
      {
        title: 'Put the numbers on the next card over',
        points: [
          'This card has no money system of its own.',
          'The Prop Firm section already has the systems: build a buffer, min payout loop, Law of 10, copy trading gates.',
          'Use this clip as the why, use those cards as the how.',
        ],
      },
    ],
    entryRules: [
      'Treat repeated, clean payouts as the goal, not one big win',
      'Reinforce the psychology: discipline over impulses on the way to a payout',
      'Verify any concrete claim with the actual systems in the Prop Firm section',
    ],
    exitRules: [
      'Close a day or week that keeps your process clean, payout or not',
      'Do not chase a payout the creator on a clip claims — copy the discipline, not the hype',
    ],
    riskManagement: [
      'The discipline to get payouts the right way IS the risk control here',
      'No concrete sizing or stop guidance in the clip; apply the Law of 10 / funding systems for numbers',
    ],
    examples: [
      {
        title: 'The clip itself',
        description: 'What the TikTok shows.',
        setup: 'Payout result screen with the persistent headline this is how you rinse these prop firms.',
        entry: 'No mechanical entry; the message is process and psychology.',
        exit: 'Get payouts the right way.',
        result: 'Motivational frame for prop firm discipline',
      },
    ],
    tips: [
      'Use it as motivation, not a method — it has no mechanical content',
      'The psychology point is real: payouts compound from repeatable discipline',
      'Pair it with the other Prop Firm cards for the actual numbers',
    ],
    commonMistakes: [
      'Looking for an entry or money system in a motivation-only clip',
      'Chasing a claimed payout number without your own process',
    ],
    source: {
      url: 'https://www.tiktok.com/t/ZTytCYoGe/',
      title: 'fittraderdad — get those payouts the right way (TikTok)',
    },
    sourceClaims: [
      'Persistent on-screen message: this is how you rinse these prop firms',
      'Caption and hashtags emphasize trading psychology for payouts',
      'No audio narration or detailed mechanical method in the clip',
    ],
    openQuestions: [
      'The clip contains no concrete entry, sizing, or payout-loop rules to apply',
    ],
    seed: {
      videos: [
        {
          id: 'vid-prop-firm-payout-discipline',
          title: 'Get payouts the right way — fittraderdad (TikTok)',
          url: 'https://www.tiktok.com/t/ZTytCYoGe/',
          notes:
            'TikTok by fittraderdad (523 likes, 138s, no audio narration). Persistent on-screen message: "This is how you rinse these prop firms" over a payout result screen. Caption: get those payouts the right way, tagged trading psychology. Motivational/process clip, not a mechanical method — pair with the Prop Firm systems (Funding to Payout Scaling, Law of 10, Copy Trading Blueprint) for the actual numbers.',
        },
      ],
    },
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
        {
          id: 'vid-fam-session-reel',
          title: 'Best prop firm strategy — failed auction (IG reel, any session)',
          url: 'https://www.instagram.com/reel/DdahNv-RtKB/',
          notes:
            'Chanelle the Trader (chanellethetrader) short-form explainer of the same Failed Auction model. Frames it for non-NY-session traders (Australia/NZ): the FRVP works on ANY single session, find POC fair value, VAH expensive, VAL cheap, wait for price at an extreme, confirm the failed auction with an imbalance being mitigated, enter off the candle that mitigated it, target 1.5R or all the way to POC. Cites $59,890 last month in prop + payouts with the 16 Sep payout $1,200. Comment "FAM" for her full breakdown.',
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
  // ─── Options starters ───────────────────────────────────────────────────────
  // Templates to paper trade and tune, not backtested results. Win rate is left
  // at 0 and `untested` keeps them out of the win-rate ranking.
  {
    id: 'opt-vwap-double-break',
    market: 'options',
    untested: true,
    name: 'VWAP Double Break (Options)',
    description:
      'The double break traded with options: when SPY or QQQ breaks its opening range AND takes New York VWAP in the same direction, with VWAP inside the range, buy a same-day call or put instead of the future.',
    difficulty: 'Advanced',
    timeframe: '1m - 5m / NY open',
    winRate: 0,
    riskReward: '1:2',
    marketCondition: 'SPY and QQQ, first two hours after the open',
    optionsPlan: {
      underlying: 'SPY or QQQ',
      contract: '0DTE, near the money (about 0.45 to 0.55 delta)',
      short: '0DTE ATM',
      stop: 'Premium down 50%, or the underlying closes back inside the range or through VWAP',
      target: 'One opening-range height beyond the break; sell half around +60% premium',
      stopPct: 50,
    },
    overview:
      'Same read as the futures double break, different instrument. You mark the first 15 minutes of New York on SPY or QQQ and plot VWAP. A long needs price above the opening range high AND above VWAP, with VWAP sitting inside the range; a short is the mirror. When both breaks line up you buy a near-the-money call (long) or put (short) that expires the same day.\n\nTwo things change with options. First, your risk is the premium, so size comes from what you pay, not from a stop in points. Second, time works against you: a same-day option loses value every minute the move stalls, so a break that goes nowhere is a losing trade even if price never reverses. That is why this playbook has a time stop as well as a price stop.',
    glossary: [
      { term: 'Double break', meaning: 'Price out of the opening range AND through New York VWAP in the same direction, with VWAP inside the range.' },
      { term: '0DTE', meaning: 'An option that expires today. Cheap and fast, but it decays quickly and can go to zero.' },
      { term: 'Delta', meaning: 'Roughly how much the option moves per $1 in the underlying. About 0.50 is at the money.' },
      { term: 'Premium', meaning: 'What you pay per share for the option. One contract costs premium x 100.' },
      { term: 'Theta', meaning: 'Time decay. On a 0DTE it is the reason a stalled trade bleeds.' },
      { term: 'Time stop', meaning: 'Exiting because the move has not happened within a set time, even though price has not hit your stop.' },
    ],
    anatomy: [
      {
        title: 'Mark the opening range and VWAP on the underlying',
        points: [
          'Opening range is the first 15 minutes of New York on SPY or QQQ.',
          'VWAP must sit INSIDE that range. Outside means no trade.',
          'Check the option you would buy: tight spread, real volume.',
        ],
      },
      {
        title: 'Both breaks confirm, then buy the contract',
        points: [
          'Long: a 5-minute close above the range high with price above VWAP. Buy the near-the-money call.',
          'Short: a 5-minute close below the range low with price below VWAP. Buy the near-the-money put.',
          'Enter with a limit order at the mid, not a market order.',
        ],
      },
      {
        title: 'Three ways out when it is wrong',
        points: [
          'Premium is down 50% from your fill.',
          'The underlying closes back inside the range or through VWAP.',
          'Thirty minutes pass with no follow-through.',
        ],
      },
      {
        title: 'Pay yourself on the range extension',
        points: [
          'First target is one opening-range height beyond the break.',
          'Sell half around +60% premium and move the stop to your entry price.',
          'Flat by 3:00 PM ET. Never hold a 0DTE into the last hour.',
        ],
      },
    ],
    entryRules: [
      'Opening range (first 15 minutes of New York) is marked on SPY or QQQ',
      'VWAP sits INSIDE the opening range',
      'Price has closed a 5-minute candle outside the range in the trade direction',
      'Price is on the same side of VWAP as the break',
      'SPY and QQQ agree on direction',
      'The option spread is tight (a few cents) and you are entering with a limit order',
      'It is before 2:00 PM ET, so the option still has time to work',
    ],
    exitRules: [
      'Exit if premium is down 50% from your fill',
      'Exit immediately if the underlying closes back inside the opening range or through VWAP',
      'Exit if 30 minutes pass without follow-through',
      'Sell half at about +60% premium or when price reaches one range height beyond the break',
      'Trail the rest under each 5-minute higher low (above each lower high for puts)',
      'Be flat by 3:00 PM ET',
    ],
    riskManagement: [
      'Decide the dollars you can lose first; contracts come from that, not from how cheap the option looks',
      'Risk per trade is half the premium you pay, because the stop is 50%',
      'One double break per day. A second entry after a stop is usually revenge',
      'Skip days with a major release in the first hour (CPI, FOMC, jobs) until the first reaction is over',
      'A 0DTE can gap to near zero. Never size as if the 50% stop is guaranteed to fill',
    ],
    examples: [
      {
        title: 'QQQ long double break (illustrative)',
        description: 'A made-up walk-through to show the mechanics. Not a real trade.',
        setup: 'QQQ builds a 15-minute range with VWAP in the middle of it. SPY looks the same.',
        entry: 'A 5-minute candle closes above the range high with price above VWAP. Buy two same-day at-the-money calls at 1.80 with a limit at the mid.',
        exit: 'Stop is 0.90 on the premium, or a close back inside the range. At +60% (about 2.90) sell one; trail the other under 5-minute lows.',
        result: 'Risk was $180 on two contracts. Illustrative only.',
      },
    ],
    tips: [
      'Trade the chart of the underlying, not the option chart',
      'Slightly in the money holds value better when the move is slow',
      'If the spread is wider than about 5% of the premium, pick a different strike',
      'Paper trade it for twenty trades before using real money',
    ],
    commonMistakes: [
      'Buying far out-of-the-money options because they are cheap',
      'Holding a stalled trade and letting time decay do the damage',
      'Taking the break when VWAP is outside the range',
      'Sizing by number of contracts instead of dollars at risk',
      'Adding to a loser because the option is "on sale"',
    ],
  },
  {
    id: 'opt-orb-0dte',
    market: 'options',
    untested: true,
    name: '0DTE Opening Range Break',
    description:
      'A simpler first options setup: wait for the 15-minute opening range on SPY or QQQ, buy a same-day call or put when price closes outside it, and take profit at one range height.',
    difficulty: 'Intermediate',
    timeframe: '5m / first 90 minutes',
    winRate: 0,
    riskReward: '1:1.5',
    marketCondition: 'SPY and QQQ on days with a clear open',
    optionsPlan: {
      underlying: 'SPY or QQQ',
      contract: '0DTE, at the money',
      short: '0DTE ATM',
      stop: 'Premium down 40%, or a 5-minute close back past the middle of the range',
      target: 'One opening-range height from the break',
      stopPct: 40,
    },
    overview:
      'The opening range break without the VWAP filter. It triggers more often than the double break and is easier to learn, at the cost of more false starts. Use it to get used to option fills, spreads and time decay before layering on the VWAP rule.\n\nThe range sets everything: the trigger (a close outside it), the stop (back past its midpoint) and the target (its height projected from the break). If the range is unusually wide, the target is far and the option is expensive; skip those days.',
    glossary: [
      { term: 'Opening range', meaning: 'The high and low of the first 15 minutes of the New York session.' },
      { term: 'Range height', meaning: 'Range high minus range low. Projected from the break, it is the target.' },
      { term: 'At the money', meaning: 'The strike closest to the current price, about 0.50 delta.' },
    ],
    anatomy: [
      { title: 'Let the first 15 minutes print', points: ['Mark the high, low and midpoint of the opening range.', 'No trades inside the range.', 'Skip the day if the range is more than about twice its usual size.'] },
      { title: 'Buy on the close outside', points: ['A 5-minute candle closes above the high: buy the at-the-money call.', 'A 5-minute candle closes below the low: buy the at-the-money put.', 'Volume on the break candle should be above the candles before it.'] },
      { title: 'Back through the middle is wrong', points: ['Exit on a 5-minute close back past the range midpoint.', 'Exit if premium is down 40%.', 'Exit if nothing happens in 30 minutes.'] },
      { title: 'One range height, then done', points: ['Target is the range height added to the break level.', 'Take the whole position off there while you are learning.', 'One attempt per direction per day.'] },
    ],
    entryRules: [
      'The 15-minute opening range is marked, with its midpoint',
      'A 5-minute candle has closed outside the range',
      'The break candle has above-average volume',
      'The range is not unusually wide for this ticker',
      'The option spread is tight and you are using a limit order',
      'It is within the first 90 minutes of the session',
    ],
    exitRules: [
      'Exit if premium is down 40% from your fill',
      'Exit on a 5-minute close back past the range midpoint',
      'Exit if 30 minutes pass without follow-through',
      'Take profit at one range height from the break',
    ],
    riskManagement: [
      'Risk per trade is 40% of the premium paid; size from that',
      'One attempt per direction per day',
      'No trades in the first 15 minutes, and none on major-release mornings until the first move settles',
    ],
    examples: [
      {
        title: 'SPY break lower (illustrative)',
        description: 'A made-up walk-through to show the mechanics. Not a real trade.',
        setup: 'SPY sets a $2.40 opening range. Sellers hold the midpoint on two tests.',
        entry: 'A 5-minute candle closes under the range low on rising volume. Buy one at-the-money put at 1.50.',
        exit: 'Stop at 0.90 premium or a close back above the midpoint. Target is $2.40 below the range low.',
        result: 'Risk was $60 on one contract. Illustrative only.',
      },
    ],
    tips: ['Start with one contract', 'Write down the range high, low and midpoint before the bell', 'If you miss the break candle, wait for the retest instead of chasing'],
    commonMistakes: ['Buying the wick instead of waiting for the close', 'Trading a range that is too wide', 'Re-entering the same direction after a stop'],
  },
  {
    id: 'opt-trend-pullback-spread',
    market: 'options',
    untested: true,
    name: 'VWAP Trend Pullback (Debit Spread)',
    description:
      'On a trending day, wait for the pullback to VWAP and buy a call or put debit spread instead of a single option. The spread costs less and time decay hurts less, in exchange for a capped profit.',
    difficulty: 'Intermediate',
    timeframe: '5m / mid-morning on',
    winRate: 0,
    riskReward: '1:1.5',
    marketCondition: 'SPY, QQQ or liquid large caps on a clear trend day',
    optionsPlan: {
      underlying: 'SPY, QQQ or a liquid large cap',
      contract: '1 to 5 days out, buy near the money and sell the strike at your target',
      short: 'Debit spread',
      stop: 'Spread worth half of what you paid, or a 5-minute close through VWAP',
      target: 'Close at about 70% of the spread width',
      stopPct: 50,
    },
    overview:
      'A debit spread is one option bought and a further-out one sold against it. You pay less than for the single option, and because you are also short an option, time decay roughly cancels. The trade-off is a ceiling: the most it can be worth is the distance between the strikes.\n\nThat fits a pullback trade well. You have a defined target (the prior high or low of the trend), so you sell the strike near it. The entry is the same as the futures VWAP pullback: an established trend, a drift back to VWAP, and a candle that rejects it.',
    glossary: [
      { term: 'Debit spread', meaning: 'Buy one option and sell another further out, same expiry. Max loss is what you paid.' },
      { term: 'Spread width', meaning: 'The distance between the two strikes. It is the most the spread can be worth.' },
      { term: 'Debit', meaning: 'What you pay to open the spread. Try to pay under half the width.' },
    ],
    anatomy: [
      { title: 'A trend that is already working', points: ['Higher highs and higher lows on the 5-minute (or the mirror for shorts).', 'Price has stayed on one side of VWAP since the open.', 'No trade if VWAP is flat and price is chopping across it.'] },
      { title: 'The pullback holds VWAP', points: ['Price drifts back to VWAP on lighter volume.', 'A 5-minute candle rejects VWAP and closes back with the trend.', 'Buy the near-the-money option and sell the strike at the prior swing.'] },
      { title: 'A close through VWAP ends it', points: ['Exit on a 5-minute close through VWAP against you.', 'Exit if the spread is worth half of what you paid.', 'Your loss can never be more than the debit.'] },
      { title: 'Close early, not at expiry', points: ['Take it off at about 70% of the spread width.', 'Do not wait for the last 30%; it takes the longest and risks the most.', 'Close before the day you are assigned, never hold through expiry.'] },
    ],
    entryRules: [
      'A clear trend on the 5-minute chart, on one side of VWAP since the open',
      'Price has pulled back to VWAP on lighter volume',
      'A 5-minute candle has rejected VWAP and closed with the trend',
      'The short strike sits at or just before the prior swing high or low',
      'The debit is under half of the spread width',
      'Both legs have tight spreads; enter as a single spread order with a limit',
    ],
    exitRules: [
      'Exit if the spread is worth half of what you paid',
      'Exit on a 5-minute close through VWAP against the trade',
      'Take profit at about 70% of the spread width',
      'Close before expiry day; do not hold to expiry',
    ],
    riskManagement: [
      'Max loss is the debit paid; plan to lose half of it at the stop',
      'Enter and exit both legs together as one order',
      'Avoid names with earnings before your expiry',
    ],
    examples: [
      {
        title: 'QQQ call spread on a trend day (illustrative)',
        description: 'A made-up walk-through to show the mechanics. Not a real trade.',
        setup: 'QQQ trends up all morning and pulls back to VWAP at 11:10 on light volume.',
        entry: 'A 5-minute candle rejects VWAP. Buy the at-the-money call and sell the call $4 higher, two days out, for a 1.70 debit.',
        exit: 'Stop if the spread is worth 0.85 or QQQ closes under VWAP. Take profit at 2.80 (70% of the $4 width).',
        result: 'Risk was $85 per spread. Illustrative only.',
      },
    ],
    tips: ['Paying under half the width keeps reward bigger than risk', 'Use this on days when single options feel too expensive', 'Check for earnings before picking an expiry'],
    commonMistakes: ['Legging in one side at a time', 'Holding for the full width', 'Buying a spread in chop because it is cheap'],
  },
  {
    id: 'opt-failed-break-reversal',
    market: 'options',
    untested: true,
    name: 'Failed Break Reversal (Options)',
    description:
      'When a break of the opening range fails and price snaps back inside, buy the option in the opposite direction and target the other side of the range.',
    difficulty: 'Advanced',
    timeframe: '5m / first half of the session',
    winRate: 0,
    riskReward: '1:2',
    marketCondition: 'SPY and QQQ on range-bound or indecisive days',
    optionsPlan: {
      underlying: 'SPY or QQQ',
      contract: '0DTE or next day, at the money',
      short: '0-1DTE ATM',
      stop: 'Premium down 50%, or price makes a new extreme beyond the failed break',
      target: 'VWAP first, then the opposite side of the opening range',
      stopPct: 50,
    },
    overview:
      'This is the other side of the double break. When price breaks the opening range but VWAP is outside it, or the break has no volume, the move often fails: traders who chased are trapped, and their exits push price back through the range.\n\nYou do not guess the failure. You wait for price to close back inside the range, then buy the option pointing at the other side. The stop is clear (a new extreme beyond the failed break) and the path is short, which suits an option.',
    glossary: [
      { term: 'Failed break', meaning: 'Price leaves the opening range, cannot hold, and closes back inside it.' },
      { term: 'Trapped traders', meaning: 'Those who bought the breakout and now have to sell as it reverses, adding fuel.' },
      { term: 'Next-day expiry', meaning: 'An option expiring tomorrow. Slower decay than 0DTE if the reversal takes time.' },
    ],
    anatomy: [
      { title: 'A break that should not be trusted', points: ['Price breaks the range with VWAP outside the range, or on weak volume.', 'SPY and QQQ disagree.', 'Do nothing yet: this is only the setup.'] },
      { title: 'The close back inside is the trigger', points: ['A 5-minute candle closes back inside the opening range.', 'Buy the option against the failed break: puts after a failed upside break, calls after a failed downside break.', 'Use next-day expiry if it is past 12:30 PM ET.'] },
      { title: 'A new extreme means you are wrong', points: ['Exit if price trades beyond the high or low of the failed break.', 'Exit if premium is down 50%.', 'Exit if 30 minutes pass and price is still stuck at the range edge.'] },
      { title: 'VWAP, then the far side', points: ['Sell half at VWAP.', 'Sell the rest at the opposite side of the opening range.', 'Do not hold for a breakout the other way; that is a different trade.'] },
    ],
    entryRules: [
      'Price broke the opening range and failed to hold',
      'The break had a warning sign: VWAP outside the range, weak volume, or SPY and QQQ disagreeing',
      'A 5-minute candle has closed back inside the range',
      'There is room to VWAP and the far side of the range',
      'The option spread is tight and you are using a limit order',
    ],
    exitRules: [
      'Exit if price makes a new extreme beyond the failed break',
      'Exit if premium is down 50% from your fill',
      'Exit if 30 minutes pass without progress',
      'Sell half at VWAP',
      'Sell the rest at the opposite side of the opening range',
    ],
    riskManagement: [
      'Risk per trade is half the premium paid',
      'Never fade a break that has VWAP inside the range and both indexes agreeing; that is the double break',
      'One reversal attempt per day',
    ],
    examples: [
      {
        title: 'SPY failed upside break (illustrative)',
        description: 'A made-up walk-through to show the mechanics. Not a real trade.',
        setup: 'SPY pokes above its opening range high on light volume while QQQ stays inside its own range.',
        entry: 'A 5-minute candle closes back under the range high. Buy two at-the-money puts at 1.40.',
        exit: 'Stop at 0.70 premium or a new high above the failed break. Sell one at VWAP, the other at the range low.',
        result: 'Risk was $140 on two contracts. Illustrative only.',
      },
    ],
    tips: ['The best failures are fast: out and back inside within two or three candles', 'If you would have taken the breakout, do not fade it', 'Keep the double break and this playbook side by side; one is the filter for the other'],
    commonMistakes: ['Fading before the close back inside', 'Fading a true double break', 'Holding past the far side of the range'],
  },
];

export const Playbooks: React.FC = () => {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');
  const [section, setSection] = useState<'strategies' | 'toolkit'>('strategies');
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'gallery' | 'list'>('gallery');
  useEffect(() => {
    try {
      if (localStorage.getItem('tp.playbooks.view') === 'list') setView('list');
    } catch {}
  }, []);
  const chooseView = (v: 'gallery' | 'list') => {
    setView(v);
    try {
      localStorage.setItem('tp.playbooks.view', v);
    } catch {}
  };
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

  const sections = [
    { id: 'strategies', label: 'Library' },
    { id: 'toolkit', label: 'TradingView toolkit' },
  ] as const;
  const sectionSwitch = (
    <nav aria-label="Playbook sections" className="relative grid grid-cols-2 rounded-[11px] bg-tp-fill p-[3px]">
      <span
        aria-hidden
        className="absolute bottom-[3px] left-[3px] top-[3px] w-[calc(50%-3px)] rounded-lg bg-[#5B6478]/70 shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_0.5px_0_rgba(255,255,255,0.14)] transition-transform duration-500 ease-spring"
        style={{ transform: section === 'toolkit' ? 'translateX(100%)' : 'translateX(0)' }}
      />
      {sections.map((t) => (
        <button
          key={t.id}
          aria-current={section === t.id ? 'page' : undefined}
          onClick={() => setSection(t.id)}
          className={clsx(
            'relative whitespace-nowrap rounded-lg px-4 py-1.5 text-[13px] font-semibold',
            section === t.id ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );

  const pageHeader = (title: string, blurb: string) => (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-1">
      <div className="min-w-0">
        <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.035em] text-white sm:text-[40px]">{title}</h1>
        <p className="mt-1.5 max-w-xl text-pretty text-[17px] leading-snug text-zinc-400">{blurb}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {sectionSwitch}
        <button
          onClick={() => setCreating(true)}
          className="tp-press inline-flex items-center gap-1.5 rounded-full bg-tp-accent px-4 py-2 text-[15px] font-semibold text-tp-ink hover:brightness-110"
        >
          <Plus className="h-4 w-4" strokeWidth={2.8} />
          New from a video
        </button>
      </div>
    </header>
  );

  const createSheet = creating && (
    <CreatePlaybook
      onClose={() => setCreating(false)}
      onCreated={(id) => {
        setCreating(false);
        setSelectedStrategy(id);
        document.querySelector('main')?.scrollTo({ top: 0 });
      }}
    />
  );

  if (section === 'toolkit') {
    return (
      <div className="mx-auto max-w-7xl space-y-8">
        {pageHeader(
          'TradingView toolkit',
          'Run these playbooks on TradingView with micros: automatic targets and stops, contract sizing, chart setup, alerts and practice.'
        )}
        <TradingViewGuide />
        {createSheet}
      </div>
    );
  }

  // Rank every strategy by win rate; the top 3 are featured.
  const futures = tradingStrategies.filter((s) => s.market !== 'options');
  const options = tradingStrategies.filter((s) => s.market === 'options');
  const ranked = [...futures].sort((a, b) => b.winRate - a.winRate);
  const rankOf = new Map(ranked.map((s, i) => [s.id, i]));
  const q = query.trim().toLowerCase();
  const matches = (s: PlaybookStrategy) =>
    !q ||
    s.name.toLowerCase().includes(q) ||
    (TAGLINE_BY_ID[s.id] ?? '').toLowerCase().includes(q) ||
    (CATEGORY_BY_ID[s.id] ?? '').toLowerCase().includes(q);
  const isCategoryFilter = CATEGORY_FILTERS.includes(filter);
  const visible = ranked.filter((s) => {
    if (!matches(s)) return false;
    if (filter === 'All' || filter === 'Futures') return true;
    if (filter === 'Options') return false;
    if (isCategoryFilter) return CATEGORY_BY_ID[s.id] === filter;
    return s.difficulty === filter;
  });

  const showPodium = (filter === 'All' || filter === 'Futures') && !q;
  const rest = showPodium ? visible.slice(3) : visible;
  // Options starters sit in their own section: they have no backtest to rank by.
  const visibleOptions = options.filter((s) => {
    if (!matches(s)) return false;
    if (filter === 'All' || filter === 'Options') return true;
    if (filter === 'Futures' || isCategoryFilter) return false;
    return s.difficulty === filter;
  });
  const countFor = (f: string) =>
    f === 'All' ? tradingStrategies.length
      : f === 'Futures' ? futures.length
      : f === 'Options' ? options.length
      : CATEGORY_FILTERS.includes(f) ? futures.filter((s) => CATEGORY_BY_ID[s.id] === f).length
      : tradingStrategies.filter((s) => s.difficulty === f).length;
  const mine = custom.filter((c) => (filter === 'All' || filter === 'Futures' || c.difficulty === filter) && matches(c));

  return (
    <div className="mx-auto max-w-7xl space-y-9 pb-24">
      {pageHeader(
        'Playbooks',
        `${futures.length} futures setups ranked by backtested win rate, plus ${options.length} options starters.`
      )}

      {/* Search + filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative block md:w-72 md:shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search playbooks"
            className="w-full rounded-xl bg-tp-fill py-2 pl-9 pr-3 text-[15px] text-white placeholder-zinc-500 focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-tp-blue/50"
          />
        </label>
        <div className="tp-no-scrollbar -mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 py-1 pr-10 [mask-image:linear-gradient(90deg,black_calc(100%-48px),transparent)]">
          {ALL_FILTERS.map((f) => {
            const soon = false;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => !soon && setFilter(f)}
                disabled={soon}
                aria-pressed={active}
                className={clsx(
                  'tp-press inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[14px] font-medium',
                  active
                    ? 'bg-white text-black'
                    : soon
                      ? 'cursor-not-allowed bg-white/[0.04] text-zinc-500'
                      : 'bg-tp-fill text-zinc-300 hover:bg-white/[0.14] hover:text-white'
                )}
              >
                {f}
                <span className={clsx('text-[12px] tabular-nums', active ? 'text-black/50' : 'text-zinc-500')}>
                  {soon ? 'Soon' : countFor(f)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {(
        <>
          {/* Your AI-built playbooks */}
          {mine.length > 0 && (
            <section>
              <SectionHeader title="My playbooks" count={mine.length} hint="Built with Pilot AI · saved on this device" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mine.map((c) => (
                  <CustomCard key={c.id} strategy={withEdits(c, edits)} onSelect={() => setSelectedStrategy(c.id)} />
                ))}
                <button
                  onClick={() => setCreating(true)}
                  className="tp-press flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-3xl bg-tp-fill/40 text-[15px] font-medium text-zinc-400 hover:bg-tp-fill hover:text-white"
                >
                  <Plus className="h-5 w-5" />
                  New from a video or idea
                </button>
              </div>
            </section>
          )}

          {/* Featured — global top 3 */}
          {showPodium && visible.length > 0 && (
            <section>
              <SectionHeader title="Top performers" hint="Highest AI-backtest win rate" />
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <FeatureCard strategy={visible[0]} onSelect={() => setSelectedStrategy(visible[0].id)} />
                </div>
                <div className="flex flex-col gap-4 lg:col-span-2">
                  {visible.slice(1, 3).map((s, i) => (
                    <RunnerUpCard key={s.id} strategy={s} rank={rankOf.get(s.id)!} delay={80 * (i + 1)} onSelect={() => setSelectedStrategy(s.id)} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Options starters */}
          {visibleOptions.length > 0 && (
            <section>
              <SectionHeader title="Options playbooks" count={visibleOptions.length} hint="Starter templates · paper trade before going live" />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleOptions.map((s) => (
                  <GalleryCard key={s.id} strategy={s} rank={-1} onSelect={() => setSelectedStrategy(s.id)} />
                ))}
              </div>
            </section>
          )}

          {/* The rest (or the full filtered list) */}
          {rest.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between gap-4 px-1">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-[20px] font-bold tracking-tight text-white">
                    {q ? 'Results' : showPodium ? 'All playbooks' : `${filter} playbooks`}
                  </h2>
                  <span className="text-[15px] tabular-nums text-zinc-500">{rest.length}</span>
                </div>
                <div className="relative grid grid-cols-2 rounded-[11px] bg-tp-fill p-[3px]" role="group" aria-label="Layout">
                  <span
                    aria-hidden
                    className="absolute bottom-[3px] left-[3px] top-[3px] w-[calc(50%-3px)] rounded-lg bg-[#5B6478]/70 shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_0.5px_0_rgba(255,255,255,0.14)] transition-transform duration-500 ease-spring"
                    style={{ transform: view === 'list' ? 'translateX(100%)' : 'translateX(0)' }}
                  />
                  {([
                    { id: 'gallery', label: 'Gallery', icon: LayoutGrid },
                    { id: 'list', label: 'List', icon: List },
                  ] as const).map((v) => (
                    <button
                      key={v.id}
                      aria-pressed={view === v.id}
                      onClick={() => chooseView(v.id)}
                      className={clsx(
                        'relative inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold',
                        view === v.id ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                      )}
                    >
                      <v.icon className="h-3.5 w-3.5" />
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              {view === 'gallery' ? (
                <div key="gallery" className="tp-rise grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {rest.map((s) => (
                    <GalleryCard key={s.id} strategy={s} rank={rankOf.get(s.id)!} onSelect={() => setSelectedStrategy(s.id)} />
                  ))}
                </div>
              ) : (
              <div key="list" className="tp-rise overflow-hidden rounded-3xl bg-tp-card shadow-lift ring-1 ring-inset ring-white/[0.07]">
                <div className={clsx(LIST_GRID, 'hidden border-b border-white/[0.06] px-5 py-2.5 md:grid')}>
                  <Eyebrow>#</Eyebrow>
                  <Eyebrow>Playbook</Eyebrow>
                  <Eyebrow className="hidden xl:block">Style</Eyebrow>
                  <Eyebrow>Level</Eyebrow>
                  <Eyebrow>Chart</Eyebrow>
                  <Eyebrow>Avg R</Eyebrow>
                  <Eyebrow>Win rate</Eyebrow>
                  <span />
                </div>
                {rest.map((s, i) => (
                  <PlaybookRow key={s.id} strategy={s} rank={rankOf.get(s.id)!} first={i === 0} onSelect={() => setSelectedStrategy(s.id)} />
                ))}
              </div>
              )}
            </section>
          )}

          {visible.length === 0 && mine.length === 0 && visibleOptions.length === 0 && (
            <div className="rounded-3xl bg-tp-card px-6 py-16 text-center ring-1 ring-inset ring-white/[0.07]">
              <div className="text-[20px] font-bold tracking-tight text-white">No matches</div>
              <p className="mt-1 text-[15px] text-zinc-400">
                {q ? `Nothing matches “${query.trim()}”.` : `No ${filter.toLowerCase()} playbooks yet.`}
              </p>
            </div>
          )}
        </>
      )}
      {createSheet}
    </div>
  );
};
