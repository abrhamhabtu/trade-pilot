'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_PLAN, type DayPlan, type TvSignal } from '@/lib/pilot/session';
import type { MacroEvent } from '@/lib/pilot/market';

export interface SessionNote {
  id: string;
  accountId: string;
  /** New York session date. */
  date: string;
  at: number;
  text: string;
  signalId?: string;
  auto: boolean;
}

interface SessionFlowState {
  /** Shared secret between TradingView alerts and this browser. */
  webhookKey: string;
  /** Public base URL (e.g. a cloudflared tunnel) TradingView can reach. */
  publicUrl: string;
  listening: boolean;
  desktopAlerts: boolean;
  lastSignalAt: number;
  signals: TvSignal[];
  notes: SessionNote[];
  plans: Record<string, DayPlan>;
  carry: Record<string, { date: string; text: string }>;
  /** Today's events, cached by the flight plan so the listener can judge signals anywhere in the app. */
  events: { date: string; list: MacroEvent[] };

  ensureKey: () => string;
  rotateKey: () => void;
  setPublicUrl: (url: string) => void;
  setListening: (on: boolean) => void;
  setDesktopAlerts: (on: boolean) => void;
  addSignals: (list: TvSignal[], lastAt: number) => TvSignal[];
  addNote: (note: Omit<SessionNote, 'id'>) => void;
  removeNote: (id: string) => void;
  plan: (accountId: string, date: string) => DayPlan;
  setPlan: (accountId: string, date: string, patch: Partial<DayPlan>) => void;
  setCarry: (accountId: string, date: string, text: string) => void;
  setEvents: (date: string, list: MacroEvent[]) => void;
}

const newKey = () => {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 57]).join('');
};

export const planKey = (accountId: string, date: string) => `${accountId}:${date}`;

/** Today's plan, or — until the trader touches it — yesterday's choices without yesterday's levels and ticks. */
export function resolvePlan(plans: Record<string, DayPlan>, accountId: string, date: string): DayPlan {
  const key = planKey(accountId, date);
  if (plans[key]) return plans[key];
  const prior = Object.entries(plans)
    .filter(([k]) => k.startsWith(`${accountId}:`) && k < key)
    .sort(([a], [b]) => a.localeCompare(b))
    .at(-1)?.[1];
  return prior ? { ...prior, levels: prior.levels.filter((l) => l.source === 'manual'), checks: {} } : DEFAULT_PLAN;
}

export const useSessionFlow = create<SessionFlowState>()(
  persist(
    (set, get) => ({
      webhookKey: '',
      publicUrl: '',
      listening: false,
      desktopAlerts: false,
      lastSignalAt: 0,
      signals: [],
      notes: [],
      plans: {},
      carry: {},
      events: { date: '', list: [] },

      ensureKey: () => {
        const existing = get().webhookKey;
        if (existing) return existing;
        const key = newKey();
        set({ webhookKey: key });
        return key;
      },
      rotateKey: () => set({ webhookKey: newKey(), lastSignalAt: 0 }),
      setPublicUrl: (publicUrl) => set({ publicUrl: publicUrl.trim().replace(/\/+$/, '') }),
      setListening: (listening) => set({ listening }),
      setDesktopAlerts: (desktopAlerts) => set({ desktopAlerts }),
      addSignals: (list, lastAt) => {
        const seen = new Set(get().signals.map((s) => s.id));
        const fresh = list.filter((s) => !seen.has(s.id));
        set((s) => ({
          signals: [...s.signals, ...fresh].slice(-200),
          lastSignalAt: Math.max(s.lastSignalAt, lastAt),
        }));
        return fresh;
      },
      addNote: (note) =>
        set((s) => ({
          notes: [...s.notes, { ...note, id: `${note.at.toString(36)}-${Math.random().toString(36).slice(2, 7)}` }].slice(-400),
        })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      plan: (accountId, date) => resolvePlan(get().plans, accountId, date),
      setPlan: (accountId, date, patch) =>
        set((s) => ({
          plans: { ...s.plans, [planKey(accountId, date)]: { ...resolvePlan(s.plans, accountId, date), ...patch } },
        })),
      setCarry: (accountId, date, text) => set((s) => ({ carry: { ...s.carry, [accountId]: { date, text } } })),
      setEvents: (date, list) => set({ events: { date, list } }),
    }),
    {
      name: 'tp_session_flow_v1',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ webhookKey, publicUrl, listening, desktopAlerts, lastSignalAt, signals, notes, plans, carry, events }) => ({
        webhookKey, publicUrl, listening, desktopAlerts, lastSignalAt, signals, notes, plans, carry, events,
      }),
    },
  ),
);
