import { create } from 'zustand';
import { Trade } from './tradingStore';

// Import history entry
export interface ImportHistoryEntry {
  id: string;
  fileName: string;
  importedAt: string;
  tradesImported: number;
  totalPnL: number;
  dateRange: {
    from: string;
    to: string;
  } | null;
}

export type AccountStatus = 'active' | 'passed_eval' | 'blown' | 'inactive';

export interface Account {
  id: string;
  name: string;
  broker: string;
  balance: number;
  lastUpdate: string | null;
  type: 'file_upload' | 'demo' | 'manual';
  status: AccountStatus;
  trades: Trade[];
  createdAt: string;
  importHistory: ImportHistoryEntry[];
  // Journey fields
  isFunded?: boolean;
  profitTarget?: number;
  startingBalance?: number;
  pacingPreference?: 'conservative' | 'moderate' | 'aggressive';
  consistencyRulePercentage?: number;
  consistencyBasis?: 'profitTarget' | 'currentProfit';
  // Consistency Guardian fields
  originalProfitTarget?: number;
  accountTier?: 'instant' | 'elite';
}

interface AccountState {
  accounts: Account[];
  selectedAccountId: string | null;
  showAllAccounts: boolean;

  // Actions
  addAccount: (account: Omit<Account, 'id' | 'createdAt' | 'trades' | 'balance' | 'lastUpdate' | 'importHistory' | 'status'>) => string;
  updateAccount: (id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>) => void;
  deleteAccount: (id: string) => void;
  selectAccount: (id: string | null) => void;
  setShowAllAccounts: (show: boolean) => void;
  getSelectedAccount: () => Account | null;
  getAllTrades: () => Trade[];
  getAccountTrades: (accountId: string) => Trade[];
  addTradesToAccount: (accountId: string, trades: Trade[], fileName?: string) => void;
  addImportHistoryEntry: (accountId: string, entry: Omit<ImportHistoryEntry, 'id'>) => void;
  deleteImportHistoryEntry: (accountId: string, entryId: string) => void;
  clearAccountTrades: (accountId: string) => void;
  updateAccountBalance: (accountId: string) => void;
  initializeFromStorage: () => void;
  saveToStorage: () => void;
}

const ACCOUNTS_STORAGE_KEY = 'tradepilot_accounts';
const SELECTED_ACCOUNT_KEY = 'tradepilot_selected_account';

// Generate demo account with sample trades
const generateDemoAccount = (): Account => {
  const demoTrades: Trade[] = [
    {
      id: 'demo-1',
      date: '2025-01-08',
      symbol: 'MES',
      entryPrice: 5980.25,
      exitPrice: 5992.50,
      quantity: 2,
      netPL: 122.50,
      duration: 45,
      outcome: 'win',
      time: '10:30 AM',
      side: 'Long',
      commission: 4.50,
      notes: 'Demo trade - morning momentum'
    },
    {
      id: 'demo-2',
      date: '2025-01-08',
      symbol: 'MES',
      entryPrice: 5995.00,
      exitPrice: 5988.75,
      quantity: 1,
      netPL: -62.50,
      duration: 22,
      outcome: 'loss',
      time: '2:15 PM',
      side: 'Long',
      commission: 2.25,
      notes: 'Demo trade - false breakout'
    },
    {
      id: 'demo-3',
      date: '2025-01-07',
      symbol: 'MNQ',
      entryPrice: 21250.00,
      exitPrice: 21295.50,
      quantity: 1,
      netPL: 91.00,
      duration: 38,
      outcome: 'win',
      time: '11:45 AM',
      side: 'Long',
      commission: 2.50,
      notes: 'Demo trade - trend continuation'
    }
  ];

  const balance = demoTrades.reduce((sum, t) => sum + t.netPL, 0) + 14742;

  return {
    id: 'demo-account',
    name: 'Demo Account',
    broker: 'Generic Template',
    balance: balance,
    lastUpdate: null,
    type: 'demo',
    status: 'active',
    trades: demoTrades,
    createdAt: new Date().toISOString(),
    importHistory: []
  };
};

// Load accounts from localStorage
const loadAccountsFromStorage = (): { accounts: Account[]; selectedId: string | null } => {
  try {
    const accountsJson = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    const selectedId = localStorage.getItem(SELECTED_ACCOUNT_KEY);

    if (accountsJson) {
      const rawAccounts = JSON.parse(accountsJson) as Account[];
      // Migrate existing accounts to include importHistory if missing
      let didMigrate = false;
      const accounts = rawAccounts.map(account => {
        const importHistory = account.importHistory || [];
        const importFileById = new Map(importHistory.map(entry => [entry.id, entry.fileName]));
        const trades = (account.trades || []).map(trade => {
          if (trade.importFileName || !trade.importId) return trade;
          const fileName = importFileById.get(trade.importId);
          if (fileName) {
            didMigrate = true;
            return { ...trade, importFileName: fileName };
          }
          return trade;
        });

        return {
          ...account,
          trades,
          importHistory,
          status: account.status || 'active'
        };
      });

      // Save migrated accounts back to storage
      if (rawAccounts.some(a => !a.importHistory || !a.status) || didMigrate) {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
      }

      return {
        accounts,
        selectedId: selectedId || (accounts.length > 0 ? accounts[0].id : null)
      };
    }
  } catch (error) {
    console.error('Failed to load accounts from storage:', error);
  }

  // Return default demo account if nothing stored
  const demoAccount = generateDemoAccount();
  return {
    accounts: [demoAccount],
    selectedId: demoAccount.id
  };
};

const initialData = loadAccountsFromStorage();

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: initialData.accounts,
  selectedAccountId: initialData.selectedId,
  showAllAccounts: false,

  addAccount: (accountData) => {
    const id = `account-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newAccount: Account = {
      ...accountData,
      id,
      balance: 0,
      lastUpdate: null,
      status: 'active',
      trades: [],
      createdAt: new Date().toISOString(),
      importHistory: []
    };

    set((state) => {
      const newAccounts = [...state.accounts, newAccount];
      // Save to storage
      try {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(newAccounts));
      } catch (e) {
        console.error('Failed to save accounts:', e);
      }
      return {
        accounts: newAccounts,
        selectedAccountId: state.selectedAccountId || id
      };
    });

    return id;
  },

  updateAccount: (id, updates) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) =>
        account.id === id ? { ...account, ...updates } : account
      );
      // Save to storage
      try {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(newAccounts));
      } catch (e) {
        console.error('Failed to save accounts:', e);
      }
      return { accounts: newAccounts };
    });
  },

  deleteAccount: (id) => {
    set((state) => {
      const newAccounts = state.accounts.filter((account) => account.id !== id);
      let newSelectedId = state.selectedAccountId;

      // If deleted account was selected, select another one
      if (state.selectedAccountId === id) {
        newSelectedId = newAccounts.length > 0 ? newAccounts[0].id : null;
      }

      // Save to storage
      try {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(newAccounts));
        if (newSelectedId) {
          localStorage.setItem(SELECTED_ACCOUNT_KEY, newSelectedId);
        } else {
          localStorage.removeItem(SELECTED_ACCOUNT_KEY);
        }
      } catch (e) {
        console.error('Failed to save accounts:', e);
      }

      return {
        accounts: newAccounts,
        selectedAccountId: newSelectedId
      };
    });
  },

  selectAccount: (id) => {
    set({ selectedAccountId: id, showAllAccounts: false });
    if (id) {
      try {
        localStorage.setItem(SELECTED_ACCOUNT_KEY, id);
      } catch (e) {
        console.error('Failed to save selected account:', e);
      }
    }
  },

  setShowAllAccounts: (show) => {
    set({ showAllAccounts: show });
  },

  getSelectedAccount: () => {
    const { accounts, selectedAccountId } = get();
    return accounts.find((a) => a.id === selectedAccountId) || null;
  },

  getAllTrades: () => {
    const { accounts, selectedAccountId, showAllAccounts } = get();

    if (showAllAccounts) {
      return accounts.flatMap((a) => a.trades);
    }

    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    return selectedAccount?.trades || [];
  },

  getAccountTrades: (accountId) => {
    const { accounts } = get();
    const account = accounts.find((a) => a.id === accountId);
    return account?.trades || [];
  },

  addTradesToAccount: (accountId, trades, fileName) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) => {
        if (account.id === accountId) {
          const normalizeDate = (date: string | undefined) => {
            if (!date) return '';
            const trimmed = date.trim();
            if (trimmed.length >= 10 && (trimmed.includes('T') || trimmed.includes(' '))) {
              return trimmed.slice(0, 10);
            }
            return trimmed;
          };

          const normalizeNum = (value: number | undefined, digits: number) => {
            if (value === null || value === undefined || Number.isNaN(value)) return '';
            return Number(value).toFixed(digits);
          };

          const buildTradeKey = (t: Trade) => {
            const date = normalizeDate(t.date);
            const time = (t.time || '').trim().toUpperCase();
            const symbol = (t.symbol || '').trim().toUpperCase();
            const side = (t.side || '').trim().toUpperCase();
            const qty = normalizeNum(t.quantity, 4);
            const entry = normalizeNum(t.entryPrice, 4);
            const exit = normalizeNum(t.exitPrice, 4);
            const pnl = normalizeNum(t.netPL, 2);
            return `${date}|${time}|${symbol}|${side}|${qty}|${entry}|${exit}|${pnl}`;
          };

          // Merge trades, avoiding duplicates with a stronger key
          const existingTradeKeys = new Set(account.trades.map((t) => buildTradeKey(t)));

          // Generate import entry ID first so we can tag trades
          const importEntryId = fileName ? `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : null;

          // Tag new trades with import ID and filter duplicates (also dedupe within the import)
          const uniqueNewTrades: Trade[] = [];
          for (const trade of trades) {
            const key = buildTradeKey(trade);
            if (existingTradeKeys.has(key)) continue;
            existingTradeKeys.add(key);
            uniqueNewTrades.push({
              ...trade,
              importId: importEntryId || undefined,
              importFileName: fileName
            });
          }

          const allTrades = [...account.trades, ...uniqueNewTrades].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          const balance = allTrades.reduce((sum, t) => sum + t.netPL, 0);

          const lastUpdate = new Date().toLocaleString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });

          // Create import history entry if fileName provided
          let newImportHistory = account.importHistory || [];
          if (fileName && uniqueNewTrades.length > 0 && importEntryId) {
            const dates = uniqueNewTrades.map(t => t.date).sort();
            const importEntry: ImportHistoryEntry = {
              id: importEntryId,
              fileName,
              importedAt: lastUpdate,
              tradesImported: uniqueNewTrades.length,
              totalPnL: uniqueNewTrades.reduce((sum, t) => sum + t.netPL, 0),
              dateRange: dates.length > 0 ? {
                from: dates[0],
                to: dates[dates.length - 1]
              } : null
            };
            newImportHistory = [...newImportHistory, importEntry];
          }

          return {
            ...account,
            trades: allTrades,
            balance,
            lastUpdate,
            importHistory: newImportHistory
          };
        }
        return account;
      });

      // Save to storage
      try {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(newAccounts));
      } catch (e) {
        console.error('Failed to save accounts:', e);
      }

      return { accounts: newAccounts };
    });
  },

  addImportHistoryEntry: (accountId, entry) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) => {
        if (account.id === accountId) {
          const newEntry: ImportHistoryEntry = {
            ...entry,
            id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          };
          return {
            ...account,
            importHistory: [...(account.importHistory || []), newEntry]
          };
        }
        return account;
      });

      try {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(newAccounts));
      } catch (e) {
        console.error('Failed to save accounts:', e);
      }

      return { accounts: newAccounts };
    });
  },

  deleteImportHistoryEntry: (accountId, entryId) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) => {
        if (account.id === accountId) {
          const entry = (account.importHistory || []).find(e => e.id === entryId);

          // Remove trades that have this importId
          const filteredTrades = account.trades.filter(t => {
            if (t.importId === entryId) return false;
            if (entry?.fileName && t.importFileName === entry.fileName) return false;
            return true;
          });

          // Recalculate balance
          const balance = filteredTrades.reduce((sum, t) => sum + t.netPL, 0);

          return {
            ...account,
            trades: filteredTrades,
            balance,
            importHistory: (account.importHistory || []).filter(e => e.id !== entryId)
          };
        }
        return account;
      });

      try {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(newAccounts));
      } catch (e) {
        console.error('Failed to save accounts:', e);
      }

      return { accounts: newAccounts };
    });
  },

  clearAccountTrades: (accountId) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) => {
        if (account.id === accountId) {
          return {
            ...account,
            trades: [],
            balance: 0,
            importHistory: []
          };
        }
        return account;
      });

      try {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(newAccounts));
      } catch (e) {
        console.error('Failed to save accounts:', e);
      }

      return { accounts: newAccounts };
    });
  },

  updateAccountBalance: (accountId) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) => {
        if (account.id === accountId) {
          const balance = account.trades.reduce((sum, t) => sum + t.netPL, 0);
          return { ...account, balance };
        }
        return account;
      });

      // Save to storage
      try {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(newAccounts));
      } catch (e) {
        console.error('Failed to save accounts:', e);
      }

      return { accounts: newAccounts };
    });
  },

  initializeFromStorage: () => {
    const data = loadAccountsFromStorage();
    set({
      accounts: data.accounts,
      selectedAccountId: data.selectedId
    });
  },

  saveToStorage: () => {
    const { accounts, selectedAccountId } = get();
    try {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
      if (selectedAccountId) {
        localStorage.setItem(SELECTED_ACCOUNT_KEY, selectedAccountId);
      }
    } catch (e) {
      console.error('Failed to save to storage:', e);
    }
  }
}));
