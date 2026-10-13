'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Activity, ChevronsLeft, ChevronsRight, Search, Settings } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAVIGATION, APP_ROUTES, isActiveRoute } from '@/lib/navigation';
import { useUIStore } from '@/store/uiStore';
import { useCompactSidebar } from '@/hooks/useCompactSidebar';
import { JournalSwitcher } from '@/components/JournalSwitcher';

// The rail is a floating panel, inset from the window edge. Pages are grouped by
// what you are doing, and one solid pill slides to wherever you are.
const GROUPS: { label: string; hrefs: string[] }[] = [
  { label: 'Trade', hrefs: [APP_ROUTES.dashboard, APP_ROUTES.pilot, APP_ROUTES.calendar, APP_ROUTES.trades, APP_ROUTES.journal] },
  { label: 'Prepare', hrefs: [APP_ROUTES.playbooks, APP_ROUTES.setups, APP_ROUTES.routine, APP_ROUTES.journey, APP_ROUTES.proving] },
  { label: 'Accounts', hrefs: [APP_ROUTES.accounts, APP_ROUTES.payout, APP_ROUTES.propfirms] },
];
const BY_HREF = new Map<string, (typeof APP_NAVIGATION)[number]>(APP_NAVIGATION.map((item) => [item.href, item]));

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { toggleSidebar } = useUIStore();
  const sidebarCollapsed = useCompactSidebar();
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const onSettings = isActiveRoute(pathname, APP_ROUTES.settings);

  // Measure the active link so the pill can travel to it.
  useIsoLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const link = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!link) return setPill(null);
      const n = nav.getBoundingClientRect();
      const l = link.getBoundingClientRect();
      setPill({ top: l.top - n.top + nav.scrollTop, left: l.left - n.left, width: l.width, height: l.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    // The rail animates its width; measure again once it has settled.
    const settled = setTimeout(measure, 560);
    return () => {
      ro.disconnect();
      clearTimeout(settled);
    };
  }, [pathname, sidebarCollapsed]);
  // No slide on first paint: the pill should simply be there.
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className={clsx(
        'fixed left-0 top-0 z-50 h-full p-3 pr-0 transition-[width] duration-500 ease-spring',
        sidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-white/[0.09] bg-tp-panel shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.05)]">
        {/* Header */}
        <div className={clsx('flex flex-shrink-0 items-center px-4 pb-1 pt-5', sidebarCollapsed ? 'justify-center px-0' : 'justify-between')}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-tp-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_12px_-4px_rgb(var(--tp-accent)/0.6)]">
              <Activity strokeWidth={2.6} className="h-[18px] w-[18px] text-tp-ink" />
            </div>
            <span className={clsx('text-[19px] font-bold tracking-[-0.03em] text-white', sidebarCollapsed && 'hidden')}>TradePilot</span>
          </div>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="tp-press flex h-8 w-8 items-center justify-center rounded-full text-white/35 hover:bg-white/[0.08] hover:text-white/80"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <div className="flex flex-shrink-0 justify-center pt-2">
            <button
              type="button"
              onClick={toggleSidebar}
              className="tp-press flex h-9 w-9 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.08] hover:text-white/80"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <JournalSwitcher collapsed={sidebarCollapsed} />

        {/* Search */}
        <div className={clsx('flex-shrink-0 px-3 pt-2.5', sidebarCollapsed && 'hidden')}>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search"
              className="w-full rounded-full bg-tp-fill py-2 pl-9 pr-4 text-[15px] text-white/90 placeholder-white/35 transition-all focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-tp-blue/50"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav
          ref={navRef}
          aria-label="Main"
          className={clsx('tp-no-scrollbar relative flex-1 overflow-y-auto pb-3', sidebarCollapsed ? 'px-2 pt-3' : 'px-3 pt-5')}
        >
          {pill && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 rounded-full bg-tp-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
              style={{
                width: pill.width,
                height: pill.height,
                transform: `translate(${pill.left}px, ${pill.top}px)`,
                transition: animate ? 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), width 0.5s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
              }}
            />
          )}

          {/* The pill sits outside this stack so it never nudges the spacing it is measured against. */}
          <div className={sidebarCollapsed ? 'space-y-3' : 'space-y-5'}>
          {GROUPS.map((group, gi) => (
            <div key={group.label}>
              {sidebarCollapsed ? (
                gi > 0 && <div className="mx-auto mb-3 h-px w-6 bg-white/[0.1]" aria-hidden />
              ) : (
                <div className="mb-1.5 px-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/35">{group.label}</div>
              )}
              <ul className="space-y-0.5">
                {group.hrefs.map((href) => {
                  const item = BY_HREF.get(href);
                  if (!item) return null;
                  const Icon = item.icon;
                  const isActive = isActiveRoute(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={item.name}
                        className={clsx(
                          'tp-press group relative flex h-10 items-center rounded-full text-[15px] font-semibold tracking-tight',
                          sidebarCollapsed ? 'mx-auto w-10 justify-center' : 'gap-3 px-3.5',
                          isActive ? 'text-tp-ink' : 'text-white/75 hover:bg-white/[0.07] hover:text-white'
                        )}
                      >
                        <Icon
                          strokeWidth={isActive ? 2.4 : 1.9}
                          className={clsx('h-[18px] w-[18px] shrink-0', !isActive && 'text-white/40 group-hover:text-white/70')}
                        />
                        <span className={clsx('truncate', sidebarCollapsed && 'hidden')}>{item.name}</span>

                        {sidebarCollapsed && (
                          <span className="pointer-events-none absolute left-full z-50 ml-4 whitespace-nowrap rounded-full bg-tp-raised px-3 py-1.5 text-[13px] font-semibold text-white opacity-0 shadow-sheet transition-opacity duration-200 group-hover:opacity-100">
                            {item.name}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          </div>
        </nav>

        {/* Footer */}
        <div className={clsx('flex-shrink-0', sidebarCollapsed ? 'p-2 pb-3' : 'p-3')}>
          <Link
            href={APP_ROUTES.settings}
            aria-current={onSettings ? 'page' : undefined}
            aria-label="Settings"
            title={sidebarCollapsed ? 'Settings' : undefined}
            className={clsx(
              'tp-press group flex h-10 items-center rounded-full text-[15px] font-semibold tracking-tight',
              sidebarCollapsed ? 'mx-auto w-10 justify-center' : 'gap-3 px-3.5',
              onSettings ? 'bg-tp-accent text-tp-ink' : 'bg-white/[0.06] text-white/75 hover:bg-white/[0.1] hover:text-white'
            )}
          >
            <Settings strokeWidth={onSettings ? 2.4 : 1.9} className={clsx('h-[18px] w-[18px] shrink-0', !onSettings && 'text-white/40 group-hover:text-white/70')} />
            <span className={clsx('flex-1 truncate', sidebarCollapsed && 'hidden')}>Settings</span>
            <span className={clsx('text-[11px] font-medium', onSettings ? 'text-tp-ink/60' : 'text-white/30', sidebarCollapsed && 'hidden')}>v1.0</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
