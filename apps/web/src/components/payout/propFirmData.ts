// ─── Prop Firm Dataset ─────────────────────────────────────────────────────────
// Real-world prop firm rules used by the Payout page. Rule sets change often and
// pricing is promo-driven, so every value is editable in the UI. `verified` marks
// firms whose CORE RULES were confirmed from the firm's own help center, and
// `rulesUpdated` / `sourceUrl` let you re-check before committing real money.
//
// Per-tier dollar figures (target / drawdown / cost) should always be confirmed at
// checkout — they drift with promotions and tier revisions.
// ───────────────────────────────────────────────────────────────────────────────

export type DrawdownType = 'trailing-intraday' | 'trailing-eod' | 'static';
export type ConsistencyBasis = 'totalProfit' | 'profitTarget';
export type PayoutModel = 'eval' | 'instant';

export interface FirmAccountTier {
  id: string;
  label: string;
  accountSize: number;
  /** Profit required (dollars) before first payout / pass. */
  profitTarget: number;
  /** Trailing or static drawdown buffer (dollars). */
  drawdown: number;
  /** Max minis held at once. Micros = maxMicros (usually 10x). */
  maxContracts: number;
  maxMicros: number;
  /** Daily loss limit in dollars, or null if the plan has none. */
  dailyLossLimit: number | null;
  /** List price to acquire one account (editable in UI). */
  cost: number;
}

export interface PropFirm {
  id: string;
  name: string;
  /** Short tag e.g. 'Ignite', 'Trading Combine', 'Expert'. */
  program: string;
  payoutModel: PayoutModel;
  drawdownType: DrawdownType;
  drawdownNote: string;
  /** Best single day must stay at/below this % of the basis. */
  consistencyPercent: number;
  consistencyBasis: ConsistencyBasis;
  /** Minimum trading days before a payout can be requested. */
  minTradingDays: number;
  /** % of profit the trader keeps after the firm's split. */
  profitSplit: number;
  /** Some firms pay 100% up to this dollar amount, then split. 0 = none. */
  keep100Upto: number;
  /** Cost cadence label for the UI. */
  costCadence: 'monthly' | 'one-time';
  rulesUpdated: string; // ISO date of last verification
  sourceUrl: string;
  /** True when CORE RULES were confirmed from the firm's official docs. */
  verified: boolean;
  notes: string;
  tiers: FirmAccountTier[];
}

const t = (
  id: string,
  label: string,
  accountSize: number,
  profitTarget: number,
  drawdown: number,
  maxContracts: number,
  dailyLossLimit: number | null,
  cost: number
): FirmAccountTier => ({
  id,
  label,
  accountSize,
  profitTarget,
  drawdown,
  maxContracts,
  maxMicros: maxContracts * 10,
  dailyLossLimit,
  cost,
});

export const PROP_FIRMS: PropFirm[] = [
  {
    id: 'topstep',
    name: 'Topstep',
    program: 'Trading Combine',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'Trailing Max Loss Limit trails your peak EOD, then locks once it reaches your starting balance.',
    consistencyPercent: 50,
    consistencyBasis: 'profitTarget',
    minTradingDays: 2,
    profitSplit: 90,
    keep100Upto: 5000,
    costCadence: 'monthly',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://help.topstep.com/en/articles/8284197-trading-combine-parameters',
    verified: true,
    notes: 'Consistency confirmed: best single day must stay below 50% of profit target. Keep 100% of first $5,000, then 90/10. Prices shown are list — Topstep discounts frequently.',
    tiers: [
      t('topstep-50k', '$50K', 50000, 3000, 2000, 5, null, 49),
      t('topstep-100k', '$100K', 100000, 6000, 3000, 10, null, 99),
      t('topstep-150k', '$150K', 150000, 9000, 4500, 15, null, 149),
    ],
  },
  {
    id: 'toponefutures',
    name: 'Top One Futures',
    program: 'Ignite (Instant Funding)',
    payoutModel: 'instant',
    drawdownType: 'trailing-eod',
    drawdownNote: 'EOD trailing drawdown that locks at starting balance + $100. No withdrawing into the buffer zone.',
    consistencyPercent: 15,
    consistencyBasis: 'totalProfit',
    minTradingDays: 5,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'one-time',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://help.toponefutures.com/en/articles/12707415-ignite-accounts-payout-requirements',
    verified: true,
    notes: 'Confirmed: 15% consistency (best day ≤ 15% of total profit) — the strictest in the TOF lineup, and the #1 reason first payouts get held. 5 funded-day minimum, 90/10 split, one-time fee from ~$87. Tier $ are estimates — confirm at checkout.',
    tiers: [
      t('tof-25k', '$25K', 25000, 1500, 1500, 4, null, 87),
      t('tof-50k', '$50K', 50000, 3000, 2000, 7, null, 150),
      t('tof-100k', '$100K', 100000, 6000, 3000, 14, null, 250),
      t('tof-150k', '$150K', 150000, 9000, 4500, 17, null, 350),
    ],
  },
  {
    id: 'tof-s2f',
    name: 'Top One Futures',
    program: 'S2F Sim PRO (Straight to Funded)',
    payoutModel: 'eval',
    drawdownType: 'trailing-intraday',
    drawdownNote: 'Intraday trailing threshold during the Sim PRO stage. Trails your intraday peak until you are above the initial buffer.',
    consistencyPercent: 20,
    consistencyBasis: 'totalProfit',
    minTradingDays: 10,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'one-time',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://help.toponefutures.com/en/articles/13449146-top-one-futures-account-comparison-elite-vs-instant-vs-s2f-sim-pro-vs-ignite-accounts',
    verified: true,
    notes: 'S2F Sim PRO: straight-to-funded evaluation with intraday trailing drawdown, 20% consistency (best day ≤ 20% of total), 10 funded-day minimum, 90/10 split. One-time fee from ~$103. Looser consistency than Ignite but a longer min-day path. Tier $ are estimates.',
    tiers: [
      t('tofs2f-50k', '$50K', 50000, 3000, 2000, 7, null, 103),
      t('tofs2f-100k', '$100K', 100000, 6000, 3000, 14, null, 170),
      t('tofs2f-150k', '$150K', 150000, 9000, 4500, 17, null, 250),
    ],
  },
  {
    id: 'tof-instant-sim',
    name: 'Top One Futures',
    program: 'Instant Sim Funded',
    payoutModel: 'instant',
    drawdownType: 'trailing-eod',
    drawdownNote: 'EOD trailing drawdown. Funded from day one, same buffer logic as Ignite.',
    consistencyPercent: 20,
    consistencyBasis: 'totalProfit',
    minTradingDays: 5,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'one-time',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://help.toponefutures.com/en/articles/13449146-top-one-futures-account-comparison-elite-vs-instant-vs-s2f-sim-pro-vs-ignite-accounts',
    verified: true,
    notes: 'Instant Sim Funded: funded from day one, 20% consistency, 5-day minimum, 90/10. Matches Ignite for payout speed but with a more forgiving 20% best-day cap. Tier $ are estimates.',
    tiers: [
      t('tofis-50k', '$50K', 50000, 3000, 2000, 7, null, 130),
      t('tofis-100k', '$100K', 100000, 6000, 3000, 14, null, 230),
      t('tofis-150k', '$150K', 150000, 9000, 4500, 17, null, 330),
    ],
  },
  {
    id: 'tof-elite',
    name: 'Top One Futures',
    program: 'Elite (Evaluation)',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'EOD trailing drawdown during the single-step evaluation, locks at start + $100 once funded.',
    consistencyPercent: 25,
    consistencyBasis: 'totalProfit',
    minTradingDays: 5,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'monthly',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://help.toponefutures.com/en/articles/13449146-top-one-futures-account-comparison-elite-vs-instant-vs-s2f-sim-pro-vs-ignite-accounts',
    verified: true,
    notes: 'Elite: single-step evaluation (~6% target), EOD trailing drawdown, 25% consistency, 90/10. Monthly fee from ~$28 (heavily promoted). The Elite Access variant has no daily loss limit on the challenge but a looser 40% consistency. Tier $ are estimates.',
    tiers: [
      t('tofel-50k', '$50K', 50000, 3000, 2000, 7, null, 28),
      t('tofel-100k', '$100K', 100000, 6000, 3000, 14, null, 38),
      t('tofel-150k', '$150K', 150000, 9000, 4500, 17, null, 48),
    ],
  },
  {
    id: 'apex',
    name: 'Apex Trader Funding',
    program: 'Apex 4.0 (Eval → PA)',
    payoutModel: 'eval',
    drawdownType: 'trailing-intraday',
    drawdownNote: 'Intraday trailing threshold that stops trailing once you are $100 above the starting drawdown (i.e. start + $100).',
    consistencyPercent: 50,
    consistencyBasis: 'totalProfit',
    minTradingDays: 8,
    profitSplit: 90,
    keep100Upto: 25000,
    costCadence: 'monthly',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://support.apextraderfunding.com/hc/en-us/articles/40507212951451-Legacy-PA-Payout-Parameters',
    verified: true,
    notes: 'Apex 4.0 (launched Mar 1, 2026) raised the payout consistency cap to 50% of total profit — legacy accounts bought before March stay at 30%. Keep 100% of first $25,000, then 90/10. Legacy PA payouts need 8 trading days (≥5 of them with $50+ profit). Apex runs aggressive promos — list monthly prices are usually heavily discounted (often $20–35).',
    tiers: [
      t('apex-25k', '$25K', 25000, 1500, 1500, 4, null, 167),
      t('apex-50k', '$50K', 50000, 3000, 2500, 10, null, 167),
      t('apex-75k', '$75K', 75000, 4250, 2750, 12, null, 167),
      t('apex-100k', '$100K', 100000, 6000, 3000, 14, null, 207),
      t('apex-150k', '$150K', 150000, 9000, 5000, 17, null, 257),
      t('apex-250k', '$250K', 250000, 15000, 6500, 27, null, 297),
      t('apex-300k', '$300K', 300000, 20000, 7500, 35, null, 657),
    ],
  },
  {
    id: 'myfundedfutures',
    name: 'My Funded Futures',
    program: 'Expert',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'EOD trailing drawdown (Expert/Pro plans). Expert has no daily loss limit; Starter plan does.',
    consistencyPercent: 50,
    consistencyBasis: 'totalProfit',
    minTradingDays: 2,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'monthly',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://help.myfundedfutures.com/en/articles/8528339-understanding-evaluation-parameters-at-mffu',
    verified: true,
    notes: '50% consistency on Rapid/Flex/Pro evals (funded ~40% on Starter/Core). Expert/Milestone/Pro have NO daily loss limit. Min 2 trading days. Confirm tier $ at checkout.',
    tiers: [
      t('mff-50k', '$50K', 50000, 3000, 2000, 5, null, 80),
      t('mff-100k', '$100K', 100000, 6000, 3000, 10, null, 150),
      t('mff-150k', '$150K', 150000, 9000, 4500, 15, null, 270),
    ],
  },
  {
    id: 'lucid-pro',
    name: 'Lucid Trading',
    program: 'LucidPro',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'EOD trailing Max Loss Limit — updates only at close (4:45pm ET), then locks once you clear the initial trail balance. No intraday wick risk.',
    consistencyPercent: 40,
    consistencyBasis: 'totalProfit',
    minTradingDays: 5,
    profitSplit: 90,
    keep100Upto: 10000,
    costCadence: 'monthly',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://lucidtrading.com/',
    verified: false,
    notes: 'LucidPro: structured eval (no consistency rule on the eval) → funded stage with 40% consistency. EOD trailing drawdown, 100% of first $10K then split, fast payouts (often <15 min). Sourced from current 2026 reviews — confirm exact target/cost/split on lucidtrading.com. Lucid has moved its rules in the last year, so re-check before buying.',
    tiers: [
      t('lucidpro-50k', '$50K', 50000, 3000, 2000, 5, null, 125),
      t('lucidpro-100k', '$100K', 100000, 6000, 3000, 10, null, 235),
      t('lucidpro-150k', '$150K', 150000, 9000, 4500, 15, null, 345),
    ],
  },
  {
    id: 'lucid-flex',
    name: 'Lucid Trading',
    program: 'LucidFlex',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'EOD trailing Max Loss Limit (updates at close, then locks). The funded stage has NO daily loss limit.',
    consistencyPercent: 50,
    consistencyBasis: 'totalProfit',
    minTradingDays: 5,
    profitSplit: 90,
    keep100Upto: 10000,
    costCadence: 'monthly',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://lucidtrading.com/',
    verified: false,
    notes: 'LucidFlex: eval needs 50% consistency to pass — but once FUNDED there is NO consistency rule and NO daily loss limit. That funded freedom is the big edge: take your big days without holding back. Set consistency below to 100% to model the funded stage. EOD trailing drawdown, 100% of first $10K then split. Confirm current terms on lucidtrading.com.',
    tiers: [
      t('lucidflex-50k', '$50K', 50000, 3000, 2000, 5, null, 135),
      t('lucidflex-100k', '$100K', 100000, 6000, 3000, 10, null, 255),
      t('lucidflex-150k', '$150K', 150000, 9000, 4500, 15, null, 375),
    ],
  },
  {
    id: 'lucid-direct',
    name: 'Lucid Trading',
    program: 'LucidDirect (Instant)',
    payoutModel: 'instant',
    drawdownType: 'trailing-eod',
    drawdownNote: 'EOD trailing Max Loss Limit. Instant-style funded — no evaluation phase.',
    consistencyPercent: 20,
    consistencyBasis: 'totalProfit',
    minTradingDays: 5,
    profitSplit: 90,
    keep100Upto: 10000,
    costCadence: 'one-time',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://lucidtrading.com/',
    verified: false,
    notes: 'LucidDirect: instant-style funded from day one with a strict 20% consistency rule and tighter payout caps. 100% of first $10K then split, EOD trailing drawdown, fast payouts. Best when you trade evenly across days. Confirm exact caps/cost on lucidtrading.com.',
    tiers: [
      t('luciddirect-50k', '$50K', 50000, 3000, 2000, 5, null, 350),
      t('luciddirect-100k', '$100K', 100000, 6000, 3000, 10, null, 600),
      t('luciddirect-150k', '$150K', 150000, 9000, 4500, 15, null, 850),
    ],
  },
  {
    id: 'custom',
    name: 'Custom',
    program: 'Your own rules',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'Fully custom — set every value to match any firm or account.',
    consistencyPercent: 30,
    consistencyBasis: 'totalProfit',
    minTradingDays: 1,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'one-time',
    rulesUpdated: '2026-06-02',
    sourceUrl: '',
    verified: false,
    notes: 'Custom profile. Edit every field to model any firm or scenario.',
    tiers: [t('custom-50k', '$50K', 50000, 3000, 2000, 5, null, 0)],
  },
];

export const getFirmById = (id: string): PropFirm =>
  PROP_FIRMS.find((f) => f.id === id) ?? PROP_FIRMS[0];

export const MICRO_POINT_VALUE: Record<string, number> = {
  MNQ: 2, // Micro Nasdaq, $2/pt
  MES: 5, // Micro S&P, $5/pt
  MGC: 10, // Micro Gold, $10/pt
  M2K: 5, // Micro Russell, $5/pt
  MYM: 0.5, // Micro Dow, $0.50/pt
};

export type MicroSymbol = keyof typeof MICRO_POINT_VALUE;
