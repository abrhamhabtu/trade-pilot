'use client';

import React from 'react';
import clsx from 'clsx';
import { Sidebar } from '@/components/Sidebar';
import { useThemeStore } from '@/store/themeStore';
import dynamic from 'next/dynamic';

const Agentation = process.env.NODE_ENV !== 'production'
  ? dynamic(() => import('agentation').then(m => ({ default: m.Agentation })), { ssr: false })
  : null;

export default function RootShell({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

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
      <main className="h-full overflow-auto transition-all duration-300 ml-64">
        {children}
      </main>
      {Agentation && <Agentation />}
    </div>
  );
}
