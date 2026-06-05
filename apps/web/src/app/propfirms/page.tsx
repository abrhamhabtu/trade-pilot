import type { Metadata } from 'next';
import { PropFirmsHub } from '@/components/propfirms';

export const metadata: Metadata = {
  title: 'Prop Firms — Apex, Topstep, Lucid & More | TradePilot',
  description:
    'Browse prop firm rules for Topstep, Apex, Lucid Trading, My Funded Futures, and more. Compare drawdown, consistency, and payout rules — then plan your path in TradePilot.',
};

export default function PropFirmsPage() {
  return <PropFirmsHub />;
}
