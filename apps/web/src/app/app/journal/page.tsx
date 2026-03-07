'use client';

import { AppShell } from '@/components/app/AppShell';
import { Journal } from '@/components/journal';
import { PageSection } from '@/components/ui';

export default function JournalPage() {
  return (
    <AppShell>
      <PageSection>
        <Journal />
      </PageSection>
    </AppShell>
  );
}
