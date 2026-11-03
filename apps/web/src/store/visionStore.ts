'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MarketKind, Timeframe, VisionSymbolId } from '@/lib/vision/markets';
import type { Side } from '@/lib/vision/analyze';

export type Venue = 'paper' | 'tradovate' | 'projectx';

export interface ChartSlot {
  symbol: VisionSymbolId;
  tf: Timeframe;
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

interface VisionState {
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
  set: (patch: Partial<Omit<VisionState, 'set' | 'open' | 'close' | 'handle' | 'setChart' | 'resetPaper'>>) => void;
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
    { name: 'tp_vision_v1', storage: createJSONStorage(() => localStorage) },
  ),
);
