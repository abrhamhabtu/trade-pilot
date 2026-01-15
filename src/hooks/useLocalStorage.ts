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

// Export all TradePilot data as a downloadable JSON file
export function exportAllData(): void {
  try {
    const accounts = localStorage.getItem('tradepilot_accounts');
    const settings = localStorage.getItem('tradepilot_settings');
    const selectedAccount = localStorage.getItem('tradepilot_selected_account');
    
    const exportData = {
      version: '0.9.0',
      exportedAt: new Date().toISOString(),
      data: {
        accounts: accounts ? JSON.parse(accounts) : [],
        settings: settings ? JSON.parse(settings) : null,
        selectedAccount: selectedAccount || null
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `tradepilot_backup_${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return;
  } catch (error) {
    console.error('Failed to export data:', error);
    throw new Error('Failed to export data');
  }
}

// Import TradePilot data from a backup JSON file
export function importBackupData(jsonString: string): { success: boolean; accountsImported: number; error?: string } {
  try {
    const importData = JSON.parse(jsonString);
    
    // Validate the backup format
    if (!importData.data || !importData.data.accounts) {
      return { success: false, accountsImported: 0, error: 'Invalid backup file format' };
    }
    
    const { accounts, settings, selectedAccount } = importData.data;
    
    // Save to localStorage
    if (accounts && Array.isArray(accounts)) {
      localStorage.setItem('tradepilot_accounts', JSON.stringify(accounts));
    }
    
    if (settings) {
      localStorage.setItem('tradepilot_settings', JSON.stringify(settings));
    }
    
    if (selectedAccount) {
      localStorage.setItem('tradepilot_selected_account', selectedAccount);
    }
    
    return { 
      success: true, 
      accountsImported: Array.isArray(accounts) ? accounts.length : 0 
    };
  } catch (error) {
    console.error('Failed to import backup:', error);
    return { success: false, accountsImported: 0, error: 'Failed to parse backup file' };
  }
}

// Get storage usage info
export function getStorageUsage(): { used: number; total: number; percentage: number } {
  try {
    let totalSize = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage.getItem(key)?.length || 0;
      }
    }
    // localStorage limit is typically 5-10MB, we'll estimate 5MB
    const totalLimit = 5 * 1024 * 1024; // 5MB in bytes (characters)
    return {
      used: totalSize,
      total: totalLimit,
      percentage: (totalSize / totalLimit) * 100
    };
  } catch (error) {
    return { used: 0, total: 5 * 1024 * 1024, percentage: 0 };
  }
}
