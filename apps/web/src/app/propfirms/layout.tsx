'use client';

import RootShell from '@/app/RootShell';
import { AppShell } from '@/components/app/AppShell';

// Prop Firms lives in the sidebar, so it keeps the app frame like every other page.
export default function PropFirmsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RootShell>
      <AppShell showAccountSelector={false}>{children}</AppShell>
    </RootShell>
  );
}
