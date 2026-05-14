import {
  BarChart3,
  Calendar,
  TrendingUp,
  BookOpen,
  ClipboardCheck,
  Compass,
  Target,
  Users,
  Crosshair,
} from 'lucide-react';

export const APP_ROUTES = {
  dashboard: '/app/dashboard',
  accounts: '/app/accounts',
  journey: '/app/journey',
  routine: '/app/routine',
  setups: '/app/setups',
  calendar: '/app/calendar',
  trades: '/app/trades',
  playbooks: '/app/playbooks',
  journal: '/app/journal',
} as const;

export type AppRouteKey = keyof typeof APP_ROUTES;

export const APP_NAVIGATION = [
  { name: 'Dashboard', icon: BarChart3, href: APP_ROUTES.dashboard },
  { name: 'Accounts', icon: Users, href: APP_ROUTES.accounts },
  { name: 'Journey', icon: Compass, href: APP_ROUTES.journey },
  { name: 'Routine', icon: ClipboardCheck, href: APP_ROUTES.routine },
  { name: 'Setups', icon: Crosshair, href: APP_ROUTES.setups },
  { name: 'Calendar', icon: Calendar, href: APP_ROUTES.calendar },
  { name: 'Trades', icon: TrendingUp, href: APP_ROUTES.trades },
  { name: 'Playbooks', icon: Target, href: APP_ROUTES.playbooks },
  { name: 'Journal', icon: BookOpen, href: APP_ROUTES.journal },
] as const;

export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
