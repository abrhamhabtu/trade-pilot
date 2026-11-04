'use client';

import { AppShell } from '@/components/app/AppShell';
import { CalendarPage as CalendarView } from '@/components/calendar/CalendarPage';
import { useAppPageData } from '@/hooks/useAppPageData';
import { PageSection } from '@/components/ui';

export default function CalendarPage() {
  const data = useAppPageData();

  return (
    <AppShell>
      <PageSection>
        <CalendarView trades={data.displayTrades} accountId={data.selectedAccountId || undefined} />
      </PageSection>
    </AppShell>
  );
}
