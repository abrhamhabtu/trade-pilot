'use client';

import { AppShell } from '@/components/app/AppShell';
import { PreflightPage } from '@/components/routine';

export default function RoutineAppPage() {
  return (
    <AppShell>
      <PreflightPage />
    </AppShell>
  );
}
