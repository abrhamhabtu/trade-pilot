'use client';

import React, { useEffect } from 'react';
import clsx from 'clsx';
import { Sidebar } from '@/components/Sidebar';
import { useThemeStore } from '@/store/themeStore';
import { useUIStore } from '@/store/uiStore';
import dynamic from 'next/dynamic';
import { PilotAutomation } from '@/components/pilot/PilotAutomation';
import { SignalListener } from '@/components/pilot/flow/SignalListener';
import { ProvingRunner } from '@/components/proving/ProvingRunner';
import { LiquidationClock } from '@/components/risk/LiquidationClock';
import { AutoSync } from '@/components/accounts/AutoSync';
import { useCompactSidebar } from '@/hooks/useCompactSidebar';
import { persistence } from '@/lib/persistence';

const Agentation = process.env.NODE_ENV !== 'production'
  ? dynamic(() => import('agentation').then(m => ({ default: m.Agentation })), { ssr: false })
  : null;

export default function RootShell({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();
  const sidebarCollapsed = useCompactSidebar();
  useEffect(() => {
    useThemeStore.getState().setTheme(persistence.loadTheme() === 'light' ? 'light' : 'dark');
  }, []);

  return (
    <div
      className={clsx(
        'tp-backdrop h-screen overflow-hidden transition-colors duration-300',
        theme === 'dark' ? 'dark' : ''
      )}
      style={theme === 'dark' ? { color: '#F2F4F8' } : { background: '#F2F2F7', color: '#11141A' }}
    >
      <Sidebar />
      <AutoSync />
      <PilotAutomation />
      <SignalListener />
      <ProvingRunner />
      <main className={clsx('h-full overflow-auto transition-[margin] duration-500 ease-spring', sidebarCollapsed ? 'ml-20' : 'ml-64')}>
        {children}
      </main>
      <LiquidationClock />
      {Agentation && <Agentation />}
    </div>
  );
}
