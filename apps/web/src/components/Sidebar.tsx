'use client';

import React from 'react';
import { Activity, Sun, Search } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAVIGATION, isActiveRoute } from '@/lib/navigation';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const sidebarCollapsed = false;

  return (
    <div
      className={clsx(
        'fixed left-0 top-0 h-full border-r border-white/[0.06] transition-all duration-300 z-50 flex flex-col',
        sidebarCollapsed ? 'w-20' : 'w-64'
      )}
      style={{
        background: 'linear-gradient(180deg, #13223A 0%, #111F35 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div className={clsx(
        'flex items-center border-b border-white/[0.06] transition-all duration-300 flex-shrink-0',
        sidebarCollapsed ? 'justify-center p-4' : 'justify-between p-4'
      )}>
        {!sidebarCollapsed && (
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-tp-green/10 border border-tp-green/20 flex items-center justify-center">
              <Activity className="h-4 w-4 text-tp-green" />
            </div>
            <span className="text-white font-semibold text-base tracking-tight">
              TradePilot
            </span>
          </div>
        )}

        {sidebarCollapsed && (
          <div className="w-8 h-8 rounded-lg bg-tp-green/10 border border-tp-green/20 flex items-center justify-center">
            <Activity className="h-5 w-5 text-tp-green" />
          </div>
        )}

        <div className="h-7 w-7" />
      </div>

      {/* Search */}
      {!sidebarCollapsed && (
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2 text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-tp-blue/40 focus:bg-white/[0.06] transition-all"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={clsx(
        'flex-1 transition-all duration-300 overflow-y-auto',
        sidebarCollapsed ? 'px-2 py-4 space-y-2' : 'px-3 py-3 space-y-0.5'
      )}>
        {APP_NAVIGATION.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveRoute(pathname, item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'w-full flex items-center text-sm font-medium rounded-lg transition-all duration-200 group relative',
                sidebarCollapsed ? 'justify-center p-3.5 mb-2' : 'px-3 py-2.5',
                isActive
                  ? 'text-white'
                  : 'text-white/35 hover:text-white/75 hover:bg-white/[0.04]'
              )}
              style={isActive ? {
                background: 'linear-gradient(135deg, rgba(0,214,143,0.12) 0%, rgba(79,156,249,0.08) 100%)',
                borderLeft: sidebarCollapsed ? 'none' : '2px solid',
                borderImage: sidebarCollapsed ? 'none' : 'linear-gradient(to bottom, #00D68F, #4F9CF9) 1',
                boxShadow: sidebarCollapsed ? '0 0 0 1.5px rgba(0,214,143,0.25)' : 'none',
              } : {}}
            >
              <Icon className={clsx(
                sidebarCollapsed ? 'h-6 w-6' : 'h-4 w-4',
                sidebarCollapsed ? 'mx-auto' : 'mr-3',
                isActive ? 'text-tp-green' : ''
              )} />
              {!sidebarCollapsed && (
                <span className="truncate">{item.name}</span>
              )}

              {sidebarCollapsed && (
                <div className="absolute left-full ml-3 px-3 py-2 bg-tp-raised text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 border border-white/[0.08] shadow-xl">
                  {item.name}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-tp-raised" />
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={clsx(
        'border-t border-white/[0.06] transition-all duration-300 flex-shrink-0',
        sidebarCollapsed ? 'p-3' : 'p-4'
      )}>
        {/* Light Mode - Coming Soon */}
        <div
          className={clsx(
            'w-full flex items-center justify-center mb-3 rounded-lg relative group cursor-not-allowed',
            sidebarCollapsed ? 'p-3' : 'px-3 py-2',
            'text-white/20 opacity-50'
          )}
        >
          <Sun className={clsx(sidebarCollapsed ? 'h-5 w-5' : 'h-4 w-4')} />
          {!sidebarCollapsed && (
            <span className="ml-3 text-sm flex items-center gap-2">
              Light Mode
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30 tracking-widest">SOON</span>
            </span>
          )}

          {sidebarCollapsed && (
            <div className="absolute left-full ml-3 px-3 py-2 bg-tp-raised text-white/70 text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 border border-white/[0.08] shadow-xl">
              Light Mode <span className="text-[9px] font-bold text-white/30 ml-1">SOON</span>
            </div>
          )}
        </div>

        {/* Version */}
        {!sidebarCollapsed ? (
          <div className="text-xs text-white/20 text-center tracking-wide">
            TradePilot <span className="text-white/40 font-medium">v1.0</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-tp-green/40" />
          </div>
        )}
      </div>
    </div>
  );
};
