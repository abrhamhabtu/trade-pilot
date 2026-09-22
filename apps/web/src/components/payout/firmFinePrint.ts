// ─── Firm fine print ───────────────────────────────────────────────────────────
// The rules that end accounts and hold payouts but never make the sales page:
// news bans, payout caps, minimum requests, winning-day counts, safety nets and
// inactivity closures.
//
// Every rule carries where it came from. `official` means we read it on the
// firm's own help center on `checked`. `reported` means only third-party review
// sites said so — treat it as a lead, not a fact. A rule we could not find is
// left out rather than guessed.
// ───────────────────────────────────────────────────────────────────────────────

export type RuleSource = 'official' | 'reported';

/**
 * allowed      — trade through releases.
 * restricted   — allowed with conditions (size limits, blocked windows).
 * banned-funded — prohibited on funded accounts around tier-1 releases.
 * unknown      — we could not confirm it. Check before trading news.
 */
export type NewsPolicy = 'allowed' | 'restricted' | 'banned-funded' | 'unknown';

export interface FineRule<T> {
  value: T;
  source: RuleSource;
  note?: string;
}

export interface FirmFinePrint {
  /** ISO date the rules below were last read. */
  checked: string;
  sources: string[];
  news: FineRule<NewsPolicy> & { note: string };
  /** Minutes either side of a tier-1 release the rule blocks, when it has a window. */
  newsWindowMinutes?: number;
  /** Largest single payout request, keyed by tier id. */
  payoutCaps?: FineRule<Record<string, number>>;
  /** Smallest payout the firm will process. */
  minPayout?: FineRule<number>;
  /** Qualifying days needed each payout cycle, and the profit a day needs to count. */
  payoutDays?: FineRule<{ count: number; minDayProfit: Record<string, number> | number | null }>;
  /** Lifetime payouts one account can take before it closes or moves on. */
  maxPayouts?: FineRule<number>;
  /** Profit you must leave in the account, above the starting balance. */
  safetyNet?: FineRule<string>;
  /**
   * The same rule as a number: only profit above drawdown + this many dollars
   * can be withdrawn. Present only where the firm states it that way.
   */
  safetyNetOverDrawdown?: number;
  inactivity?: FineRule<string>;
  /** Anything else that quietly ends accounts or holds payouts. */
  gotchas?: FineRule<string>[];
}

const CHECKED = '2026-09-22';

export const FIRM_FINE_PRINT: Record<string, FirmFinePrint> = {
  topstep: {
    checked: CHECKED,
    sources: [
      'https://help.topstep.com/en/articles/8284233-topstep-payout-policy',
      'https://help.topstep.com/en/articles/10305426-prohibited-trading-strategies-at-topstep',
      'https://help.topstep.com/en/articles/8284211-economic-releases',
    ],
    news: {
      value: 'restricted',
      source: 'official',
      note: 'No flatten rule, but trading full max size straight into a scheduled release is a prohibited strategy, and new equity-index opens are blocked 5 minutes either side of CPI.',
    },
    newsWindowMinutes: 5,
    payoutCaps: {
      value: { 'topstep-50k': 2000, 'topstep-100k': 3000, 'topstep-150k': 5000 },
      source: 'official',
      note: 'Standard Express Funded path. The Consistency path caps $1,000 higher. Never more than 50% of the balance per request.',
    },
    minPayout: { value: 125, source: 'official' },
    payoutDays: {
      value: { count: 5, minDayProfit: 150 },
      source: 'official',
      note: 'Standard path: five winning days of $150+ net since the last payout.',
    },
    safetyNet: {
      value: 'After the first payout the Maximum Loss Limit resets to $0 permanently: any drawdown below starting balance ends the account.',
      source: 'official',
    },
  },

  toponefutures: {
    checked: CHECKED,
    sources: ['https://help.toponefutures.com/en/articles/12707415-ignite-accounts-payout-requirements'],
    news: {
      value: 'allowed',
      source: 'reported',
      note: 'Review sites report news trading is allowed with a 10-second minimum hold. Not stated on the payout help page.',
    },
    minPayout: { value: 250, source: 'official' },
    gotchas: [
      {
        value: 'Every payout cycle needs 5% profit on the account, measured from the post-payout balance.',
        source: 'official',
      },
      {
        value: 'Best day must stay at or under 15% of total profit when you request. One big day can hold a payout for weeks.',
        source: 'official',
      },
    ],
  },

  apex: {
    checked: CHECKED,
    sources: [
      'https://support.apextraderfunding.com/hc/en-us/articles/40507212951451-Legacy-PA-Payout-Parameters',
      'https://support.apextraderfunding.com/hc/en-us/articles/31519788944411-Performance-Account-PA-and-Compliance',
    ],
    news: {
      value: 'allowed',
      source: 'reported',
      note: 'Directional trades through releases are reported as allowed. Opposing positions or hedges around news are prohibited.',
    },
    minPayout: { value: 500, source: 'reported' },
    maxPayouts: {
      value: 6,
      source: 'official',
      note: 'A Performance Account closes after its sixth payout, however much profit is left.',
    },
    safetyNet: {
      value: 'Drawdown + $100 must stay in the account for its life. Only profit above that is withdrawable.',
      source: 'official',
    },
    safetyNetOverDrawdown: 100,
    inactivity: {
      value: 'Reported: at least 2 days with $50+ net profit every rolling 30 days, or the account goes dormant, then closes.',
      source: 'reported',
    },
  },

  myfundedfutures: {
    checked: CHECKED,
    sources: ['https://help.myfundedfutures.com/en/articles/8230009-news-trading-policy'],
    news: {
      value: 'banned-funded',
      source: 'official',
      note: 'Funded accounts: no positions or resting orders from 2 minutes before to 2 minutes after FOMC, FOMC minutes, CPI and the jobs report. A breach voids the account.',
    },
    newsWindowMinutes: 2,
    gotchas: [
      {
        value: 'The Expert plan is retired. Current plans are Rapid, Builder, Flex and Pro, and their news rules differ (Builder is unrestricted).',
        source: 'reported',
      },
    ],
  },

  'lucid-pro': {
    checked: CHECKED,
    sources: ['https://support.lucidtrading.com/en/articles/12890092-lucidpro-payouts'],
    news: {
      value: 'allowed',
      source: 'reported',
      note: 'Review sites report positions are allowed through major releases. Not stated on the payout help page.',
    },
    payoutCaps: {
      value: { 'lucidpro-50k': 2000, 'lucidpro-100k': 2500, 'lucidpro-150k': 3000 },
      source: 'official',
      note: 'First payout. Later payouts cap $500 higher.',
    },
    minPayout: { value: 500, source: 'official' },
    safetyNet: {
      value: 'Profit must clear the initial Max Loss Limit + $100 before any payout.',
      source: 'official',
    },
    safetyNetOverDrawdown: 100,
    gotchas: [
      { value: 'Payout requests are final once submitted. They cannot be edited or cancelled.', source: 'official' },
    ],
  },

  'lucid-flex': {
    checked: CHECKED,
    sources: ['https://support.lucidtrading.com/en/articles/12945796-lucidflex-payouts'],
    news: {
      value: 'allowed',
      source: 'reported',
      note: 'Review sites report positions are allowed through major releases. Not stated on the payout help page.',
    },
    payoutCaps: {
      value: { 'lucidflex-50k': 2000, 'lucidflex-100k': 2500, 'lucidflex-150k': 3000 },
      source: 'official',
      note: '50% of profit, up to the cap.',
    },
    minPayout: { value: 500, source: 'official' },
    payoutDays: {
      value: {
        count: 5,
        minDayProfit: { 'lucidflex-50k': 150, 'lucidflex-100k': 200, 'lucidflex-150k': 250 },
      },
      source: 'official',
      note: 'Five profitable days per cycle, each clearing the size-based minimum.',
    },
    maxPayouts: { value: 5, source: 'official', note: 'After five payouts the account moves to live.' },
    safetyNet: { value: 'No buffer balance is required.', source: 'official' },
  },

  'lucid-direct': {
    checked: CHECKED,
    sources: [],
    news: { value: 'unknown', source: 'reported', note: 'Not confirmed. Check with Lucid before trading releases.' },
  },
};

export const finePrintFor = (firmId: string | null | undefined): FirmFinePrint | null =>
  (firmId && FIRM_FINE_PRINT[firmId]) || null;

/** The qualifying-day profit for a tier, when the rule has one. */
export function minDayProfitFor(fp: FirmFinePrint | null, tierId: string | null): number | null {
  const rule = fp?.payoutDays?.value.minDayProfit;
  if (rule === null || rule === undefined) return null;
  if (typeof rule === 'number') return rule;
  return tierId ? rule[tierId] ?? null : null;
}

export const NEWS_LABEL: Record<NewsPolicy, string> = {
  allowed: 'Allowed',
  restricted: 'Restricted',
  'banned-funded': 'Banned when funded',
  unknown: 'Not confirmed',
};

// ─── Tier-1 release calendar ─────────────────────────────────────────────────
// Dates the Fed has published for 2026, and the jobs report's usual first-Friday
// slot. CPI moves around too much to guess, so it is never claimed here.

const FOMC_DECISIONS_2026 = [
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17',
  '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
];

export interface ScheduledRelease {
  label: string;
  time: string;
  /** 'scheduled' comes from a published calendar; 'typical' is the usual slot. */
  certainty: 'scheduled' | 'typical';
}

/** Tier-1 releases we can place on a date without a live calendar. */
export function tierOneReleasesOn(date: string): ScheduledRelease[] {
  const out: ScheduledRelease[] = [];
  if (FOMC_DECISIONS_2026.includes(date)) {
    out.push({ label: 'FOMC rate decision', time: '14:00 ET', certainty: 'scheduled' });
  }
  const d = new Date(`${date}T12:00:00`);
  if (d.getDay() === 5 && d.getDate() <= 7) {
    out.push({ label: 'Jobs report (usual first-Friday slot)', time: '08:30 ET', certainty: 'typical' });
  }
  return out;
}
