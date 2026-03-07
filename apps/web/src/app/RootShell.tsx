'use client';

import React from 'react';
import clsx from 'clsx';
import { Sidebar } from '@/components/Sidebar';
import { useThemeStore } from '@/store/themeStore';
import dynamic from 'next/dynamic';

// Only load Agentation in development — zero impact on production bundle
const Agentation = process.env.NODE_ENV !== 'production'
  ? dynamic(() => import('agentation').then(m => ({ default: m.Agentation })), { ssr: false })
  : null;

export default function RootShell({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  return (
    <div
      className={clsx('h-screen overflow-hidden transition-colors duration-300', theme === 'dark' ? 'dark text-slate-100' : 'text-slate-900')}
      style={{
        background:
          theme === 'dark'
            ? '#181B24'
            : '#F8FAFC'
      }}
    >
      <Sidebar />
      <main className="h-full overflow-auto transition-all duration-300 ml-64">
        {children}
      </main>
      {Agentation && <Agentation />}
    </div>
  );
}
