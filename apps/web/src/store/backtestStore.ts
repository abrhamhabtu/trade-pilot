'use client';

import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BacktestSide = 'Long' | 'Short';
export type BacktestOutcome = 'win' | 'loss' | 'breakeven';
export type SessionStatus = 'active' | 'completed' | 'paused';

export interface BacktestTrade {
    id: string;
    sessionId: string;
    date: string;          // YYYY-MM-DD
    time?: string;
    side: BacktestSide;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    netPL: number;
    outcome: BacktestOutcome;
    rMultiple?: number;    // R-multiple (risk/reward)
    stopLoss?: number;
    takeProfit?: number;
    duration?: number;     // minutes
    notes?: string;
    screenshot?: string;   // base64 or URL
    tags?: string[];
    createdAt: string;
}

export interface BacktestSession {
    id: string;
    name: string;
    symbol: string;
    strategy?: string;
    description?: string;
    startBalance: number;
    currentBalance: number;
    status: SessionStatus;
    trades: BacktestTrade[];
    startDate?: string;    // date range being tested
    endDate?: string;
    timeframe?: string;    // '1m' | '5m' | '15m' | '1h' | '4h' | '1D'
    tags?: string[];
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    totalPnL: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    timeSpentMinutes: number; // total active time
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface BacktestState {
    sessions: BacktestSession[];
    activeSessionId: string | null;

    // Actions
    createSession: (data: Omit<BacktestSession, 'id' | 'createdAt' | 'updatedAt' | 'trades' | 'currentBalance' | 'totalPnL' | 'winRate' | 'profitFactor' | 'totalTrades' | 'timeSpentMinutes'>) => string;
    updateSession: (id: string, updates: Partial<BacktestSession>) => void;
    deleteSession: (id: string) => void;
    completeSession: (id: string) => void;
    setActiveSession: (id: string | null) => void;

    addTrade: (sessionId: string, trade: Omit<BacktestTrade, 'id' | 'sessionId' | 'createdAt'>) => void;
    updateTrade: (sessionId: string, tradeId: string, updates: Partial<BacktestTrade>) => void;
    deleteTrade: (sessionId: string, tradeId: string) => void;

    getSession: (id: string) => BacktestSession | null;
    getStats: () => BacktestStats;

    hydrate: () => void;
}

export interface BacktestStats {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    totalTrades: number;
    overallWinRate: number;
    overallPnL: number;
    overallProfitFactor: number;
    totalTimeSpentMinutes: number;
    bestSession: BacktestSession | null;
    avgTradesPerSession: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tradepilot_backtests';

function load(): BacktestSession[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as BacktestSession[]) : [];
    } catch { return []; }
}

function persist(sessions: BacktestSession[]): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch { }
}

function recalcSession(session: BacktestSession): BacktestSession {
    const trades = session.trades;
    const wins = trades.filter(t => t.outcome === 'win');
    const losses = trades.filter(t => t.outcome === 'loss');
    const totalPnL = trades.reduce((s, t) => s + t.netPL, 0);
    const winAmount = wins.reduce((s, t) => s + t.netPL, 0);
    const lossAmount = Math.abs(losses.reduce((s, t) => s + t.netPL, 0));
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const profitFactor = lossAmount > 0 ? winAmount / lossAmount : winAmount > 0 ? 999 : 0;
    return {
        ...session,
        totalPnL,
        currentBalance: session.startBalance + totalPnL,
        winRate,
        profitFactor,
        totalTrades: trades.length,
        updatedAt: new Date().toISOString(),
    };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBacktestStore = create<BacktestState>((set, get) => ({
    sessions: [],
    activeSessionId: null,

    hydrate: () => {
        const sessions = load();
        set({ sessions });
    },

    createSession: (data) => {
        const id = `bt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        const session: BacktestSession = {
            ...data,
            id,
            trades: [],
            currentBalance: data.startBalance,
            totalPnL: 0,
            winRate: 0,
            profitFactor: 0,
            totalTrades: 0,
            timeSpentMinutes: 0,
            createdAt: now,
            updatedAt: now,
        };
        set(state => {
            const sessions = [session, ...state.sessions];
            persist(sessions);
            return { sessions, activeSessionId: id };
        });
        return id;
    },

    updateSession: (id, updates) => {
        set(state => {
            const sessions = state.sessions.map(s =>
                s.id === id ? recalcSession({ ...s, ...updates, updatedAt: new Date().toISOString() }) : s
            );
            persist(sessions);
            return { sessions };
        });
    },

    deleteSession: (id) => {
        set(state => {
            const sessions = state.sessions.filter(s => s.id !== id);
            persist(sessions);
            return {
                sessions,
                activeSessionId: state.activeSessionId === id ? null : state.activeSessionId
            };
        });
    },

    completeSession: (id) => {
        set(state => {
            const sessions = state.sessions.map(s =>
                s.id === id ? { ...s, status: 'completed' as SessionStatus, completedAt: new Date().toISOString() } : s
            );
            persist(sessions);
            return { sessions };
        });
    },

    setActiveSession: (id) => set({ activeSessionId: id }),

    addTrade: (sessionId, tradeData) => {
        const trade: BacktestTrade = {
            ...tradeData,
            id: `btt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sessionId,
            createdAt: new Date().toISOString(),
        };
        set(state => {
            const sessions = state.sessions.map(s => {
                if (s.id !== sessionId) return s;
                return recalcSession({ ...s, trades: [...s.trades, trade] });
            });
            persist(sessions);
            return { sessions };
        });
    },

    updateTrade: (sessionId, tradeId, updates) => {
        set(state => {
            const sessions = state.sessions.map(s => {
                if (s.id !== sessionId) return s;
                return recalcSession({
                    ...s,
                    trades: s.trades.map(t => t.id === tradeId ? { ...t, ...updates } : t)
                });
            });
            persist(sessions);
            return { sessions };
        });
    },

    deleteTrade: (sessionId, tradeId) => {
        set(state => {
            const sessions = state.sessions.map(s => {
                if (s.id !== sessionId) return s;
                return recalcSession({ ...s, trades: s.trades.filter(t => t.id !== tradeId) });
            });
            persist(sessions);
            return { sessions };
        });
    },

    getSession: (id) => get().sessions.find(s => s.id === id) || null,

    getStats: () => {
        const { sessions } = get();
        if (sessions.length === 0) {
            return {
                totalSessions: 0, activeSessions: 0, completedSessions: 0,
                totalTrades: 0, overallWinRate: 0, overallPnL: 0,
                overallProfitFactor: 0, totalTimeSpentMinutes: 0,
                bestSession: null, avgTradesPerSession: 0,
            };
        }
        const all = sessions.flatMap(s => s.trades);
        const wins = all.filter(t => t.outcome === 'win');
        const losses = all.filter(t => t.outcome === 'loss');
        const winAmount = wins.reduce((s, t) => s + t.netPL, 0);
        const lossAmount = Math.abs(losses.reduce((s, t) => s + t.netPL, 0));
        const best = sessions.reduce((a, b) => b.totalPnL > (a?.totalPnL || -Infinity) ? b : a, sessions[0]);
        return {
            totalSessions: sessions.length,
            activeSessions: sessions.filter(s => s.status === 'active').length,
            completedSessions: sessions.filter(s => s.status === 'completed').length,
            totalTrades: all.length,
            overallWinRate: all.length > 0 ? (wins.length / all.length) * 100 : 0,
            overallPnL: all.reduce((s, t) => s + t.netPL, 0),
            overallProfitFactor: lossAmount > 0 ? winAmount / lossAmount : winAmount > 0 ? 999 : 0,
            totalTimeSpentMinutes: sessions.reduce((s, sess) => s + sess.timeSpentMinutes, 0),
            bestSession: best || null,
            avgTradesPerSession: all.length / sessions.length,
        };
    },
}));
