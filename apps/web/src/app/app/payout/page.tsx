'use client';

import { AppShell } from '@/components/app/AppShell';
import { PayoutPredictor } from '@/components/payout';

export default function PayoutPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PayoutPredictor />
      </div>
    </AppShell>
  );
}
