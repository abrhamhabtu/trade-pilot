'use client';

import { AppShell } from '@/components/app/AppShell';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { PageSection } from '@/components/ui';

export default function SettingsRoute() {
  return (
    <AppShell showAccountSelector={false}>
      <PageSection>
        <SettingsPage />
      </PageSection>
    </AppShell>
  );
}
