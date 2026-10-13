'use client';

import { create } from 'zustand';

// A journal belongs to the trader, not to a firm: "Abe's prop accounts",
// "Personal", "Options". Each one holds its own set of trading accounts.

export interface Journal {
  id: string;
  name: string;
  /** Tile colour, as a hex. */
  color: string;
}

export const DEFAULT_JOURNAL_ID = 'default';
const JOURNALS_KEY = 'tradepilot_journals';
const ACTIVE_KEY = 'tradepilot_active_journal';
export const JOURNAL_COLORS = ['#30D158', '#0A84FF', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF', '#FFD60A', '#AC8E68'];
const SEED_KEY = 'tradepilot_journals_seed';
const FIRST: Journal = { id: DEFAULT_JOURNAL_ID, name: 'Prop Journal', color: JOURNAL_COLORS[0] };
/** Must match OPTIONS_JOURNAL_ID in lib/demo/demoData: the sample options account lives here. */
const OPTIONS: Journal = { id: 'options', name: 'Options Journal', color: JOURNAL_COLORS[1] };
const STARTERS = [FIRST, OPTIONS];

function read(): { journals: Journal[]; activeId: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(JOURNALS_KEY) || 'null');
    let journals: Journal[] =
      Array.isArray(raw) && raw.length ? raw.filter((j) => j && typeof j.id === 'string' && typeof j.name === 'string') : [...STARTERS];
    if (!journals.some((j) => j.id === DEFAULT_JOURNAL_ID)) journals.unshift(FIRST);
    // One-time upgrade for lists saved before the starter journals existed.
    if (localStorage.getItem(SEED_KEY) !== '2') {
      journals = journals.map((j) => (j.id === DEFAULT_JOURNAL_ID && j.name === 'My Journal' ? { ...j, name: FIRST.name } : j));
      if (!journals.some((j) => j.id === OPTIONS.id)) journals.push(OPTIONS);
      localStorage.setItem(SEED_KEY, '2');
      localStorage.setItem(JOURNALS_KEY, JSON.stringify(journals));
    }
    const saved = localStorage.getItem(ACTIVE_KEY);
    return { journals, activeId: journals.some((j) => j.id === saved) ? (saved as string) : DEFAULT_JOURNAL_ID };
  } catch {
    return { journals: [...STARTERS], activeId: DEFAULT_JOURNAL_ID };
  }
}

function write(journals: Journal[], activeId: string) {
  try {
    localStorage.setItem(JOURNALS_KEY, JSON.stringify(journals));
    localStorage.setItem(ACTIVE_KEY, activeId);
  } catch {}
}

/** The journal the app is showing. Safe to call outside React (the account store uses it). */
export function getActiveJournalId(): string {
  return typeof window === 'undefined' ? DEFAULT_JOURNAL_ID : read().activeId;
}

interface JournalState {
  journals: Journal[];
  activeId: string;
  hydrate: () => void;
  setActive: (id: string) => void;
  addJournal: (name: string) => string;
  renameJournal: (id: string, name: string) => void;
  removeJournal: (id: string) => void;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  journals: [...STARTERS],
  activeId: DEFAULT_JOURNAL_ID,

  hydrate: () => set(read()),

  setActive: (id) => {
    if (!get().journals.some((j) => j.id === id)) return;
    write(get().journals, id);
    set({ activeId: id });
  },

  addJournal: (name) => {
    const journals = get().journals;
    const id = `journal-${Date.now().toString(36)}`;
    const used = new Set(journals.map((j) => j.color));
    const color = JOURNAL_COLORS.find((c) => !used.has(c)) ?? JOURNAL_COLORS[journals.length % JOURNAL_COLORS.length];
    const next = [...journals, { id, name: name.trim() || 'New journal', color }];
    write(next, get().activeId);
    set({ journals: next });
    return id;
  },

  renameJournal: (id, name) => {
    const clean = name.trim();
    if (!clean) return;
    const next = get().journals.map((j) => (j.id === id ? { ...j, name: clean } : j));
    write(next, get().activeId);
    set({ journals: next });
  },

  removeJournal: (id) => {
    if (id === DEFAULT_JOURNAL_ID) return;
    const next = get().journals.filter((j) => j.id !== id);
    const activeId = get().activeId === id ? DEFAULT_JOURNAL_ID : get().activeId;
    write(next, activeId);
    set({ journals: next, activeId });
  },
}));

export const journalInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'J';
