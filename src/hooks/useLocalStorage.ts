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

// All localStorage keys used by TradePilot
const TRADEPILOT_KEYS = [
  'tradepilot_accounts',
  'tradepilot_settings',
  'tradepilot_selected_account',
  'tradepilot_theme',
  'tradepilot_routine',
  'tradepilot_gameplans',
  'tradepilot_trading_rules',
  'tradepilot_journal',
  'tradepilot_trades',
  'tradepilot-daily-notes', // Note: uses hyphen, not underscore
] as const;

// Export all TradePilot data as a downloadable JSON file
export function exportAllData(): void {
  try {
    // Collect all TradePilot data from localStorage
    const exportData: Record<string, unknown> = {
      version: '0.9.0',
      exportedAt: new Date().toISOString(),
      data: {}
    };
    
    // Export all known keys
    for (const key of TRADEPILOT_KEYS) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          (exportData.data as Record<string, unknown>)[key] = JSON.parse(value);
        } catch {
          // If not valid JSON, store as string
          (exportData.data as Record<string, unknown>)[key] = value;
        }
      }
    }
    
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
export function importBackupData(jsonString: string): { success: boolean; accountsImported: number; itemsRestored: string[]; error?: string } {
  try {
    const importData = JSON.parse(jsonString);
    
    // Validate the backup format
    if (!importData.data) {
      return { success: false, accountsImported: 0, itemsRestored: [], error: 'Invalid backup file format' };
    }
    
    const data = importData.data;
    const itemsRestored: string[] = [];
    let accountsImported = 0;
    
    // Handle new format (keys stored by their full name)
    for (const key of TRADEPILOT_KEYS) {
      if (data[key] !== undefined) {
        const value = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
        localStorage.setItem(key, value);
        itemsRestored.push(key.replace('tradepilot_', '').replace('tradepilot-', ''));
        
        if (key === 'tradepilot_accounts' && Array.isArray(data[key])) {
          accountsImported = data[key].length;
        }
      }
    }
    
    // Handle old format for backwards compatibility (accounts, settings, selectedAccount)
    if (data.accounts && !data.tradepilot_accounts) {
      localStorage.setItem('tradepilot_accounts', JSON.stringify(data.accounts));
      accountsImported = Array.isArray(data.accounts) ? data.accounts.length : 0;
      if (!itemsRestored.includes('accounts')) itemsRestored.push('accounts');
    }
    
    if (data.settings && !data.tradepilot_settings) {
      localStorage.setItem('tradepilot_settings', JSON.stringify(data.settings));
      if (!itemsRestored.includes('settings')) itemsRestored.push('settings');
    }
    
    if (data.selectedAccount && !data.tradepilot_selected_account) {
      localStorage.setItem('tradepilot_selected_account', data.selectedAccount);
      if (!itemsRestored.includes('selected_account')) itemsRestored.push('selected_account');
    }
    
    if (itemsRestored.length === 0) {
      return { success: false, accountsImported: 0, itemsRestored: [], error: 'No valid data found in backup file' };
    }
    
    return { 
      success: true, 
      accountsImported,
      itemsRestored
    };
  } catch (error) {
    console.error('Failed to import backup:', error);
    return { success: false, accountsImported: 0, itemsRestored: [], error: 'Failed to parse backup file' };
  }
}

// Export trades to CSV format
export function exportTradesToCSV(): void {
  try {
    const accountsData = localStorage.getItem('tradepilot_accounts');
    if (!accountsData) {
      throw new Error('No accounts found');
    }
    
    const accounts = JSON.parse(accountsData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allTrades: any[] = [];
    
    // Collect all trades from all accounts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accounts.forEach((account: any) => {
      if (account.trades && Array.isArray(account.trades)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        account.trades.forEach((trade: any) => {
          allTrades.push({
            Account: account.name || '',
            Broker: account.broker || '',
            Date: trade.date || '',
            Time: trade.time || '',
            Symbol: trade.symbol || '',
            Side: trade.side || '',
            Quantity: trade.quantity || trade.contracts || '',
            EntryPrice: trade.entryPrice || '',
            ExitPrice: trade.exitPrice || '',
            PnL: trade.pnl || trade.netPL || '',
            GrossPnL: trade.grossPL || '',
            Fees: trade.fees || trade.commission || '',
            Duration: trade.duration || '',
            Notes: trade.notes || ''
          });
        });
      }
    });
    
    if (allTrades.length === 0) {
      throw new Error('No trades to export');
    }
    
    // Create CSV header
    const headers = Object.keys(allTrades[0]);
    const csvRows = [headers.join(',')];
    
    // Add data rows
    allTrades.forEach(trade => {
      const values = headers.map(header => {
        const value = trade[header];
        // Escape commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      });
      csvRows.push(values.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `tradepilot_trades_${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return;
  } catch (error) {
    console.error('Failed to export CSV:', error);
    throw error;
  }
}

// Get last backup timestamp
export function getLastBackupTime(): number | null {
  try {
    const backupInfo = localStorage.getItem('tradepilot_last_backup');
    return backupInfo ? parseInt(backupInfo, 10) : null;
  } catch {
    return null;
  }
}

// Set last backup timestamp
export function setLastBackupTime(): void {
  try {
    localStorage.setItem('tradepilot_last_backup', Date.now().toString());
  } catch (error) {
    console.error('Failed to save backup time:', error);
  }
}

// Dismiss the backup reminder for 3 days
export function dismissBackupReminder(): void {
  try {
    localStorage.setItem('tradepilot_reminder_dismissed', Date.now().toString());
  } catch {
    // ignore
  }
}

// Check if backup reminder should be shown (7+ days since last backup, respects dismissals)
export function shouldShowBackupReminder(): boolean {
  try {
    const lastBackup = getLastBackupTime();
    const accountsData = localStorage.getItem('tradepilot_accounts');
    
    // No accounts = no reminder needed
    if (!accountsData) return false;
    
    const accounts = JSON.parse(accountsData);
    const totalTrades = accounts.reduce((sum: number, acc: Record<string, unknown>) => 
      sum + ((acc.trades as unknown[])?.length || 0), 0);
    
    // No trades = no reminder needed
    if (totalTrades === 0) return false;

    // If user dismissed the reminder recently, don't show again for 3 days
    const dismissed = localStorage.getItem('tradepilot_reminder_dismissed');
    if (dismissed) {
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      if (Date.now() - parseInt(dismissed, 10) < threeDaysMs) return false;
    }
    
    // Never backed up and has trades = show reminder
    if (!lastBackup) return true;
    
    // Check if 7+ days since last backup
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - lastBackup > sevenDaysMs;
  } catch {
    return false;
  }
}

// Get storage usage info
export function getStorageUsage(): { used: number; total: number; percentage: number } {
  try {
    let totalSize = 0;
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
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
  } catch {
    return { used: 0, total: 5 * 1024 * 1024, percentage: 0 };
  }
}
