'use client';

import { AppShell } from '@/components/app/AppShell';
import { ProvingPage } from '@/components/proving/ProvingPage';
import { PageSection } from '@/components/ui';

export default function ProvingRoute() {
  return (
    <AppShell>
      <PageSection>
        <ProvingPage />
      </PageSection>
    </AppShell>
  );
}
