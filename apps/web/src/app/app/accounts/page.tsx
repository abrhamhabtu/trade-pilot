'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app/AppShell';
import { AccountsPage } from '@/components/accounts';
import { useAppPageData } from '@/hooks/useAppPageData';

function AccountsPageContent() {
  const data = useAppPageData();
  const searchParams = useSearchParams();
  const broker = searchParams.get('broker') ?? undefined;

  return (
    <AppShell
      showAccountSelector={false}
      showImportModal={data.showImportModal}
      importTargetAccountId={data.importTargetAccountId}
      onImportClose={() => {
        data.setShowImportModal(false);
        data.setImportTargetAccountId(null);
      }}
      onImportComplete={data.handleImportComplete}
    >
      <AccountsPage onImportForAccount={data.openImportForAccount} initialBroker={broker} />
    </AppShell>
  );
}

export default function AccountsPageRoute() {
  return (
    <Suspense>
      <AccountsPageContent />
    </Suspense>
  );
}
