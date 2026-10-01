export const TRADOVATE_ACCOUNT_PROVIDERS = [
  'Futures Elite', 'Lucid Trading', 'Top One Futures', 'Other firms', 'Personal brokerage',
] as const;

export const FUTURES_ELITE_SOURCE = 'https://futureselite.com/#pricing';
export const FUTURES_ELITE_CHECKED = '2026-09-30';

export type ProviderPlan = {
  id: string;
  name: string;
  instant: boolean;
  summary: string;
  tiers: {
    size: number;
    listPrice: number;
    promoPrice: number;
    target: number | null;
    maxLoss: number;
    dailyLoss: number | null;
    payoutCap: number;
  }[];
};

// Default Tradovate configuration in the live pricing table on the checked date.
// Prices are reference quotes, never recorded as an account's actual cost.
const sizes = [25000, 50000, 100000, 150000];
const targets = [1250, 3000, 6000, 9000];
const losses = [1000, 2000, 3000, 4500];
const caps = [1000, 2000, 2500, 3000];
export const FUTURES_ELITE_PLANS: ProviderPlan[] = [
  {
    id: 'futures-elite-elite', name: 'Elite', instant: false,
    summary: 'Evaluation: EOD drawdown, 3 minimum trading days, default 40% consistency (50% option). Funded: 90% split, 6 qualifying trading days, no consistency rule. No daily loss limit by default. No activation fee.',
    tiers: sizes.map((size, i) => ({ size, listPrice: [99, 160, 306, 368][i], promoPrice: [69.30, 112, 214.20, 257.60][i], target: targets[i], maxLoss: losses[i], dailyLoss: null, payoutCap: caps[i] })),
  },
  {
    id: 'futures-elite-nitro', name: 'Nitro', instant: false,
    summary: 'Evaluation: EOD drawdown, 2 minimum trading days, 50% consistency. Funded: trailing equity drawdown, 90% split, 1 minimum trading day, no consistency rule. No daily loss limit. Funded buffer is maximum loss + $100. No activation fee.',
    tiers: sizes.map((size, i) => ({ size, listPrice: [137, 152, 240, 328][i], promoPrice: [89.05, 98.80, 156, 213.20][i], target: targets[i], maxLoss: losses[i], dailyLoss: null, payoutCap: [1000, 2000, 2500, 2800][i] })),
  },
  {
    id: 'futures-elite-prime', name: 'Prime', instant: false,
    summary: 'Evaluation: EOD drawdown, 1 minimum trading day, no consistency rule. Funded: 90% split, 40% consistency, buffer of maximum loss + $100. The pricing table lists 3 minimum funded days; the FAQ says no minimum. Confirm your dashboard. No activation fee.',
    tiers: sizes.map((size, i) => ({ size, listPrice: [96, 179, 279, 369][i], promoPrice: [62.40, 116.35, 181.35, 239.85][i], target: targets[i], maxLoss: losses[i], dailyLoss: [600, 1200, 1800, 2700][i], payoutCap: caps[i] })),
  },
  {
    id: 'futures-elite-instant', name: 'Instant', instant: true,
    summary: 'No evaluation. EOD drawdown, 80% split, 10 minimum trading days, 20% initial consistency. No daily loss limit or payout buffer. Payout profit goals and later caps vary by cycle; the 25K cap differs between pricing and the FAQ. Confirm your dashboard.',
    tiers: sizes.map((size, i) => ({ size, listPrice: [239, 349, 469, 569][i], promoPrice: [167.30, 244.30, 328.30, 398.30][i], target: null, maxLoss: [1000, 1800, 3000, 4500][i], dailyLoss: null, payoutCap: [1000, 1500, 2500, 3500][i] })),
  },
];

export function futuresEliteSelection(planId: string, size: number) {
  const plan = FUTURES_ELITE_PLANS.find((p) => p.id === planId);
  const tier = plan?.tiers.find((t) => t.size === size);
  return plan && tier ? { plan, tier } : null;
}
