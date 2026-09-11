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
  Wallet,
  Building2,
  Sparkles,
} from 'lucide-react';

export const APP_ROUTES = {
  dashboard: '/app/dashboard',
  accounts: '/app/accounts',
  pilot: '/app/pilot',
  journey: '/app/journey',
  routine: '/app/routine',
  setups: '/app/setups',
  calendar: '/app/calendar',
  trades: '/app/trades',
  playbooks: '/app/playbooks',
  journal: '/app/journal',
  payout: '/app/payout',
  propfirms: '/propfirms',
} as const;

export type AppRouteKey = keyof typeof APP_ROUTES;

export const APP_NAVIGATION = [
  { name: 'Dashboard', icon: BarChart3, href: APP_ROUTES.dashboard },
  { name: 'Accounts', icon: Users, href: APP_ROUTES.accounts },
  { name: 'Pilot AI', icon: Sparkles, href: APP_ROUTES.pilot },
  { name: 'Playbooks', icon: Target, href: APP_ROUTES.playbooks },
  { name: 'Journey', icon: Compass, href: APP_ROUTES.journey },
  { name: 'Routine', icon: ClipboardCheck, href: APP_ROUTES.routine },
  { name: 'Setups', icon: Crosshair, href: APP_ROUTES.setups },
  { name: 'Calendar', icon: Calendar, href: APP_ROUTES.calendar },
  { name: 'Trades', icon: TrendingUp, href: APP_ROUTES.trades },
  { name: 'Journal', icon: BookOpen, href: APP_ROUTES.journal },
  { name: 'Payout', icon: Wallet, href: APP_ROUTES.payout },
  { name: 'Prop Firms', icon: Building2, href: APP_ROUTES.propfirms },
] as const;

export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
