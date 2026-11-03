'use client';

import { AppShell } from '@/components/app/AppShell';
import { VisionPage } from '@/components/vision/VisionPage';

export default function VisionRoute() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
        <VisionPage />
      </div>
    </AppShell>
  );
}
