'use client';

import { AppShell } from '@/components/app/AppShell';
import { Calendar } from '@/components/Calendar';
import { useAppPageData } from '@/hooks/useAppPageData';
import { PageSection } from '@/components/ui';

export default function CalendarPage() {
  const data = useAppPageData();

  return (
    <AppShell>
      <PageSection>
        <Calendar
          data={data.calendarData}
          trades={data.displayTrades}
          accountId={data.selectedAccountId || undefined}
        />
      </PageSection>
    </AppShell>
  );
}
