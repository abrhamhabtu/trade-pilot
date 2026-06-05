'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  BotConfig,
  BotState,
  BotMode,
  BotStatus,
  BotLogEntry,
  MarketOpportunity,
  SmartMoneyWallet,
  Position,
} from '@/lib/polymarket';
import { DEFAULT_BOT_CONFIG } from '@/lib/polymarket';
import { calculateRiskStatus, canTrade } from '@/lib/polymarket';

interface PolymarketStore {
  // Config
  config: BotConfig;
  updateConfig: (partial: Partial<BotConfig>) => void;
  updateStrategyConfig: <K extends keyof BotConfig['strategies']>(
    strategy: K,
    partial: Partial<BotConfig['strategies'][K]>
  ) => void;

  // State
  state: BotState;
  setMode: (mode: BotMode) => void;
  setStatus: (status: BotStatus) => void;
  startBot: () => void;
  pauseBot: (minutes?: number) => void;
  resumeBot: () => void;
  haltBot: () => void;
  resetBot: () => void;

  // PnL
  recordTrade: (profit: number, strategy: string) => void;

  // Logs
  addLog: (entry: Omit<BotLogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;

  // Markets
  opportunities: MarketOpportunity[];
  setOpportunities: (opps: MarketOpportunity[]) => void;

  // Wallets
  wallets: SmartMoneyWallet[];
  setWallets: (wallets: SmartMoneyWallet[]) => void;
  toggleFollowWallet: (address: string) => void;

  // Positions
  positions: Position[];
  setPositions: (positions: Position[]) => void;

  // Computed
  riskStatus: ReturnType<typeof calculateRiskStatus>;
  canTrade: ReturnType<typeof canTrade>;
}

function createInitialState(): BotState {
  return {
    mode: 'dry-run',
    status: 'idle',
    startTime: null,
    pauseUntil: null,
    dailyPnL: 0,
    monthlyPnL: 0,
    totalPnL: 0,
    peakCapital: DEFAULT_BOT_CONFIG.capital.totalUsd,
    currentCapital: DEFAULT_BOT_CONFIG.capital.totalUsd,
    currentDrawdown: 0,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    tradesExecuted: 0,
    smartMoneyTrades: 0,
    arbTrades: 0,
    dipArbTrades: 0,
    directTrades: 0,
    activeArbMarket: null,
    activeDipArbMarket: null,
    usdcBalance: 0,
    maticBalance: 0,
    btcTrend: 'neutral',
    ethTrend: 'neutral',
    solTrend: 'neutral',
    logs: [],
  };
}

export const usePolymarketStore = create<PolymarketStore>()(
  persist(
    (set, get) => ({
      config: DEFAULT_BOT_CONFIG,
      state: createInitialState(),
      opportunities: [],
      wallets: [],
      positions: [],

      updateConfig: (partial) =>
        set((s) => ({
          config: { ...s.config, ...partial },
        })),

      updateStrategyConfig: (strategy, partial) =>
        set((s) => ({
          config: {
            ...s.config,
            strategies: {
              ...s.config.strategies,
              [strategy]: { ...s.config.strategies[strategy], ...partial },
            },
          },
        })),

      setMode: (mode) =>
        set((s) => ({
          state: { ...s.state, mode },
        })),

      setStatus: (status) =>
        set((s) => ({
          state: { ...s.state, status },
        })),

      startBot: () =>
        set((s) => ({
          state: {
            ...s.state,
            status: 'running',
            startTime: Date.now(),
            pauseUntil: null,
          },
        })),

      pauseBot: (minutes = 60) =>
        set((s) => ({
          state: {
            ...s.state,
            status: 'paused',
            pauseUntil: Date.now() + minutes * 60 * 1000,
          },
        })),

      resumeBot: () =>
        set((s) => ({
          state: {
            ...s.state,
            status: 'running',
            pauseUntil: null,
          },
        })),

      haltBot: () =>
        set((s) => ({
          state: {
            ...s.state,
            status: 'halted',
          },
        })),

      resetBot: () =>
        set(() => ({
          state: createInitialState(),
        })),

      recordTrade: (profit, strategy) =>
        set((s) => {
          const newState = { ...s.state };
          newState.tradesExecuted++;
          newState.dailyPnL += profit;
          newState.monthlyPnL += profit;
          newState.totalPnL += profit;
          newState.currentCapital = s.config.capital.totalUsd + newState.totalPnL;

          if (newState.currentCapital > newState.peakCapital) {
            newState.peakCapital = newState.currentCapital;
          }
          newState.currentDrawdown =
            (newState.peakCapital - newState.currentCapital) / newState.peakCapital;

          if (profit < 0) {
            newState.consecutiveLosses++;
            newState.consecutiveWins = 0;
          } else {
            newState.consecutiveLosses = 0;
            newState.consecutiveWins++;
          }

          if (strategy === 'smartMoney') newState.smartMoneyTrades++;
          else if (strategy === 'arbitrage') newState.arbTrades++;
          else if (strategy === 'dipArb') newState.dipArbTrades++;
          else if (strategy === 'direct') newState.directTrades++;

          return { state: newState };
        }),

      addLog: (entry) =>
        set((s) => ({
          state: {
            ...s.state,
            logs: [
              {
                ...entry,
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                timestamp: Date.now(),
              },
              ...s.state.logs,
            ].slice(0, 500),
          },
        })),

      clearLogs: () =>
        set((s) => ({
          state: { ...s.state, logs: [] },
        })),

      setOpportunities: (opportunities) => set({ opportunities }),

      setWallets: (wallets) => set({ wallets }),

      toggleFollowWallet: (address) =>
        set((s) => ({
          wallets: s.wallets.map((w) =>
            w.address === address ? { ...w, following: !w.following } : w
          ),
        })),

      setPositions: (positions) => set({ positions }),

      get riskStatus() {
        return calculateRiskStatus(get().state, get().config);
      },

      get canTrade() {
        return canTrade(get().state, get().config);
      },
    }),
    {
      name: 'tradepilot_polymarket',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        config: state.config,
        state: {
          ...state.state,
          logs: [],
        },
      }),
    }
  )
);
