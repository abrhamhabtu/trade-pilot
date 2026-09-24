// ─── The trading day, as Pilot runs it ─────────────────────────────────────────
// Three stages share one set of facts:
//   Flight plan  (before 09:30 ET) — levels, events, a game plan with evidence
//   In flight    (09:30–16:00)     — every TradingView signal checked against it
//   Debrief      (after 16:00)     — how the day matched the plan, and one
//                                     focus that becomes tomorrow's first line
// Pure functions only: the page, the signal listener and the tests share them.
// ───────────────────────────────────────────────────────────────────────────────

import type { Trade } from "@/store/tradingStore";
import {
  RTH_CLOSE,
  RTH_OPEN,
  hhmmToMinute,
  nyClock,
  type MacroEvent,
  type MarketRead,
} from "./market";
import {
  inspectTrade,
  orderedTrades,
  tradeMinute,
  type PilotRules,
} from "./workspace";

// ─── Setups ────────────────────────────────────────────────────────────────────

export type SetupId = "double-break-vwap" | "sr-break" | "sr-retest" | "orb" | "vwap-pullback" | "failed-breakout";

export type SetupFamily = "vwap" | "sr" | "orb";

export const SETUPS: Record<SetupId, { label: string; short: string; how: string; family: SetupFamily }> = {
  "double-break-vwap": {
    label: "Double-break VWAP",
    short: "DB-VWAP",
    family: "vwap",
    how: "Price closes through VWAP, gets pushed back, then closes through it again the same way. The second close is the entry. The first break is information.",
  },
  "vwap-pullback": {
    label: "VWAP trend pullback",
    short: "VWAP PB",
    family: "vwap",
    how: "Trending on one side of a sloping VWAP, the first tag back into it that closes in the trend direction.",
  },
  "sr-retest": {
    label: "S/R retest & hold",
    short: "Retest",
    family: "sr",
    how: "After a break, price comes back to the level, holds it, and closes away from it. Entry on the hold, stop on the other side.",
  },
  "sr-break": {
    label: "S/R break",
    short: "S/R break",
    family: "sr",
    how: "A candle closes through a marked level (prior-day high/low, overnight high/low or your own).",
  },
  "failed-breakout": {
    label: "Failed breakout (sweep)",
    short: "Sweep",
    family: "sr",
    how: "Price runs a prior-day or overnight extreme, fails, and closes back inside. Fade it with the stop beyond the sweep.",
  },
  orb: {
    label: "Opening range breakout",
    short: "ORB",
    family: "orb",
    how: "The first 15 minutes set the range. The first close outside it is the trade, stop at the range middle.",
  },
};

export const isSetupId = (s: unknown): s is SetupId =>
  typeof s === "string" && Object.hasOwn(SETUPS, s);

/** Which of the trader's setup families a free-text journal strategy belongs to. */
export function setupFamily(strategy?: string): SetupFamily | null {
  const s = (strategy || "").toLowerCase();
  if (/vwap/.test(s)) return "vwap";
  if (/\borb\b|opening range/.test(s)) return "orb";
  if (/support|resist|s\/r|\bsr\b|level|retest|breakout|break|sweep|liquidity/.test(s)) return "sr";
  return null;
}
const familyOf = (id: SetupId) => SETUPS[id].family;

// ─── Plan ──────────────────────────────────────────────────────────────────────

export type PlanBias = "long" | "short" | "both";

export interface PlanLevel {
  id: string;
  label: string;
  price: number;
  source: "auto" | "manual";
}

export interface DayPlan {
  bias: PlanBias;
  setups: SetupId[];
  /** Minutes after 09:30 before the first entry. */
  waitMinutes: number;
  levels: PlanLevel[];
  checks: Record<string, boolean>;
  /** The symbol the plan was drawn on. */
  symbol?: string;
}

export const DEFAULT_PLAN: DayPlan = {
  bias: "both",
  setups: ["double-break-vwap", "sr-retest"],
  waitMinutes: 15,
  levels: [],
  checks: {},
};

export const PREP_CHECKS = [
  { id: "levels", label: "Levels drawn on the chart" },
  { id: "alerts", label: "TradingView alerts armed" },
  { id: "stop", label: "Daily stop entered at the broker" },
  { id: "size", label: "Size set for a static stop" },
] as const;

export type Stage = "plan" | "fly" | "debrief";

export function stageAt(ms = Date.now()): Stage {
  const { minute, weekday } = nyClock(ms);
  if (weekday === 0 || weekday === 6) return "plan";
  if (minute < RTH_OPEN) return "plan";
  if (minute < RTH_CLOSE) return "fly";
  return "debrief";
}

export const minuteLabel = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = String(Math.round(m % 60)).padStart(2, "0");
  return `${h}:${mm}`;
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const usd = (n: number) =>
  `${n < 0 ? "-" : "+"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const pct = (n: number) => `${Math.round(n)}%`;

export type LevelKind = "prior" | "overnight" | "vwap" | "opening" | "round" | "manual";

/** The levels a market read gives us for free, top to bottom. */
export function autoLevels(m: MarketRead | null): (PlanLevel & { kind: LevelKind })[] {
  if (!m) return [];
  const rows: [string, string, number | null, LevelKind][] = [
    ["pdh", "Prior-day high", m.pdh, "prior"],
    ["onh", "Overnight high", m.onh, "overnight"],
    ["orh", "Opening range high", m.orh ?? null, "opening"],
    ["pdc", "Prior close", m.prevClose, "prior"],
    ["vwap", "VWAP", m.vwap, "vwap"],
    ["orl", "Opening range low", m.orl ?? null, "opening"],
    ["onl", "Overnight low", m.onl, "overnight"],
    ["pdl", "Prior-day low", m.pdl, "prior"],
  ];
  return rows
    .filter((r): r is [string, string, number, LevelKind] => r[2] != null)
    .map(([id, label, price, kind]) => ({ id, label, price, kind, source: "auto" as const }))
    .sort((a, b) => b.price - a.price);
}

/** The nearest round-number handles above and below price (NQ 100s, ES 25s). */
export function roundLevels(price: number): (PlanLevel & { kind: LevelKind })[] {
  const step = price > 10000 ? 100 : price > 2000 ? 25 : 5;
  const below = Math.floor(price / step) * step;
  const above = below + step;
  return [above, below === price ? below - step : below].map((p) => ({
    id: `round-${p}`,
    label: `Round ${p.toLocaleString("en-US")}`,
    price: p,
    kind: "round" as const,
    source: "auto" as const,
  }));
}

export interface LevelCluster {
  price: number;
  levels: (PlanLevel & { kind: LevelKind })[];
  /** Two or more independent levels within a few ticks of each other. */
  confluence: boolean;
}

/**
 * Levels that sit on top of each other are one zone, and a stronger one. Round
 * numbers never make a confluence on their own; they only reinforce one.
 */
export function clusterLevels(levels: (PlanLevel & { kind: LevelKind })[], price: number): LevelCluster[] {
  const tol = price * 0.0008;
  const sorted = [...levels].sort((a, b) => b.price - a.price);
  const out: LevelCluster[] = [];
  for (const l of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.price - l.price) <= tol && l.kind !== "vwap" && last.levels.every((x) => x.kind !== "vwap")) {
      last.levels.push(l);
      last.price = last.levels.reduce((a, x) => a + x.price, 0) / last.levels.length;
    } else out.push({ price: l.price, levels: [l], confluence: false });
  }
  for (const c of out) c.confluence = c.levels.filter((l) => l.kind !== "round").length >= 2;
  return out;
}

export function nearestLevels(levels: PlanLevel[], price: number) {
  const above = levels.filter((l) => l.price > price && l.id !== "vwap").sort((a, b) => a.price - b.price)[0] ?? null;
  const below = levels.filter((l) => l.price < price && l.id !== "vwap").sort((a, b) => b.price - a.price)[0] ?? null;
  return { above, below };
}

// ─── History slices ────────────────────────────────────────────────────────────

interface Slice {
  n: number;
  pnl: number;
  wins: number;
  winRate: number;
}
const slice = (ts: Trade[]): Slice => {
  const wins = ts.filter((t) => t.netPL > 0).length;
  return {
    n: ts.length,
    pnl: ts.reduce((s, t) => s + t.netPL, 0),
    wins,
    winRate: ts.length ? (wins / ts.length) * 100 : 0,
  };
};

/** Entries inside the opening window versus after it. */
export function openingSplit(history: Trade[], waitMinutes: number) {
  const timed = history.filter((t) => {
    const m = tradeMinute(t.time);
    return m !== null && m >= RTH_OPEN && m < RTH_CLOSE;
  });
  const cut = RTH_OPEN + Math.max(waitMinutes, 1);
  return {
    early: slice(timed.filter((t) => tradeMinute(t.time)! < cut)),
    later: slice(timed.filter((t) => tradeMinute(t.time)! >= cut)),
  };
}

export function familyStats(history: Trade[]) {
  return {
    vwap: slice(history.filter((t) => setupFamily(t.strategy) === "vwap")),
    sr: slice(history.filter((t) => setupFamily(t.strategy) === "sr")),
    orb: slice(history.filter((t) => setupFamily(t.strategy) === "orb")),
  };
}

export function sessionsOf(trades: Trade[]) {
  const map = new Map<string, Trade[]>();
  for (const t of orderedTrades(trades)) {
    const d = t.date.slice(0, 10);
    map.set(d, [...(map.get(d) || []), t]);
  }
  return map;
}

// ─── Game plan ─────────────────────────────────────────────────────────────────

export type LineKind = "event" | "clock" | "bias" | "setup" | "risk" | "carry";

export interface PlanLine {
  kind: LineKind;
  text: string;
  /** The numbers the line rests on, shown as chips. */
  evidence?: string[];
}

export interface GamePlan {
  headline: string;
  lines: PlanLine[];
  /** First minute ET a new entry is allowed. */
  firstEntry: number;
  /** Windows where no new entries are allowed. */
  blackouts: { from: number; to: number; why: string }[];
}

export function buildGamePlan(input: {
  market: MarketRead | null;
  events: MacroEvent[];
  history: Trade[];
  plan: DayPlan;
  rules: PilotRules;
  carry?: { date: string; text: string } | null;
  today: string;
}): GamePlan {
  const { market, events, history, plan, rules, carry, today } = input;
  const lines: PlanLine[] = [];
  const blackouts: GamePlan["blackouts"] = [];
  const high = events.filter((e) => e.impact === "high");
  const med = events.filter((e) => e.impact === "med");
  const preOpenHigh = high.filter((e) => (hhmmToMinute(e.time) ?? 0) < RTH_OPEN);
  let wait = plan.waitMinutes;
  if (preOpenHigh.length) wait = Math.max(wait, 15);
  const firstEntry = RTH_OPEN + wait;

  if (carry?.text && carry.date < today)
    lines.push({ kind: "carry", text: carry.text, evidence: [`From your ${shortDate(carry.date)} debrief`] });

  // Events first: they decide when you are allowed to trade at all.
  for (const e of preOpenHigh)
    lines.push({
      kind: "event",
      text: `${e.title} at ${e.time}. Let the first 15-minute candle close (${minuteLabel(firstEntry)}) before any entry, because the open will reprice it.`,
      evidence: [e.forecast ? `Forecast ${e.forecast}` : "", e.previous ? `Prior ${e.previous}` : ""].filter(Boolean),
    });
  for (const e of [...high, ...med]) {
    const m = hhmmToMinute(e.time);
    if (m === null || m < RTH_OPEN || m >= RTH_CLOSE) continue;
    const pad = e.impact === "high" ? 10 : 3;
    blackouts.push({ from: m - pad, to: m + (e.impact === "high" ? 30 : 5), why: e.title });
    lines.push({
      kind: "event",
      text:
        e.impact === "high"
          ? `${e.title} at ${e.time}. Be flat by ${minuteLabel(m - pad)} and take nothing new until ${minuteLabel(m + 30)}.`
          : `${e.title} at ${e.time}. No new entries from ${minuteLabel(m - pad)} to ${minuteLabel(m + 5)}.`,
    });
  }

  // The opening candle, argued from the trader's own tape when it can be.
  const split = openingSplit(history, wait);
  if (split.early.n >= 5 && split.later.n >= 5 && split.early.pnl < split.later.pnl / Math.max(split.later.n, 1) * split.early.n) {
    lines.push({
      kind: "clock",
      text: `Wait for ${minuteLabel(firstEntry)}. Your entries in the first ${wait} minutes make less per trade than the ones after.`,
      evidence: [
        `First ${wait}m: ${split.early.n} trades, ${usd(split.early.pnl)}, ${pct(split.early.winRate)} WR`,
        `After: ${split.later.n} trades, ${usd(split.later.pnl)}, ${pct(split.later.winRate)} WR`,
      ],
    });
  } else if (!preOpenHigh.length && wait > 0) {
    lines.push({
      kind: "clock",
      text: `Mark the first ${wait}-minute candle's high and low. Nothing fires before ${minuteLabel(firstEntry)}.`,
    });
  }

  // Bias and where each setup lives today.
  // Rank the chosen setups by what their family has paid this trader per trade.
  const fam = familyStats(history);
  const FAMILY_NAME: Record<SetupFamily, string> = { vwap: "VWAP", sr: "level", orb: "opening-range" };
  const chosen = [...plan.setups].sort((x, y) => {
    const fx = fam[SETUPS[x].family];
    const fy = fam[SETUPS[y].family];
    return (fy.n >= 5 ? fy.pnl / fy.n : -Infinity) - (fx.n >= 5 ? fx.pnl / fx.n : -Infinity);
  });
  const families = [...new Set(chosen.map((id) => SETUPS[id].family))];
  const levels = plan.levels.length ? plan.levels : autoLevels(market);
  if (market) {
    const { above, below } = nearestLevels(levels, market.price);
    const vw = market.vwap != null ? fmt(market.vwap) : "VWAP once it forms at 9:30";
    const up = above ? `${above.label} ${fmt(above.price)}` : null;
    const dn = below ? `${below.label} ${fmt(below.price)}` : null;
    const lean = plan.bias !== "both" ? plan.bias : market.bias === "bullish" ? "long" : market.bias === "bearish" ? "short" : "both";
    const lead = chosen[0];
    const text =
      lean === "both"
        ? `Two-sided open, so let the tape pick the side${lead ? ` and wait for ${trigger(lead, "long", vw, up, dn)} or ${trigger(lead, "short", vw, up, dn)}` : ""}.${up && dn ? ` Range to respect: ${dn} to ${up}.` : ""}`
        : lean === "long"
          ? `Favor longs${lead ? `: ${trigger(lead, "long", vw, up, dn)}` : ""}.${up ? ` First objective ${up}.` : ""}${dn ? ` Longs are invalid below ${dn}.` : ""}`
          : `Favor shorts${lead ? `: ${trigger(lead, "short", vw, up, dn)}` : ""}.${dn ? ` First objective ${dn}.` : ""}${up ? ` Shorts are invalid above ${up}.` : ""}`;
    lines.push({ kind: "bias", text, evidence: market.reasons.slice(0, 3) });
  }

  const setupEvidence = families
    .filter((f) => fam[f].n)
    .map((f) => `${FAMILY_NAME[f][0].toUpperCase()}${FAMILY_NAME[f].slice(1)} trades: ${fam[f].n}, ${pct(fam[f].winRate)} WR, ${usd(fam[f].pnl)}`);
  const a = chosen[0];
  const ranked = families.length > 1 && families.every((f) => fam[f].n >= 5);
  lines.push({
    kind: "setup",
    text: !chosen.length
      ? "No setup chosen. Pick the one or two you will take before the open. Anything else is not a trade."
      : ranked
        ? `Your ${FAMILY_NAME[SETUPS[a].family]} trades pay the most per trade, so ${SETUPS[a].label} is the A setup today. ${chosen.slice(1).map((x) => SETUPS[x].label).join(" and ")} only at A-quality.`
        : `Only ${chosen.map((x) => SETUPS[x].label).join(" or ")}. If it does not print, you do not trade.`,
    evidence: setupEvidence,
  });

  const sessions = [...sessionsOf(history).entries()].filter(([d]) => d < today);
  const last = sessions[sessions.length - 1];
  const lastPnl = last ? last[1].reduce((s, t) => s + t.netPL, 0) : 0;
  lines.push({
    kind: "risk",
    text: `${rules.maxTrades} trades max, stop at -$${rules.dailyLoss.toLocaleString("en-US")}, done by ${rules.finishTime}.${last && lastPnl < 0 ? " Yesterday closed red, so take the first trade at half size." : ""}`,
    evidence: last ? [`Last session ${shortDate(last[0])}: ${last[1].length} trades, ${usd(lastPnl)}`] : [],
  });

  const side = plan.bias === "long" || (plan.bias === "both" && market?.bias === "bullish") ? "Longs" : plan.bias === "short" || (plan.bias === "both" && market?.bias === "bearish") ? "Shorts" : null;
  const setupPhrase = a ? SETUPS[a].short : "your A setup";
  const headline = [
    wait > 0 ? `Wait for ${minuteLabel(firstEntry)}.` : null,
    side ? `${side} on ${setupPhrase}.` : `${setupPhrase}, and let the tape pick the side.`,
    high.length ? `${high[0].title} at ${high[0].time}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return { headline, lines, firstEntry, blackouts };
}

/** What the entry looks like for one setup, in the words of today's levels. */
function trigger(id: SetupId, side: "long" | "short", vw: string, up: string | null, dn: string | null) {
  const L = side === "long";
  switch (id) {
    case "double-break-vwap":
      return `the second close back ${L ? "above" : "below"} VWAP ${vw}`;
    case "vwap-pullback":
      return `the first pullback into VWAP ${vw} that closes ${L ? "up" : "down"}`;
    case "sr-retest":
      return `a break of ${(L ? up : dn) || "the nearest level"} that retests and holds`;
    case "sr-break":
      return `a close through ${(L ? up : dn) || "the nearest level"}`;
    case "failed-breakout":
      return `a sweep of ${(L ? dn : up) || "an extreme"} that closes back inside`;
    case "orb":
      return `a close ${L ? "above" : "below"} the opening range`;
  }
}

export function shortDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── Signals ───────────────────────────────────────────────────────────────────

export interface TvSignal {
  id: string;
  receivedAt: number;
  symbol: string;
  setup: string;
  side: "long" | "short" | null;
  price: number | null;
  vwap: number | null;
  level: number | null;
  levelName: string;
  tf: string;
  message: string;
  closes: number[];
  vwaps: number[];
  test: boolean;
}

const num = (x: unknown) => {
  const n = typeof x === "string" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const str = (x: unknown, max = 80) => (typeof x === "string" ? x.slice(0, max) : "");
const series = (x: unknown) =>
  Array.isArray(x) ? x.slice(-120).map(num).filter((n): n is number => n !== null) : [];

/** Anything TradingView can send (JSON from our indicator, a template, or plain text) → a signal. */
export function parseSignal(raw: unknown, receivedAt: number, id: string): TvSignal {
  const p = (raw && typeof raw === "object" ? raw : { message: String(raw ?? "") }) as Record<string, unknown>;
  const text = str(p.message, 280);
  const sideRaw = str(p.side || p.action || p.direction).toLowerCase();
  const side = /long|buy|bull/.test(sideRaw || text.toLowerCase()) ? "long" : /short|sell|bear/.test(sideRaw || text.toLowerCase()) ? "short" : null;
  const setupRaw = str(p.setup).toLowerCase();
  const setup = isSetupId(setupRaw)
    ? setupRaw
    : /vwap/.test(setupRaw || text.toLowerCase())
      ? "double-break-vwap"
      : setupRaw || "alert";
  return {
    id,
    receivedAt,
    symbol: str(p.symbol || p.ticker, 24).toUpperCase() || "—",
    setup,
    side,
    price: num(p.price ?? p.close),
    vwap: num(p.vwap),
    level: num(p.level),
    levelName: str(p.levelName, 24),
    tf: str(p.tf || p.interval, 8),
    message: text,
    closes: series(p.closes),
    vwaps: series(p.vwaps),
    test: p.test === true,
  };
}

export const setupLabel = (s: string) => (isSetupId(s) ? SETUPS[s].label : s === "alert" ? "TradingView alert" : s);

export type Verdict = "go" | "caution" | "wait";

export interface SignalCheck {
  verdict: Verdict;
  headline: string;
  checks: { label: string; state: "ok" | "warn" | "fail"; detail: string }[];
}

export interface SessionState {
  minute: number;
  trades: Trade[];
  rules: PilotRules;
  plan: DayPlan;
  game: Pick<GamePlan, "firstEntry" | "blackouts">;
}

/** Would taking this signal right now keep the trader inside their own plan? */
export function checkSignal(s: TvSignal, ctx: SessionState): SignalCheck {
  const { minute, trades, rules, plan, game } = ctx;
  const checks: SignalCheck["checks"] = [];
  const add = (label: string, state: "ok" | "warn" | "fail", detail: string) => checks.push({ label, state, detail });

  if (minute < RTH_OPEN || minute >= RTH_CLOSE) add("Session", "warn", "Outside regular hours (09:30–16:00 ET)");
  else if (minute < game.firstEntry) add("Opening candle", "fail", `Inside your first ${plan.waitMinutes}-minute window. Entries open at ${minuteLabel(game.firstEntry)}.`);
  else add("Opening candle", "ok", `Past ${minuteLabel(game.firstEntry)}`);

  const blackout = game.blackouts.find((b) => minute >= b.from && minute <= b.to);
  add("News", blackout ? "fail" : "ok", blackout ? `${blackout.why}: no new entries until ${minuteLabel(blackout.to)}` : "No event window open");

  if (s.side && plan.bias !== "both")
    add("Bias", s.side === plan.bias ? "ok" : "warn", s.side === plan.bias ? `With your ${plan.bias} bias` : `Against your ${plan.bias} bias. Only take it with a reason you would write down.`);

  if (isSetupId(s.setup))
    add("Setup", plan.setups.includes(s.setup) ? "ok" : "warn", plan.setups.includes(s.setup) ? `${SETUPS[s.setup].label} is in today's plan` : `${SETUPS[s.setup].label} is not in today's plan`);

  const done = trades.filter((t) => (tradeMinute(t.time) ?? 0) <= minute);
  add("Trade count", done.length >= rules.maxTrades ? "fail" : done.length === rules.maxTrades - 1 ? "warn" : "ok", `${done.length} of ${rules.maxTrades} trades used${done.length === rules.maxTrades - 1 ? ". This would be the last one." : ""}`);

  const realized = done.reduce((sum, t) => sum + t.netPL, 0);
  const left = rules.dailyLoss + Math.min(0, realized);
  add("Daily stop", left <= 0 ? "fail" : left < rules.dailyLoss * 0.35 ? "warn" : "ok", left <= 0 ? "Daily stop reached. You are done." : `$${Math.round(left).toLocaleString("en-US")} left before your stop`);

  const lastLoss = [...done].reverse().find((t) => t.netPL < 0);
  if (lastLoss) {
    const closed = (tradeMinute(lastLoss.time) ?? 0) + (Number.isFinite(lastLoss.duration) ? lastLoss.duration : 0);
    const since = minute - closed;
    if (since >= 0 && since < rules.cooldown)
      add("Cooldown", "fail", `Last loss closed ${Math.round(since)} min ago. Your cooldown is ${rules.cooldown} min.`);
  }

  const finish = hhmmToMinute(rules.finishTime);
  if (finish !== null && minute >= finish) add("Finish time", "fail", `Past your ${rules.finishTime} finish`);

  const fails = checks.filter((c) => c.state === "fail");
  const warns = checks.filter((c) => c.state === "warn");
  const verdict: Verdict = fails.length ? "wait" : warns.length ? "caution" : "go";
  const headline =
    verdict === "go"
      ? "Inside your plan. Your trigger, your size."
      : verdict === "caution"
        ? warns[0].detail
        : fails[0].detail;
  return { verdict, headline, checks };
}

/** The line that lands in Quick notes the moment a signal arrives. */
export function autoNote(s: TvSignal, check: SignalCheck, minute: number) {
  const bits = [
    `${s.symbol} ${setupLabel(s.setup)}${s.side ? ` ${s.side}` : ""}`,
    s.price != null ? `@ ${fmt(s.price)}` : "",
    s.vwap != null ? `(VWAP ${fmt(s.vwap)})` : "",
    s.level != null ? `through ${s.levelName || "level"} ${fmt(s.level)}` : "",
    `at ${minuteLabel(minute)}${s.tf ? ` on the ${s.tf}m` : ""}.`,
  ].filter(Boolean);
  const verdict = check.verdict === "go" ? "Pilot: cleared." : check.verdict === "caution" ? `Pilot: caution, ${check.headline.toLowerCase()}` : `Pilot: wait, ${check.headline.toLowerCase()}`;
  return `${bits.join(" ")} ${verdict}`;
}

// ─── In-session nudges ─────────────────────────────────────────────────────────

export interface Nudge {
  tone: "warn" | "info" | "good";
  title: string;
  text: string;
}

export function sessionNudges(today: Trade[], history: Trade[], rules: PilotRules, minute: number): Nudge[] {
  const out: Nudge[] = [];
  const days = [...sessionsOf(history).values()];
  const n = today.length;

  if (n >= 2) {
    const first = days.flatMap((d) => d.slice(0, n));
    const after = days.flatMap((d) => d.slice(n));
    const a = slice(first);
    const b = slice(after);
    if (b.n >= 8 && a.winRate - b.winRate >= 10)
      out.push({
        tone: "warn",
        title: `Trade ${n + 1} is where it turns`,
        text: `You're ${n} trades in. Historically your trade ${n + 1} onward wins ${pct(b.winRate)}, against ${pct(a.winRate)} for the first ${n}. Stand up for five minutes before the next one.`,
      });
  }

  let streak = 0;
  for (let i = n - 1; i >= 0 && today[i].netPL < 0; i--) streak++;
  if (streak >= 2) {
    const next: Trade[] = [];
    for (const d of days)
      for (let i = 2; i < d.length; i++)
        if (d[i - 1].netPL < 0 && d[i - 2].netPL < 0) next.push(d[i]);
    const s = slice(next);
    out.push({
      tone: "warn",
      title: `${streak} losses in a row`,
      text: s.n >= 5
        ? `After back-to-back losses your next trade wins ${pct(s.winRate)} (${s.n} times, ${usd(s.pnl)}). The plan says stop, not win it back.`
        : "Two red tickets back to back. Take a break long enough that the next entry is a decision.",
    });
  }

  const pnl = today.reduce((s, t) => s + t.netPL, 0);
  const green = days.map((d) => d.reduce((s, t) => s + t.netPL, 0)).filter((p) => p > 0);
  const avgGreen = green.length ? green.reduce((a, b) => a + b, 0) / green.length : 0;
  if (pnl > 0 && avgGreen > 0 && pnl >= avgGreen)
    out.push({
      tone: "good",
      title: "Already an average green day",
      text: `You're ${usd(pnl)}, and your average green day is ${usd(avgGreen)}. One more loss and you're done for the day.`,
    });

  const finish = hhmmToMinute(rules.finishTime);
  if (finish !== null && minute < finish && finish - minute <= 15)
    out.push({ tone: "info", title: "Finish line", text: `${Math.round(finish - minute)} minutes to your ${rules.finishTime} finish. Manage what's open, start nothing new.` });

  return out;
}

// ─── Adherence and debrief ─────────────────────────────────────────────────────

export interface AdherenceItem {
  label: string;
  state: "ok" | "fail" | "pending";
  detail: string;
}

export function adherence(today: Trade[], all: Trade[], plan: DayPlan, rules: PilotRules): { items: AdherenceItem[]; score: number | null } {
  const items: AdherenceItem[] = [];
  const planned = new Set(plan.setups.map(familyOf));
  const off = today.filter((t) => { const f = setupFamily(t.strategy); return !f || !planned.has(f); });
  items.push({
    label: `Setup: ${plan.setups.map((s) => SETUPS[s].short).join(" / ") || "none chosen"}`,
    state: !today.length ? "pending" : off.length ? "fail" : "ok",
    detail: !today.length ? "No trades yet" : off.length ? `${off.length} off-plan: ${[...new Set(off.map((t) => t.strategy || "untagged"))].slice(0, 2).join(", ")}` : "Every trade was a planned setup",
  });
  const big = today.filter((t) => t.quantity > rules.maxContracts);
  items.push({ label: `Sizing: ≤ ${rules.maxContracts} contracts`, state: !today.length ? "pending" : big.length ? "fail" : "ok", detail: big.length ? `${big.length} over size, max ${Math.max(...big.map((t) => t.quantity))}` : today.length ? "Within size" : "No trades yet" });
  const firstEntry = RTH_OPEN + plan.waitMinutes;
  const early = today.filter((t) => { const m = tradeMinute(t.time); return m !== null && m >= RTH_OPEN && m < firstEntry; });
  items.push({ label: `Entry: after ${minuteLabel(firstEntry)}`, state: !today.length ? "pending" : early.length ? "fail" : "ok", detail: early.length ? `${early.length} inside the opening window, ${usd(early.reduce((s, t) => s + t.netPL, 0))}` : today.length ? "Waited for the candle" : "No trades yet" });
  items.push({ label: `Trades: ≤ ${rules.maxTrades}`, state: today.length > rules.maxTrades ? "fail" : today.length ? "ok" : "pending", detail: `${today.length} of ${rules.maxTrades}` });
  const revenge = today.filter((t) => inspectTrade(t, all, rules).flags.some((f) => /revenge/i.test(f)));
  items.push({ label: "No revenge entries", state: revenge.length ? "fail" : today.length ? "ok" : "pending", detail: revenge.length ? `${revenge.length} within ${rules.cooldown} min of a loss` : today.length ? "Cooldown respected" : "No trades yet" });
  const judged = items.filter((i) => i.state !== "pending");
  return { items, score: judged.length ? Math.round((judged.filter((i) => i.state === "ok").length / judged.length) * 100) : null };
}

export interface Debrief {
  date: string;
  pnl: number;
  trades: number;
  winRate: number;
  score: number | null;
  cleanStreak: number;
  insights: { tone: "good" | "warn" | "info"; title: string; text: string }[];
  tomorrow: string;
}

export function debrief(date: string, all: Trade[], plan: DayPlan, rules: PilotRules, signals: TvSignal[]): Debrief {
  const sessions = sessionsOf(all);
  const day = sessions.get(date) || [];
  const s = slice(day);
  const { score, items } = adherence(day, all, plan, rules);
  const insights: Debrief["insights"] = [];

  // Consecutive sessions, ending today, with no rule breaks.
  const dates = [...sessions.keys()].filter((d) => d <= date).sort().reverse();
  let cleanStreak = 0;
  for (const d of dates) {
    if ((sessions.get(d) || []).some((t) => inspectTrade(t, all, rules).flags.length)) break;
    cleanStreak++;
  }

  const flagged = day.map((t) => ({ t, flags: inspectTrade(t, all, rules).flags })).filter((x) => x.flags.length);
  if (!flagged.length && day.length)
    insights.push({ tone: "good", title: "Clean session", text: cleanStreak > 1 ? `No rule breaks, and that's ${cleanStreak} sessions in a row.` : "No rule breaks today." });
  else if (flagged.length) {
    const cost = flagged.reduce((sum, x) => sum + x.t.netPL, 0);
    insights.push({ tone: "warn", title: `${flagged.length} ${flagged.length === 1 ? "trade" : "trades"} broke a rule`, text: `${flagged[0].flags[0]} (${flagged[0].t.time || "time n/a"}). Together they made ${usd(cost)}.` });
  }

  const failed = items.filter((i) => i.state === "fail");
  for (const f of failed.slice(0, 2)) insights.push({ tone: "warn", title: f.label, text: f.detail });

  const daySignals = signals.filter((x) => nyClock(x.receivedAt).date === date && !x.test);
  if (daySignals.length) {
    const taken = daySignals.filter((sig) => { const m = nyClock(sig.receivedAt).minute; return day.some((t) => { const tm = tradeMinute(t.time); return tm !== null && tm >= m && tm - m <= 3; }); });
    insights.push({ tone: "info", title: "Signals", text: `${daySignals.length} TradingView ${daySignals.length === 1 ? "signal" : "signals"} fired, and you traded ${taken.length} of them within 3 minutes.` });
  }

  if (day.length) {
    const best = [...day].sort((a, b) => b.netPL - a.netPL)[0];
    const worst = [...day].sort((a, b) => a.netPL - b.netPL)[0];
    if (best.netPL > 0) insights.push({ tone: "good", title: "Best trade", text: `${best.symbol} ${best.side?.toLowerCase() || ""} at ${best.time || "n/a"}, ${usd(best.netPL)}${best.strategy ? `, ${best.strategy}` : ""}.` });
    if (worst.netPL < 0 && worst.id !== best.id) insights.push({ tone: "info", title: "Most expensive", text: `${worst.symbol} at ${worst.time || "n/a"}, ${usd(worst.netPL)}${worst.strategy ? `, ${worst.strategy}` : ""}.` });
  }

  const early = items.find((i) => i.label.startsWith("Entry"));
  const tomorrow = !day.length
    ? "No trades today. Same plan tomorrow: mark levels before 9:30 and wait for the second break."
    : early?.state === "fail"
      ? `Nothing before ${minuteLabel(RTH_OPEN + plan.waitMinutes)}. Today's opening-window entries: ${early.detail.split(", ")[1] || early.detail}.`
      : failed.find((f) => f.label.startsWith("No revenge"))
        ? `After a loss, stand up for ${rules.cooldown} minutes before the next click.`
        : failed.find((f) => f.label.startsWith("Trades"))
          ? `Stop at ${rules.maxTrades} trades, win or lose.`
          : failed.find((f) => f.label.startsWith("Setup"))
            ? `Only ${plan.setups.map((x) => SETUPS[x].label).join(" or ")}. If it isn't one of those, it isn't a trade.`
            : failed.find((f) => f.label.startsWith("Sizing"))
              ? `Max ${rules.maxContracts} contracts. Size is not how you get it back.`
              : "Repeat today. Same levels routine, same patience at the open.";

  return { date, pnl: s.pnl, trades: s.n, winRate: s.winRate, score, cleanStreak, insights, tomorrow };
}
