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
      className={clsx('min-h-screen transition-colors duration-300', theme === 'dark' ? 'text-slate-100' : 'text-slate-900')}
      style={{
        background:
          theme === 'dark'
            ? 'linear-gradient(135deg, #0B0D10 0%, #0F1419 50%, #0B0D10 100%)'
            : 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 50%, #F8FAFC 100%)'
      }}
    >
      <Sidebar />
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        {children}
      </main>
    </div>
  );
}
