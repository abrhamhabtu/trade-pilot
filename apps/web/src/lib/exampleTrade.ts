// ─── Example trades ────────────────────────────────────────────────────────────
// A playbook's worked examples are written as prose: "Long 19,860. Stop 20 pts
// below zone → 19,825. Target ~20,000." This reads the three prices out of that
// prose so the example can be drawn to scale, with its real risk and reward.
//
// It only ever reports what the text says. When the prices cannot be read with
// confidence (an account-sizing walkthrough, an options spread) it returns null
// and the example is shown as words, not as a chart that was made up.
// ───────────────────────────────────────────────────────────────────────────────

export interface ExampleText {
  title: string;
  description: string;
  setup: string;
  entry: string;
  exit: string;
  result: string;
}

export type Outcome = 'win' | 'loss' | 'plan';

export interface ExampleTrade {
  direction: 'long' | 'short';
  entry: number;
  stop: number;
  target: number;
  /** True when the text gave no target and it was placed at the playbook's R multiple. */
  targetAssumed: boolean;
  /** Reward ÷ risk, from the prices. */
  r: number;
  risk: number;
  reward: number;
  symbol: string | null;
  /** Decimal places the source wrote its prices with. */
  decimals: number;
  /** How a distance reads: FX in pips, stocks in dollars, futures in points. */
  unit: 'pts' | 'pips' | '$';
  /** Multiply a price distance by this to get it in `unit`. */
  unitFactor: number;
  outcome: Outcome;
}

// A price is a comma-grouped number, a decimal, or a bare run of 3+ digits. Small
// integers ("5m", "20 pts", "+40") are never prices.
const PRICE = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d{3,}`;
// Percentages, distances and sizes are not chart prices.
const NOT_AFTER = String.raw`(?!\s*(?:%|pts?\b|points?\b|pips?\b|ticks?\b|R\b|x\b|k\b|K\b|-point|-pip|-tick))`;
const price = (after: string) => new RegExp(String.raw`${after}(?<![\d,.])(${PRICE})${NOT_AFTER}(?!\d|,\d)`, 'i');

const num = (s: string) => Number(s.replace(/,/g, ''));
const decimalsOf = (s: string) => (s.includes('.') ? s.split('.')[1].length : 0);

function find(text: string, lead: string): string | null {
  const m = price(lead).exec(text);
  return m ? m[1] : null;
}

const SYMBOL = /\b(MNQ|MES|MYM|M2K|MGC|MCL|NQ|ES|YM|RTY|GC|CL|SPY|QQQ|SPX|[A-Z]{3}(?:USD|JPY|GBP|EUR|CHF|CAD|AUD))\b/;

export function outcomeOf(result: string): Outcome {
  if (/\b(loss|lost|stopped out|stop hit|scratch|-\s?1R)\b/i.test(result) && !/no loss/i.test(result)) return 'loss';
  if (/illustrative|typical|pays|plan/i.test(result) && !/\+\s?[\d$]/.test(result)) return 'plan';
  if (/\+\s?[\d$]|profit|win|base hit|target hit/i.test(result)) return 'win';
  return 'plan';
}

/** The trade an example describes, or null when its prose does not pin one down. */
export function parseExampleTrade(ex: ExampleText, fallbackR: number): ExampleTrade | null {
  const all = `${ex.setup} ${ex.entry} ${ex.exit}`;
  const side = /\b(long|buy|bought|calls?)\b/i.test(ex.entry) ? 'long' : /\b(short|sell|sold|puts?)\b/i.test(ex.entry) ? 'short' : null;

  // Entry: the price that follows the side word, else the first price in the entry line.
  const entryRaw = find(ex.entry, String.raw`\b(?:long|short|buy|sell|enter(?:ed)?|entry)\b[^.;]*?`) ?? find(ex.entry, '');
  const stopRaw = find(`${ex.entry} ${ex.exit}`, String.raw`\bstop\b[^.;]*?`);
  const targetRaw = find(`${ex.exit} ${ex.entry}`, String.raw`\b(?:target|tp|take profit|exit at|cover at)\b[^.;]*?`);
  // Without a stated side and a stated stop there is no trade to draw, only numbers.
  if (!side || !entryRaw || !stopRaw) return null;

  const entry = num(entryRaw);
  const stop = num(stopRaw);
  if (!(entry > 0) || !(stop > 0) || entry === stop) return null;

  const direction = side;
  const dir = direction === 'long' ? 1 : -1;
  const risk = (entry - stop) * dir;
  // A stop on the wrong side of the entry, or further than a fifth of the price away, was misread.
  if (!(risk > 0) || risk / entry > 0.2) return null;

  let target = targetRaw ? num(targetRaw) : NaN;
  let targetAssumed = false;
  const reward = (target - entry) * dir;
  if (!Number.isFinite(target) || !(reward > 0) || reward / entry > 0.5) {
    if (!(fallbackR > 0)) return null;
    target = entry + dir * risk * fallbackR;
    targetAssumed = true;
  }

  const decimals = Math.max(decimalsOf(entryRaw), decimalsOf(stopRaw), targetRaw && !targetAssumed ? decimalsOf(targetRaw) : 0);
  const symbol = SYMBOL.exec(`${ex.title} ${ex.description} ${all}`)?.[1] ?? null;
  const fx = !!symbol && /^[A-Z]{6}$/.test(symbol);
  const dollars = new RegExp(String.raw`\$\s?${entryRaw.replace('.', String.raw`\.`)}`).test(ex.entry);
  return {
    direction,
    entry,
    stop,
    target,
    targetAssumed,
    risk,
    reward: (target - entry) * dir,
    r: ((target - entry) * dir) / risk,
    symbol,
    decimals,
    unit: fx ? 'pips' : dollars ? '$' : 'pts',
    unitFactor: fx ? (symbol!.endsWith('JPY') ? 100 : 10_000) : 1,
    outcome: outcomeOf(ex.result),
  };
}

export interface Candle {
  open: number;
  close: number;
  high: number;
  low: number;
}

// Price paths in R multiples from the entry (0 = entry, −1 = stop), drawn for a
// long and mirrored for a short. Only the three marked prices are real; the path
// between them is a plausible one, and the UI says so.
const APPROACH = [1.45, 1.2, 1.38, 1.02, 0.8, 0.96, 0.55, 0.3, 0.48, 0.06, -0.38, -0.22];
const RUN = [0.1, 0.04, 0.2, 0.33, 0.26, 0.46, 0.6, 0.52, 0.72, 0.84, 0.77, 0.94, 1];
const FAIL = [0.3, 0.46, 0.18, 0.27, -0.18, -0.44, -0.3, -0.72, -1];

/** Index of the candle that closes at the entry price. */
export const ENTRY_INDEX = APPROACH.length;

/** Deterministic candles through the example's entry, ending at its target or its stop. */
export function exampleCandles(t: ExampleTrade): Candle[] {
  const dir = t.direction === 'long' ? 1 : -1;
  const lost = t.outcome === 'loss';
  const after = lost ? FAIL : RUN.map((p, i) => (i === 1 ? -0.26 : p * t.r));
  const closes = [...APPROACH, 0, ...after];
  const at = (u: number) => t.entry + dir * u * t.risk;
  // Wicks stay inside the stop on a winner: the trade is never shown surviving a breach.
  const floor = lost ? -1 : -0.62;
  return closes.map((c, i) => {
    const o = i ? closes[i - 1] : c + 0.22;
    const wick = 0.07 + ((i * 7) % 5) * 0.035;
    const hi = Math.max(o, c) + wick;
    const lo = Math.max(floor, Math.min(o, c) - wick * (i % 2 ? 1.4 : 0.8));
    const [high, low] = dir === 1 ? [at(hi), at(lo)] : [at(lo), at(hi)];
    return { open: at(o), close: at(c), high, low };
  });
}
