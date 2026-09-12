import type { Account, BalanceAdjustment } from '@/store/accountStore';
import type { Trade } from '@/store/tradingStore';

/**
 * Sample prop-firm accounts for the demo experience.
 *
 * Trades are generated day by day from a seed of (account, date), so the history is identical on
 * every load, and the active account keeps "trading" up to the current moment: each new session
 * adds its trades as the clock passes their entry time.
 */

export interface DemoCutoff {
  /** Last calendar day (YYYY-MM-DD) that may contain trades. */
  date: string;
  /** Minutes after midnight on `date` up to which trades are included. */
  minutes: number;
}

/**
 * Fixed cutoff for the very first render (server and client must match); the client refreshes
 * to the real clock right after mount.
 */
export const DEMO_SNAPSHOT: DemoCutoff = { date: '2026-09-10', minutes: 0 };

export function nowCutoff(now = new Date()): DemoCutoff {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { date, minutes: now.getHours() * 60 + now.getMinutes() };
}

// ─── Date helpers (pure string/UTC maths so every time zone agrees) ──────────

const DAY = 86_400_000;
const toDayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY;
const fromDayNum = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const weekday = (n: number) => new Date(n * DAY).getUTCDay();

/** CME equity-index full closures we skip (approximate, 2026). */
const HOLIDAYS = new Set(['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07']);

// ─── Seeded randomness ───────────────────────────────────────────────────────

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, items: [T, number][]) => {
  const total = items.reduce((n, [, w]) => n + w, 0);
  let x = r() * total;
  for (const [v, w] of items) if ((x -= w) <= 0) return v;
  return items[items.length - 1][0];
};

// ─── Instruments & setups ────────────────────────────────────────────────────

const BASE_PRICE: Record<string, number> = { MES: 6420, MNQ: 23480, MGC: 3380, MYM: 45300 };
const POINT_VALUE: Record<string, number> = { MES: 5, MNQ: 2, MGC: 10, MYM: 0.5 };

const MORNING_SETUPS: [string, number][] = [
  ['Opening Range Breakout', 5],
  ['VWAP Reclaim', 5],
  ['Trend Following', 4],
  ['Order Block Retest', 3],
  ['Fair Value Gap', 3],
  ['Support & Resistance', 2],
  ['Momentum Breakout', 2],
];
const AFTERNOON_SETUPS: [string, number][] = [
  ['Mean Reversion', 4],
  ['Liquidity Sweep', 3],
  ['Failed Breakout', 3],
  ['Momentum Breakout', 2],
  ['VWAP Reclaim', 1],
];

const clock = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(((h + 11) % 12) + 1).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Account profiles ────────────────────────────────────────────────────────

interface Regime {
  /** Added to the base win probability. */
  win?: number;
  loss?: number;
  gain?: number;
  skip?: number;
}

interface ScriptedTrade {
  minutes: number;
  symbol: string;
  side: 'Long' | 'Short';
  netPL: number;
  duration: number;
  strategy: string;
  quantity: number;
}

interface Profile {
  id: string;
  name: string;
  broker: string;
  status: Account['status'];
  isFunded: boolean;
  start: string;
  /** Last trading day; omitted = still trading today. */
  end?: string;
  profitTarget: number;
  startingBalance: number;
  winBase: number;
  lossScale: number;
  gainScale: number;
  skip: number;
  regime?: (date: string) => Regime;
  scripted?: Record<string, ScriptedTrade[]>;
  payouts: { date: string; amount: number; description: string }[];
}

export const DEMO_ACCOUNT_IDS = ['demo-account', 'demo-scaled', 'demo-paid-out', 'demo-blown'] as const;

const PROFILES: Profile[] = [
  {
    id: 'demo-account',
    name: 'Topstep 50K Funded',
    broker: 'Topstep',
    status: 'active',
    isFunded: true,
    start: '2026-05-04',
    profitTarget: 3000,
    startingBalance: 50000,
    winBase: 0.565,
    gainScale: 0.74,
    lossScale: 0.95,
    skip: 0.18,
    // A shaky early June, then a steadier summer — the equity curve should look earned.
    regime: (d) => (d >= '2026-06-08' && d <= '2026-06-19' ? { win: -0.08 } : d >= '2026-06-22' ? { win: 0.03 } : {}),
    payouts: [
      { date: '2026-07-17', amount: 2000, description: 'First payout · 90% split' },
      { date: '2026-08-21', amount: 2500, description: 'Second payout · 90% split' },
    ],
  },
  {
    id: 'demo-scaled',
    name: 'MFF 150K Expert',
    broker: 'My Funded Futures',
    status: 'active',
    isFunded: true,
    start: '2026-03-02',
    profitTarget: 9000,
    startingBalance: 150000,
    winBase: 0.565,
    gainScale: 1.0,
    lossScale: 1.25,
    skip: 0.2,
    // The shape a scaled account actually has: a grinding spring, a drawdown in
    // May that nearly ended it, then size earned back slowly over the summer.
    regime: (d) =>
      d >= '2026-05-11' && d <= '2026-05-29'
        ? { win: -0.11, loss: 1.25 }
        : d >= '2026-06-01' && d <= '2026-06-19'
          ? { win: 0.01, gain: 0.7, loss: 0.7, skip: 0.1 }
          : d >= '2026-06-22'
            ? { win: 0.04 }
            : {},
    payouts: [
      { date: '2026-04-17', amount: 3200, description: 'First payout · 90% split' },
      { date: '2026-06-26', amount: 4100, description: 'Second payout · after the May drawdown' },
      { date: '2026-08-14', amount: 5500, description: 'Third payout · 90% split' },
    ],
  },
  {
    id: 'demo-paid-out',
    name: 'Lucid 100K Flex',
    broker: 'Lucid Trading',
    status: 'inactive',
    isFunded: true,
    start: '2026-02-02',
    end: '2026-04-24',
    profitTarget: 6000,
    startingBalance: 100000,
    winBase: 0.575,
    gainScale: 0.9,
    lossScale: 1.0,
    skip: 0.22,
    payouts: [
      { date: '2026-03-06', amount: 1800, description: 'First payout · 90% split' },
      { date: '2026-04-03', amount: 2400, description: 'Second payout · 90% split' },
      { date: '2026-04-24', amount: 3600, description: 'Final payout · account closed' },
    ],
  },
  {
    id: 'demo-blown',
    name: 'Apex 100K Eval',
    broker: 'Apex Trader Funding',
    status: 'blown',
    isFunded: false,
    start: '2026-06-01',
    end: '2026-07-17',
    profitTarget: 6000,
    startingBalance: 100000,
    winBase: 0.55,
    gainScale: 0.85,
    lossScale: 1,
    skip: 0.15,
    // Oversizing after a strong start: losses grow, discipline slips, then one tilt day ends it.
    regime: (d) => (d >= '2026-07-06' ? { win: -0.1, loss: 1.2 } : {}),
    scripted: {
      '2026-07-15': [
        { minutes: 9 * 60 + 52, symbol: 'MNQ', side: 'Long', netPL: -335, duration: 18, strategy: 'Opening Range Breakout', quantity: 2 },
        { minutes: 10 * 60 + 14, symbol: 'MNQ', side: 'Long', netPL: 95, duration: 12, strategy: 'VWAP Reclaim', quantity: 5 },
      ],
      '2026-07-16': [
        { minutes: 9 * 60 + 41, symbol: 'MES', side: 'Short', netPL: -290, duration: 16, strategy: 'Failed Breakout', quantity: 2 },
        { minutes: 10 * 60 + 5, symbol: 'MNQ', side: 'Long', netPL: -410, duration: 13, strategy: 'Momentum Breakout', quantity: 3 },
        { minutes: 10 * 60 + 38, symbol: 'MNQ', side: 'Short', netPL: -365, duration: 10, strategy: 'Liquidity Sweep', quantity: 3 },
      ],
      // The last morning: size doubles after every loss, the trades get shorter,
      // and the final one takes the account through its trailing threshold.
      '2026-07-17': [
        { minutes: 9 * 60 + 34, symbol: 'MNQ', side: 'Long', netPL: -240, duration: 22, strategy: 'Opening Range Breakout', quantity: 2 },
        { minutes: 9 * 60 + 58, symbol: 'MNQ', side: 'Short', netPL: -380, duration: 14, strategy: 'Failed Breakout', quantity: 4 },
        { minutes: 10 * 60 + 21, symbol: 'MNQ', side: 'Long', netPL: -1185, duration: 11, strategy: 'Momentum Breakout', quantity: 6 },
        { minutes: 10 * 60 + 44, symbol: 'MNQ', side: 'Long', netPL: -1460, duration: 7, strategy: 'Momentum Breakout', quantity: 8 },
        { minutes: 11 * 60 + 2, symbol: 'MNQ', side: 'Long', netPL: -905, duration: 4, strategy: 'Momentum Breakout', quantity: 10 },
      ],
    },
    payouts: [],
  },
];

// ─── Generation ──────────────────────────────────────────────────────────────

function dayTrades(p: Profile, date: string): Trade[] {
  const specs: ScriptedTrade[] = p.scripted?.[date] ?? generateDay(p, date);
  return specs.map((s, k) => {
    const pv = POINT_VALUE[s.symbol] ?? 5;
    const pts = s.netPL / (pv * s.quantity);
    const entry = BASE_PRICE[s.symbol] ?? 5000;
    const exit = s.side === 'Long' ? entry + pts : entry - pts;
    return {
      id: `${p.id}-${date}-${k + 1}`,
      date,
      time: clock(s.minutes),
      symbol: s.symbol,
      side: s.side,
      entryPrice: round2(entry),
      exitPrice: round2(exit),
      quantity: s.quantity,
      netPL: round2(s.netPL),
      duration: s.duration,
      outcome: s.netPL >= 0 ? 'win' : 'loss',
      commission: round2(0.74 * 2 * s.quantity),
      rMultiple: round2(s.netPL / 250),
      strategy: s.strategy,
    } satisfies Trade;
  });
}

function generateDay(p: Profile, date: string): ScriptedTrade[] {
  const r = rng(`${p.id}:${date}`);
  const reg = p.regime?.(date) ?? {};
  if (r() < p.skip + (reg.skip ?? 0)) return [];

  const count = pick(r, [
    [1, 45],
    [2, 35],
    [3, 15],
    [4, 5],
  ]);
  const out: ScriptedTrade[] = [];
  let minutes = 9 * 60 + 31 + Math.floor(r() * 50);
  let lossStreak = 0;
  let lastQty = 2;
  for (let k = 0; k < count && minutes < 15 * 60 + 30; k++) {
    const afternoon = minutes >= 12 * 60 + 30;
    // The patterns Pilot Coach looks for: weaker afternoons and tilt after two straight losses.
    const pWin = p.winBase + (reg.win ?? 0) - (afternoon ? 0.17 : 0) - (lossStreak >= 2 ? 0.25 : 0);
    const win = r() < pWin;
    const revenge = k > 0 && lossStreak > 0 && r() < 0.35;
    const quantity = Math.min(4, revenge ? lastQty + 1 : 1 + Math.floor(r() * 3));
    const qtyScale = 0.55 + quantity * 0.25;
    const raw = win ? (160 + r() * 470) * p.gainScale * (reg.gain ?? 1) * qtyScale : -(95 + r() * 250) * p.lossScale * (reg.loss ?? 1) * qtyScale;
    const netPL = Math.round(raw / 5) * 5;
    out.push({
      minutes,
      symbol: pick(r, [
        ['MNQ', 45],
        ['MES', 30],
        ['MGC', 15],
        ['MYM', 10],
      ]),
      side: r() < 0.62 ? 'Long' : 'Short',
      netPL,
      duration: win ? 18 + Math.floor(r() * 64) : 7 + Math.floor(r() * 30),
      strategy: pick(r, afternoon ? AFTERNOON_SETUPS : MORNING_SETUPS),
      quantity,
    });
    lossStreak = win ? 0 : lossStreak + 1;
    lastQty = quantity;
    minutes += 22 + Math.floor(r() * 100);
  }
  return out;
}

function buildAccount(p: Profile, cutoff: DemoCutoff): Account {
  const last = p.end && p.end < cutoff.date ? p.end : cutoff.date;
  const trades: Trade[] = [];
  for (let n = toDayNum(p.start); n <= toDayNum(last); n++) {
    const date = fromDayNum(n);
    const wd = weekday(n);
    if (wd === 0 || wd === 6 || HOLIDAYS.has(date)) continue;
    for (const t of dayTrades(p, date)) {
      if (date < cutoff.date) trades.push(t);
      else if (date === cutoff.date) {
        const m = t.time ? toMinutes(t.time) : 0;
        // A trade appears once it has closed.
        if (m + t.duration <= cutoff.minutes) trades.push(t);
      }
    }
  }

  const balanceAdjustments: BalanceAdjustment[] = p.payouts
    .filter((po) => po.date <= last)
    .map((po, i) => ({
      id: `demo-adj-${p.id}-${i + 1}`,
      date: po.date,
      amount: -po.amount,
      type: 'payout',
      description: po.description,
      createdAt: `${po.date}T21:00:00.000Z`,
    }));

  const tradePnL = trades.reduce((n, t) => n + t.netPL, 0);
  const adj = balanceAdjustments.reduce((n, a) => n + a.amount, 0);

  return {
    id: p.id,
    name: p.name,
    broker: p.broker,
    balance: round2(tradePnL + adj),
    lastUpdate: trades.at(-1)?.date ?? null,
    type: 'demo',
    status: p.status,
    trades,
    createdAt: `${p.start}T13:00:00.000Z`,
    importHistory: [],
    balanceAdjustments,
    isFunded: p.isFunded,
    profitTarget: p.profitTarget,
    startingBalance: p.startingBalance,
    consistencyRulePercentage: 40,
  };
}

function toMinutes(t: string) {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return 0;
  let h = +m[1] % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + +m[2];
}

/** All sample accounts, with trades up to `cutoff`. */
export function buildDemoAccounts(cutoff: DemoCutoff = DEMO_SNAPSHOT): Account[] {
  return PROFILES.map((p) => buildAccount(p, cutoff));
}

export const isDemoAccount = (a: Pick<Account, 'type'>) => a.type === 'demo';

// Settings a trader may have changed on a sample account; these survive a refresh.
const USER_KEYS = [
  'pilotSettings',
  'riskSnapshot',
  'profitTarget',
  'pacingPreference',
  'customDailyPace',
  'dailyFocus',
  'consistencyRulePercentage',
  'consistencyBasis',
  'accountTier',
  'liquidationRules',
  'personalDailyLimit',
] as const;

/**
 * True when a sample account carries anything the trader put there themselves —
 * a setting from USER_KEYS, a recorded payout, or a note, tag or Pilot review on
 * a trade. Callers use this to decide whether saved samples are worth carrying
 * forward; rebuilding from scratch throws all of it away.
 */
export function hasTraderEdits(account: Account): boolean {
  if (USER_KEYS.some((key) => account[key] !== undefined)) return true;
  if (account.balanceAdjustments?.length) return true;
  return account.trades.some((t) => t.pilotReview || t.notes || t.tags?.length);
}

/**
 * Regenerate the sample accounts up to `cutoff` while keeping the trader's own work on them:
 * Pilot reviews, trade notes and tags, settings, and any payouts they recorded themselves.
 * Real accounts are returned untouched and listed first.
 */
export function refreshDemoAccounts(current: Account[], cutoff: DemoCutoff = nowCutoff()): Account[] {
  const previous = new Map(current.filter(isDemoAccount).map((a) => [a.id, a]));
  const demos = buildDemoAccounts(cutoff).map((fresh) => {
    const old = previous.get(fresh.id);
    if (!old) return fresh;
    const oldTrades = new Map(old.trades.map((t) => [t.id, t]));
    const trades = fresh.trades.map((t) => {
      const o = oldTrades.get(t.id);
      return o ? { ...t, pilotReview: o.pilotReview, notes: o.notes, tags: o.tags } : t;
    });
    const userAdjustments = (old.balanceAdjustments ?? []).filter((a) => !a.id.startsWith('demo-adj-'));
    const balanceAdjustments = [...(fresh.balanceAdjustments ?? []), ...userAdjustments];
    const kept = Object.fromEntries(USER_KEYS.filter((k) => old[k] !== undefined).map((k) => [k, old[k]]));
    const balance = round2(trades.reduce((n, t) => n + t.netPL, 0) + balanceAdjustments.reduce((n, a) => n + a.amount, 0));
    return { ...fresh, ...kept, trades, balanceAdjustments, balance };
  });
  return [...current.filter((a) => !isDemoAccount(a)), ...demos];
}
