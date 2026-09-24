'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DaySim, StrategyConfig } from '@/lib/proving/engine';

export const MAX_RUNNING = 5;
export const TEST_COLORS = ['#00D68F', '#4F9CF9', '#B18CFF', '#FFB800', '#FF6B9A', '#3DD9D6'];

export interface ProvingNote {
  id: string;
  at: number;
  text: string;
  /** Session date the note is about, if any. */
  date?: string;
  tradeId?: string;
}

export interface ProvingTest {
  id: string;
  name: string;
  color: string;
  cfg: StrategyConfig;
  programKey: string;
  /** First session (ET date) the test trades. */
  startDate: string;
  createdAt: number;
  state: 'running' | 'paused';
  /** Simulated sessions by date. Today's is replaced on every tick until the close. */
  days: Record<string, DaySim>;
  notes: ProvingNote[];
  lastRun: number;
  error?: string;
}

interface ProvingState {
  tests: ProvingTest[];
  selectedId: string | null;
  add: (t: Omit<ProvingTest, 'id' | 'createdAt' | 'days' | 'notes' | 'lastRun' | 'state' | 'color'> & { color?: string }) => string;
  update: (id: string, patch: Partial<ProvingTest>) => void;
  /** Change the rules and re-simulate from the start date. */
  retune: (id: string, cfg: StrategyConfig, programKey?: string) => void;
  remove: (id: string) => void;
  select: (id: string | null) => void;
  saveDays: (id: string, days: DaySim[], error?: string) => void;
  addNote: (id: string, note: Omit<ProvingNote, 'id' | 'at'>) => void;
  removeNote: (id: string, noteId: string) => void;
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const useProvingStore = create<ProvingState>()(
  persist(
    (set, get) => ({
      tests: [],
      selectedId: null,
      add: (t) => {
        const id = uid();
        const used = new Set(get().tests.map((x) => x.color));
        const color = t.color || TEST_COLORS.find((c) => !used.has(c)) || TEST_COLORS[get().tests.length % TEST_COLORS.length];
        // Past the limit a new test waits, paused, until a slot frees up.
        const state = get().tests.filter((x) => x.state === 'running').length < MAX_RUNNING ? 'running' : 'paused';
        set((s) => ({
          tests: [...s.tests, { ...t, id, color, createdAt: Date.now(), days: {}, notes: [], lastRun: 0, state }],
          selectedId: id,
        }));
        return id;
      },
      update: (id, patch) => set((s) => ({ tests: s.tests.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      retune: (id, cfg, programKey) =>
        set((s) => ({
          tests: s.tests.map((t) =>
            t.id === id ? { ...t, cfg, programKey: programKey ?? t.programKey, days: {}, lastRun: 0, error: undefined, state: 'running' } : t,
          ),
        })),
      remove: (id) => set((s) => ({ tests: s.tests.filter((t) => t.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })),
      select: (selectedId) => set({ selectedId }),
      saveDays: (id, days, error) =>
        set((s) => ({
          tests: s.tests.map((t) =>
            t.id === id
              ? { ...t, days: { ...t.days, ...Object.fromEntries(days.map((d) => [d.date, d])) }, lastRun: Date.now(), error }
              : t,
          ),
        })),
      addNote: (id, note) =>
        set((s) => ({
          tests: s.tests.map((t) => (t.id === id ? { ...t, notes: [...t.notes, { ...note, id: uid(), at: Date.now() }] } : t)),
        })),
      removeNote: (id, noteId) =>
        set((s) => ({ tests: s.tests.map((t) => (t.id === id ? { ...t, notes: t.notes.filter((n) => n.id !== noteId) } : t)) })),
    }),
    { name: 'tp_proving_v1', storage: createJSONStorage(() => localStorage) },
  ),
);
