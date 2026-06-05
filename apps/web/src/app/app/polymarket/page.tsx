'use client';

import { AppShell } from '@/components/app/AppShell';
import { PolymarketDashboard } from '@/components/polymarket';

export default function PolymarketPage() {
  return (
    <AppShell showAccountSelector={false}>
      <PolymarketDashboard />
    </AppShell>
  );
}
