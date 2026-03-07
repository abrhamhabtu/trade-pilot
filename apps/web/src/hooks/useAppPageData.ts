'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccountStore } from '@/store/accountStore';
import { Trade, useTradingStore } from '@/store/tradingStore';
import { useDailyNotesStore } from '@/store/dailyNotesStore';
import { useChartData } from '@/hooks/useChartData';
import { calculateTradeSummaryMetrics, filterTradesByPeriod } from '@/lib/domain/trading';

export function useAppPageData() {
  const {
    refreshData,
    isLoading,
    selectedTimePeriod,
    setTimePeriod,
  } = useTradingStore();
  const {
    accounts,
    selectedAccountId,
    showAllAccounts,
    initializeFromIDB,
    addTradesToAccount,
  } = useAccountStore();
  const { hydrate } = useDailyNotesStore();

  const [showImportModal, setShowImportModal] = useState(false);
  const [importTargetAccountId, setImportTargetAccountId] = useState<string | null>(null);

  useEffect(() => {
    initializeFromIDB();
    hydrate();
  }, [hydrate, initializeFromIDB]);

  const allAccountTrades = useMemo(() => {
    if (showAllAccounts) {
      return accounts.flatMap((account) => account.trades);
    }

    return accounts.find((account) => account.id === selectedAccountId)?.trades || [];
  }, [accounts, selectedAccountId, showAllAccounts]);

  const displayTrades = useMemo(
    () => filterTradesByPeriod(allAccountTrades, selectedTimePeriod),
    [allAccountTrades, selectedTimePeriod]
  );

  const metrics = useMemo(
    () => calculateTradeSummaryMetrics(displayTrades),
    [displayTrades]
  );

  const selectedAccountBalance = useMemo(() => {
    if (showAllAccounts) {
      return accounts.reduce((sum, account) => sum + account.balance, 0);
    }

    return accounts.find((account) => account.id === selectedAccountId)?.balance ?? 0;
  }, [accounts, selectedAccountId, showAllAccounts]);

  const { calendarData } = useChartData(displayTrades, metrics);

  const openImportForAccount = (accountId: string) => {
    setImportTargetAccountId(accountId);
    setShowImportModal(true);
  };

  const openImportForSelection = () => {
    setImportTargetAccountId(selectedAccountId);
    setShowImportModal(true);
  };

  const handleImportComplete = (trades: Trade[]) => {
    const targetId = importTargetAccountId || selectedAccountId;
    if (targetId && trades.length > 0) {
      addTradesToAccount(targetId, trades);
    }
  };

  return {
    accounts,
    selectedAccountId,
    selectedAccountBalance,
    allAccountTrades,
    displayTrades,
    metrics,
    calendarData,
    isLoading,
    selectedTimePeriod,
    setTimePeriod,
    refreshData,
    showImportModal,
    importTargetAccountId,
    setShowImportModal,
    setImportTargetAccountId,
    openImportForAccount,
    openImportForSelection,
    handleImportComplete,
  };
}
