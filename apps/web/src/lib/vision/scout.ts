// ─── Vision · strategy scout ───────────────────────────────────────────────────
// Ideas from papers and trading books, written as rules the backtest can run.
// None is recommended for where it came from: each is judged on the newest 30%
// of the data, which played no part in anything, and most are expected to fail.
// Weekly research can add to the list through scout-candidates.json.
// ───────────────────────────────────────────────────────────────────────────────

import { PROP_FIRMS } from "@/components/payout/propFirmData";
import type { FirmProgram } from "@/lib/proving/firms";
import type { CustomRules } from "./custom";
import { rollingOdds, toUnitDays, type Pricing, type SizingPlan, type UnitTrade } from "./lab";
import { firmExtras } from "./economics";

export interface ScoutCandidate {
  id: string;
  name: string;
  idea: string;
  source: string;
  url?: string;
  tf: "5m" | "15m";
  rules: CustomRules;
}

const base: Omit<CustomRules, "entry"> = { side: "both", stop: { kind: "atr", mult: 1.5, len: 14 }, target: { kind: "r", r: 2 }, trend: "none", session: "ny", maxPerDay: null, breakEvenR: null };

export const SCOUT_CATALOG: ScoutCandidate[] = [
  { id: "intraday-momentum", name: "Last half hour momentum", idea: "When the first half hour of the session is up, buy into the close at 3:30; when down, sell. Late-day flows tend to follow the morning.", source: "Gao, Han, Li and Zhou, Market Intraday Momentum, Journal of Financial Economics, 2018", url: "https://ideas.repec.org/a/eee/jfinec/v129y2018i2p394-414.html", tf: "5m", rules: { ...base, entry: { kind: "last_half", signal: "first30" }, session: null, target: { kind: "r", r: 3 } } },
  { id: "overnight-momentum", name: "Overnight into the close", idea: "The overnight move, not the first half hour, sets the last half hour's direction. Found where the first half hour didn't work.", source: "Liu and Tse, on S&P ETFs and 12 index futures, 2017, as cited in Jin et al., Journal of Futures Markets, 2020", url: "https://ideas.repec.org/a/wly/jfutmk/v40y2020i4p632-650.html", tf: "5m", rules: { ...base, entry: { kind: "last_half", signal: "overnight" }, session: null, target: { kind: "r", r: 3 } } },
  { id: "nr7-orb", name: "Narrow day breakout", idea: "After the narrowest session in seven, range tends to expand. Take the opening range breakout only then.", source: "Toby Crabel, Day Trading with Short Term Price Patterns and Opening Range Breakout, 1990", tf: "5m", rules: { ...base, entry: { kind: "narrow_orb", minutes: 30, lookback: 7 }, maxPerDay: 1 } },
  { id: "nr4-orb", name: "Short narrow day breakout", idea: "The same contraction idea over four sessions: more trades, a weaker signal.", source: "Toby Crabel, 1990", tf: "15m", rules: { ...base, entry: { kind: "narrow_orb", minutes: 30, lookback: 4 }, maxPerDay: 1 } },
  { id: "inside-orb", name: "Inside day breakout", idea: "A session inside the one before it is compression. Crabel expected trend days after them.", source: "Toby Crabel, 1990", tf: "5m", rules: { ...base, entry: { kind: "inside_orb", minutes: 30 }, maxPerDay: 1 } },
  { id: "orb-30", name: "30-minute opening range", idea: "The plain version as a benchmark: first close beyond the first 30 minutes' range.", source: "Toby Crabel, 1990", url: "https://ungeracademy.com/?p=7020", tf: "5m", rules: { ...base, entry: { kind: "orb", minutes: 30 }, maxPerDay: 1 } },
  { id: "orb-60-trend", name: "One-hour range with trend", idea: "A wider opening range, taken only with the 200 EMA, trades less and avoids early fakeouts.", source: "Common practitioner variation; no published evidence found", tf: "15m", rules: { ...base, entry: { kind: "orb", minutes: 60 }, trend: "ema200", maxPerDay: 1 } },
  { id: "gap-fade", name: "Opening gap fade", idea: "Overnight gaps often fill. When New York opens well away from yesterday's close, trade back toward it.", source: "Common practitioner idea; no published futures evidence found", tf: "5m", rules: { ...base, entry: { kind: "gap_fade", minGap: 0.5 }, stop: { kind: "plan" }, target: { kind: "plan" }, maxPerDay: 1 } },
  { id: "gap-fade-big", name: "Large gap fade", idea: "The same, only for larger gaps, where traders overreact most.", source: "Common practitioner idea; no published futures evidence found", tf: "5m", rules: { ...base, entry: { kind: "gap_fade", minGap: 1.5 }, stop: { kind: "plan" }, target: { kind: "plan" }, maxPerDay: 1 } },
  { id: "pd-sweep", name: "Prior day sweep and reclaim", idea: "Stops rest beyond yesterday's high and low. Price runs them, then closes back inside.", source: "Liquidity-sweep trading, popular on social media; no published evidence found", tf: "5m", rules: { ...base, entry: { kind: "pdhl_sweep" }, stop: { kind: "signal" }, maxPerDay: 2 } },
  { id: "pd-retest", name: "Prior day break and retest", idea: "Break yesterday's level, come back to test it, then go. Follows breakouts that hold.", source: "Common practitioner setup; no published evidence found", tf: "15m", rules: { ...base, entry: { kind: "pdhl_retest", bars: 12 }, maxPerDay: 1 } },
  { id: "fvg-trend", name: "Fair value gap with VWAP", idea: "Pullbacks into a fair value gap, only on the side of VWAP.", source: "ICT-style trading, popular on social media; no published evidence found", tf: "5m", rules: { ...base, entry: { kind: "fvg" }, trend: "vwap", stop: { kind: "signal" }, maxPerDay: 2 } },
  { id: "rsi2-trend", name: "RSI(2) dip in a trend", idea: "Short-term extremes against the 200 EMA tend to snap back. A daily idea tried intraday.", source: "Larry Connors' RSI(2), adapted here to intraday bars", tf: "15m", rules: { ...base, entry: { kind: "rsi", len: 2, low: 10, high: 90 }, trend: "ema200", target: { kind: "r", r: 1.5 }, maxPerDay: 2 } },
  { id: "ema-open", name: "EMA 9/21 in the morning", idea: "A fast cross during the first two hours, when trends tend to start.", source: "Common retail setup; no published evidence found", tf: "5m", rules: { ...base, entry: { kind: "ema_cross", fast: 9, slow: 21 }, session: "open", maxPerDay: 2 } },
  { id: "bos-vwap", name: "Break of structure with VWAP", idea: "A close through the last swing, only with VWAP behind it.", source: "Smart-money-concepts trading; no published evidence found", tf: "5m", rules: { ...base, entry: { kind: "structure" }, trend: "vwap", stop: { kind: "swing", bars: 10 }, maxPerDay: 2 } },
];

export interface ScoutSide {
  trades: number;
  avgR: number;
  winRate: number;
  t: number;
}

export interface ScoutResult {
  id: string;
  candidate: string;
  name: string;
  idea: string;
  source: string;
  url?: string;
  symbol: string;
  tf: string;
  dataTo: string;
  older: ScoutSide;
  newer: ScoutSide;
  /** Share of calendar years that made money. */
  greenYears: number;
  /** Pass rate on the newer data at a reference account, and a no-edge trader's. */
  passRate: number;
  coin: number;
  verdict: "recommended" | "watch" | "rejected";
  reason: string;
}

const sideOf = (ts: UnitTrade[]): ScoutSide => {
  const rs = ts.map((t) => (t.risk ? t.points / t.risk : 0));
  const n = Math.max(1, rs.length);
  const avg = rs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(rs.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, n - 1)) || 1;
  return { trades: rs.length, avgR: avg, winRate: rs.filter((r) => r > 0).length / n, t: (avg / sd) * Math.sqrt(n) };
};

/**
 * The bar is deliberately high, since this tests many ideas at once: positive on
 * old and new data alike, a t-stat over 2 on the new data, most years green, and a
 * pass rate above a no-edge trader's on data it never saw.
 */
export function judge(c: ScoutCandidate, symbol: string, trades: UnitTrade[], reference: FirmProgram, price: Pricing, coin: number, dataTo: string): ScoutResult {
  const sorted = [...trades].sort((a, b) => a.entryT - b.entryT);
  const cut = Math.floor(sorted.length * 0.7);
  const older = sideOf(sorted.slice(0, cut));
  const newer = sideOf(sorted.slice(cut));
  const years = new Map<string, number>();
  for (const t of sorted) years.set(t.session.slice(0, 4), (years.get(t.session.slice(0, 4)) ?? 0) + (t.risk ? t.points / t.risk : 0));
  const greenYears = years.size ? [...years.values()].filter((v) => v > 0).length / years.size : 0;
  const days = toUnitDays(sorted);
  const split = days.findIndex((d) => d.date >= (sorted[cut]?.session ?? "9999"));
  const plan: SizingPlan = { kind: "room", amount: 0.12, dayStop: 0.4, dayCap: reference.consistencyPct < 100, coast: true };
  const passRate = split >= 0 ? rollingOdds(days, reference, plan, price, { lo: split, hi: days.length, cap: 50 }).passRate : 0;
  let verdict: ScoutResult["verdict"] = "rejected";
  let reason: string;
  if (sorted.length < 200) reason = `Only ${sorted.length} trades in 16 years, too few to judge.`;
  else if (newer.avgR <= 0) reason = `Loses on the newest data: ${newer.avgR.toFixed(3)}R a trade over ${newer.trades} trades.`;
  else if (older.avgR <= 0) reason = `Positive lately, but negative in the ${older.trades} trades before that. Likely a recent fluke.`;
  else if (newer.t < 2) {
    reason = `Positive on old and new data, but not clearly different from luck (t-stat ${newer.t.toFixed(1)} on the newest trades; it needs 2).`;
    verdict = "watch";
  } else if (greenYears < 0.6) {
    reason = `Only ${Math.round(greenYears * 100)}% of years were green. It depends on a few good stretches.`;
    verdict = "watch";
  } else if (passRate <= coin) {
    reason = `A real edge per trade, but it passes ${Math.round(passRate * 100)}% at the reference account against ${Math.round(coin * 100)}% with no edge. Too slow or too bumpy for evaluation rules.`;
    verdict = "watch";
  } else {
    reason = `Held up on data it never saw: ${newer.avgR >= 0 ? "+" : ""}${newer.avgR.toFixed(3)}R a trade, t-stat ${newer.t.toFixed(1)}, ${Math.round(greenYears * 100)}% of years green, ${Math.round(passRate * 100)}% pass rate.`;
    verdict = "recommended";
  }
  return { id: `${c.id}@${symbol}`, candidate: c.id, name: c.name, idea: c.idea, source: c.source, url: c.url, symbol, tf: c.tf, dataTo, older, newer, greenYears, passRate, coin, verdict, reason };
}

// ── Firm rule check ────────────────────────────────────────────────────────────

export interface RuleCheck {
  id: string;
  firm: string;
  program: string;
  updated: string;
  ageDays: number;
  verified: boolean;
  url: string;
  status: "fresh" | "aging" | "stale" | "unverified";
  issues: string[];
}

// Where outside sources disagreed with these rules when last researched (Nov 2026).
const DISPUTES: Record<string, string[]> = {
  topstep: ["Since Feb 2026, third-party guides describe two funded payout paths, with different consistency and caps than a single rule.", "Guides disagree on the activation fee and on a no-activation-fee price."],
  "lucid-pro": ["Guides list consistency at both 35% and 40%, and disagree on whether the drawdown updates live or at the close."],
  "lucid-flex": ["Guides disagree on whether there is a 50% rule at all, and list a $2,000 or $2,500 funded drawdown at 50K."],
};

export function firmRuleCheck(now: number): RuleCheck[] {
  return PROP_FIRMS.filter((f) => f.id !== "custom").map((f) => {
    const ageDays = Math.floor((now - Date.parse(`${f.rulesUpdated}T12:00:00Z`)) / 86_400_000);
    const issues = [...(DISPUTES[f.id] ?? [])];
    const extras = firmExtras({ firmId: f.id, model: f.payoutModel });
    if (extras.activation == null) issues.push("Activation fee unknown here: costs may be understated.");
    if (!f.verified) issues.push("Core rules were never confirmed from the firm's own documents.");
    return { id: f.id, firm: f.name, program: f.program, updated: f.rulesUpdated, ageDays, verified: f.verified, url: f.sourceUrl, status: !f.verified ? "unverified" : ageDays > 120 ? "stale" : ageDays > 45 ? "aging" : "fresh", issues };
  });
}
