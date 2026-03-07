'use client';

import { AppShell } from '@/components/app/AppShell';
import { Backtest } from '@/components/Backtest';

export default function BacktestPage() {
  return (
    <AppShell fullHeight>
      <Backtest />
    </AppShell>
  );
}
