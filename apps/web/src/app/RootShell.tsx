'use client';

import React from 'react';
import clsx from 'clsx';
import { Sidebar } from '@/components/Sidebar';
import { useTradingStore } from '@/store/tradingStore';
import { useThemeStore } from '@/store/themeStore';

export default function RootShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useTradingStore();
  const { theme } = useThemeStore();

  return (
    <div
      className={clsx('min-h-screen transition-colors duration-300', theme === 'dark' ? 'dark text-slate-100' : 'text-slate-900')}
      style={{
        background:
          theme === 'dark'
            ? '#181B24'
            : '#F8FAFC'
      }}
    >
      <Sidebar />
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        {children}
      </main>
    </div>
  );
}
