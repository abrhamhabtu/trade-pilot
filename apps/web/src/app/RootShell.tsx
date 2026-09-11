'use client';

import React, { useEffect } from 'react';
import clsx from 'clsx';
import { Sidebar } from '@/components/Sidebar';
import { useThemeStore } from '@/store/themeStore';
import { useUIStore } from '@/store/uiStore';
import dynamic from 'next/dynamic';
import { PilotAutomation } from '@/components/pilot/PilotAutomation';
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
        'h-screen overflow-hidden transition-colors duration-300',
        theme === 'dark' ? 'dark' : ''
      )}
      style={{
        background: theme === 'dark'
          ? 'radial-gradient(ellipse 140% 65% at 50% -5%, rgba(20,60,140,0.22) 0%, transparent 65%), #0D1628'
          : 'radial-gradient(ellipse 140% 65% at 50% -5%, rgba(100,160,255,0.08) 0%, transparent 65%), #F0F4FC',
        color: theme === 'dark' ? '#E0EAF8' : '#1A2A42',
      }}
    >
      <Sidebar />
      <AutoSync />
      <PilotAutomation />
      <main className={clsx('h-full overflow-auto transition-all duration-300', sidebarCollapsed ? 'ml-20' : 'ml-64')}>
        {children}
      </main>
      {Agentation && <Agentation />}
    </div>
  );
}
