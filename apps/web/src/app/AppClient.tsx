'use client';

import { useState, useMemo, useEffect } from 'react';
import { Dashboard } from '@/components/dashboard';
import { TradeLog } from '@/components/TradeLog';
import { Playbooks } from '@/components/Playbooks';
import { Calendar } from '@/components/Calendar';
import { Journal } from '@/components/journal';
import { ImportModal } from '@/components/ImportModal';
import { AccountsPage, AccountSelector } from '@/components/accounts';
import { RoutinePage, JourneyPage } from '@/components/routine';
import { Backtest } from '@/components/Backtest';
import { ToastContainer } from '@/components/common/Toast';
import { useTradingStore, Trade, TimePeriod } from '@/store/tradingStore';
import { useAccountStore } from '@/store/accountStore';
import { useThemeStore } from '@/store/themeStore';
import { useToastStore } from '@/store/toastStore';
import { useDailyNotesStore } from '@/store/dailyNotesStore';
import { useChartData } from '@/hooks/useChartData';
import { shouldShowBackupReminder, dismissBackupReminder } from '@/hooks/useLocalStorage';
import { AlertTriangle, X } from 'lucide-react';

const filterTradesByPeriod = (trades: Trade[], period: TimePeriod): Trade[] => {
  if (period === 'ALL') {
    return trades;
  }

  const now = new Date();
  const cutoffDate = new Date();

  switch (period) {
    case '1D':
      cutoffDate.setDate(now.getDate() - 1);
      break;
    case '1W':
      cutoffDate.setDate(now.getDate() - 7);
      break;
    case '1M':
      cutoffDate.setMonth(now.getMonth() - 1);
      break;
    case '3M':
      cutoffDate.setMonth(now.getMonth() - 3);
      break;
    case '6M':
      cutoffDate.setMonth(now.getMonth() - 6);
      break;
    case '1Y':
      cutoffDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      return trades;
  }

  return trades.filter((trade) => {
    const tradeDate = new Date(trade.date);
    return tradeDate >= cutoffDate;
  });
};

const calculateMetrics = (trades: Trade[]) => {
  if (trades.length === 0) {
    return {
      netPL: 0,
      profitFactor: 0,
      winRate: 0,
      expectancy: 0,
      currentStreak: 0,
      totalTrades: 0,
      avgWin: 0,
      avgLoss: 0,
      maxDrawdown: 0,
      recoveryFactor: 0,
      consistency: 0,
      sharpeRatio: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      largestWin: 0,
      largestLoss: 0,
      avgRiskReward: 0
    };
  }

  const wins = trades.filter((t) => t.outcome === 'win');
  const losses = trades.filter((t) => t.outcome === 'loss');

  const totalWinAmount = wins.reduce((sum, t) => sum + t.netPL, 0);
  const totalLossAmount = Math.abs(losses.reduce((sum, t) => sum + t.netPL, 0));

  const netPL = trades.reduce((sum, t) => sum + t.netPL, 0);
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0;
  const winRate = (wins.length / trades.length) * 100;
  const expectancy = netPL / trades.length;

  const avgWin = wins.length > 0 ? totalWinAmount / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLossAmount / losses.length : 0;

  let currentStreak = 0;
  if (trades.length > 0) {
    const firstOutcome = trades[0].outcome;
    for (const trade of trades) {
      if (trade.outcome === firstOutcome) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  for (const trade of trades) {
    if (trade.outcome === 'win') {
      currentWinStreak++;
      currentLossStreak = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
    } else {
      currentLossStreak++;
      currentWinStreak = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
    }
  }

  const largestWin = Math.max(...trades.map((t) => t.netPL));
  const largestLoss = Math.min(...trades.map((t) => t.netPL));
  const avgRiskReward = avgLoss > 0 ? avgWin / avgLoss : 0;

  let maxDrawdown = 0;
  let peak = 0;
  let runningPL = 0;

  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const trade of sortedTrades) {
    runningPL += trade.netPL;
    if (runningPL > peak) {
      peak = runningPL;
    }
    const drawdown = peak > 0 ? ((peak - runningPL) / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  const dailyReturns = trades.map((t) => t.netPL);
  const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  const recoveryFactor = maxDrawdown > 0 ? netPL / ((maxDrawdown * peak) / 100) : 0;

  let consistencyScore = 0;
  const winRateScore = Math.min(winRate * 0.8, 40);
  const profitFactorScore = Math.min(profitFactor * 12.5, 25);
  const riskScore = Math.max(0, 20 - maxDrawdown * 0.8);
  const expectancyScore = expectancy > 0 ? Math.min(expectancy * 0.05, 15) : 0;

  consistencyScore = winRateScore + profitFactorScore + riskScore + expectancyScore;

  if (netPL > 0 && winRate > 50 && profitFactor > 1.0) {
    consistencyScore = Math.max(consistencyScore, 65);
  }

  return {
    netPL,
    profitFactor,
    winRate,
    expectancy,
    currentStreak,
    totalTrades: trades.length,
    avgWin,
    avgLoss,
    maxDrawdown,
    recoveryFactor,
    consistency: Math.min(95, consistencyScore),
    sharpeRatio,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    largestWin,
    largestLoss,
    avgRiskReward
  };
};

export default function AppClient() {
  const {
    sidebarCollapsed,
    refreshData,
    isLoading,
    currentView,
    selectedTimePeriod,
    setTimePeriod,
    setCurrentView
  } = useTradingStore();

  const { getAllTrades, addTradesToAccount, selectedAccountId, showAllAccounts, accounts, initializeFromIDB } =
    useAccountStore();
  const { hydrate: hydrateNotes } = useDailyNotesStore();

  const [showImportModal, setShowImportModal] = useState(false);
  const [importTargetAccountId, setImportTargetAccountId] = useState<string | null>(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);

  const { theme } = useThemeStore();

  // Hydrate accounts + notes from IndexedDB on first client render
  useEffect(() => {
    initializeFromIDB();
    hydrateNotes();
    if (shouldShowBackupReminder()) {
      setShowBackupReminder(true);
    }
  }, []);
  const { toasts, removeToast } = useToastStore();

  const allAccountTrades = useMemo(() => {
    return getAllTrades();
  }, [selectedAccountId, showAllAccounts, accounts, getAllTrades]);

  const displayTrades = useMemo(() => {
    return filterTradesByPeriod(allAccountTrades, selectedTimePeriod);
  }, [allAccountTrades, selectedTimePeriod]);

  const metrics = useMemo(() => {
    return calculateMetrics(displayTrades);
  }, [displayTrades]);

  const selectedAccountBalance = useMemo(() => {
    if (showAllAccounts) {
      return accounts.reduce((sum, a) => sum + a.balance, 0);
    }
    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    return selectedAccount?.balance ?? 0;
  }, [accounts, selectedAccountId, showAllAccounts]);

  const { calendarData } = useChartData(displayTrades, metrics);

  const handleImportForAccount = (accountId: string) => {
    setImportTargetAccountId(accountId);
    setShowImportModal(true);
  };

  const handleImportComplete = (trades: Trade[]) => {
    const targetId = importTargetAccountId || selectedAccountId;
    if (targetId && trades.length > 0) {
      addTradesToAccount(targetId, trades);
    }
  };

  const handleOpenImport = () => {
    setImportTargetAccountId(selectedAccountId);
    setShowImportModal(true);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'accounts':
        return <AccountsPage onImportForAccount={handleImportForAccount} />;
      case 'backtest':
        return <Backtest />;
      case 'routine':
        return <RoutinePage />;
      case 'journey':
        return <JourneyPage />;
      case 'trades':
        return (
          <div className="p-6">
            <TradeLog trades={displayTrades} />
          </div>
        );
      case 'playbooks':
        return (
          <div className="p-6">
            <Playbooks />
          </div>
        );
      case 'calendar':
        return (
          <div className="p-6">
            <Calendar data={calendarData} trades={displayTrades} accountId={selectedAccountId || undefined} />
          </div>
        );
      case 'journal':
        return (
          <div className="p-6">
            <Journal />
          </div>
        );
      default:
        return (
          <Dashboard
            trades={displayTrades}
            allTrades={allAccountTrades}
            metrics={metrics}
            selectedTimePeriod={selectedTimePeriod}
            onTimePeriodChange={setTimePeriod}
            isLoading={isLoading}
            onRefresh={refreshData}
            onImport={handleOpenImport}
            onNavigateToRoutine={() => setCurrentView('routine')}
            accountId={selectedAccountId || undefined}
            accountBalance={selectedAccountBalance}
          />
        );
    }
  };

  return (
    <div className="h-full">
      {showBackupReminder && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div
            className={`mx-auto max-w-4xl mt-3 mx-4 px-4 py-2.5 rounded-xl flex items-center justify-between backdrop-blur-md shadow-lg ${theme === 'dark'
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30'
              : 'bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-300'
              }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-200'}`}>
                <AlertTriangle className={`h-4 w-4 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
              </div>
              <span className={`text-sm ${theme === 'dark' ? 'text-amber-100' : 'text-amber-800'}`}>
                Backup reminder: <span className="font-medium">Accounts → Data Management</span>
              </span>
            </div>
            <button
              onClick={() => {
                dismissBackupReminder();
                setShowBackupReminder(false);
              }}
              className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'text-amber-300 hover:bg-amber-500/20' : 'text-amber-700 hover:bg-amber-200'
                }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {currentView !== 'accounts' && (
        <div
          className={`fixed top-0 right-0 z-40 p-4 transition-all duration-300 ${sidebarCollapsed ? 'left-20' : 'left-64'
            }`}
          style={{
            background:
              theme === 'dark'
                ? 'linear-gradient(180deg, rgba(24,27,36,0.97) 0%, rgba(24,27,36,0) 100%)'
                : 'linear-gradient(180deg, rgba(248,250,252,0.97) 0%, rgba(248,250,252,0) 100%)'
          }}
        >
          <div className="flex justify-end">
            <AccountSelector />
          </div>
        </div>
      )}

      <div className={`${currentView === 'backtest' ? 'h-full' : currentView !== 'accounts' ? 'pt-16' : ''}`}>{renderCurrentView()}</div>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportTargetAccountId(null);
        }}
        targetAccountId={importTargetAccountId}
        onImportComplete={handleImportComplete}
      />

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
