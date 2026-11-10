'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MarketKind, Timeframe, VisionSymbolId } from '@/lib/vision/markets';
import type { ReaderChoice, Side } from '@/lib/vision/analyze';
import { TEMPLATES, type CustomRules, type SessionKey } from '@/lib/vision/custom';
import type { ChartView } from '@/lib/vision/chartView';

export type Venue = 'paper' | 'tradovate' | 'projectx';

export interface ChartSlot {
  symbol: VisionSymbolId;
  tf: Timeframe;
  /** Which strategy reads this chart; 'auto' runs all of them. */
  reader?: ReaderChoice;
  /** What the chart draws; unset follows the layout (clean when two share the screen). */
  view?: ChartView;
}

export interface VisionPosition {
  id: string;
  symbol: VisionSymbolId;
  side: Side;
  qty: number;
  entry: number;
  stop: number;
  target: number;
  openedAt: number;
  setupId: string;
  auto: boolean;
  venue: Venue;
  /** Dollars per 1.0 price move per unit (contract or coin). */
  pointValue: number;
}

export interface VisionTrade extends VisionPosition {
  exit: number;
  closedAt: number;
  pnl: number;
  reason: 'target' | 'stop' | 'manual';
}

export interface BacktestSettings {
  symbol: string;
  source: 'library' | 'feed';
  tf: Timeframe;
  /** Days back from the end of the data; 0 = everything loaded. */
  days: number;
  reader: ReaderChoice;
  side: 'both' | Side;
  contracts: number;
  micro: boolean;
  riskDollars: number;
  commission: number;
  slippageTicks: number;
  maxHold: number;
  skipFomc: boolean;
  skipEarly: boolean;
  vix: 'any' | 'low' | 'mid' | 'high';
  /** Entry hours, New York time. */
  session: SessionKey;
  /** Custom period (YYYY-MM-DD), used when days is -1. */
  from?: string;
  to?: string;
  /** Starting balance; in prop firm mode, the account size. */
  balance: number;
  /** Vision's strategies, or the trader's own rules written in plain English. */
  logic: 'vision' | 'custom';
  text: string;
  /** The parsed rules, as edited on screen. */
  rules: CustomRules | null;
  /** Futures sizing: a fixed count, or contracts that risk a share of the balance. */
  sizing: 'fixed' | 'risk';
  riskPct: number;
  breakEvenR: number | null;
  maxPerDay: number | null;
  prop: { on: boolean; program: string };
}

/** A tag or note on one historical trade. */
export interface JournalEntry {
  tags: string[];
  note: string;
}

interface VisionState {
  mode: 'live' | 'backtest';
  btTab: 'test' | 'prop' | 'replay' | 'library';
  /** The prop account open in the Prop firm tab. */
  propAccount: string | null;
  bt: BacktestSettings;
  /** Notes on backtest and replay trades, by symbol:entry time. */
  journal: Record<string, JournalEntry>;
  setJournal: (key: string, e: JournalEntry | null) => void;
  kind: MarketKind;
  charts: ChartSlot[];
  focus: number;
  autoExecute: boolean;
  /** Auto-execute only when history rates the setup at least this hit rate. */
  minHitRate: number;
  /** Auto-execute only when history shows a positive edge per trade. */
  requireEdge: boolean;
  /** Paper sizing: crypto risks this many dollars per trade; futures trade this many contracts. */
  riskDollars: number;
  contracts: number;
  micro: boolean;
  accountSize: number;
  venue: Venue;
  sound: boolean;
  positions: VisionPosition[];
  trades: VisionTrade[];
  /** Setups already acted on or skipped, so a setup is never taken twice. */
  handled: string[];
  set: (patch: Partial<Omit<VisionState, 'set' | 'open' | 'close' | 'handle' | 'setChart' | 'resetPaper' | 'setBt' | 'setJournal'>>) => void;
  setBt: (patch: Partial<BacktestSettings>) => void;
  setChart: (index: number, patch: Partial<ChartSlot>) => void;
  open: (p: Omit<VisionPosition, 'id' | 'openedAt'>) => void;
  close: (id: string, exit: number, reason: VisionTrade['reason']) => VisionTrade | null;
  handle: (setupId: string) => void;
  resetPaper: () => void;
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const useVisionStore = create<VisionState>()(
  persist(
    (set, get) => ({
      mode: 'live',
      btTab: 'test',
      propAccount: null,
      bt: { symbol: 'NQ', source: 'library', tf: '5m', days: 365, reader: 'auto', side: 'both', contracts: 2, micro: true, riskDollars: 250, commission: 1.04, slippageTicks: 1, maxHold: 48, skipFomc: false, skipEarly: true, vix: 'any', session: 'ny', balance: 50_000, logic: 'vision', text: TEMPLATES[0].text, rules: null, sizing: 'fixed', riskPct: 1, breakEvenR: null, maxPerDay: null, prop: { on: false, program: 'lucid-pro:lucidpro-50k' } },
      journal: {},
      setJournal: (key, e) =>
        set((s) => {
          const journal = { ...s.journal };
          if (e && (e.tags.length || e.note.trim())) journal[key] = e;
          else delete journal[key];
          return { journal };
        }),
      setBt: (patch) => set((s) => ({ bt: { ...s.bt, ...patch } })),
      kind: 'crypto',
      charts: [{ symbol: 'BTC', tf: '15m' }],
      focus: 0,
      autoExecute: false,
      minHitRate: 0.5,
      requireEdge: true,
      riskDollars: 250,
      contracts: 1,
      micro: true,
      accountSize: 50_000,
      venue: 'paper',
      sound: true,
      positions: [],
      trades: [],
      handled: [],
      set: (patch) => set(patch),
      setChart: (index, patch) => set((s) => ({ charts: s.charts.map((c, i) => (i === index ? { ...c, ...patch } : c)) })),
      open: (p) => set((s) => ({ positions: [...s.positions, { ...p, id: uid(), openedAt: Date.now() }], handled: [...s.handled.slice(-200), p.setupId] })),
      close: (id, exit, reason) => {
        const p = get().positions.find((x) => x.id === id);
        if (!p) return null;
        const pnl = (p.side === 'long' ? exit - p.entry : p.entry - exit) * p.qty * p.pointValue;
        const trade: VisionTrade = { ...p, exit, closedAt: Date.now(), pnl, reason };
        set((s) => ({ positions: s.positions.filter((x) => x.id !== id), trades: [...s.trades.slice(-500), trade] }));
        return trade;
      },
      handle: (setupId) => set((s) => ({ handled: [...s.handled.slice(-200), setupId] })),
      resetPaper: () => set({ positions: [], trades: [], handled: [] }),
    }),
    {
      name: 'tp_vision_v1',
      storage: createJSONStorage(() => localStorage),
      // New backtest settings get their defaults on top of what was saved before.
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<VisionState>;
        const bt = { ...current.bt, ...p.bt } as BacktestSettings;
        // Sessions were once 'rth'; that is New York now.
        if ((bt.session as string) === 'rth') bt.session = 'ny';
        return { ...current, ...p, bt };
      },
    },
  ),
);
