// ─── Vision · quick bar ────────────────────────────────────────────────────────
// One line to a backtest: "nq 5m orb ny open 1y 50k lucid 2 micros". Settings
// are recognised by phrase, deterministic like parseRules; whatever is left is
// read as the strategy in plain words. Nothing is dropped silently: every word
// that changed nothing is listed back.
// ───────────────────────────────────────────────────────────────────────────────

import { READERS, type PatternId, type ReaderId } from "./analyze";
import { parseRules, type SessionKey } from "./custom";
import { PATTERNS } from "./patterns";
import type { BacktestSettings } from "@/store/visionStore";
import type { Timeframe } from "./markets";

export interface QuickFirm {
  key: string;
  firm: string;
  size: number;
}

export interface Quick {
  patch: Partial<BacktestSettings>;
  /** What was understood, as chips. */
  used: string[];
  /** Words that changed nothing. */
  unknown: string[];
}

type Rule = { re: RegExp; take: (m: RegExpMatchArray, q: Quick, ctx: { firms: QuickFirm[] }) => void };

const SYMBOL: [RegExp, string, string][] = [
  [/\b(m?nq|nasdaq|nas100|ndx)\b/, "NQ", "Nasdaq (NQ)"],
  [/\b(m?es|s&p(?: ?500)?|spx|spy)\b/, "ES", "S&P 500 (ES)"],
  [/\b(m?gc|gold|xau)\b/, "GC", "Gold (GC)"],
  [/\b(m?cl|crude|oil|wti)\b/, "CL", "Crude (CL)"],
  [/\b(btc|bitcoin)\b/, "BTC", "Bitcoin"],
  [/\b(eth|ethereum)\b/, "ETH", "Ethereum"],
  [/\b(sol|solana)\b/, "SOL", "Solana"],
  [/\bxrp\b/, "XRP", "XRP"],
];

const READER_WORDS: [RegExp, ReaderId][] = [
  [/\b(double[- ]?break(?: vwap)?|db[- ]?vwap|dbvwap)\b/, "dbvwap"],
  [/\b(s&d|sd|s and d|supply (?:and|&) demand|octavia|demand zone|supply zone)\b/, "sd"],
  [/\bvwap ?(?:trend )?pull ?back|vwap ?pb\b/, "vwappb"],
  [/\b(?:liquidity )?sweep reader\b|\bmy sweep\b|\bliquidity sweep\b/, "sweep"],
  [/\b(orb|opening range(?: breakout)?)\b/, "orb"],
];
const PATTERN_WORDS: [RegExp, PatternId][] = [
  [/\basia(?:n)? (?:range )?sweep\b/, "asia_sweep"],
  [/\b(?:overnight|on) (?:high |low )?sweep\b/, "on_sweep"],
  [/\b(?:prior day|pd|pdh|pdl) sweep\b/, "pd_sweep"],
  [/\b(?:orb|opening range) fail(?:ed|ure)?\b|\bfailed (?:orb|opening range(?: break)?)\b/, "orb_fail"],
  [/\b(?:ib|initial balance) break(?:out)?\b/, "ib_break"],
  [/\bvwap band(?:s| reversion)?\b|\bband reversion\b/, "vwap_band"],
  [/\b(?:fvg|fair value gap)(?: continuation)?\b/, "fvg_cont"],
  [/\b(?:bos|break of structure)(?: (?:and )?retest)?\b/, "bos_retest"],
  [/\b(?:squeeze|compression(?: breakout)?)\b/, "squeeze"],
];

const SESSIONS: [RegExp, SessionKey, string][] = [
  [/\b(?:ny|new york) open\b|\bthe open\b|\bopen\b/, "open", "NY open"],
  [/\b(?:ny|new york|rth|cash session)\b/, "ny", "New York"],
  [/\b(?:asia|asian|tokyo)\b/, "asia", "Asia"],
  [/\b(?:london|europe)\b/, "london", "London"],
  [/\b(?:all day|24h|around the clock|entire day)\b/, "all", "Entire day"],
];

const RULES: Rule[] = [
  // Patterns before readers: "orb fail" is not "orb".
  ...PATTERN_WORDS.map<Rule>(([re, id]) => ({
    re,
    take: (_m, q) => {
      q.patch.logic = "custom";
      q.patch.rules = { side: "both", stop: { kind: "plan" }, target: { kind: "plan" }, trend: "none", session: null, maxPerDay: null, breakEvenR: null, entry: { kind: "pattern", pattern: id } };
      q.patch.text = `${PATTERNS[id].label}.`;
      q.used.push(PATTERNS[id].label);
    },
  })),
  ...READER_WORDS.map<Rule>(([re, id]) => ({
    re,
    take: (_m, q) => {
      if (q.patch.logic === "custom" && q.patch.rules) return;
      q.patch.logic = "vision";
      q.patch.reader = id;
      q.used.push(READERS[id].label);
    },
  })),
  ...SYMBOL.map<Rule>(([re, id, label]) => ({
    re,
    take: (m, q) => {
      if (q.patch.symbol) return;
      q.patch.symbol = id;
      if (/^m(nq|es|gc|cl)$/.test(m[0])) q.patch.micro = true;
      q.used.push(label);
    },
  })),
  {
    re: /\b(1|5|15)\s?(?:m|min|mins|minute|minutes)\b|\b(1|4)\s?(?:h|hr|hour|hours)\b/,
    take: (m, q) => {
      const tf = (m[1] ? `${m[1]}m` : `${m[2]}h`) as Timeframe;
      q.patch.tf = tf;
      q.used.push(`${tf} bars`);
    },
  },
  ...SESSIONS.map<Rule>(([re, key, label]) => ({
    re,
    take: (_m, q) => {
      if (q.patch.session) return;
      q.patch.session = key;
      q.used.push(`${label} entries`);
    },
  })),
  {
    re: /\b(\d+)\s?(?:x\s)?(micros?|minis?|contracts?|mnq|mes|mgc|nq|es|gc)\b/,
    take: (m, q) => {
      const n = Math.max(1, Math.min(50, Number(m[1])));
      q.patch.contracts = n;
      q.patch.sizing = "fixed";
      if (/^(micro|mnq|mes|mgc)/.test(m[2])) q.patch.micro = true;
      else if (/^(mini|nq|es|gc)/.test(m[2])) q.patch.micro = false;
      q.used.push(`${n} ${q.patch.micro === false ? "mini" : q.patch.micro ? "micro" : "contract"}${n === 1 ? "" : "s"}`);
    },
  },
  {
    re: /\b(\d{4})-(\d{2})\b/,
    take: (m, q) => {
      const last = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
      q.patch.days = -1;
      q.patch.from = `${m[1]}-${m[2]}-01`;
      q.patch.to = `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}`;
      q.used.push(`${new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${m[1]}`);
    },
  },
  {
    re: /\b(20[0-3]\d)\b/,
    take: (m, q) => {
      q.patch.days = -1;
      q.patch.from = `${m[1]}-01-01`;
      q.patch.to = `${m[1]}-12-31`;
      q.used.push(`Year ${m[1]}`);
    },
  },
  {
    // The timeframe rule ran first and took 1m, 5m and 15m; any other "Nm" is months.
    re: /\b(\d+)\s?(d|days?|w|weeks?|mo|months?|m|y|yrs?|years?)\b(?!\s?(?:micro|mini|contract))/,
    take: (m, q) => {
      const n = Number(m[1]);
      const unit = m[2][0] === "d" ? 1 : m[2][0] === "w" ? 7 : m[2][0] === "m" ? 30.4 : 365;
      q.patch.days = Math.round(n * unit);
      q.used.push(`Last ${n}${unit === 1 ? " days" : unit === 7 ? " weeks" : unit === 365 ? (n === 1 ? " year" : " years") : " months"}`);
    },
  },
  {
    re: /\b(?:all|everything|all time|full history)\b/,
    take: (_m, q) => {
      q.patch.days = 0;
      q.used.push("All history");
    },
  },
  {
    re: /\b(\d+(?:\.\d+)?)\s?k\b/,
    take: (m, q) => {
      q.patch.balance = Math.round(Number(m[1]) * 1000);
      q.used.push(`$${m[1]}K account`);
    },
  },
  { re: /\b(?:longs? only|only longs?|long)\b/, take: (_m, q) => ((q.patch.side = "long"), q.used.push("Longs only")) },
  { re: /\b(?:shorts? only|only shorts?|short)\b/, take: (_m, q) => ((q.patch.side = "short"), q.used.push("Shorts only")) },
  {
    re: /\b(?:be|break[- ]?even)\s?(?:at\s)?(\d+(?:\.\d+)?)\s?r\b/,
    take: (m, q) => {
      q.patch.breakEvenR = Number(m[1]);
      q.used.push(`Break-even at ${m[1]}R`);
    },
  },
  {
    re: /\bmax\s?(\d+)\s?(?:\/|per|a)\s?day\b|\b(\d+)\s?(?:trades? )?(?:\/|per|a)\s?day\b/,
    take: (m, q) => {
      q.patch.maxPerDay = Number(m[1] ?? m[2]);
      q.used.push(`At most ${m[1] ?? m[2]} a day`);
    },
  },
];

/**
 * A line to Strategy test settings. `firms` are the prop programs to match
 * firm names against, at the account size the line names (50K when it names none).
 */
export function parseQuick(text: string, firms: QuickFirm[] = []): Quick {
  const q: Quick = { patch: {}, used: [], unknown: [] };
  let rest = ` ${text.toLowerCase().replace(/[’']/g, "'").replace(/[,;]+/g, " ").replace(/\s+/g, " ")} `;
  for (const rule of RULES) {
    // A rule may match more than once ("long" in "longs only" is one match): take the first, blank it out.
    const m = rest.match(rule.re);
    if (!m || m.index == null) continue;
    rule.take(m, q, { firms });
    rest = `${rest.slice(0, m.index)} ${rest.slice(m.index + m[0].length)}`;
  }
  // Firm names, at the size named (or 50K).
  const size = q.patch.balance ?? 50_000;
  for (const word of rest.trim().split(" ").filter(Boolean)) {
    if (word.length < 3) continue;
    const hit = firms.find((f) => f.size === size && f.firm.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(word.replace(/[^a-z0-9]/g, "")));
    if (!hit) continue;
    q.patch.prop = { on: true, program: hit.key };
    if (!q.patch.balance) q.patch.balance = hit.size;
    q.used.push(`${hit.firm} ${Math.round(hit.size / 1000)}K rules`);
    rest = rest.replace(new RegExp(`\\b${word.replace(/[^a-z0-9]/g, "")}\\b`), " ");
    break;
  }
  const left = rest.replace(/\s+/g, " ").trim();
  if (left) {
    // What's left may be a strategy in plain words.
    const r = parseRules(left);
    if (!q.patch.logic && r.used.some((u) => u.startsWith("Entry"))) {
      q.patch.logic = "custom";
      q.patch.rules = r.rules;
      q.patch.text = left;
      q.used.push(...r.used);
      q.unknown.push(...r.unknown);
    } else q.unknown.push(...left.split(" ").filter((w) => !/^(and|the|on|in|with|a|an|for|of|at|my|using|use|test|backtest|run)$/.test(w)));
  }
  return q;
}
