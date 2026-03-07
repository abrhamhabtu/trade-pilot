'use client';

import { AppShell } from '@/components/app/AppShell';
import { TradeLog } from '@/components/TradeLog';
import { useAppPageData } from '@/hooks/useAppPageData';
import { PageSection } from '@/components/ui';

export default function TradesPage() {
  const data = useAppPageData();

  return (
    <AppShell>
      <PageSection>
        <TradeLog trades={data.displayTrades} />
      </PageSection>
    </AppShell>
  );
}
