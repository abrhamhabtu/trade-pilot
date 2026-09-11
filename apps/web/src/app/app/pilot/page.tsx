'use client';

import { AppShell } from '@/components/app/AppShell';
import { PilotPage } from '@/components/pilot';
import { PageSection } from '@/components/ui';

export default function PilotRoute() {
  return (
    <AppShell>
      <PageSection>
        <PilotPage />
      </PageSection>
    </AppShell>
  );
}
