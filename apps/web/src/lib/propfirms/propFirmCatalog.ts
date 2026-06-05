import type { DrawdownType } from '@/components/payout/propFirmData';

export type PropFirmBrandStatus = 'live' | 'coming-soon';

export interface PropFirmFAQ {
  question: string;
  answer: string;
}

export interface PropFirmBrand {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  summary: string;
  assetClasses: string[];
  /** Maps to `PropFirm.id` entries in propFirmData.ts */
  programIds: string[];
  status: PropFirmBrandStatus;
  whyHard: string;
  howTradePilotHelps: string;
  mistakes: string[];
  faq: PropFirmFAQ[];
  relatedSlugs: string[];
  /** Label used when creating an account in TradePilot */
  brokerLabel: string;
}

export const PROP_FIRM_CATALOG: PropFirmBrand[] = [
  {
    slug: 'topstep',
    name: 'Topstep',
    emoji: '🏆',
    tagline: 'The original US futures prop firm.',
    summary:
      'Trailing drawdown, daily loss limit, and the classic Trading Combine evaluation that set the template for the entire industry.',
    assetClasses: ['futures'],
    programIds: ['topstep'],
    status: 'live',
    whyHard:
      'Topstep punishes hot streaks. The consistency rule caps your best day at 50% of the profit target — not total profit — so one oversized green day can stall a payout even when you are well above the target. Combine that with an EOD trailing drawdown that follows your peak balance and a daily loss limit, and you are juggling three buffers at once.',
    howTradePilotHelps:
      'TradePilot\'s Payout Planner models Topstep\'s consistency against your profit target, sizes micros to your daily ceiling, and projects how many sessions you need before your first withdrawal — using your real trade history when an account is linked.',
    mistakes: [
      'Sizing up to hit the profit target quickly and tripping the trailing drawdown on a normal pullback.',
      'Ignoring the 50% consistency rule relative to the target — not your running P&L.',
      'Forgetting that the drawdown trails your peak EOD balance until it locks at starting capital.',
    ],
    faq: [
      {
        question: 'Does TradePilot support Topstep\'s Trading Combine rules?',
        answer:
          'Yes. Select Topstep in the Payout Planner to load trailing EOD drawdown, consistency, profit split, and tier sizing. Override any value if Topstep updates their rules.',
      },
      {
        question: 'What is the #1 reason traders fail Topstep?',
        answer:
          'Oversizing early in the combine. The trailing drawdown does not care that you were up big intraday — it measures against your end-of-day peak.',
      },
      {
        question: 'Can I track multiple Topstep accounts?',
        answer:
          'Yes. Create separate accounts in TradePilot for each combine or funded account and link trades to compare performance across them.',
      },
    ],
    relatedSlugs: ['apex-trader-funding', 'my-funded-futures', 'lucid-trading'],
    brokerLabel: 'Topstep',
  },
  {
    slug: 'apex-trader-funding',
    name: 'Apex Trader Funding',
    emoji: '⚡',
    tagline: 'The largest futures prop firm in the US.',
    summary:
      'Intraday trailing drawdown, scaling plan, and a consistency rule that tightened again in Apex 4.0.',
    assetClasses: ['futures'],
    programIds: ['apex'],
    status: 'live',
    whyHard:
      'Apex uses intraday trailing drawdown — your buffer moves with your session high, not just the close. That means a spike and give-back can end an account before you ever see a green day on the calendar. The 50% consistency rule on total profit (Apex 4.0) adds another ceiling on payout requests.',
    howTradePilotHelps:
      'Model Apex tiers with intraday trailing logic in the firm config, plan micro sizing around your daily risk budget, and use the path-to-payout projection to see whether your edge clears consistency before you request a withdrawal.',
    mistakes: [
      'Treating Apex like an EOD-trail firm and holding losers into the close.',
      'Blowing the consistency cap with one huge green day right before a payout request.',
      'Underestimating how fast intraday trailing moves when you scale contract size.',
    ],
    faq: [
      {
        question: 'Does TradePilot track Apex 4.0 consistency?',
        answer:
          'The Payout Planner uses Apex\'s configured consistency percent and basis. Verify your account generation on Apex\'s official docs — legacy accounts may differ.',
      },
      {
        question: 'What drawdown type does Apex use?',
        answer:
          'Intraday trailing on evaluation and funded accounts. The threshold trails your session peak until you clear the initial buffer zone.',
      },
      {
        question: 'Can I plan payouts with the 100% first $25K split?',
        answer:
          'Yes. The profit split and keep-100%-up-to fields in the Payout Planner reflect Apex\'s tiered payout structure.',
      },
    ],
    relatedSlugs: ['topstep', 'my-funded-futures', 'top-one-futures'],
    brokerLabel: 'Apex Trader Funding',
  },
  {
    slug: 'my-funded-futures',
    name: 'My Funded Futures',
    emoji: '🚀',
    tagline: 'Fast-growing US futures prop firm with flexible plans.',
    summary:
      'Multiple evaluation tracks with EOD trailing drawdown, tier-dependent daily loss limits, and a scaling program.',
    assetClasses: ['futures'],
    programIds: ['myfundedfutures'],
    status: 'live',
    whyHard:
      'MFFU\'s rules vary by plan — Expert drops the daily loss limit but keeps a 50% consistency rule on total profit. Traders often buy the wrong tier, then discover the consistency math does not match how they actually trade.',
    howTradePilotHelps:
      'Pick the MFFU Expert preset, tune consistency and drawdown to your tier, and run the eval-vs-funded comparison to see whether a no-DLL plan is worth the stricter payout rules for your style.',
    mistakes: [
      'Choosing Expert for "no daily loss limit" without planning for 50% consistency on payouts.',
      'Mixing up Rapid/Flex/Pro consistency rules across different account types.',
      'Assuming EOD trailing means you can hold large intraday open losses without consequence.',
    ],
    faq: [
      {
        question: 'Which MFFU plan does TradePilot model?',
        answer:
          'The Expert evaluation preset is the default. Override drawdown, consistency, and daily loss limit in Firm & Rules to match your specific plan.',
      },
      {
        question: 'How many trading days before payout?',
        answer:
          'MFFU typically requires a minimum number of funded trading days. The Payout Planner shows min days in the firm config panel.',
      },
    ],
    relatedSlugs: ['topstep', 'lucid-trading', 'apex-trader-funding'],
    brokerLabel: 'My Funded Futures',
  },
  {
    slug: 'lucid-trading',
    name: 'Lucid Trading',
    emoji: '💎',
    tagline: 'Competitive pricing and straightforward evaluation rules.',
    summary:
      'EOD trailing drawdown across LucidPro, LucidFlex, and LucidDirect — each with different consistency and funded-stage freedoms.',
    assetClasses: ['futures'],
    programIds: ['lucid-pro', 'lucid-flex', 'lucid-direct'],
    status: 'live',
    whyHard:
      'Lucid\'s rules look simple, which makes traders complacent. EOD trailing still bites on a bad week, and consistency rules differ sharply between programs — LucidFlex is strict on the eval but drops consistency on the funded account, while LucidDirect funds you instantly with a tight 20% cap.',
    howTradePilotHelps:
      'Compare all three Lucid programs side by side in the hub, then open the Payout Planner pre-loaded for your program. Size micros against your consistency ceiling and map the path to first payout with your actual win rate.',
    mistakes: [
      'Assuming "simple rules" means easy to pass — EOD trailing still ends accounts on normal pullbacks.',
      'Picking LucidFlex for funded freedom but failing the 50% eval consistency first.',
      'Not matching the program to your style — LucidDirect punishes uneven traders with a 20% consistency rule.',
    ],
    faq: [
      {
        question: 'Which Lucid program should I choose?',
        answer:
          'LucidPro for structured eval → funded with 40% consistency on payouts. LucidFlex if you want no consistency rule once funded. LucidDirect if you want instant-style funding and can trade evenly across days.',
      },
      {
        question: 'Does TradePilot distinguish LucidPro vs LucidFlex?',
        answer:
          'Yes. Each program is a separate preset in prop firm data with its own consistency, drawdown notes, and tier pricing.',
      },
      {
        question: 'What drawdown type does Lucid use?',
        answer:
          'End-of-day trailing on all three programs. The max loss limit updates at the close, not on intraday spikes.',
      },
    ],
    relatedSlugs: ['top-one-futures', 'my-funded-futures', 'topstep'],
    brokerLabel: 'Lucid Trading',
  },
  {
    slug: 'top-one-futures',
    name: 'Top One Futures',
    emoji: '🔥',
    tagline: 'Multiple paths from eval to instant funding.',
    summary:
      'Ignite, S2F Sim PRO, Instant Sim, and Elite — each with different drawdown types, consistency caps, and min-day requirements.',
    assetClasses: ['futures'],
    programIds: ['toponefutures', 'tof-s2f', 'tof-instant-sim', 'tof-elite'],
    status: 'live',
    whyHard:
      'Top One Futures has the widest spread of rule sets in the industry. Ignite\'s 15% consistency is brutal. S2F uses intraday trailing with a 10-day minimum. Elite is cheap monthly but still carries a 25% cap. Picking the wrong program for your style is the fastest way to pay twice.',
    howTradePilotHelps:
      'Browse all four TOF programs from the Lucid-style detail page, compare consistency and drawdown types, then jump into the Payout Planner on the exact program you bought.',
    mistakes: [
      'Buying Ignite for instant funding without planning for 15% consistency on payouts.',
      'Confusing intraday trailing (S2F) with EOD trailing (Ignite/Instant Sim).',
      'Underestimating the 10 funded-day minimum on S2F Sim PRO.',
    ],
    faq: [
      {
        question: 'What is the strictest Top One Futures program?',
        answer:
          'Ignite (instant funding) with 15% consistency on total profit — the tightest cap in the TOF lineup and the most common reason first payouts get held.',
      },
      {
        question: 'Does TradePilot model all TOF account types?',
        answer:
          'Yes. Ignite, S2F Sim PRO, Instant Sim Funded, and Elite each have dedicated presets with verified rules where available.',
      },
    ],
    relatedSlugs: ['lucid-trading', 'apex-trader-funding', 'my-funded-futures'],
    brokerLabel: 'TopOne Futures',
  },
  // Coming soon — shown on hub, detail pages not yet available
  {
    slug: 'ftmo',
    name: 'FTMO',
    emoji: '🌍',
    tagline: 'The largest international prop firm.',
    summary:
      'Two-phase evaluation with strict daily loss and max drawdown rules across forex, futures, and indices.',
    assetClasses: ['forex', 'futures', 'indices'],
    programIds: [],
    status: 'coming-soon',
    whyHard: '',
    howTradePilotHelps: '',
    mistakes: [],
    faq: [],
    relatedSlugs: ['topstep', 'fundednext'],
    brokerLabel: 'FTMO',
  },
  {
    slug: 'fundednext',
    name: 'FundedNext',
    emoji: '🎯',
    tagline: 'Fast-growing multi-asset prop firm.',
    summary:
      'Multiple evaluation models including one-phase challenges across forex, stocks, crypto, and commodities.',
    assetClasses: ['forex', 'stocks', 'crypto', 'commodities'],
    programIds: [],
    status: 'coming-soon',
    whyHard: '',
    howTradePilotHelps: '',
    mistakes: [],
    faq: [],
    relatedSlugs: ['ftmo', 'topstep'],
    brokerLabel: 'Funded Next',
  },
  {
    slug: 'tradeify',
    name: 'Tradeify',
    emoji: '🔥',
    tagline: 'Aggressive promos and flexible DLL options.',
    summary:
      'Rising US futures prop firm known for no-daily-loss-limit options on select accounts.',
    assetClasses: ['futures'],
    programIds: [],
    status: 'coming-soon',
    whyHard: '',
    howTradePilotHelps: '',
    mistakes: [],
    faq: [],
    relatedSlugs: ['lucid-trading', 'apex-trader-funding'],
    brokerLabel: 'Tradeify',
  },
  {
    slug: 'earn2trade',
    name: 'Earn2Trade',
    emoji: '📚',
    tagline: 'Education-first futures prop firm.',
    summary:
      'Gauntlet Mini evaluation path with a heavier focus on trader development.',
    assetClasses: ['futures'],
    programIds: [],
    status: 'coming-soon',
    whyHard: '',
    howTradePilotHelps: '',
    mistakes: [],
    faq: [],
    relatedSlugs: ['topstep', 'my-funded-futures'],
    brokerLabel: 'Earn2Trade',
  },
  {
    slug: 'the5ers',
    name: 'The5%ers',
    emoji: '🌐',
    tagline: 'Established international forex prop firm.',
    summary:
      'Instant funding and bootcamp-style evaluation paths for forex and indices traders.',
    assetClasses: ['forex', 'indices', 'crypto'],
    programIds: [],
    status: 'coming-soon',
    whyHard: '',
    howTradePilotHelps: '',
    mistakes: [],
    faq: [],
    relatedSlugs: ['ftmo', 'fundednext'],
    brokerLabel: 'The5ers',
  },
];

export const CATALOG_LAST_UPDATED = '2026-06-04';

export const DRAWDOWN_LABELS: Record<DrawdownType, string> = {
  'trailing-intraday': 'Intraday trailing',
  'trailing-eod': 'End-of-day trailing',
  static: 'Static drawdown',
};

export function getBrandBySlug(slug: string): PropFirmBrand | undefined {
  return PROP_FIRM_CATALOG.find((b) => b.slug === slug);
}

export function getLiveBrands(): PropFirmBrand[] {
  return PROP_FIRM_CATALOG.filter((b) => b.status === 'live');
}

export function getComingSoonBrands(): PropFirmBrand[] {
  return PROP_FIRM_CATALOG.filter((b) => b.status === 'coming-soon');
}

export function getRelatedBrands(slug: string, limit = 6): PropFirmBrand[] {
  const brand = getBrandBySlug(slug);
  if (!brand) return [];
  return brand.relatedSlugs
    .map((s) => getBrandBySlug(s))
    .filter((b): b is PropFirmBrand => Boolean(b && b.status === 'live'))
    .slice(0, limit);
}

export function buildPayoutUrl(programId: string): string {
  return `/app/payout?firm=${encodeURIComponent(programId)}`;
}

export function buildAccountsUrl(brokerLabel: string): string {
  return `/app/accounts?broker=${encodeURIComponent(brokerLabel)}`;
}
