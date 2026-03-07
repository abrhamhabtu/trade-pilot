'use client';

import { AppShell } from '@/components/app/AppShell';
import { Playbooks } from '@/components/Playbooks';
import { PageSection } from '@/components/ui';

export default function PlaybooksPage() {
  return (
    <AppShell>
      <PageSection>
        <Playbooks />
      </PageSection>
    </AppShell>
  );
}
