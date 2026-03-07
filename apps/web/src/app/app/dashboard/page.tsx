'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app/AppShell';
import { Dashboard } from '@/components/dashboard';
import { APP_ROUTES } from '@/lib/navigation';
import { useAppPageData } from '@/hooks/useAppPageData';

export default function DashboardPage() {
  const router = useRouter();
  const data = useAppPageData();

  return (
    <AppShell
      showImportModal={data.showImportModal}
      importTargetAccountId={data.importTargetAccountId}
      onImportClose={() => {
        data.setShowImportModal(false);
        data.setImportTargetAccountId(null);
      }}
      onImportComplete={data.handleImportComplete}
    >
      <Dashboard
        trades={data.displayTrades}
        allTrades={data.allAccountTrades}
        metrics={data.metrics}
        selectedTimePeriod={data.selectedTimePeriod}
        onTimePeriodChange={data.setTimePeriod}
        isLoading={data.isLoading}
        onRefresh={data.refreshData}
        onImport={data.openImportForSelection}
        onNavigateToRoutine={() => router.push(APP_ROUTES.routine)}
        accountId={data.selectedAccountId || undefined}
        accountBalance={data.selectedAccountBalance}
      />
    </AppShell>
  );
}
