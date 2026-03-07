'use client';

import { create } from 'zustand';
import { Trade } from './tradingStore';
import { persistence } from '@/lib/persistence';

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

// Balance adjustment entry (for payouts, deposits, manual adjustments)
export interface BalanceAdjustment {
  id: string;
  date: string; // YYYY-MM-DD format
  amount: number; // Negative for payouts/withdrawals, positive for deposits
  type: 'payout' | 'deposit' | 'adjustment';
  description?: string;
  createdAt: string;
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
  // Balance adjustments (payouts, deposits, manual adjustments)
  balanceAdjustments?: BalanceAdjustment[];
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
  addTradesToAccount: (accountId: string, trades: Trade[], fileName?: string) => { added: number; skipped: number };
  addImportHistoryEntry: (accountId: string, entry: Omit<ImportHistoryEntry, 'id'>) => void;
  deleteImportHistoryEntry: (accountId: string, entryId: string) => void;
  clearAccountTrades: (accountId: string) => void;
  updateAccountBalance: (accountId: string) => void;
  // Balance adjustment actions
  addBalanceAdjustment: (accountId: string, adjustment: Omit<BalanceAdjustment, 'id' | 'createdAt'>) => void;
  deleteBalanceAdjustment: (accountId: string, adjustmentId: string) => void;
  getAccountAdjustments: (accountId: string) => BalanceAdjustment[];
  initializeFromStorage: () => void;
  initializeFromIDB: () => Promise<void>;
  saveToStorage: () => void;
}

const ACCOUNTS_STORAGE_KEY = 'tradepilot_accounts';
const SELECTED_ACCOUNT_KEY = 'tradepilot_selected_account';

// ─── Sync helper to persist accounts (IDB primary, localStorage fallback) ─────
function persistAccounts(accounts: Account[], selectedId?: string | null): void {
  // Fire-and-forget async save to IndexedDB
  persistence.saveAccounts(accounts as unknown[]).catch(e =>
    console.error('Failed to persist accounts to IDB:', e)
  );
  // selectedAccountId stays in localStorage (tiny value, always safe)
  if (selectedId !== undefined) persistence.saveSelectedAccountId(selectedId);
}

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

// ─── Stable initial state for SSR and first client render ────
// Always start from the same placeholder state and hydrate from persistence
// in initializeFromIDB() after mount. This prevents SSR/client mismatches.
const createInitialAccountsState = (): { accounts: Account[]; selectedId: string | null } => {
  const demoAccount = generateDemoAccount();
  return { accounts: [demoAccount], selectedId: demoAccount.id };
};

const initialData = createInitialAccountsState();

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
      persistAccounts(newAccounts, state.selectedAccountId || id);
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
      persistAccounts(newAccounts);
      return { accounts: newAccounts };
    });
  },

  deleteAccount: (id) => {
    set((state) => {
      const newAccounts = state.accounts.filter((account) => account.id !== id);
      let newSelectedId = state.selectedAccountId;
      if (state.selectedAccountId === id) {
        newSelectedId = newAccounts.length > 0 ? newAccounts[0].id : null;
      }
      persistAccounts(newAccounts, newSelectedId);
      return { accounts: newAccounts, selectedAccountId: newSelectedId };
    });
  },

  selectAccount: (id) => {
    set({ selectedAccountId: id, showAllAccounts: false });
    persistence.saveSelectedAccountId(id);
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
    let addedCount = 0;
    let skippedCount = 0;

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

          const existingTradeKeys = new Set(account.trades.map((t) => buildTradeKey(t)));
          const importEntryId = fileName
            ? `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            : null;

          const uniqueNewTrades: Trade[] = [];
          for (const trade of trades) {
            const key = buildTradeKey(trade);
            if (existingTradeKeys.has(key)) {
              skippedCount++;
              continue;
            }
            existingTradeKeys.add(key);
            uniqueNewTrades.push({
              ...trade,
              importId: importEntryId || undefined,
              importFileName: fileName
            });
          }
          addedCount = uniqueNewTrades.length;

          const allTrades = [...account.trades, ...uniqueNewTrades].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          const tradeBalance = allTrades.reduce((sum, t) => sum + t.netPL, 0);
          const adjustmentBalance = (account.balanceAdjustments || []).reduce((sum, adj) => sum + adj.amount, 0);
          const balance = tradeBalance + adjustmentBalance;

          const lastUpdate = new Date().toLocaleString('en-US', {
            month: '2-digit', day: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
          });

          let newImportHistory = account.importHistory || [];
          if (fileName && uniqueNewTrades.length > 0 && importEntryId) {
            const dates = uniqueNewTrades.map(t => t.date).sort();
            const importEntry: ImportHistoryEntry = {
              id: importEntryId,
              fileName,
              importedAt: lastUpdate,
              tradesImported: uniqueNewTrades.length,
              totalPnL: uniqueNewTrades.reduce((sum, t) => sum + t.netPL, 0),
              dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null
            };
            newImportHistory = [...newImportHistory, importEntry];
          }

          return { ...account, trades: allTrades, balance, lastUpdate, importHistory: newImportHistory };
        }
        return account;
      });

      persistAccounts(newAccounts);
      return { accounts: newAccounts };
    });

    return { added: addedCount, skipped: skippedCount };
  },

  addImportHistoryEntry: (accountId, entry) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) => {
        if (account.id === accountId) {
          const newEntry: ImportHistoryEntry = {
            ...entry,
            id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          };
          return { ...account, importHistory: [...(account.importHistory || []), newEntry] };
        }
        return account;
      });
      persistAccounts(newAccounts);
      return { accounts: newAccounts };
    });
  },

  deleteImportHistoryEntry: (accountId, entryId) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) => {
        if (account.id === accountId) {
          const entry = (account.importHistory || []).find(e => e.id === entryId);
          const filteredTrades = account.trades.filter(t => {
            if (t.importId === entryId) return false;
            if (entry?.fileName && t.importFileName === entry.fileName) return false;
            return true;
          });
          const tradeBalance = filteredTrades.reduce((sum, t) => sum + t.netPL, 0);
          const adjustmentBalance = (account.balanceAdjustments || []).reduce((sum, adj) => sum + adj.amount, 0);
          const balance = tradeBalance + adjustmentBalance;
          return {
            ...account,
            trades: filteredTrades,
            balance,
            importHistory: (account.importHistory || []).filter(e => e.id !== entryId)
          };
        }
        return account;
      });
      persistAccounts(newAccounts);
      return { accounts: newAccounts };
    });
  },

  clearAccountTrades: (accountId) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) => {
        if (account.id === accountId) {
          const adjustmentBalance = (account.balanceAdjustments || []).reduce((sum, adj) => sum + adj.amount, 0);
          return { ...account, trades: [], balance: adjustmentBalance, importHistory: [] };
        }
        return account;
      });
      persistAccounts(newAccounts);
      return { accounts: newAccounts };
    });
  },

  updateAccountBalance: (accountId) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) => {
        if (account.id === accountId) {
          const tradeBalance = account.trades.reduce((sum, t) => sum + t.netPL, 0);
          const adjustmentBalance = (account.balanceAdjustments || []).reduce((sum, adj) => sum + adj.amount, 0);
          const balance = tradeBalance + adjustmentBalance;
          return { ...account, balance };
        }
        return account;
      });
      persistAccounts(newAccounts);
      return { accounts: newAccounts };
    });
  },

  addBalanceAdjustment: (accountId, adjustment) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) => {
        if (account.id === accountId) {
          const newAdjustment: BalanceAdjustment = {
            ...adjustment,
            id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString()
          };
          const balanceAdjustments = [...(account.balanceAdjustments || []), newAdjustment].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const tradeBalance = account.trades.reduce((sum, t) => sum + t.netPL, 0);
          const adjustmentBalance = balanceAdjustments.reduce((sum, adj) => sum + adj.amount, 0);
          const balance = tradeBalance + adjustmentBalance;
          return { ...account, balanceAdjustments, balance };
        }
        return account;
      });
      persistAccounts(newAccounts);
      return { accounts: newAccounts };
    });
  },

  deleteBalanceAdjustment: (accountId, adjustmentId) => {
    set((state) => {
      const newAccounts = state.accounts.map((account) => {
        if (account.id === accountId) {
          const balanceAdjustments = (account.balanceAdjustments || []).filter(
            (adj) => adj.id !== adjustmentId
          );
          const tradeBalance = account.trades.reduce((sum, t) => sum + t.netPL, 0);
          const adjustmentBalance = balanceAdjustments.reduce((sum, adj) => sum + adj.amount, 0);
          const balance = tradeBalance + adjustmentBalance;
          return { ...account, balanceAdjustments, balance };
        }
        return account;
      });
      persistAccounts(newAccounts);
      return { accounts: newAccounts };
    });
  },

  getAccountAdjustments: (accountId) => {
    const { accounts } = get();
    const account = accounts.find((a) => a.id === accountId);
    return account?.balanceAdjustments || [];
  },

  initializeFromStorage: () => {
    const data = createInitialAccountsState();
    set({ accounts: data.accounts, selectedAccountId: data.selectedId });
  },

  initializeFromIDB: async () => {
    try {
      // loadAccountsFromIDB already handles IDB → localStorage fallback internally
      const rawAccounts = await persistence.loadAccounts();

      // Nothing in IDB or localStorage — keep current state (demo account placeholder)
      if (!rawAccounts || !Array.isArray(rawAccounts) || rawAccounts.length === 0) {
        return;
      }

      const accounts = (rawAccounts as Account[]).map(account => ({
        ...account,
        importHistory: account.importHistory || [],
        status: account.status || 'active',
        trades: account.trades || [],
      }));

      // Only overwrite store if IDB/localStorage has real (non-demo) accounts
      const hasRealAccounts = accounts.some(a => a.type !== 'demo');
      if (!hasRealAccounts) return;

      const selectedId = persistence.loadSelectedAccountId();
      set({
        accounts,
        selectedAccountId: selectedId || accounts[0]?.id || null,
      });
    } catch (e) {
      console.error('Failed to initialize from IDB:', e);
    }
  },

  saveToStorage: () => {
    const { accounts, selectedAccountId } = get();
    persistAccounts(accounts, selectedAccountId);
  }
}));
