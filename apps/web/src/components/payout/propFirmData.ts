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
    program: 'Ignite',
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
    notes: 'Confirmed: 15% consistency (best day ≤ 15% of total profit), 5 funded-day minimum, 90/10 split. Elite Access tier uses 40% consistency instead. Tier $ targets/drawdown/cost are estimates — confirm at checkout.',
    tiers: [
      t('tof-25k', '$25K', 25000, 1500, 1500, 4, null, 75),
      t('tof-50k', '$50K', 50000, 3000, 2000, 7, null, 150),
      t('tof-100k', '$100K', 100000, 6000, 3000, 14, null, 250),
      t('tof-150k', '$150K', 150000, 9000, 4500, 17, null, 350),
    ],
  },
  {
    id: 'apex',
    name: 'Apex Trader Funding',
    program: 'Evaluation → PA',
    payoutModel: 'eval',
    drawdownType: 'trailing-intraday',
    drawdownNote: 'Intraday trailing threshold that stops trailing once you are $100 above the starting drawdown (i.e. start + $100).',
    consistencyPercent: 30,
    consistencyBasis: 'totalProfit',
    minTradingDays: 8,
    profitSplit: 90,
    keep100Upto: 25000,
    costCadence: 'monthly',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://apextraderfunding.com/help-center/evaluation-accounts-ea/legacy-evaluation-rules/',
    verified: true,
    notes: '30% consistency on PA/funded, keep 100% of first $25,000 then 90/10. Apex runs aggressive promos — list monthly prices below are usually heavily discounted (often $20–35).',
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
    id: 'lucid',
    name: 'Lucid Trading',
    program: 'Evaluation',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'EOD trailing drawdown (unverified — confirm on lucidtrading.com).',
    consistencyPercent: 40,
    consistencyBasis: 'totalProfit',
    minTradingDays: 5,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'monthly',
    rulesUpdated: '2026-06-02',
    sourceUrl: 'https://lucidtrading.com',
    verified: false,
    notes: 'UNVERIFIED — these numbers are best-effort placeholders. Confirm Lucid\'s current target, consistency, drawdown, split, and cost before relying on this.',
    tiers: [
      t('lucid-50k', '$50K', 50000, 3000, 2000, 5, null, 110),
      t('lucid-100k', '$100K', 100000, 6000, 3000, 10, null, 220),
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
