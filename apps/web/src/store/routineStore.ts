'use client';

import { create } from 'zustand';
import { persistence } from '@/lib/persistence';

// Checklist item interface
export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  isDefault: boolean; // Default items vs user-added
}

// Personal Trading Rule
export interface TradingRule {
  id: string;
  text: string;
  category: 'entry' | 'exit' | 'risk' | 'mindset' | 'time';
  isActive: boolean;
  createdAt: string;
}

// Daily rule compliance tracking
export interface DailyRuleCompliance {
  ruleId: string;
  followed: boolean | null; // null = not rated yet
  notes: string;
}

// Daily game plan interface
export interface DailyGamePlan {
  date: string;
  marketBias: 'bullish' | 'bearish' | 'neutral' | null;
  keyLevels: {
    support: string[];
    resistance: string[];
  };
  watchlist: string[];
  maxLoss: number | null;
  maxProfit: number | null;
  maxTrades: number | null;
  notes: string;
  completed: boolean;
  // Rule compliance for the day
  ruleCompliance: DailyRuleCompliance[];
  // Post-trade reflection
  followedPlan: boolean | null;
  emotionalState: 'calm' | 'anxious' | 'confident' | 'frustrated' | 'neutral' | null;
  lessonsLearned: string;
}

// Default checklist items
const DEFAULT_CHECKLIST_ITEMS: Omit<ChecklistItem, 'checked'>[] = [
  { id: 'default-1', text: 'Reviewed overnight news & events', isDefault: true },
  { id: 'default-2', text: 'Checked economic calendar', isDefault: true },
  { id: 'default-3', text: 'Identified key support/resistance levels', isDefault: true },
  { id: 'default-4', text: 'Set daily risk limits (max loss)', isDefault: true },
  { id: 'default-5', text: 'Mental state is good to trade', isDefault: true },
  { id: 'default-6', text: 'No revenge trading mindset', isDefault: true },
  { id: 'default-7', text: 'Trading plan is clear', isDefault: true },
  { id: 'default-8', text: 'Platform & tools are ready', isDefault: true },
];

// Default trading rules (starter pack)
const DEFAULT_TRADING_RULES: TradingRule[] = [
  { id: 'rule-1', text: 'Only trade during my best hours (9:30-11:30 AM)', category: 'time', isActive: true, createdAt: new Date().toISOString() },
  { id: 'rule-2', text: 'Wait for confirmation before entering', category: 'entry', isActive: true, createdAt: new Date().toISOString() },
  { id: 'rule-3', text: 'Never risk more than my daily max loss', category: 'risk', isActive: true, createdAt: new Date().toISOString() },
  { id: 'rule-4', text: 'Take profits at predetermined levels', category: 'exit', isActive: true, createdAt: new Date().toISOString() },
  { id: 'rule-5', text: 'No trading after 2 consecutive losses', category: 'mindset', isActive: true, createdAt: new Date().toISOString() },
  { id: 'rule-6', text: 'Always use a stop loss', category: 'risk', isActive: true, createdAt: new Date().toISOString() },
];

interface RoutineState {
  // Checklist
  checklistItems: ChecklistItem[];
  
  // Game plans by date
  gamePlans: Record<string, DailyGamePlan>;
  
  // Trading Rules
  tradingRules: TradingRule[];
  
  // Actions
  toggleChecklistItem: (id: string) => void;
  addChecklistItem: (text: string) => void;
  removeChecklistItem: (id: string) => void;
  resetChecklist: () => void;
  
  // Game plan actions
  updateGamePlan: (date: string, plan: Partial<DailyGamePlan>) => void;
  getGamePlan: (date: string) => DailyGamePlan;
  addKeyLevel: (date: string, type: 'support' | 'resistance', level: string) => void;
  removeKeyLevel: (date: string, type: 'support' | 'resistance', index: number) => void;
  addToWatchlist: (date: string, symbol: string) => void;
  removeFromWatchlist: (date: string, index: number) => void;
  
  // Trading rules actions
  addTradingRule: (text: string, category: TradingRule['category']) => void;
  removeTradingRule: (id: string) => void;
  toggleRuleActive: (id: string) => void;
  updateTradingRule: (id: string, updates: Partial<TradingRule>) => void;
  
  // Rule compliance actions
  updateRuleCompliance: (date: string, ruleId: string, followed: boolean | null, notes?: string) => void;
  batchUpdateRuleCompliance: (date: string, updates: Record<string, boolean>) => void;
  getRuleComplianceStats: (days?: number) => { ruleId: string; text: string; followedCount: number; totalDays: number; percentage: number }[];
  
  // Persistence
  initializeFromStorage: () => void;
  saveToStorage: () => void;
}

const ROUTINE_STORAGE_KEY = 'tradepilot_routine';

function persistRoutineData(
  checklistItems: ChecklistItem[],
  gamePlans: Record<string, DailyGamePlan>,
  tradingRules: TradingRule[]
): void {
  persistence.saveRoutine({
    checklistItems,
    gamePlans,
    tradingRules,
  });
}

// Create empty game plan
const createEmptyGamePlan = (date: string): DailyGamePlan => ({
  date,
  marketBias: null,
  keyLevels: { support: [], resistance: [] },
  watchlist: [],
  maxLoss: null,
  maxProfit: null,
  maxTrades: null,
  notes: '',
  completed: false,
  ruleCompliance: [],
  followedPlan: null,
  emotionalState: null,
  lessonsLearned: '',
});

// Load from localStorage
const loadFromStorage = (): { 
  checklistItems: ChecklistItem[]; 
  gamePlans: Record<string, DailyGamePlan>;
  tradingRules: TradingRule[];
} => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {
      checklistItems: DEFAULT_CHECKLIST_ITEMS.map(item => ({ ...item, checked: false })),
      gamePlans: {},
      tradingRules: DEFAULT_TRADING_RULES,
    };
  }
  try {
    const storedRoutine = persistence.loadRoutine();
    const checklistJson = storedRoutine?.checklistItems;
    const gamePlansJson = storedRoutine?.gamePlans;
    const rulesJson = storedRoutine?.tradingRules;
    
    let checklistItems: ChecklistItem[];
    if (Array.isArray(checklistJson) && checklistJson.length > 0) {
      checklistItems = checklistJson as ChecklistItem[];
    } else {
      // Initialize with default items, all unchecked
      checklistItems = DEFAULT_CHECKLIST_ITEMS.map(item => ({
        ...item,
        checked: false,
      }));
    }
    
    const gamePlans = gamePlansJson ? (gamePlansJson as Record<string, DailyGamePlan>) : {};
    const tradingRules = Array.isArray(rulesJson) && rulesJson.length > 0
      ? (rulesJson as TradingRule[])
      : DEFAULT_TRADING_RULES;
    
    return { checklistItems, gamePlans, tradingRules };
  } catch (error) {
    console.error('Failed to load routine from storage:', error);
    return {
      checklistItems: DEFAULT_CHECKLIST_ITEMS.map(item => ({ ...item, checked: false })),
      gamePlans: {},
      tradingRules: DEFAULT_TRADING_RULES,
    };
  }
};

const initialData = loadFromStorage();

export const useRoutineStore = create<RoutineState>((set, get) => ({
  checklistItems: initialData.checklistItems,
  gamePlans: initialData.gamePlans,
  tradingRules: initialData.tradingRules,

  toggleChecklistItem: (id) => {
    set((state) => {
      const newItems = state.checklistItems.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      );
      // Save to storage
      persistRoutineData(newItems, state.gamePlans, state.tradingRules);
      return { checklistItems: newItems };
    });
  },

  addChecklistItem: (text) => {
    set((state) => {
      const newItem: ChecklistItem = {
        id: `custom-${Date.now()}`,
        text,
        checked: false,
        isDefault: false,
      };
      const newItems = [...state.checklistItems, newItem];
      persistRoutineData(newItems, state.gamePlans, state.tradingRules);
      return { checklistItems: newItems };
    });
  },

  removeChecklistItem: (id) => {
    set((state) => {
      const newItems = state.checklistItems.filter((item) => item.id !== id);
      persistRoutineData(newItems, state.gamePlans, state.tradingRules);
      return { checklistItems: newItems };
    });
  },

  resetChecklist: () => {
    set((state) => {
      const newItems = state.checklistItems.map((item) => ({
        ...item,
        checked: false,
      }));
      persistRoutineData(newItems, state.gamePlans, state.tradingRules);
      return { checklistItems: newItems };
    });
  },

  getGamePlan: (date) => {
    const { gamePlans } = get();
    const plan = gamePlans[date] || createEmptyGamePlan(date);
    // Ensure critical fields exist (defensive against old data)
    if (!plan.ruleCompliance) plan.ruleCompliance = [];
    if (!plan.keyLevels) plan.keyLevels = { support: [], resistance: [] };
    if (!plan.watchlist) plan.watchlist = [];
    return plan;
  },

  updateGamePlan: (date, plan) => {
    set((state) => {
      const existing = state.gamePlans[date] || createEmptyGamePlan(date);
      const updated = { ...existing, ...plan, date };
      const newPlans = { ...state.gamePlans, [date]: updated };
      persistRoutineData(state.checklistItems, newPlans, state.tradingRules);
      return { gamePlans: newPlans };
    });
  },

  addKeyLevel: (date, type, level) => {
    set((state) => {
      const existing = state.gamePlans[date] || createEmptyGamePlan(date);
      const updated = {
        ...existing,
        keyLevels: {
          ...existing.keyLevels,
          [type]: [...existing.keyLevels[type], level],
        },
      };
      const newPlans = { ...state.gamePlans, [date]: updated };
      persistRoutineData(state.checklistItems, newPlans, state.tradingRules);
      return { gamePlans: newPlans };
    });
  },

  removeKeyLevel: (date, type, index) => {
    set((state) => {
      const existing = state.gamePlans[date] || createEmptyGamePlan(date);
      const updated = {
        ...existing,
        keyLevels: {
          ...existing.keyLevels,
          [type]: existing.keyLevels[type].filter((_, i) => i !== index),
        },
      };
      const newPlans = { ...state.gamePlans, [date]: updated };
      persistRoutineData(state.checklistItems, newPlans, state.tradingRules);
      return { gamePlans: newPlans };
    });
  },

  addToWatchlist: (date, symbol) => {
    set((state) => {
      const existing = state.gamePlans[date] || createEmptyGamePlan(date);
      const updated = {
        ...existing,
        watchlist: [...existing.watchlist, symbol.toUpperCase()],
      };
      const newPlans = { ...state.gamePlans, [date]: updated };
      persistRoutineData(state.checklistItems, newPlans, state.tradingRules);
      return { gamePlans: newPlans };
    });
  },

  removeFromWatchlist: (date, index) => {
    set((state) => {
      const existing = state.gamePlans[date] || createEmptyGamePlan(date);
      const updated = {
        ...existing,
        watchlist: existing.watchlist.filter((_, i) => i !== index),
      };
      const newPlans = { ...state.gamePlans, [date]: updated };
      persistRoutineData(state.checklistItems, newPlans, state.tradingRules);
      return { gamePlans: newPlans };
    });
  },

  // Trading Rules Actions
  addTradingRule: (text, category) => {
    set((state) => {
      const newRule: TradingRule = {
        id: `rule-${Date.now()}`,
        text,
        category,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      const newRules = [...state.tradingRules, newRule];
      persistRoutineData(state.checklistItems, state.gamePlans, newRules);
      return { tradingRules: newRules };
    });
  },

  removeTradingRule: (id) => {
    set((state) => {
      const newRules = state.tradingRules.filter((rule) => rule.id !== id);
      persistRoutineData(state.checklistItems, state.gamePlans, newRules);
      return { tradingRules: newRules };
    });
  },

  toggleRuleActive: (id) => {
    set((state) => {
      const newRules = state.tradingRules.map((rule) =>
        rule.id === id ? { ...rule, isActive: !rule.isActive } : rule
      );
      persistRoutineData(state.checklistItems, state.gamePlans, newRules);
      return { tradingRules: newRules };
    });
  },

  updateTradingRule: (id, updates) => {
    set((state) => {
      const newRules = state.tradingRules.map((rule) =>
        rule.id === id ? { ...rule, ...updates } : rule
      );
      persistRoutineData(state.checklistItems, state.gamePlans, newRules);
      return { tradingRules: newRules };
    });
  },

  // Rule Compliance Actions
  updateRuleCompliance: (date, ruleId, followed, notes = '') => {
    set((state) => {
      const existing = state.gamePlans[date] || createEmptyGamePlan(date);
      // Ensure ruleCompliance exists and is an array (defensive against old data)
      const currentCompliance = Array.isArray(existing.ruleCompliance) ? existing.ruleCompliance : [];
      const complianceIndex = currentCompliance.findIndex((c) => c.ruleId === ruleId);
      
      let newCompliance: DailyRuleCompliance[];
      if (complianceIndex >= 0) {
        newCompliance = currentCompliance.map((c, i) =>
          i === complianceIndex ? { ...c, followed, notes } : c
        );
      } else {
        newCompliance = [...currentCompliance, { ruleId, followed, notes }];
      }
      
      const updated = { ...existing, ruleCompliance: newCompliance };
      const newPlans = { ...state.gamePlans, [date]: updated };
      
      persistRoutineData(state.checklistItems, newPlans, state.tradingRules);
      return { gamePlans: newPlans };
    });
  },

  batchUpdateRuleCompliance: (date, updates) => {
    set((state) => {
      const existing = state.gamePlans[date] || createEmptyGamePlan(date);
      // Ensure ruleCompliance exists and is an array (defensive against old data)
      let newCompliance = Array.isArray(existing.ruleCompliance) ? [...existing.ruleCompliance] : [];

      Object.entries(updates).forEach(([ruleId, followed]) => {
        const index = newCompliance.findIndex((c) => c.ruleId === ruleId);
        if (index >= 0) {
          newCompliance[index] = { ...newCompliance[index], followed, notes: '' };
        } else {
          newCompliance.push({ ruleId, followed, notes: '' });
        }
      });

      const updated = { ...existing, ruleCompliance: newCompliance };
      const newPlans = { ...state.gamePlans, [date]: updated };

      persistRoutineData(state.checklistItems, newPlans, state.tradingRules);
      return { gamePlans: newPlans };
    });
  },

  getRuleComplianceStats: (days = 30) => {
    const { tradingRules, gamePlans } = get();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return tradingRules.filter(r => r.isActive).map((rule) => {
      let followedCount = 0;
      let totalDays = 0;
      
      Object.entries(gamePlans).forEach(([date, plan]) => {
        if (new Date(date) >= cutoffDate) {
          const compliance = plan.ruleCompliance?.find((c) => c.ruleId === rule.id);
          if (compliance && compliance.followed !== null) {
            totalDays++;
            if (compliance.followed) followedCount++;
          }
        }
      });
      
      return {
        ruleId: rule.id,
        text: rule.text,
        followedCount,
        totalDays,
        percentage: totalDays > 0 ? Math.round((followedCount / totalDays) * 100) : 0,
      };
    });
  },

  initializeFromStorage: () => {
    const data = loadFromStorage();
    set(data);
  },

  saveToStorage: () => {
    const { checklistItems, gamePlans, tradingRules } = get();
    persistRoutineData(checklistItems, gamePlans, tradingRules);
  },
}));
