// ─── Vision · strategy doctor ──────────────────────────────────────────────────
// Two honest questions about a backtest. Does it beat a coin flip taking the same
// trades? And which changes help on older trades and still help on newer ones?
// A change is only offered if it does both, since nearly any filter looks good on
// the data it was chosen from.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import type { BacktestResult, BacktestTrade } from "./backtest";
import type { BacktestSettings } from "@/store/visionStore";

export interface CoinFlipReport {
  trades: number;
  actualR: number;
  /** Every trade taken the other way, at the same time and distances. */
  oppositeR: number;
  medianR: number;
  /** The range of totals 90% of random coin flips landed in. */
  low: number;
  high: number;
  /** Share of coin flips that this strategy beat. */
  beat: number;
  verdict: "better" | "maybe" | "same" | "worse";
  text: string;
}

const netR = (t: BacktestTrade) => (t.riskUsd ? t.pnl / t.riskUsd : t.r);

/**
 * Same entries, stops and targets, with the side decided by a coin. Each trade is
 * replayed the other way through the bars under the same fill rules, so all that
 * changes is the direction: the part a strategy claims to know.
 */
export function coinFlipTest(bars: Bar[], trades: BacktestTrade[], o: { slip: number; maxHold: number; runs?: number }): CoinFlipReport {
  const flipped = trades.map((t) => {
    const dir = t.side === "long" ? -1 : 1;
    const risk = Math.abs(t.entry - t.stop);
    const reward = Math.abs(t.target - t.entry);
    const stop = t.entry - dir * risk;
    const target = t.entry + dir * reward;
    const end = Math.min(bars.length - 1, t.entryIndex + o.maxHold);
    let exit = bars[end].c;
    for (let k = t.entryIndex + 1; k <= end; k++) {
      const b = bars[k];
      if (dir > 0 ? b.l <= stop : b.h >= stop) {
        exit = stop - dir * o.slip;
        break;
      }
      if (dir > 0 ? b.h >= target : b.l <= target) {
        exit = target;
        break;
      }
    }
    const gross = risk ? ((exit - t.entry) * dir) / risk : 0;
    // The same costs per R as the real trade paid.
    return gross - (t.r - netR(t));
  });
  const real = trades.map(netR);
  const actualR = real.reduce((a, b) => a + b, 0);
  const runs = o.runs ?? 1000;
  let seed = 7;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let x = seed;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const totals: number[] = [];
  for (let r = 0; r < runs; r++) {
    let sum = 0;
    for (let i = 0; i < real.length; i++) sum += rnd() < 0.5 ? real[i] : flipped[i];
    totals.push(sum);
  }
  totals.sort((a, b) => a - b);
  const at = (f: number) => totals[Math.min(totals.length - 1, Math.round(f * (totals.length - 1)))] ?? 0;
  const beat = totals.length ? totals.filter((x) => x < actualR).length / totals.length : 0;
  const verdict = beat >= 0.95 ? "better" : beat >= 0.75 ? "maybe" : beat >= 0.25 ? "same" : "worse";
  const n = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}R`;
  const text =
    verdict === "better" ? `It beat ${Math.round(beat * 100)}% of coin flips taking the same trades. Picking a side seems to add something real.` :
    verdict === "maybe" ? `It beat ${Math.round(beat * 100)}% of coin flips. That happens by chance often enough that it isn't proof of an edge. It takes about 95%.` :
    verdict === "same" ? `A coin flip does about as well. ${n(actualR)} against a typical ${n(at(0.5))}, so the entries add little beyond timing and costs.` :
    `It did worse than most coin flips: ${n(actualR)} against a typical ${n(at(0.5))}. Its read on direction may be backwards here.`;
  return { trades: trades.length, actualR, oppositeR: flipped.reduce((a, b) => a + b, 0), medianR: at(0.5), low: at(0.05), high: at(0.95), beat, verdict, text };
}

// ── Prescriptions ──────────────────────────────────────────────────────────────

export interface Side {
  trades: number;
  avgR: number;
  totalR: number;
}

export interface Prescription {
  id: string;
  title: string;
  why: string;
  older: { before: Side; after: Side };
  newer: { before: Side; after: Side };
  /** The settings that apply it to the next run, when the app has one. */
  apply?: Partial<BacktestSettings>;
}

export interface DoctorReport {
  splitDate: string;
  older: Side;
  newer: Side;
  prescriptions: Prescription[];
  /** Tried, and they didn't hold up. */
  tried: number;
  /** The surviving changes together, chosen on older trades. */
  stacked: { titles: string[]; older: Side; newer: Side } | null;
  tips: { title: string; body: string }[];
}

type Rule = { id: string; title: string; why: string; apply?: Partial<BacktestSettings>; map: (ts: BacktestTrade[]) => number[] };

const side = (rs: number[]): Side => ({ trades: rs.length, totalR: rs.reduce((a, b) => a + b, 0), avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0 });
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const firstN = (ts: BacktestTrade[], keep: (t: BacktestTrade, n: number, sum: number) => boolean) => {
  const seen = new Map<string, { n: number; sum: number }>();
  const out: number[] = [];
  for (const t of ts) {
    const e = seen.get(t.session) ?? { n: 0, sum: 0 };
    seen.set(t.session, e);
    if (keep(t, e.n, e.sum)) {
      const r = netR(t);
      out.push(r);
      e.sum += r;
    }
    e.n++;
  }
  return out;
};

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;

function rules(all: BacktestTrade[]): Rule[] {
  const only = (keep: (t: BacktestTrade) => boolean) => (ts: BacktestTrade[]) => ts.filter(keep).map(netR);
  const out: Rule[] = [
    { id: "long", title: "Take longs only", why: "Index futures rose over these years, so shorts often pay for the longs.", apply: { side: "long" }, map: only((t) => t.side === "long") },
    { id: "short", title: "Take shorts only", why: "The longs here lose more than the shorts.", apply: { side: "short" }, map: only((t) => t.side === "short") },
    { id: "one", title: "One trade a day", why: "The first signal does better than later ones.", apply: { maxPerDay: 1 }, map: (ts) => firstN(ts, (_t, n) => n < 1) },
    { id: "two", title: "Two trades a day", why: "Later signals in a day are lower quality.", apply: { maxPerDay: 2 }, map: (ts) => firstN(ts, (_t, n) => n < 2) },
    { id: "stop2", title: "Stop for the day after losing 2R", why: "Bad days tend to stay bad for this strategy.", map: (ts) => firstN(ts, (_t, _n, sum) => sum > -2) },
    { id: "be1", title: "Move the stop to break-even at 1R", why: "Trades that reach 1R and come back to a full loss are costly here. Worked out from each trade's best moment.", apply: { breakEvenR: 1 }, map: (ts) => ts.map((t) => (t.mfe >= 1 && netR(t) < 0 ? netR(t) - t.r : netR(t))) },
    { id: "fomc", title: "Sit out FOMC days", why: "Decision days whipsaw this strategy.", apply: { skipFomc: true }, map: only((t) => !t.fomc) },
    { id: "calm", title: "Skip days when VIX is over 25", why: "This strategy struggles when fear is high.", map: only((t) => t.vix == null || t.vix < 25) },
    { id: "vol", title: "Only trade when VIX is 15 or more", why: "It needs some movement to work.", map: only((t) => t.vix == null || t.vix >= 15) },
    ...[1, 1.5, 3].map((x) => ({ id: `cap${x}`, title: `Take profit at ${x}R`, why: `Trades often reach ${x}R and then don't get paid. Worked out from each trade's best moment.`, map: (ts: BacktestTrade[]) => ts.map((t) => (t.mfe >= x ? x + (netR(t) - t.r) : netR(t))) })),
    ...[1, 2, 3, 4, 5].map((d) => ({ id: `wd${d}`, title: `Skip ${WD[d]}s`, why: `${WD[d]}s pull this strategy down.`, map: only((t) => t.weekday !== d) })),
  ];
  const hours = [...new Set(all.map((t) => t.hour))].filter((h) => all.filter((t) => t.hour === h).length >= 30);
  for (const h of hours) out.push({ id: `h${h}`, title: `Skip entries in the ${hourLabel(h)} hour`, why: `Entries from ${hourLabel(h)}, New York time, pull this strategy down.`, map: only((t) => t.hour !== h) });
  return out;
}

/** Keeps only changes that help on older trades and on newer ones they weren't chosen from. */
export function prescribe(result: BacktestResult): DoctorReport {
  const ts = result.trades;
  const cut = Math.floor(ts.length * 0.7);
  const old = ts.slice(0, cut);
  const fresh = ts.slice(cut);
  const baseOld = side(old.map(netR));
  const baseNew = side(fresh.map(netR));
  const found: (Prescription & { rule: Rule; gain: number })[] = [];
  const list = ts.length >= 60 ? rules(ts) : [];
  for (const rule of list) {
    const a = side(rule.map(old));
    const b = side(rule.map(fresh));
    // It must keep enough trades to mean anything, and add real money on both sides.
    if (a.trades < 25 || b.trades < 10) continue;
    if (a.avgR <= baseOld.avgR + 0.01 || b.avgR <= baseNew.avgR + 0.01) continue;
    if (a.totalR <= baseOld.totalR && rule.map(old).length === old.length) continue;
    // Could this much gain be luck? Testing many ideas finds some that only look good, even on a pure coin flip.
    const whole = rule.map(ts);
    const gain = side(whole).totalR - side(ts.map(netR)).totalR;
    if (gain <= 0) continue;
    const base = ts.map(netR);
    let noise: number;
    if (whole.length === base.length) {
      const deltas = whole.map((x, i) => x - base[i]).filter((x) => Math.abs(x) > 1e-9);
      noise = Math.sqrt(deltas.reduce((m, x) => m + x * x, 0));
    } else {
      const mean = base.reduce((m, x) => m + x, 0) / base.length;
      const sd = Math.sqrt(base.reduce((m, x) => m + (x - mean) ** 2, 0) / Math.max(1, base.length - 1));
      noise = sd * Math.sqrt(base.length - whole.length);
    }
    if (!noise || gain / noise < 2.5) continue;
    found.push({ id: rule.id, title: rule.title, why: rule.why, apply: rule.apply, older: { before: baseOld, after: a }, newer: { before: baseNew, after: b }, rule, gain: a.avgR - baseOld.avgR });
  }
  found.sort((x, y) => y.newer.after.avgR - x.newer.after.avgR);

  // Stacks the best filters greedily on older trades; the newer ones get one honest look at the result.
  let stacked: DoctorReport["stacked"] = null;
  const filters = found.filter((f) => !f.id.startsWith("cap") && f.id !== "be1").sort((a, b) => b.gain - a.gain).slice(0, 3);
  if (filters.length >= 2) {
    const keepIn = (t: BacktestTrade) => filters.every((f) => {
      if (f.id === "long") return t.side === "long";
      if (f.id === "short") return t.side === "short";
      if (f.id === "fomc") return !t.fomc;
      if (f.id === "calm") return t.vix == null || t.vix < 25;
      if (f.id === "vol") return t.vix == null || t.vix >= 15;
      if (f.id.startsWith("wd")) return t.weekday !== Number(f.id.slice(2));
      if (f.id.startsWith("h")) return t.hour !== Number(f.id.slice(1));
      return true;
    });
    stacked = { titles: filters.map((f) => f.title), older: side(old.filter(keepIn).map(netR)), newer: side(fresh.filter(keepIn).map(netR)) };
  }
  return { splitDate: fresh[0]?.date ?? "", older: baseOld, newer: baseNew, prescriptions: found.slice(0, 6).map(({ rule: _r, gain: _g, ...p }) => (void _r, void _g, p)), tried: list.length, stacked, tips: tipsFor(result) };
}

function tipsFor(r: BacktestResult): DoctorReport["tips"] {
  const s = r.stats;
  const ts = r.trades;
  const out: DoctorReport["tips"] = [];
  if (!ts.length) return [{ title: "No trades to read", body: "This setup never fired. Try a longer period, another session, or a less strict rule." }];
  const costR = ts.reduce((a, t) => a + (t.r - netR(t)), 0) / ts.length;
  const grossR = ts.reduce((a, t) => a + t.r, 0) / ts.length;
  if (costR > 0.01) out.push({ title: costR >= Math.abs(grossR) ? "Costs eat the whole edge" : `Costs take ${costR.toFixed(2)}R a trade`, body: `Before commissions it makes ${grossR >= 0 ? "+" : ""}${grossR.toFixed(2)}R a trade. Tight stops make costs a bigger share of each R, so a higher timeframe or wider stop can be worth more than a better entry.` });
  const payoff = s.avgLossR ? s.avgWinR / Math.abs(s.avgLossR) : 0;
  if (payoff > 0) {
    const need = 1 / (1 + payoff);
    out.push({ title: `It needs to win ${Math.round(need * 100)}% and wins ${Math.round(s.winRate * 100)}%`, body: `Average win ${s.avgWinR.toFixed(2)}R, average loss ${Math.abs(s.avgLossR).toFixed(2)}R. ${s.winRate > need ? "It clears that, which is the core of any edge." : "Move one: a better entry, or a target that gets hit more often."}` });
  }
  if (ts.length < 200) out.push({ title: `${ts.length} trades is too few to trust`, body: "Under about 200 trades, a good or bad result is often luck. Test a longer period before changing anything." });
  if (s.avgMfe > 0 && s.avgWinR && s.avgMfe > s.avgWinR * 0.8) out.push({ title: "Trades run further than they pay", body: `The average trade reaches ${s.avgMfe.toFixed(2)}R at its best, and the average winner banks ${s.avgWinR.toFixed(2)}R. Try a nearer target or a break-even stop.` });
  const months = r.by.month;
  const green = months.filter((m) => m.pnl > 0).length;
  if (months.length >= 12) out.push({ title: `${Math.round((green / months.length) * 100)}% of months were green`, body: "A strategy you can live with wins more months than it loses. Few funded traders survive long flat stretches." });
  out.push({ title: "Change one thing at a time", body: "Each extra filter tested makes a false edge more likely. If a tweak only works on the data it was picked from, drop it." });
  return out;
}
