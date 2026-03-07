'use client';

import { AppShell } from '@/components/app/AppShell';
import { AccountsPage } from '@/components/accounts';
import { useAppPageData } from '@/hooks/useAppPageData';

export default function AccountsPageRoute() {
  const data = useAppPageData();

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
      <AccountsPage onImportForAccount={data.openImportForAccount} />
    </AppShell>
  );
}
