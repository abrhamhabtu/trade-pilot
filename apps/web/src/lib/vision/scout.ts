// ─── Vision · strategy scout ───────────────────────────────────────────────────
// Ideas from papers and trading books, written as rules the backtest can run.
// None is recommended for where it came from: each is judged on the newest 30%
// of the data, which played no part in anything, and most are expected to fail.
// Weekly research can add to the list through scout-candidates.json.
// ───────────────────────────────────────────────────────────────────────────────

import { PROP_FIRMS } from "@/components/payout/propFirmData";
import type { FirmProgram } from "@/lib/proving/firms";
import { rollingOdds, toUnitDays, type Pricing, type SizingPlan, type UnitTrade } from "./lab";
import { firmExtras } from "./economics";

export { SCOUT_CATALOG, type ScoutCandidate } from "./scout-catalog";
import type { ScoutCandidate } from "./scout-catalog";

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
