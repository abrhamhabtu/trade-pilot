import type { AppPersistence, RoutineSnapshot, StoredSettings } from './types';

type CloudStore = {
  accounts: unknown[] | null;
  selectedAccountId: string | null;
  notes: Record<string, unknown>;
  trades: unknown[] | null;
  settings: StoredSettings | null;
  theme: string | null;
  routine: RoutineSnapshot | null;
  journalEntries: unknown[] | null;
};

const store: CloudStore = {
  accounts: null,
  selectedAccountId: null,
  notes: {},
  trades: null,
  settings: null,
  theme: null,
  routine: null,
  journalEntries: null,
};

export const mockCloudPersistenceAdapter: AppPersistence = {
  async saveAccounts(accounts) {
    store.accounts = accounts;
  },
  async loadAccounts() {
    return store.accounts;
  },
  saveSelectedAccountId(id) {
    store.selectedAccountId = id;
  },
  loadSelectedAccountId() {
    return store.selectedAccountId;
  },
  async saveNotes(notes) {
    store.notes = notes;
  },
  async loadNotes() {
    return store.notes;
  },
  saveTrades(trades) {
    store.trades = trades;
  },
  loadTrades<T>() {
    return store.trades as T[] | null;
  },
  saveSettings(settings) {
    store.settings = settings;
  },
  loadSettings() {
    return store.settings;
  },
  saveTheme(theme) {
    store.theme = theme;
  },
  loadTheme() {
    return store.theme;
  },
  saveRoutine(snapshot) {
    store.routine = snapshot;
  },
  loadRoutine() {
    return store.routine;
  },
  saveJournalEntries(entries) {
    store.journalEntries = entries;
  },
  loadJournalEntries<T>() {
    return store.journalEntries as T[] | null;
  },
};
