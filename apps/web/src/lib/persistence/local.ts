import {
  loadAccountsFromIDB,
  loadNotesFromIDB,
  loadSelectedAccountId,
  saveAccountsToIDB,
  saveNotesToIDB,
  saveSelectedAccountId,
} from '@/utils/indexedDB';
import type { AppPersistence, RoutineSnapshot, StoredSettings } from './types';

const TRADES_KEY = 'tradepilot_trades';
const SETTINGS_KEY = 'tradepilot_settings';
const THEME_KEY = 'tradepilot_theme';
const ROUTINE_STORAGE_KEY = 'tradepilot_routine';
const GAMEPLAN_STORAGE_KEY = 'tradepilot_gameplans';
const RULES_STORAGE_KEY = 'tradepilot_trading_rules';
const JOURNAL_KEY = 'tradepilot_journal';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function saveJson(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save ${key}:`, error);
  }
}

function loadJson<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : null;
  } catch (error) {
    console.error(`Failed to load ${key}:`, error);
    return null;
  }
}

export const localPersistenceAdapter: AppPersistence = {
  async saveAccounts(accounts) {
    await saveAccountsToIDB(accounts);
  },

  async loadAccounts() {
    return loadAccountsFromIDB();
  },

  saveSelectedAccountId(id) {
    saveSelectedAccountId(id);
  },

  loadSelectedAccountId() {
    return loadSelectedAccountId();
  },

  async saveNotes(notes) {
    await saveNotesToIDB(notes);
  },

  async loadNotes() {
    return loadNotesFromIDB();
  },

  saveTrades(trades) {
    saveJson(TRADES_KEY, trades);
  },

  loadTrades<T>() {
    return loadJson<T[]>(TRADES_KEY);
  },

  saveSettings(settings: StoredSettings) {
    saveJson(SETTINGS_KEY, settings);
  },

  loadSettings() {
    return loadJson<StoredSettings>(SETTINGS_KEY);
  },

  saveTheme(theme) {
    if (!canUseStorage()) return;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  },

  loadTheme() {
    if (!canUseStorage()) return null;
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  },

  saveRoutine(snapshot: RoutineSnapshot) {
    saveJson(ROUTINE_STORAGE_KEY, snapshot.checklistItems);
    saveJson(GAMEPLAN_STORAGE_KEY, snapshot.gamePlans);
    saveJson(RULES_STORAGE_KEY, snapshot.tradingRules);
  },

  loadRoutine() {
    return {
      checklistItems: loadJson<unknown[]>(ROUTINE_STORAGE_KEY) || [],
      gamePlans: loadJson<Record<string, unknown>>(GAMEPLAN_STORAGE_KEY) || {},
      tradingRules: loadJson<unknown[]>(RULES_STORAGE_KEY) || [],
    };
  },

  saveJournalEntries(entries) {
    saveJson(JOURNAL_KEY, entries);
  },

  loadJournalEntries<T>() {
    return loadJson<T[]>(JOURNAL_KEY);
  },
};
