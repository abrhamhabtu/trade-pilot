'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Target,
  Eye,
  DollarSign,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Shield,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  Clock,
  Zap,
  Brain,
  LogOut,
  LogIn
} from 'lucide-react';
import { useRoutineStore, TradingRule } from '../../store/routineStore';
import { useThemeStore } from '../../store/themeStore';
import clsx from 'clsx';

// Category colors and icons
const RULE_CATEGORIES: Record<TradingRule['category'], { label: string; color: string; icon: React.ElementType }> = {
  entry: { label: 'Entry', color: '#3BF68A', icon: LogIn },
  exit: { label: 'Exit', color: '#A78BFA', icon: LogOut },
  risk: { label: 'Risk', color: '#F45B69', icon: Shield },
  mindset: { label: 'Mindset', color: '#60A5FA', icon: Brain },
  time: { label: 'Time', color: '#FBBF24', icon: Clock },
};

// Get today's date in YYYY-MM-DD format
const getTodayDate = () => new Date().toISOString().split('T')[0];

// Format date for display
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
};

export const RoutinePage: React.FC = () => {
  const { theme } = useThemeStore();
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newSupport, setNewSupport] = useState('');
  const [newResistance, setNewResistance] = useState('');
  const [newWatchlistSymbol, setNewWatchlistSymbol] = useState('');
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState<TradingRule['category']>('entry');
  const [showAddRuleForm, setShowAddRuleForm] = useState(false);
  const [ruleSavedMessage, setRuleSavedMessage] = useState('');

  const {
    checklistItems,
    toggleChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    resetChecklist,
    getGamePlan,
    updateGamePlan,
    addKeyLevel,
    removeKeyLevel,
    addToWatchlist,
    removeFromWatchlist,
    tradingRules,
    addTradingRule,
    removeTradingRule,
    toggleRuleActive,
    updateRuleCompliance,
    getRuleComplianceStats,
  } = useRoutineStore();

  const gamePlan = getGamePlan(selectedDate);
  const completedCount = checklistItems.filter(item => item.checked).length;
  const totalCount = checklistItems.length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const isToday = selectedDate === getTodayDate();
  const activeRules = tradingRules.filter(r => r.isActive);
  const complianceStats = getRuleComplianceStats(30);

  // Get today's rule compliance
  const getRuleCompliance = (ruleId: string) => {
    const compliance = gamePlan.ruleCompliance?.find(c => c.ruleId === ruleId);
    return compliance?.followed ?? null;
  };

  const handleAddRule = () => {
    if (newRuleText.trim()) {
      addTradingRule(newRuleText.trim(), newRuleCategory);
      setNewRuleText('');
      setShowAddRuleForm(false);
      setRuleSavedMessage('Rule saved! It will apply to all trading days.');
      setTimeout(() => setRuleSavedMessage(''), 3000);
    }
  };

  // Initialize all active rules for the current day (set to "not rated" so you can track them)
  const initializeRulesForDay = () => {
    activeRules.forEach(rule => {
      const existing = gamePlan.ruleCompliance?.find(c => c.ruleId === rule.id);
      if (!existing) {
        updateRuleCompliance(selectedDate, rule.id, null, '');
      }
    });
    setRuleSavedMessage('Rules initialized for this day! Start tracking your compliance.');
    setTimeout(() => setRuleSavedMessage(''), 3000);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const date = new Date(selectedDate + 'T12:00:00');
    date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      addChecklistItem(newChecklistItem.trim());
      setNewChecklistItem('');
    }
  };

  const handleAddSupport = () => {
    if (newSupport.trim()) {
      addKeyLevel(selectedDate, 'support', newSupport.trim());
      setNewSupport('');
    }
  };

  const handleAddResistance = () => {
    if (newResistance.trim()) {
      addKeyLevel(selectedDate, 'resistance', newResistance.trim());
      setNewResistance('');
    }
  };

  const handleAddWatchlist = () => {
    if (newWatchlistSymbol.trim()) {
      addToWatchlist(selectedDate, newWatchlistSymbol.trim());
      setNewWatchlistSymbol('');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className={clsx(
          'text-2xl font-bold mb-2',
          theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
        )}>
          Pre-Trade Routine
        </h1>
        <p className={clsx(
          'text-sm',
          theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
        )}>
          Complete your checklist and game plan before market open
        </p>
      </div>

      {/* Date Navigation */}
      <div className={clsx(
        'flex items-center justify-between p-4 rounded-xl border mb-6',
        theme === 'dark' 
          ? 'bg-[#15181F] border-[#1F2937]' 
          : 'bg-white border-gray-200'
      )}>
        <button
          onClick={() => navigateDate('prev')}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            theme === 'dark'
              ? 'hover:bg-[#1F2937] text-[#8B94A7] hover:text-[#E5E7EB]'
              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        <div className="text-center">
          <p className={clsx(
            'text-lg font-semibold',
            theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
          )}>
            {formatDate(selectedDate)}
          </p>
          {isToday && (
            <span className="text-xs px-2 py-1 rounded-full bg-[#3BF68A]/20 text-[#3BF68A]">
              Today
            </span>
          )}
        </div>

        <button
          onClick={() => navigateDate('next')}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            theme === 'dark'
              ? 'hover:bg-[#1F2937] text-[#8B94A7] hover:text-[#E5E7EB]'
              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pre-Trade Checklist */}
        <div className={clsx(
          'rounded-xl border p-6',
          theme === 'dark' 
            ? 'bg-[#15181F] border-[#1F2937]' 
            : 'bg-white border-gray-200'
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-[#3BF68A]/10">
                <CheckCircle2 className="h-5 w-5 text-[#3BF68A]" />
              </div>
              <div>
                <h2 className={clsx(
                  'text-lg font-semibold',
                  theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
                )}>
                  Pre-Trade Checklist
                </h2>
                <p className={clsx(
                  'text-sm',
                  theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
                )}>
                  {completedCount}/{totalCount} completed ({completionPercent}%)
                </p>
              </div>
            </div>
            <button
              onClick={resetChecklist}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                theme === 'dark'
                  ? 'hover:bg-[#1F2937] text-[#8B94A7] hover:text-[#E5E7EB]'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              )}
              title="Reset checklist"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className={clsx(
            'h-2 rounded-full mb-4',
            theme === 'dark' ? 'bg-[#1F2937]' : 'bg-gray-200'
          )}>
            <div 
              className="h-full rounded-full bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] transition-all duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          {/* Checklist items */}
          <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto">
            {checklistItems.map((item) => (
              <div
                key={item.id}
                className={clsx(
                  'flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer',
                  item.checked
                    ? theme === 'dark'
                      ? 'bg-[#3BF68A]/10 border-[#3BF68A]/30'
                      : 'bg-green-50 border-green-200'
                    : theme === 'dark'
                      ? 'bg-[#0B0D10] border-[#1F2937] hover:border-[#3BF68A]/30'
                      : 'bg-gray-50 border-gray-200 hover:border-green-300'
                )}
                onClick={() => toggleChecklistItem(item.id)}
              >
                <div className="flex items-center space-x-3">
                  {item.checked ? (
                    <CheckCircle2 className="h-5 w-5 text-[#3BF68A]" />
                  ) : (
                    <Circle className={clsx(
                      'h-5 w-5',
                      theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-400'
                    )} />
                  )}
                  <span className={clsx(
                    'text-sm',
                    item.checked
                      ? 'line-through text-[#8B94A7]'
                      : theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
                  )}>
                    {item.text}
                  </span>
                </div>
                {!item.isDefault && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeChecklistItem(item.id);
                    }}
                    className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add new item */}
          <div className="flex space-x-2">
            <input
              type="text"
              value={newChecklistItem}
              onChange={(e) => setNewChecklistItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
              placeholder="Add custom item..."
              className={clsx(
                'flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50',
                theme === 'dark'
                  ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              )}
            />
            <button
              onClick={handleAddChecklistItem}
              className="px-3 py-2 bg-[#3BF68A] text-black rounded-lg hover:bg-[#3BF68A]/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Daily Game Plan */}
        <div className={clsx(
          'rounded-xl border p-6',
          theme === 'dark' 
            ? 'bg-[#15181F] border-[#1F2937]' 
            : 'bg-white border-gray-200'
        )}>
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 rounded-lg bg-[#A78BFA]/10">
              <Target className="h-5 w-5 text-[#A78BFA]" />
            </div>
            <h2 className={clsx(
              'text-lg font-semibold',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
            )}>
              Daily Game Plan
            </h2>
          </div>

          {/* Market Bias */}
          <div className="mb-6">
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
            )}>
              Market Bias
            </label>
            <div className="flex space-x-2">
              {[
                { value: 'bullish', icon: TrendingUp, color: 'text-[#3BF68A]', bg: 'bg-[#3BF68A]' },
                { value: 'neutral', icon: Minus, color: 'text-[#8B94A7]', bg: 'bg-[#8B94A7]' },
                { value: 'bearish', icon: TrendingDown, color: 'text-[#F45B69]', bg: 'bg-[#F45B69]' },
              ].map(({ value, icon: Icon, color, bg }) => (
                <button
                  key={value}
                  onClick={() => updateGamePlan(selectedDate, { 
                    marketBias: gamePlan.marketBias === value ? null : value as any 
                  })}
                  className={clsx(
                    'flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border transition-all',
                    gamePlan.marketBias === value
                      ? `${bg}/20 border-current ${color}`
                      : theme === 'dark'
                        ? 'bg-[#0B0D10] border-[#1F2937] text-[#8B94A7] hover:border-[#3BF68A]/30'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="capitalize text-sm font-medium">{value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Key Levels */}
          <div className="mb-6">
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
            )}>
              Key Levels
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Support */}
              <div>
                <p className="text-xs text-[#3BF68A] mb-2 font-medium">Support</p>
                <div className="space-y-2">
                  {gamePlan.keyLevels.support.map((level, idx) => (
                    <div key={idx} className={clsx(
                      'flex items-center justify-between px-3 py-2 rounded-lg border',
                      theme === 'dark' ? 'bg-[#0B0D10] border-[#1F2937]' : 'bg-gray-50 border-gray-200'
                    )}>
                      <span className={clsx('text-sm', theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700')}>
                        {level}
                      </span>
                      <button
                        onClick={() => removeKeyLevel(selectedDate, 'support', idx)}
                        className="text-red-400 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newSupport}
                      onChange={(e) => setNewSupport(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSupport()}
                      placeholder="Add level..."
                      className={clsx(
                        'flex-1 px-2 py-1 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-[#3BF68A]/50',
                        theme === 'dark'
                          ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                          : 'bg-gray-50 border-gray-300 text-gray-900'
                      )}
                    />
                    <button onClick={handleAddSupport} className="text-[#3BF68A]">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Resistance */}
              <div>
                <p className="text-xs text-[#F45B69] mb-2 font-medium">Resistance</p>
                <div className="space-y-2">
                  {gamePlan.keyLevels.resistance.map((level, idx) => (
                    <div key={idx} className={clsx(
                      'flex items-center justify-between px-3 py-2 rounded-lg border',
                      theme === 'dark' ? 'bg-[#0B0D10] border-[#1F2937]' : 'bg-gray-50 border-gray-200'
                    )}>
                      <span className={clsx('text-sm', theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700')}>
                        {level}
                      </span>
                      <button
                        onClick={() => removeKeyLevel(selectedDate, 'resistance', idx)}
                        className="text-red-400 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newResistance}
                      onChange={(e) => setNewResistance(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddResistance()}
                      placeholder="Add level..."
                      className={clsx(
                        'flex-1 px-2 py-1 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-[#3BF68A]/50',
                        theme === 'dark'
                          ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                          : 'bg-gray-50 border-gray-300 text-gray-900'
                      )}
                    />
                    <button onClick={handleAddResistance} className="text-[#F45B69]">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Watchlist */}
          <div className="mb-6">
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
            )}>
              <Eye className="h-4 w-4 inline mr-1" />
              Watchlist
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {gamePlan.watchlist.map((symbol, idx) => (
                <span
                  key={idx}
                  className={clsx(
                    'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                    theme === 'dark' 
                      ? 'bg-[#A78BFA]/20 text-[#A78BFA]' 
                      : 'bg-purple-100 text-purple-700'
                  )}
                >
                  {symbol}
                  <button
                    onClick={() => removeFromWatchlist(selectedDate, idx)}
                    className="ml-2 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newWatchlistSymbol}
                onChange={(e) => setNewWatchlistSymbol(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWatchlist()}
                placeholder="Add symbol (e.g., ES, NQ, MES)..."
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/50',
                  theme === 'dark'
                    ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                )}
              />
              <button
                onClick={handleAddWatchlist}
                className="px-3 py-2 bg-[#A78BFA] text-white rounded-lg hover:bg-[#A78BFA]/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Risk Limits */}
          <div className="mb-6">
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
            )}>
              <DollarSign className="h-4 w-4 inline mr-1" />
              Risk Limits
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-[#8B94A7] mb-1">Max Loss</p>
                <input
                  type="number"
                  value={gamePlan.maxLoss || ''}
                  onChange={(e) => updateGamePlan(selectedDate, { maxLoss: e.target.value ? Number(e.target.value) : null })}
                  placeholder="$0"
                  className={clsx(
                    'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#F45B69]/50',
                    theme === 'dark'
                      ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                      : 'bg-gray-50 border-gray-300 text-gray-900'
                  )}
                />
              </div>
              <div>
                <p className="text-xs text-[#8B94A7] mb-1">Max Profit</p>
                <input
                  type="number"
                  value={gamePlan.maxProfit || ''}
                  onChange={(e) => updateGamePlan(selectedDate, { maxProfit: e.target.value ? Number(e.target.value) : null })}
                  placeholder="$0"
                  className={clsx(
                    'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50',
                    theme === 'dark'
                      ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                      : 'bg-gray-50 border-gray-300 text-gray-900'
                  )}
                />
              </div>
              <div>
                <p className="text-xs text-[#8B94A7] mb-1">Max Trades</p>
                <input
                  type="number"
                  value={gamePlan.maxTrades || ''}
                  onChange={(e) => updateGamePlan(selectedDate, { maxTrades: e.target.value ? Number(e.target.value) : null })}
                  placeholder="0"
                  className={clsx(
                    'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/50',
                    theme === 'dark'
                      ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                      : 'bg-gray-50 border-gray-300 text-gray-900'
                  )}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
            )}>
              Notes & Game Plan
            </label>
            <textarea
              value={gamePlan.notes}
              onChange={(e) => updateGamePlan(selectedDate, { notes: e.target.value })}
              placeholder="Write your trading plan for the day..."
              rows={4}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50 resize-none',
                theme === 'dark'
                  ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                  : 'bg-gray-50 border-gray-300 text-gray-900'
              )}
            />
          </div>
        </div>
      </div>

      {/* My Trading Rules Section */}
      <div className={clsx(
        'rounded-xl border p-6 mt-6',
        theme === 'dark' 
          ? 'bg-[#15181F] border-[#1F2937]' 
          : 'bg-white border-gray-200'
      )}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-[#F45B69]/10">
              <Shield className="h-5 w-5 text-[#F45B69]" />
            </div>
            <div>
              <h2 className={clsx(
                'text-lg font-semibold',
                theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
              )}>
                My Trading Rules
              </h2>
              <p className={clsx(
                'text-sm',
                theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
              )}>
                {activeRules.length} active rules • Saved automatically • Track compliance daily
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {activeRules.length > 0 && (
              <button
                onClick={initializeRulesForDay}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  gamePlan.ruleCompliance?.length === 0
                    ? 'bg-[#3BF68A] text-black hover:bg-[#3BF68A]/90'
                    : theme === 'dark'
                      ? 'bg-[#1F2937] text-[#E5E7EB] hover:bg-[#2A3441]'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
                title="Initialize all active rules for this day so you can track compliance"
              >
                {gamePlan.ruleCompliance?.length === 0 ? 'Start Tracking Today' : 'Reset Tracking'}
              </button>
            )}
            <button
              onClick={() => setShowAddRuleForm(!showAddRuleForm)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                theme === 'dark'
                  ? 'bg-[#1F2937] text-[#E5E7EB] hover:bg-[#2A3441]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {showAddRuleForm ? 'Cancel' : '+ Add Rule'}
            </button>
          </div>
        </div>

        {/* Save confirmation message */}
        {ruleSavedMessage && (
          <div className={clsx(
            'mb-4 p-3 rounded-lg border',
            theme === 'dark' 
              ? 'bg-[#3BF68A]/10 border-[#3BF68A]/30 text-[#3BF68A]' 
              : 'bg-green-50 border-green-200 text-green-700'
          )}>
            <p className="text-sm">{ruleSavedMessage}</p>
          </div>
        )}

        {/* Info banner */}
        {tradingRules.length > 0 && (
          <div className={clsx(
            'mb-4 p-3 rounded-lg border',
            theme === 'dark' 
              ? 'bg-[#60A5FA]/10 border-[#60A5FA]/30' 
              : 'bg-blue-50 border-blue-200'
          )}>
            <p className={clsx('text-xs', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-600')}>
              <strong className={theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'}>How it works:</strong> Your rules are saved automatically and apply to all trading days. 
              Click "Start Tracking Today" to initialize compliance tracking for {formatDate(selectedDate)}. 
              Then use 👍/👎 buttons to mark if you followed each rule.
            </p>
          </div>
        )}

        {/* Add New Rule Form */}
        {showAddRuleForm && (
          <div className={clsx(
            'p-4 rounded-lg border mb-4',
            theme === 'dark' ? 'bg-[#0B0D10] border-[#1F2937]' : 'bg-gray-50 border-gray-200'
          )}>
            <p className={clsx(
              'text-sm font-medium mb-3',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
            )}>
              Add New Rule (saved automatically)
            </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {(Object.keys(RULE_CATEGORIES) as TradingRule['category'][]).map((cat) => {
                  const { label, color, icon: Icon } = RULE_CATEGORIES[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => setNewRuleCategory(cat)}
                      className={clsx(
                        'flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        newRuleCategory === cat
                          ? 'ring-2 ring-offset-1'
                          : 'opacity-60 hover:opacity-100',
                        theme === 'dark' ? 'ring-offset-[#0B0D10]' : 'ring-offset-gray-50'
                      )}
                      style={{ 
                        backgroundColor: `${color}20`,
                        color: color,
                        borderColor: newRuleCategory === cat ? color : 'transparent',
                      }}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
                  placeholder="e.g., Never chase a trade after missing entry..."
                  className={clsx(
                    'flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#F45B69]/50',
                    theme === 'dark'
                      ? 'bg-[#15181F] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                      : 'bg-white border-gray-300 text-gray-900'
                  )}
                />
                <button
                  onClick={handleAddRule}
                  className="px-4 py-2 bg-[#F45B69] text-white rounded-lg hover:bg-[#F45B69]/90 transition-colors font-medium text-sm"
                >
                  Save Rule
                </button>
              </div>
            </div>
        )}

        {/* Rules List - Always Visible */}
        {tradingRules.length === 0 ? (
          <div className={clsx(
            'text-center py-8 rounded-lg border',
            theme === 'dark' ? 'bg-[#0B0D10] border-[#1F2937]' : 'bg-gray-50 border-gray-200'
          )}>
            <Shield className={clsx('h-12 w-12 mx-auto mb-3', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-400')} />
            <p className={clsx('text-sm mb-2', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500')}>
              No trading rules yet
            </p>
            <p className={clsx('text-xs', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-400')}>
              Add your first rule to start tracking your discipline
            </p>
          </div>
        ) : (
          <div className="space-y-4">
              {(Object.keys(RULE_CATEGORIES) as TradingRule['category'][]).map((category) => {
                const rulesInCategory = tradingRules.filter(r => r.category === category);
                if (rulesInCategory.length === 0) return null;
                
                const { label, color, icon: Icon } = RULE_CATEGORIES[category];
                
                return (
                  <div key={category}>
                    <div className="flex items-center space-x-2 mb-2">
                      <Icon className="h-4 w-4" style={{ color }} />
                      <span className={clsx(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
                      )}>
                        {label} Rules
                      </span>
                    </div>
                    <div className="space-y-2">
                      {rulesInCategory.map((rule) => {
                        const compliance = getRuleCompliance(rule.id);
                        const stats = complianceStats.find(s => s.ruleId === rule.id);
                        
                        return (
                          <div
                            key={rule.id}
                            className={clsx(
                              'flex items-center justify-between p-3 rounded-lg border transition-all',
                              !rule.isActive && 'opacity-50',
                              theme === 'dark'
                                ? 'bg-[#0B0D10] border-[#1F2937]'
                                : 'bg-gray-50 border-gray-200'
                            )}
                          >
                            <div className="flex items-center space-x-3 flex-1">
                              <button
                                onClick={() => toggleRuleActive(rule.id)}
                                className={clsx(
                                  'p-1 rounded',
                                  rule.isActive ? 'text-[#3BF68A]' : 'text-[#8B94A7]'
                                )}
                                title={rule.isActive ? 'Disable rule' : 'Enable rule'}
                              >
                                {rule.isActive ? (
                                  <CheckCircle2 className="h-5 w-5" />
                                ) : (
                                  <Circle className="h-5 w-5" />
                                )}
                              </button>
                              <span className={clsx(
                                'text-sm flex-1',
                                theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
                              )}>
                                {rule.text}
                              </span>
                            </div>
                            
                            {/* Compliance buttons for today */}
                            {rule.isActive && (
                              <div className="flex items-center space-x-2">
                                {stats && stats.totalDays > 0 && (
                                  <span className={clsx(
                                    'text-xs px-2 py-1 rounded',
                                    stats.percentage >= 80 
                                      ? 'bg-[#3BF68A]/20 text-[#3BF68A]' 
                                      : stats.percentage >= 50 
                                        ? 'bg-[#FBBF24]/20 text-[#FBBF24]'
                                        : 'bg-[#F45B69]/20 text-[#F45B69]'
                                  )}>
                                    {stats.percentage}%
                                  </span>
                                )}
                                <button
                                  onClick={() => updateRuleCompliance(selectedDate, rule.id, true)}
                                  className={clsx(
                                    'p-1.5 rounded-lg transition-all',
                                    compliance === true
                                      ? 'bg-[#3BF68A] text-black'
                                      : theme === 'dark'
                                        ? 'bg-[#1F2937] text-[#8B94A7] hover:text-[#3BF68A]'
                                        : 'bg-gray-200 text-gray-500 hover:text-green-600'
                                  )}
                                  title="Followed this rule"
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => updateRuleCompliance(selectedDate, rule.id, false)}
                                  className={clsx(
                                    'p-1.5 rounded-lg transition-all',
                                    compliance === false
                                      ? 'bg-[#F45B69] text-white'
                                      : theme === 'dark'
                                        ? 'bg-[#1F2937] text-[#8B94A7] hover:text-[#F45B69]'
                                        : 'bg-gray-200 text-gray-500 hover:text-red-600'
                                  )}
                                  title="Broke this rule"
                                >
                                  <ThumbsDown className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => removeTradingRule(rule.id)}
                                  className="p-1.5 rounded-lg text-[#8B94A7] hover:text-[#F45B69] hover:bg-[#F45B69]/10 transition-all"
                                  title="Delete rule"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
        )}
      </div>

      {/* Post-Trade Reflection Section */}
      <div className={clsx(
        'rounded-xl border p-6 mt-6',
        theme === 'dark' 
          ? 'bg-[#15181F] border-[#1F2937]' 
          : 'bg-white border-gray-200'
      )}>
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 rounded-lg bg-[#60A5FA]/10">
            <BookOpen className="h-5 w-5 text-[#60A5FA]" />
          </div>
          <div>
            <h2 className={clsx(
              'text-lg font-semibold',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
            )}>
              End of Day Reflection
            </h2>
            <p className={clsx(
              'text-sm',
              theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
            )}>
              Review your trading day and learn from it
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Did you follow your plan? */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
            )}>
              Did you follow your trading plan?
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => updateGamePlan(selectedDate, { followedPlan: true })}
                className={clsx(
                  'flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border transition-all',
                  gamePlan.followedPlan === true
                    ? 'bg-[#3BF68A]/20 border-[#3BF68A] text-[#3BF68A]'
                    : theme === 'dark'
                      ? 'bg-[#0B0D10] border-[#1F2937] text-[#8B94A7] hover:border-[#3BF68A]/50'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-green-300'
                )}
              >
                <ThumbsUp className="h-4 w-4" />
                <span className="text-sm font-medium">Yes</span>
              </button>
              <button
                onClick={() => updateGamePlan(selectedDate, { followedPlan: false })}
                className={clsx(
                  'flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border transition-all',
                  gamePlan.followedPlan === false
                    ? 'bg-[#F45B69]/20 border-[#F45B69] text-[#F45B69]'
                    : theme === 'dark'
                      ? 'bg-[#0B0D10] border-[#1F2937] text-[#8B94A7] hover:border-[#F45B69]/50'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-red-300'
                )}
              >
                <ThumbsDown className="h-4 w-4" />
                <span className="text-sm font-medium">No</span>
              </button>
            </div>
          </div>

          {/* Emotional State */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
            )}>
              How did you feel while trading?
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'calm', label: 'Calm', color: '#3BF68A' },
                { value: 'confident', label: 'Confident', color: '#60A5FA' },
                { value: 'neutral', label: 'Neutral', color: '#8B94A7' },
                { value: 'anxious', label: 'Anxious', color: '#FBBF24' },
                { value: 'frustrated', label: 'Frustrated', color: '#F45B69' },
              ].map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() => updateGamePlan(selectedDate, { 
                    emotionalState: gamePlan.emotionalState === value ? null : value as any 
                  })}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    gamePlan.emotionalState === value
                      ? 'ring-2 ring-offset-1'
                      : 'opacity-60 hover:opacity-100',
                    theme === 'dark' ? 'ring-offset-[#15181F]' : 'ring-offset-white'
                  )}
                  style={{
                    backgroundColor: `${color}20`,
                    color: color,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lessons Learned */}
        <div className="mt-6">
          <label className={clsx(
            'block text-sm font-medium mb-2',
            theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
          )}>
            What did you learn today?
          </label>
          <textarea
            value={gamePlan.lessonsLearned || ''}
            onChange={(e) => updateGamePlan(selectedDate, { lessonsLearned: e.target.value })}
            placeholder="Write your key takeaways, mistakes to avoid, patterns you noticed..."
            rows={3}
            className={clsx(
              'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#60A5FA]/50 resize-none',
              theme === 'dark'
                ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                : 'bg-gray-50 border-gray-300 text-gray-900'
            )}
          />
        </div>

        {/* Rule Compliance Summary */}
        {gamePlan.ruleCompliance && gamePlan.ruleCompliance.length > 0 && (
          <div className={clsx(
            'mt-6 p-4 rounded-lg',
            theme === 'dark' ? 'bg-[#0B0D10]' : 'bg-gray-50'
          )}>
            <p className={clsx(
              'text-sm font-medium mb-3',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
            )}>
              Today's Rule Compliance
            </p>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#3BF68A]" />
                <span className={clsx('text-sm', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-600')}>
                  Followed: {gamePlan.ruleCompliance.filter(c => c.followed === true).length}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#F45B69]" />
                <span className={clsx('text-sm', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-600')}>
                  Broken: {gamePlan.ruleCompliance.filter(c => c.followed === false).length}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#8B94A7]" />
                <span className={clsx('text-sm', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-600')}>
                  Not rated: {activeRules.length - gamePlan.ruleCompliance.filter(c => c.followed !== null).length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
