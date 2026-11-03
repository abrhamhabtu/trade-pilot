// ─── Vision · edge verdict ─────────────────────────────────────────────────────
// Reads a finished backtest the way a risk manager would: is the expectancy
// distinguishable from luck, did it hold in both halves of the period, which
// months carried it, how deep a drawdown should be expected, and what to fix
// before sizing up. Everything here is computed from the trades; no model.
// ───────────────────────────────────────────────────────────────────────────────

import type { BacktestResult } from "./backtest";

export interface Verdict {
  grade: "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C" | "D" | "F" | "—";
  score: number;
  title: string;
  body: string;
  fixes: string[];
  robust: {
    /** Expectancy in R divided by its standard error. */
    tStat: number;
    firstHalfR: number;
    secondHalfR: number;
    greenMonths: number;
    months: number;
    /** Share of the net profit from the best two months. */
    carry: number;
    /** Bootstrap of the trades: 5th / 50th / 95th percentile of the final P&L and the 95th of max drawdown. */
    p5: number;
    p50: number;
    p95: number;
    dd95: number;
    pLoss: number;
  };
}

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const monthName = (k: string) => new Date(`${k}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const slotName = (k: string) => {
  const [h, m] = k.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function verdict(r: BacktestResult): Verdict {
  const s = r.stats;
  const t = r.trades;
  const n = t.length;
  const rs = t.map((x) => x.r);
  const mean = n ? rs.reduce((a, b) => a + b, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const tStat = sd ? mean / (sd / Math.sqrt(n)) : 0;
  const half = Math.floor(n / 2);
  const firstHalfR = half ? t.slice(0, half).reduce((a, x) => a + x.r, 0) / half : 0;
  const secondHalfR = n - half ? t.slice(half).reduce((a, x) => a + x.r, 0) / (n - half) : 0;
  const months = r.by.month;
  const green = months.filter((m) => m.pnl > 0);
  const top2 = [...months].sort((a, b) => b.pnl - a.pnl).slice(0, 2);
  const carry = s.pnl > 0 ? Math.min(1, top2.reduce((a, m) => a + Math.max(0, m.pnl), 0) / s.pnl) : 0;

  // Bootstrap: draw the same number of trades with replacement.
  const rand = rng(n * 7919 + 13);
  const ends: number[] = [];
  const dds: number[] = [];
  const pn = t.map((x) => x.pnl);
  for (let k = 0; k < (n ? 600 : 0); k++) {
    let eq = 0;
    let peak = 0;
    let dd = 0;
    for (let j = 0; j < n; j++) {
      eq += pn[Math.floor(rand() * n)];
      peak = Math.max(peak, eq);
      dd = Math.max(dd, peak - eq);
    }
    ends.push(eq);
    dds.push(dd);
  }
  ends.sort((a, b) => a - b);
  dds.sort((a, b) => a - b);
  const q = (xs: number[], p: number) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor(p * xs.length))] : 0);
  const robust = { tStat, firstHalfR, secondHalfR, greenMonths: green.length, months: months.length, carry, p5: q(ends, 0.05), p50: q(ends, 0.5), p95: q(ends, 0.95), dd95: q(dds, 0.95), pLoss: ends.length ? ends.filter((x) => x < 0).length / ends.length : 0 };

  if (n < 20)
    return {
      grade: "—",
      score: 0,
      title: n ? "Too few trades to call." : "No trades to judge.",
      body: n ? `${n} trade${n === 1 ? "" : "s"} is not enough to tell an edge from luck. Widen the period, loosen a filter or drop to a faster timeframe until there are at least 30.` : "Nothing fired in this period. Try a longer period, another session or a different strategy.",
      fixes: [],
      robust,
    };

  // ── Score out of 100 ──
  const pf = Math.min(s.profitFactor, 3);
  let score = 0;
  score += Math.max(0, Math.min(35, tStat * 12)); // is it luck?
  score += Math.max(0, Math.min(20, (pf - 1) * 40)); // how much edge
  score += firstHalfR > 0 && secondHalfR > 0 ? 15 : firstHalfR > 0 || secondHalfR > 0 ? 5 : 0; // did it hold
  score += months.length ? (green.length / months.length) * 15 : 0; // consistency
  score += Math.max(0, 10 - s.maxDrawdownPct * 50); // survivable
  score += Math.min(5, n / 40); // sample
  if (s.pnl <= 0) score = Math.min(score, 30);
  score = Math.round(Math.max(0, Math.min(100, score)));
  const grade: Verdict["grade"] = score >= 90 ? "A+" : score >= 82 ? "A" : score >= 75 ? "A-" : score >= 68 ? "B+" : score >= 60 ? "B" : score >= 52 ? "B-" : score >= 40 ? "C" : score >= 28 ? "D" : "F";

  const title =
    s.pnl <= 0
      ? s.profitFactor > 0.9
        ? "No edge yet. It breaks even before costs at best."
        : "No edge here. The losses are structural."
      : tStat >= 2 && s.profitFactor >= 1.3 && firstHalfR > 0 && secondHalfR > 0
        ? "A real edge, and it held up across the period."
        : tStat >= 1.5 && firstHalfR > 0 && secondHalfR > 0
          ? "Profitable, and consistent enough to take seriously."
          : s.profitFactor < 1.25
            ? "Marginally profitable. The edge is real, but thin."
            : "Profitable, but it could still be a hot stretch.";

  // ── The written read ──
  const parts: string[] = [];
  if (s.payoff >= 1.3 && s.winRate < 0.5) parts.push(`You're winning on size, not accuracy: the average win (${usd(s.avgWin)}) is ${s.payoff.toFixed(2)}× the average loss (${usd(-s.avgLoss)}).`);
  else if (s.winRate >= 0.55) parts.push(`You're winning on accuracy: ${Math.round(s.winRate * 100)}% of trades work, with wins ${s.payoff.toFixed(2)}× the size of losses.`);
  else parts.push(`${Math.round(s.winRate * 100)}% win rate with wins ${s.payoff.toFixed(2)}× losses gives ${mean >= 0 ? "+" : ""}${mean.toFixed(2)}R a trade.`);
  if (months.length >= 3) {
    const red = months.filter((m) => m.pnl < 0);
    if (s.pnl > 0 && carry > 0.6 && months.length > 3) parts.push(`${top2.map((m) => monthName(m.key).split(" ")[0]).join(" and ")} carried ${Math.round(carry * 100)}% of the profit, so the rest of the period was close to flat.`);
    else if (red.length === 1) parts.push(`${monthName(red[0].key)} was the only down month.`);
    else parts.push(`${green.length} of ${months.length} months were green.`);
  }
  if (firstHalfR > 0 !== secondHalfR > 0) parts.push(`It made ${firstHalfR > secondHalfR ? "its money early and faded" : "nothing early and only worked later"} (${firstHalfR.toFixed(2)}R vs ${secondHalfR.toFixed(2)}R a trade by half), which is what a regime change looks like.`);
  if (s.longestLosing >= 6) parts.push(`A ${s.longestLosing}-loss streak is in here, so discipline and size matter more than the average suggests.`);
  if (tStat < 1.5 && s.pnl > 0) parts.push(`The expectancy is ${tStat.toFixed(1)} standard errors from zero; a run this good happens by chance more often than you'd like.`);

  // ── What to fix before sizing up ──
  const fixes: string[] = [];
  const longs = r.by.side.find((g) => g.key === "Long");
  const shorts = r.by.side.find((g) => g.key === "Short");
  if (longs && shorts && longs.n >= 10 && shorts.n >= 10) {
    if (shorts.pnl < 0 && longs.pnl > 0) fixes.push(`Shorts lost ${usd(shorts.pnl)} over ${shorts.n} trades while longs made ${usd(longs.pnl)}. Test longs only.`);
    else if (longs.pnl < 0 && shorts.pnl > 0) fixes.push(`Longs lost ${usd(longs.pnl)} over ${longs.n} trades while shorts made ${usd(shorts.pnl)}. Test shorts only.`);
  }
  const slots = r.by.slot.filter((g) => g.n >= Math.max(5, n * 0.05));
  const worst = slots.reduce<(typeof slots)[number] | null>((a, g) => (!a || g.pnl < a.pnl ? g : a), null);
  if (worst && worst.pnl < 0 && worst.pnl < -0.15 * Math.abs(s.pnl || 1)) fixes.push(`Entries from ${slotName(worst.key)} lost ${usd(worst.pnl)} over ${worst.n} trades. Narrow the session to skip them.`);
  const vix = r.by.vix.filter((g) => g.n >= 10 && g.key !== "No VIX data");
  const badVix = vix.find((g) => g.pnl < -0.1 * Math.abs(s.pnl || 1) && vix.some((o) => o.pnl > 0));
  if (badVix) fixes.push(`${badVix.key} days lost ${usd(badVix.pnl)}. Set the VIX filter to skip them.`);
  const fomcDays = r.by.fomc.find((g) => g.key === "FOMC days");
  if (fomcDays && fomcDays.n >= 5 && fomcDays.pnl < 0) fixes.push(`FOMC days lost ${usd(fomcDays.pnl)}. Turn on Skip FOMC days.`);
  if (s.avgMfe > 1.5 && s.avgWinR < s.avgMfe * 0.6) fixes.push(`Trades ran to +${s.avgMfe.toFixed(1)}R on average before exit; a wider target or a break-even stop may keep more of it.`);
  if (s.maxDrawdownPct > 0.1) fixes.push(`Expect drawdowns near ${usd(robust.dd95)} (95th percentile by resampling). Size so that fits inside your account's limit.`);

  return { grade, score, title, body: parts.join(" "), fixes: fixes.slice(0, 4), robust };
}
