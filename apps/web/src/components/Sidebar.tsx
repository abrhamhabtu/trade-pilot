'use client';

import React from 'react';
import { Activity, ChevronsLeft, ChevronsRight, Sun, Search } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAVIGATION, isActiveRoute } from '@/lib/navigation';
import { useUIStore } from '@/store/uiStore';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <div
      className={clsx(
        'fixed left-0 top-0 z-50 flex h-full flex-col border-r border-white/[0.06] transition-all duration-300',
        sidebarCollapsed ? 'w-20' : 'w-64'
      )}
      style={{
        background: 'linear-gradient(180deg, #13223A 0%, #111F35 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div
        className={clsx(
          'flex flex-shrink-0 items-center border-b border-white/[0.06] p-4 transition-all duration-300',
          sidebarCollapsed ? 'justify-center' : 'justify-between'
        )}
      >
        <div className="flex items-center space-x-2.5">
          <div
            className={clsx(
              'flex items-center justify-center rounded-lg border border-tp-green/20 bg-tp-green/10',
              sidebarCollapsed ? 'h-8 w-8' : 'h-7 w-7'
            )}
          >
            <Activity className={clsx('text-tp-green', sidebarCollapsed ? 'h-5 w-5' : 'h-4 w-4')} />
          </div>
          <span className={clsx('text-base font-semibold tracking-tight text-white', sidebarCollapsed && 'hidden')}>
            TradePilot
          </span>
        </div>

        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 transition-all hover:bg-white/[0.05] hover:text-white/80"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {sidebarCollapsed && (
        <div className="flex flex-shrink-0 justify-center border-b border-white/[0.06] px-2 py-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/35 transition-all hover:bg-white/[0.05] hover:text-white/80"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronsRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className={clsx('flex-shrink-0 px-4 pb-2 pt-4', sidebarCollapsed && 'hidden')}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            placeholder="Search"
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] py-2 pl-9 pr-4 text-sm text-white/70 placeholder-white/20 transition-all focus:border-tp-blue/40 focus:bg-white/[0.06] focus:outline-none"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav
        className={clsx(
          'flex-1 overflow-y-auto transition-all duration-300',
          sidebarCollapsed ? 'space-y-2 px-2 py-4' : 'space-y-0.5 px-3 py-3'
        )}
      >
        {APP_NAVIGATION.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveRoute(pathname, item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'w-full flex items-center text-sm font-medium rounded-lg transition-all duration-200 group relative',
                sidebarCollapsed ? 'justify-center p-3.5' : 'justify-start px-3 py-2.5',
                isActive
                  ? 'text-white'
                  : 'text-white/35 hover:text-white/75 hover:bg-white/[0.04]'
              )}
              style={isActive ? {
                background: 'linear-gradient(135deg, rgba(0,214,143,0.12) 0%, rgba(79,156,249,0.08) 100%)',
                boxShadow: '0 0 0 1.5px rgba(0,214,143,0.16)',
              } : {}}
            >
              <Icon className={clsx(
                sidebarCollapsed ? 'mx-auto h-6 w-6' : 'mr-3 h-4 w-4',
                isActive ? 'text-tp-green' : ''
              )} />
              <span className={clsx('truncate', sidebarCollapsed && 'hidden')}>{item.name}</span>

              {sidebarCollapsed && (
                <div className="absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg border border-white/[0.08] bg-tp-raised px-3 py-2 text-sm text-white opacity-0 shadow-xl transition-all duration-200 group-hover:opacity-100">
                  {item.name}
                  <div className="absolute right-full top-1/2 h-0 w-0 -translate-y-1/2 border-b-4 border-r-4 border-t-4 border-transparent border-r-tp-raised" />
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={clsx('flex-shrink-0 border-t border-white/[0.06] transition-all duration-300', sidebarCollapsed ? 'p-3' : 'p-4')}>
        {/* Light Mode - Coming Soon */}
        <div
          className={clsx(
            'group relative mb-3 flex w-full cursor-not-allowed items-center justify-center rounded-lg text-white/20 opacity-50',
            sidebarCollapsed ? 'p-3' : 'px-3 py-2'
          )}
        >
          <Sun className={clsx(sidebarCollapsed ? 'h-5 w-5' : 'h-4 w-4')} />
          <span className={clsx('ml-3 items-center gap-2 text-sm', sidebarCollapsed ? 'hidden' : 'flex')}>
            Light Mode
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-white/30">SOON</span>
          </span>

          {sidebarCollapsed && (
            <div className="absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg border border-white/[0.08] bg-tp-raised px-3 py-2 text-sm text-white/70 opacity-0 shadow-xl transition-all duration-200 group-hover:opacity-100">
              Light Mode <span className="ml-1 text-[9px] font-bold text-white/30">SOON</span>
            </div>
          )}
        </div>

        {/* Version */}
        <div className={clsx('text-center text-xs tracking-wide text-white/20', sidebarCollapsed && 'hidden')}>
          TradePilot <span className="font-medium text-white/40">v1.0</span>
        </div>
        {sidebarCollapsed && (
          <div className="flex justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-tp-green/40" />
          </div>
        )}
      </div>
    </div>
  );
};
