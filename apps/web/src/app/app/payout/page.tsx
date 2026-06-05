'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app/AppShell';
import { PayoutPredictor } from '@/components/payout';

function PayoutPageContent() {
  const searchParams = useSearchParams();
  const firm = searchParams.get('firm') ?? undefined;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        <PayoutPredictor initialFirmId={firm} />
      </div>
    </AppShell>
  );
}

export default function PayoutPage() {
  return (
    <Suspense>
      <PayoutPageContent />
    </Suspense>
  );
}
