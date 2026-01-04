import { Trade } from '../store/tradingStore';

const STORAGE_KEY = 'tradepilot_trades';
const SETTINGS_KEY = 'tradepilot_settings';

interface StoredSettings {
  hasImportedData: boolean;
  lastImportTime: number;
}

export function saveTradesToStorage(trades: Trade[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  } catch (error) {
    console.error('Failed to save trades to localStorage:', error);
  }
}

export function loadTradesFromStorage(): Trade[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Trade[];
    }
    return null;
  } catch (error) {
    console.error('Failed to load trades from localStorage:', error);
    return null;
  }
}

export function saveSettingsToStorage(settings: StoredSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error);
  }
}

export function loadSettingsFromStorage(): StoredSettings | null {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored) as StoredSettings;
    }
    return null;
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error);
    return null;
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}
