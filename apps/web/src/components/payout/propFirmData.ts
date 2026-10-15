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
  /**
   * Profit (dollars above starting balance) at which a trailing threshold stops
   * trailing and locks forever. 0 = locks level with the starting balance.
   * null = the threshold trails the peak for the life of the account.
   * Editable in the UI — firms move this more often than any other rule.
   */
  drawdownLockProfit: number | null;
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
    drawdownLockProfit: 0,
    consistencyPercent: 50,
    consistencyBasis: 'profitTarget',
    minTradingDays: 2,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'monthly',
    rulesUpdated: '2026-09-22',
    sourceUrl: 'https://help.topstep.com/en/articles/8284197-trading-combine-parameters',
    verified: true,
    notes: 'Consistency confirmed: best single day must stay below 50% of profit target. Payout policy now reads a flat 90/10 split for new traders (the old keep-100%-of-the-first tier only applies to dashboards opened before Jan 12, 2026). Prices shown are list — Topstep discounts frequently.',
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
    drawdownLockProfit: 100,
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
    drawdownLockProfit: 100,
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
    drawdownLockProfit: 100,
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
    drawdownLockProfit: 100,
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
    drawdownLockProfit: 100,
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
    drawdownLockProfit: 0,
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
    drawdownLockProfit: 0,
    consistencyPercent: 40,
    consistencyBasis: 'totalProfit',
    minTradingDays: 5,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'one-time',
    rulesUpdated: '2026-09-22',
    sourceUrl: 'https://lucidtrading.com/',
    verified: false,
    notes: 'LucidPro: structured eval (no consistency rule on the eval) → funded stage with 40% consistency. EOD trailing drawdown, every funded payout split 90/10 per the help center, fast payouts. Sourced from current 2026 reviews — confirm exact target/cost/split on lucidtrading.com. Lucid has moved its rules in the last year, so re-check before buying.',
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
    drawdownLockProfit: 0,
    consistencyPercent: 50,
    consistencyBasis: 'totalProfit',
    minTradingDays: 5,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'one-time',
    rulesUpdated: '2026-10-15',
    sourceUrl: 'https://lucidtrading.com/',
    verified: false,
    notes: 'LucidFlex: eval needs 50% consistency to pass — but once FUNDED there is NO consistency rule and NO daily loss limit. That funded freedom is the big edge: take your big days without holding back. Set consistency below to 100% to model the funded stage. EOD trailing drawdown, every funded payout split 90/10 per the help center. One-time evaluation fee, no subscription (2026 reviews); 4 minis / 40 micros on the 50K. Lucid now prices by configuration (daily loss limit choice), so confirm the checkout total on lucidtrading.com.',
    tiers: [
      t('lucidflex-50k', '$50K', 50000, 3000, 2000, 4, null, 135),
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
    drawdownLockProfit: 0,
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
    id: 'futures-elite',
    name: 'Futures Elite',
    program: 'Elite (Evaluation)',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'End-of-day trailing drawdown, no daily loss limit by default.',
    drawdownLockProfit: 100,
    consistencyPercent: 40,
    consistencyBasis: 'totalProfit',
    minTradingDays: 3,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'one-time',
    rulesUpdated: '2026-09-30',
    sourceUrl: 'https://futureselite.com/#pricing',
    verified: true,
    notes: 'From the Futures Elite pricing table (Tradovate configuration) on Sep 30, 2026: EOD drawdown, 3 minimum days, 40% eval consistency (50% option). Funded: 90% split, 6 qualifying days, no consistency rule, no activation fee, payout caps $1K/$2K/$2.5K/$3K by size. List prices shown; promos often run ~30% off. Contract caps are not on the pricing table: the limits here are assumed, check your dashboard. The drawdown lock level is assumed at start + $100.',
    tiers: [
      t('fe-elite-25k', '$25K', 25000, 1250, 1000, 2, null, 99),
      t('fe-elite-50k', '$50K', 50000, 3000, 2000, 4, null, 160),
      t('fe-elite-100k', '$100K', 100000, 6000, 3000, 8, null, 306),
      t('fe-elite-150k', '$150K', 150000, 9000, 4500, 12, null, 368),
    ],
  },
  {
    id: 'futures-elite-instant',
    name: 'Futures Elite',
    program: 'Instant (No Evaluation)',
    payoutModel: 'instant',
    drawdownType: 'trailing-eod',
    drawdownNote: 'End-of-day trailing drawdown from day one. No daily loss limit or payout buffer.',
    drawdownLockProfit: 100,
    consistencyPercent: 20,
    consistencyBasis: 'totalProfit',
    minTradingDays: 10,
    profitSplit: 80,
    keep100Upto: 0,
    costCadence: 'one-time',
    rulesUpdated: '2026-09-30',
    sourceUrl: 'https://futureselite.com/#pricing',
    verified: true,
    notes: 'From the Futures Elite pricing table on Sep 30, 2026: no evaluation, 80% split, 10 minimum trading days, 20% starting consistency, payout caps $1K/$1.5K/$2.5K/$3.5K by size. Profit goals and later caps change by payout cycle. The target used here (6% of the account) is only the size of a first payout cycle in this model. Contract caps are assumed.',
    tiers: [
      t('fe-instant-25k', '$25K', 25000, 1500, 1000, 2, null, 239),
      t('fe-instant-50k', '$50K', 50000, 3000, 1800, 4, null, 349),
      t('fe-instant-100k', '$100K', 100000, 6000, 3000, 8, null, 469),
      t('fe-instant-150k', '$150K', 150000, 9000, 4500, 12, null, 569),
    ],
  },
  {
    id: 'tradeify-select',
    name: 'Tradeify',
    program: 'Select (Evaluation)',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'End-of-day trailing drawdown, enforced in real time: touching it fails the account.',
    drawdownLockProfit: 100,
    consistencyPercent: 40,
    consistencyBasis: 'totalProfit',
    minTradingDays: 3,
    profitSplit: 90,
    keep100Upto: 0,
    costCadence: 'one-time',
    rulesUpdated: '2026-10-15',
    sourceUrl: 'https://tradeify.co/',
    verified: false,
    notes: 'Select evaluation: 40% best-day consistency during the eval, none once funded; 90% split; one-time fee, no activation fee (Tradeify blog and QuantVPS, Oct 2026). Funded you choose Select Flex (no daily loss limit) or Select Daily (daily loss limit, daily payouts). Third-party reviews disagree on the 50K target ($2,500 vs $3,000): the stricter $3,000 is used. The help center blocked automated checks, so confirm on tradeify.co before buying.',
    tiers: [
      t('tradeify-50k', '$50K', 50000, 3000, 2000, 4, null, 165),
      t('tradeify-100k', '$100K', 100000, 6000, 3000, 8, null, 265),
      t('tradeify-150k', '$150K', 150000, 9000, 4500, 12, null, 375),
    ],
  },
  {
    id: 'fundednext-flex',
    name: 'FundedNext',
    program: 'Futures Flex',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'End-of-day Max Loss Limit. No daily loss limit.',
    drawdownLockProfit: 0,
    consistencyPercent: 40,
    consistencyBasis: 'totalProfit',
    minTradingDays: 5,
    profitSplit: 95,
    keep100Upto: 0,
    costCadence: 'one-time',
    rulesUpdated: '2026-10-15',
    sourceUrl: 'https://fundednext.com/futures',
    verified: false,
    notes: 'Flex 50K from fundednext.com/futures (Oct 15, 2026): $2,500 target, $1,500 EOD max loss, no daily loss limit, 40% consistency in the challenge and none funded, 95% split, 3 minis or 30 micros, $1,500 max withdrawal, 5 days to a reward. $74.99 is a sale price (list $141.99); the list price is used. The 100K and 150K rules were not on the page and are scaled from the 50K, so confirm them.',
    tiers: [
      t('fnflex-50k', '$50K', 50000, 2500, 1500, 3, null, 142),
      t('fnflex-100k', '$100K', 100000, 5000, 3000, 6, null, 274),
      t('fnflex-150k', '$150K', 150000, 7500, 4500, 9, null, 491),
    ],
  },
  {
    id: 'takeprofittrader',
    name: 'Take Profit Trader',
    program: 'Test → PRO',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'Test: end-of-day trailing. PRO: intraday trailing (follows open profit). Modelled as EOD, so PRO results here are a little generous.',
    drawdownLockProfit: 0,
    consistencyPercent: 50,
    consistencyBasis: 'totalProfit',
    minTradingDays: 3,
    profitSplit: 80,
    keep100Upto: 0,
    costCadence: 'monthly',
    rulesUpdated: '2026-10-15',
    sourceUrl: 'https://www.takeprofittrader.com/',
    verified: false,
    notes: 'Test: 6% target, EOD trailing drawdown, no daily loss limit, best day under 50% of total profit, 3 minimum days for tests bought from Aug 17, 2026. PRO: 80% split (90% on PRO+), daily payouts once the balance clears start + max drawdown, $130 activation fee not included here. Monthly subscription; reported 50K price $170/mo. From third-party reviews (Oct 2026) and the TPT home page; contract caps assumed.',
    tiers: [
      t('tpt-50k', '$50K', 50000, 3000, 2000, 6, null, 170),
      t('tpt-100k', '$100K', 100000, 6000, 3000, 12, null, 330),
      t('tpt-150k', '$150K', 150000, 9000, 4500, 15, null, 360),
    ],
  },
  {
    id: 'custom',
    name: 'Custom',
    program: 'Your own rules',
    payoutModel: 'eval',
    drawdownType: 'trailing-eod',
    drawdownNote: 'Fully custom — set every value to match any firm or account.',
    drawdownLockProfit: 0,
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
  MBT: 0.1, // CME Micro Bitcoin: 0.1 BTC; $0.10 per $1 price move
};

export type MicroSymbol = keyof typeof MICRO_POINT_VALUE;
