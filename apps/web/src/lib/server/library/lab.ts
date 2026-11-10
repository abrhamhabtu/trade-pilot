// ─── The lab's long work ───────────────────────────────────────────────────────
// Runs every strategy variant over the library, a year at a time, and keeps the
// trades per contract on disk. Each year is done once, so adding new data only
// costs the new year, and every study after the first is arithmetic on stored
// trades (lib/vision/lab.ts). Runs in this process between other requests.
// ───────────────────────────────────────────────────────────────────────────────

import { promises as fs } from "fs";
import path from "path";
import { READERS, READER_ORDER, isReader, type ReaderId } from "@/lib/vision/analyze";
import { DISCOVER_DEFAULTS, ideasFor, judgeStudy, pack, scenarioSeries, studyRows, summarize, unpack, type DetectorStudy, type PackedRow, type StudyEnv } from "@/lib/vision/discover";
import { levelsFor } from "@/lib/vision/levels";
import { patternContext } from "@/lib/vision/patterns";
import { inHours, runBacktest } from "@/lib/vision/backtest";
import { nyClock } from "@/lib/pilot/market";
import { SESSION_WINDOWS, type SessionKey } from "@/lib/vision/custom";
import { accountState, resetAccount, type AccountTrade, type PropAccount } from "@/lib/vision/account";
import { baselineWalk, coinFlipOdds, firmShootout, planKey, planLabel, rollingOdds, simulate, sizingStudy, toUnitDays, walkSteps, type Attempt, type FirmRow, type Odds, type Pricing, type SizingPlan, type SizingStudy, type UnitTrade, type Variant, type WalkResult } from "@/lib/vision/lab";
import { SYMBOLS, TF_SECONDS, isSymbol, type Timeframe } from "@/lib/vision/markets";
import { FIRM_PROGRAMS, programByKey } from "@/lib/proving/firms";
import { DAY_MARGIN, DEFAULT_LIMITS, FEES, limitsKey, riskCap, type RiskLimits } from "@/lib/vision/limits";
import { bookOdds, dailyCorrelation, firmExtras, healthCheck, liveTable, minimumCapital, newsDays, stressTest, worth, youVsMachine, type Book, type Health, type LiveRow, type NewsReport, type StressReport, type Versus, type Worth } from "@/lib/vision/economics";
import { SCOUT_CATALOG, judge, type ScoutCandidate, type ScoutResult } from "@/lib/vision/scout";
import { ECON_CALENDAR as calendar } from "@/lib/vision/econ-calendar";
import { readJson, writeJson } from "../store";
import { LIB, getContext, getIndex, queryBars, zipCsvLines } from "./index";

const VERSION = "v1";
const ROOT = path.join(LIB, "lab", VERSION);
const SESSIONS: SessionKey[] = ["ny", "open", "london"];
const TFS: Timeframe[] = ["5m", "15m"];
const BREAKEVEN: (number | null)[] = [null, 1];
export { FEES };

export const pricing = (symbol: string, micro: boolean, maxRisk?: number, live?: boolean): Pricing | null => {
  if (!isSymbol(symbol)) return null;
  const pv = SYMBOLS[symbol].pointValue;
  if (!pv) return null;
  const margin = live ? DAY_MARGIN[symbol]?.[micro ? "micro" : "full"] : undefined;
  return { pointValue: micro ? pv.micro : pv.full, fee: micro ? FEES.micro : FEES.full, micro, maxRisk, margin };
};

const LIMITS_FILE = "library/lab/limits.json";
export const getLimits = async (): Promise<RiskLimits> => ({ ...DEFAULT_LIMITS, ...(await readJson<Partial<RiskLimits>>(LIMITS_FILE, {})) });
export async function saveLimits(next: RiskLimits) {
  await fs.mkdir(path.join(LIB, "lab"), { recursive: true });
  await writeJson(LIMITS_FILE, next);
  return next;
}

/** Days the trader said they can't or won't trade come out before anything is chosen. */
function applyProfile(trades: UnitTrade[], l: RiskLimits, fomc: Set<string>) {
  const cpi = new Set(calendar.cpi);
  const jobs = new Set(calendar.jobs);
  return trades.filter((t) => {
    const clock = nyClock(t.entryT * 1000);
    if (l.hours && !inHours(clock.minute, l.hours)) return false;
    if (!l.weekdays.includes(clock.weekday)) return false;
    if (l.skipNews.cpi && cpi.has(clock.date)) return false;
    if (l.skipNews.jobs && jobs.has(clock.date)) return false;
    if (l.skipNews.fomc && fomc.has(clock.date)) return false;
    return true;
  });
}

const comboId = (r: ReaderId, s: SessionKey, tf: Timeframe, be: number | null) => `${r}|${s}|${tf}|${be ?? 0}`;
const comboLabel = (r: ReaderId, s: SessionKey, tf: Timeframe, be: number | null) => `${READERS[r].label}, ${SESSION_WINDOWS[s].label}, ${tf}${be ? `, break-even at ${be}R` : ""}`;

type Packed = [number, number, 0 | 1, number, number, number, number, number, number, number, number, string, string];
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export interface LabJob {
  key: string;
  stage: string;
  done: number;
  total: number;
  error?: string;
}
const jobs = ((globalThis as Record<string, unknown>).__tpLabJobs ??= new Map<string, LabJob>()) as Map<string, LabJob>;
export const labJob = (key: string) => jobs.get(key) ?? null;
const breathe = () => new Promise((r) => setImmediate(r));

/** Runs whatever years of this symbol have not been run yet. A year still being added to is run again. */
async function ensureTrades(symbol: string, job: LabJob) {
  const idx = await getIndex();
  const info = idx.series[symbol];
  if (!info) throw new Error(`No ${symbol} in your library yet. Add your data in the Library tab.`);
  const market = SYMBOLS[symbol as keyof typeof SYMBOLS];
  const raw = await getContext();
  const metals = symbol === "GC";
  const context = { fomc: raw.fomc, vix: raw.vix, early: (metals ? raw.earlyCloses.metals : raw.earlyCloses.equity).map((d) => d.date) };
  const lastYear = new Date(info.to * 1000).getUTCFullYear();
  const dir = path.join(ROOT, symbol);
  await fs.mkdir(dir, { recursive: true });
  const todo: { year: number; tf: Timeframe; file: string }[] = [];
  for (const year of info.years)
    for (const tf of TFS) {
      const file = path.join(dir, `${tf}-${year}.json`);
      const old = await fs.readFile(file, "utf8").then((x) => JSON.parse(x) as { to: number }, () => null);
      if (!old || (year === lastYear && old.to < info.to)) todo.push({ year, tf, file });
    }
  job.total = todo.length * READER_ORDER.length * SESSIONS.length * BREAKEVEN.length;
  job.done = 0;
  for (const { year, tf, file } of todo) {
    job.stage = `Running every strategy on ${symbol} ${tf}, ${year}`;
    const from = Date.UTC(year, 0, 1) / 1000;
    const to = Date.UTC(year + 1, 0, 1) / 1000;
    // A run starts early enough for its indicators to warm up and ends late enough to close a trade opened on New Year's Eve.
    const { bars } = await queryBars(symbol, from - 45 * 86_400, to + 7 * 86_400, TF_SECONDS[tf], Infinity);
    const out: Record<string, Packed[]> = {};
    for (const reader of READER_ORDER)
      for (const session of SESSIONS)
        for (const be of BREAKEVEN) {
          await breathe();
          if (bars.length > 200) {
            const r = runBacktest(bars, { reader, anchor: "rth", side: "both", pointValue: 1, contracts: 1, balance: 50_000, commission: 0, slippageTicks: 1, tick: market.tick, maxHold: tf === "5m" ? 48 : 24, breakEvenR: be, maxPerDay: null, skipFomc: false, skipEarly: true, vix: "any", hours: SESSION_WINDOWS[session].hours, context });
            out[comboId(reader, session, tf, be)] = r.trades.filter((t) => t.entryT >= from && t.entryT < to).map((t) => [t.entryT, t.exitT, t.side === "long" ? 1 : 0, t.entry, t.stop, t.target, t.exit, r4(t.riskUsd), r4(t.mae * t.riskUsd), r4(t.mfe * t.riskUsd), r4(t.pnl), t.outcome, t.session]);
          }
          job.done++;
        }
    await fs.writeFile(file, JSON.stringify({ to: info.to, combos: out }));
  }
}

/** Every variant's trades, plus each one limited to two trades a day. Cutting a day short can't change the trades before it. */
export async function loadVariants(symbol: string, limits?: RiskLimits): Promise<Variant[]> {
  const l = limits ?? (await getLimits());
  const fomc = new Set((await getContext()).fomc);
  const raw = await rawVariants(symbol);
  const approved = await approvedVariants(symbol);
  return [...raw, ...approved].map((v) => ({ ...v, trades: applyProfile(v.trades, l, fomc) })).filter((v) => v.trades.length > 30);
}

async function rawVariants(symbol: string): Promise<Variant[]> {
  const dir = path.join(ROOT, symbol);
  const names = (await fs.readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith(".json")).sort();
  const by = new Map<string, UnitTrade[]>();
  for (const n of names) {
    const { combos } = JSON.parse(await fs.readFile(path.join(dir, n), "utf8")) as { combos: Record<string, Packed[]> };
    for (const [id, rows] of Object.entries(combos)) {
      const list = by.get(id) ?? [];
      by.set(id, list);
      const reader = id.split("|")[0];
      for (const x of rows) list.push({ entryT: x[0], exitT: x[1], side: x[2] ? "long" : "short", entry: x[3], stop: x[4], target: x[5], exit: x[6], risk: x[7], worst: x[8], best: x[9], points: x[10], outcome: x[11], session: x[12], reader });
    }
  }
  const out: Variant[] = [];
  for (const [id, trades] of by) {
    const [r, s, tf, be] = id.split("|");
    const label = comboLabel(r as ReaderId, s as SessionKey, tf as Timeframe, Number(be) || null);
    out.push({ id, label, trades });
    const seen = new Map<string, number>();
    const two = trades.filter((t) => {
      const n = (seen.get(t.session) ?? 0) + 1;
      seen.set(t.session, n);
      return n <= 2;
    });
    if (two.length < trades.length) out.push({ id: `${id}|2`, label: `${label}, 2 trades a day`, trades: two });
  }
  return out;
}

// ── Studies ────────────────────────────────────────────────────────────────────

export interface LeagueRow {
  id: string;
  label: string;
  trades: number;
  winRate: number;
  expectancyR: number;
  t: number;
  odds: Odds;
}

export interface Generation {
  at: number;
  /** Last bar the study saw. */
  dataTo: string;
  variant: string;
  plan: SizingPlan;
  expected: number;
  passRate: number;
  attempts: number;
  /** What this study changed from the one before. */
  note: string;
}

export interface Study {
  program: string;
  symbol: string;
  micro: boolean;
  fee: number;
  at: number;
  dataFrom: string;
  dataTo: string;
  variants: number;
  coin: ReturnType<typeof coinFlipOdds>;
  walk: Omit<WalkResult, "steps"> & { steps: Omit<WalkResult["steps"][number], "attempt">[] };
  sizing: Omit<SizingStudy, "rows"> & { rows: SizingStudy["rows"] };
  league: LeagueRow[];
  causes: { id: string; title: string; count: number }[];
  years: { year: string; passed: number; failed: number; other: number }[];
  rescues: { change: string; count: number }[];
  generations: Generation[];
  /** The current strategy at every firm's account of this size. */
  shootout: FirmRow[];
  limitsKey: string;
  /** Dollars over a year at every firm, ranked by what reaches the trader. */
  money: Worth[];
  /** This firm at each evaluation risk level, and the instant accounts beside it. */
  riskMore: Worth[];
  firmNote: string;
  stress: StressReport;
  health: Health;
  news: NewsReport;
  fills: FillAudit | null;
  insights: Insight[];
}

export interface Insight {
  title: string;
  body: string;
}

export interface FillAudit {
  from: string;
  to: string;
  trades: number;
  /** Trades whose 5m or 15m bar touched both stop and target, or where seconds tell a different story. */
  ambiguous: number;
  flipped: number;
  /** Change in total R once seconds decide, against the bars' assumption. */
  deltaR: number;
  totalR: number;
  text: string;
}

const studyFile = (program: string, symbol: string, micro: boolean) => path.join(ROOT, "studies", `${program.replace(/[^a-z0-9-]/gi, "_")}-${symbol}-${micro ? "micro" : "full"}.json`);

export const getStudy = (program: string, symbol: string, micro: boolean): Promise<Study | null> =>
  fs.readFile(studyFile(program, symbol, micro), "utf8").then((x) => JSON.parse(x) as Study, () => null);

const contractWord = (symbol: string, micro: boolean) => {
  const roots = isSymbol(symbol) ? SYMBOLS[symbol].roots : undefined;
  return roots ? (micro ? roots.micro : roots.full) : micro ? "micros" : "contracts";
};

const CAUSE_NAMES: Record<string, string> = { streak: "A long losing streak", trail: "The trailing floor took it", oversize: "Too big for the room", "one-day": "One day did most of it", bleed: "It was winning, then gave it back", stuck: "Stuck over the target", stalled: "Ran out of road" };

const stripAttempt = <T extends { attempt?: Attempt }>(step: T) => {
  const rest = { ...step };
  delete rest.attempt;
  return rest;
};

export async function runStudy(o: { program: string; symbol: string; micro: boolean }) {
  const key = `${o.program}|${o.symbol}|${o.micro ? 1 : 0}`;
  if (jobs.has(key) && !jobs.get(key)!.error) return jobs.get(key)!;
  const job: LabJob = { key, stage: "Getting ready", done: 0, total: 1 };
  jobs.set(key, job);
  void study(o, job)
    .then(() => jobs.delete(key))
    .catch((e) => {
      job.error = e instanceof Error ? e.message : "The study failed.";
    });
  return job;
}

async function study(o: { program: string; symbol: string; micro: boolean }, job: LabJob) {
  const p = programByKey(o.program);
  const limits = await getLimits();
  const evalCap = riskCap(limits, o.symbol, p?.model === "instant" ? "funded" : "eval");
  const fundedCap = riskCap(limits, o.symbol, "funded");
  const price = pricing(o.symbol, o.micro, evalCap);
  const fundedPrice = pricing(o.symbol, o.micro, fundedCap);
  if (!p) throw new Error("That firm program is no longer listed.");
  if (!price || !fundedPrice) throw new Error(`${o.symbol} can't be studied.`);
  await ensureTrades(o.symbol, job);
  job.stage = "Reading the trades";
  await breathe();
  const variants = await loadVariants(o.symbol, limits);
  const word = contractWord(o.symbol, o.micro);

  // Attempts in date order, each choice blind to its own future.
  job.stage = "Trading attempts through history";
  job.done = 0;
  job.total = 1;
  const it = walkSteps(variants, p, price, word);
  let x = it.next();
  while (!x.done) {
    job.done = x.value.n;
    job.total = Math.max(job.total, x.value.n + 1);
    job.stage = `Attempt ${x.value.n}, starting ${x.value.start}`;
    await breathe();
    x = it.next();
  }
  const walk = x.value;
  if (!walk.current) throw new Error("Not enough trades in the library to choose a plan.");

  job.stage = "Sizing the current plan";
  await breathe();
  const chosen = variants.find((v) => v.id === walk.current!.variant)!;
  const days = toUnitDays(chosen.trades);
  const sizing = sizingStudy(days, p, price, { cap: 50 });
  const held = sizing.flat ? baselineWalk(chosen, p, sizing.flat.plan, price) : null;
  if (held) walk.baseline = { label: planLabel(sizing.flat!.plan, word), passRate: held.passRate, attempts: held.attempts };

  job.stage = "Ranking every variant";
  await breathe();
  const league: LeagueRow[] = variants.map((v) => {
    const rs = v.trades.map((t) => (t.risk ? t.points / t.risk : 0));
    const mean = rs.reduce((a, b) => a + b, 0) / Math.max(1, rs.length);
    const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rs.length - 1)) || 1;
    return { id: v.id, label: v.label, trades: rs.length, winRate: rs.filter((r) => r > 0).length / Math.max(1, rs.length), expectancyR: mean, t: (mean / sd) * Math.sqrt(rs.length), odds: rollingOdds(toUnitDays(v.trades), p, walk.current!.plan, price, { cap: 40 }) };
  });
  league.sort((a, b) => b.odds.low - a.odds.low);

  job.stage = "Comparing every firm";
  await breathe();
  const shootout = firmShootout(days, FIRM_PROGRAMS.filter((x) => x.size === p.size && x.model === p.model), price);

  // Dollars, not pass rates. Funded accounts run at the funded limit whatever the evaluation did.
  job.stage = "Following the money";
  await breathe();
  const fundedPlan: SizingPlan = { kind: "room", amount: Math.min(0.12, fundedCap), dayStop: 0.4, dayCap: true, coast: false };
  const peers = FIRM_PROGRAMS.filter((x) => x.size === p.size);
  const money: Worth[] = [];
  for (const q of peers) {
    await breathe();
    const evalP = pricing(o.symbol, o.micro, q.model === "instant" ? fundedCap : evalCap)!;
    const plan = shootout.find((r) => r.key === q.key)?.plan ?? walk.current.plan;
    money.push(worth(days, q, q.model === "instant" ? fundedPlan : plan, fundedPlan, evalP, fundedPrice, { cap: 20, fundedConsistencyPct: limits.fundedConsistencyPct }));
  }
  money.sort((a, b) => b.meanNet - a.meanNet);
  job.stage = "Is it worth risking more?";
  await breathe();
  const riskMore: Worth[] = p.model === "eval" ? [0.08, 0.12, 0.16, 0.22, 0.3, 0.4, 0.5].map((amount) => worth(days, p, { kind: "room", amount, dayStop: 0, dayCap: p.consistencyPct < 100, coast: true }, fundedPlan, { ...price, maxRisk: undefined }, fundedPrice, { label: `Risk ${Math.round(amount * 100)}% of the room in the evaluation`, cap: 24, fundedConsistencyPct: limits.fundedConsistencyPct })) : [];
  for (const q of peers.filter((x) => x.model === "instant")) riskMore.push(money.find((m) => m.key === q.key)!);

  job.stage = "Stress testing";
  await breathe();
  const market = SYMBOLS[o.symbol as keyof typeof SYMBOLS];
  const stress = stressTest(days, p, walk.current.plan, price, market.tick);
  const rs = chosen.trades.map((t) => (t.risk ? t.points / t.risk : 0));
  const health = healthCheck(rs);
  const context = await getContext();
  const news = newsDays(days, p, walk.current.plan, price, { cpi: calendar.cpi, jobs: calendar.jobs, fomc: context.fomc });
  job.stage = "Checking fills against seconds";
  await breathe();
  const fills = o.symbol === "NQ" ? await auditFills(chosen).catch(() => null) : null;
  job.stage = "Writing it up";
  await breathe();

  const causeCount = new Map<string, { id: string; title: string; count: number }>();
  const rescueCount = new Map<string, number>();
  const years = new Map<string, { year: string; passed: number; failed: number; other: number }>();
  for (const s of walk.steps) {
    const y = years.get(s.start.slice(0, 4)) ?? { year: s.start.slice(0, 4), passed: 0, failed: 0, other: 0 };
    years.set(y.year, y);
    if (s.result === "passed") y.passed++;
    else if (s.result === "floor") y.failed++;
    else y.other++;
    if (s.result === "passed") continue;
    for (const c of s.autopsy.causes) {
      const e = causeCount.get(c.id) ?? { id: c.id, title: CAUSE_NAMES[c.id] ?? c.title, count: 0 };
      e.count++;
      causeCount.set(c.id, e);
    }
    for (const r of s.autopsy.rescues) {
      const label = r.change.replace(/^\d+ \S+ instead of \d+$/, "A smaller size");
      rescueCount.set(label, (rescueCount.get(label) ?? 0) + 1);
    }
  }

  const idx = await getIndex();
  const info = idx.series[o.symbol];
  const iso = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
  const rawCoin = coinFlipOdds(p, { runs: 800 });
  const prev = await getStudy(o.program, o.symbol, o.micro);
  const before = prev?.generations.at(-1);
  const note = !before
    ? "First study of this account type."
    : before.variant !== walk.current.variant || planKey(before.plan) !== planKey(walk.current.plan)
      ? `Changed from ${before.variant === walk.current.variant ? "the same strategy" : variants.find((v) => v.id === before.variant)?.label ?? before.variant} with ${planLabel(before.plan, word)}: the newest data now favours this.`
      : "Looked again and kept the same plan.";
  const out: Study = {
    program: o.program,
    symbol: o.symbol,
    micro: o.micro,
    fee: price.fee,
    at: Date.now(),
    dataFrom: iso(info.from),
    dataTo: iso(info.to),
    variants: variants.length,
    coin: rawCoin,
    walk: { ...walk, steps: walk.steps.map(stripAttempt) },
    sizing,
    league: league.slice(0, 16),
    shootout,
    limitsKey: limitsKey(limits),
    money,
    riskMore,
    firmNote: firmExtras(p).note,
    stress,
    health,
    news,
    fills,
    insights: buildInsights({ p, walk, coin: rawCoin, chosen, days, money, riskMore, lockFails: 0 }),
    causes: [...causeCount.values()].sort((a, b) => b.count - a.count),
    years: [...years.values()].sort((a, b) => a.year.localeCompare(b.year)),
    rescues: [...rescueCount.entries()].map(([change, count]) => ({ change, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    generations: [...(prev?.generations ?? []), { at: Date.now(), dataTo: iso(info.to), variant: walk.current.variant, plan: walk.current.plan, expected: walk.current.expected, passRate: walk.passRate, attempts: walk.attempts, note }].slice(-40),
  };
  const file = studyFile(o.program, o.symbol, o.micro);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(out));
  return out;
}

// ── Putting a plan on an account ───────────────────────────────────────────────

const toAccountTrades = (att: Attempt, price: Pricing, name: string): AccountTrade[] =>
  att.days.flatMap((d) =>
    d.trades.map((x, i) => ({ id: `lab${x.t.entryT}${i}`, entryT: x.t.entryT, exitT: x.t.exitT, session: x.t.session, side: x.t.side, qty: x.qty, entry: x.t.entry, exit: x.t.exit, stop: x.t.stop, target: x.t.target, pnl: x.pnl, r: x.t.risk ? x.t.points / x.t.risk : 0, worst: x.worst, best: x.best, reason: x.t.outcome, source: "auto" as const, strategy: name })),
  );

/** Trades one variant and plan forward from where the account stands, under the firm's rules. */
export async function tradePlan(a: PropAccount, o: { variant: string; plan: SizingPlan; horizon?: number }) {
  const s = accountState(a);
  const limits = await getLimits();
  const price = pricing(a.symbol, a.micro, riskCap(limits, a.symbol, a.phase), a.phase === "live");
  if (!s || !price) throw new Error("This account can't be traded here.");
  const v = (await loadVariants(a.symbol, limits)).find((x) => x.id === o.variant);
  if (!v) throw new Error("Run the study first: it builds the trades this plan needs.");
  const days = toUnitDays(v.trades);
  const start = s.lastDay && s.lastDay >= a.startDate ? s.lastDay : a.startDate;
  const from = days.findIndex((d) => (s.lastDay ? d.date > start : d.date >= start));
  if (from < 0) return { account: a, text: `${v.label} has no trades after ${start}. The data ends there.`, added: 0 };
  const att = simulate(days, s.program, o.plan, price, { from, horizon: o.horizon ?? 250, seed: { balance: s.balance, peak: s.peak, threshold: s.threshold, bestDay: s.bestDay, daysTraded: s.daysTraded } });
  const trades = toAccountTrades(att, price, v.label);
  const next: PropAccount = { ...a, trades: [...a.trades, ...trades], cursorT: trades.at(-1)?.exitT ?? a.cursorT, contracts: Math.max(a.contracts, ...trades.map((t) => t.qty)) };
  const after = accountState(next)!;
  const word = contractWord(a.symbol, a.micro);
  const text = `${v.label}. ${planLabel(o.plan, word)}. ${trades.length} trades over ${att.days.length} days. ${after.status === "passed" ? `Passed: ${after.headline}.` : after.status === "blown" ? `Blown: ${after.headline}.` : after.headline}.`;
  const now = Date.now();
  next.events = [...next.events, { at: now, kind: "run", text }, ...(after.status !== "active" ? [{ at: now + 1, kind: after.status === "passed" ? ("passed" as const) : ("blown" as const), text: after.headline }] : [])];
  return { account: next, text, added: trades.length };
}

/**
 * Autopilot on an account: from its start date, choose from earlier data only,
 * trade until pass or fail, read the result, pay for a reset and go again.
 */
export async function runCampaign(a: PropAccount, o: { maxAttempts?: number } = {}) {
  const p = programByKey(a.program);
  const limits = await getLimits();
  const price = pricing(a.symbol, a.micro, riskCap(limits, a.symbol, a.phase));
  if (!p || !price) throw new Error("This account can't be traded here.");
  const variants = await loadVariants(a.symbol, limits);
  if (!variants.length) throw new Error("Run the study first: it builds the trades Autopilot needs.");
  const word = contractWord(a.symbol, a.micro);
  const it = walkSteps(variants, p, price, word, { from: a.startDate, maxAttempts: o.maxAttempts ?? 10, stopAtPass: true });
  let next: PropAccount = a.trades.length ? resetAccount(a, accountState(a)) : { ...a };
  let x = it.next();
  let last: Attempt | null = null;
  let tries = 0;
  while (!x.done) {
    const step = x.value;
    await breathe();
    if (last) next = resetAccount({ ...next, trades: toAccountTrades(last, price, "Autopilot") }, accountState({ ...next, trades: toAccountTrades(last, price, "Autopilot") }));
    tries++;
    last = step.attempt ?? null;
    const lead = step.autopsy.causes[0]?.title;
    const text = `Attempt ${step.n}: ${step.variantLabel}. ${planLabel(step.plan, word)}. ${step.result === "passed" ? `Passed in ${step.days} trading days.` : step.result === "floor" ? `Failed after ${step.days} days${lead ? `: ${lead.toLowerCase()}` : ""}.${step.autopsy.rescues[0] ? ` Would have survived with: ${step.autopsy.rescues[0].change.toLowerCase()}.` : ""}` : "Ran out of time."} ${step.n > 1 ? step.change : ""}`.trim();
    next = { ...next, events: [...next.events, { at: Date.now() + step.n, kind: step.result === "passed" ? "passed" : step.result === "floor" ? "blown" : "run", text }] };
    next.trades = last ? toAccountTrades(last, price, step.variantLabel) : [];
    next.contracts = Math.max(next.contracts, ...next.trades.map((t) => t.qty), 1);
    next.cursorT = next.trades.at(-1)?.exitT ?? next.cursorT;
    x = it.next();
  }
  const s = accountState(next);
  return { account: next, attempts: tries, text: tries ? `Autopilot made ${tries} attempt${tries === 1 ? "" : "s"}. ${s?.headline ?? ""}.` : "No trades after this account's start date." };
}

// ── One-second audit ───────────────────────────────────────────────────────────

/**
 * Bars can't say whether a stop or a target came first, so the backtest assumes the
 * stop. Where one-second bars exist, this replays each trade through them and
 * counts how often that assumption was wrong and what it cost.
 */
export async function auditFills(v: Variant): Promise<FillAudit | null> {
  const first = Date.UTC(2026, 6, 24) / 1000;
  const inWindow = v.trades.filter((t) => t.entryT >= first);
  if (!inWindow.length) return null;
  const lines = await zipCsvLines("databento-2026-10-24-nq.zip", /ohlcv-1s.*\.csv$/);
  if (!lines) return null;
  const sorted = [...inWindow].sort((a, b) => a.entryT - b.entryT);
  // Trades carry their bars' start times: a fill comes at the signal bar's close, an exit somewhere inside its bar.
  const tf = TF_SECONDS[(v.id.split("|")[2] ?? "5m") as Timeframe] ?? 300;
  const decided = new Map<UnitTrade, { first: "stop" | "target" | null }>();
  for (const t of sorted) decided.set(t, { first: null });
  let idx = 0;
  let last = 0;
  let covered = 0;
  let header: string[] | null = null;
  for await (const line of lines) {
    if (!header) {
      header = line.split(",");
      continue;
    }
    const c = line.split(",");
    const t = Date.parse(c[header.indexOf("ts_utc")]) / 1000;
    // Each month's file has its own header row.
    if (!Number.isFinite(t)) continue;
    const high = Number(c[header.indexOf("high")]);
    const low = Number(c[header.indexOf("low")]);
    last = Math.max(last, t);
    while (idx < sorted.length && sorted[idx].exitT + tf + 3600 < t) idx++;
    for (let k = idx; k < sorted.length && sorted[k].entryT + tf <= t; k++) {
      const x = sorted[k];
      const d = decided.get(x)!;
      if (d.first || t >= x.exitT + tf) continue;
      const long = x.side === "long";
      if (long ? low <= x.stop : high >= x.stop) d.first = "stop";
      else if (long ? high >= x.target : low <= x.target) d.first = "target";
      if (d.first) covered++;
    }
    if (++job1s % 250000 === 0) await breathe();
  }
  let flipped = 0;
  let deltaR = 0;
  let totalR = 0;
  let ambiguous = 0;
  for (const [t, d] of decided) {
    const r = t.risk ? t.points / t.risk : 0;
    totalR += r;
    if (t.exitT > last || !d.first) continue;
    const wasStop = t.outcome === "stop";
    const wasTarget = t.outcome === "target";
    if ((wasStop && d.first === "target") || (wasTarget && d.first === "stop")) {
      flipped++;
      ambiguous++;
      const rewardR = t.risk ? Math.abs(t.target - t.entry) / t.risk : 0;
      deltaR += wasStop ? rewardR - r : -1 - r;
    }
  }
  const text = !flipped ? "Seconds agree with the backtest on every trade they cover." : deltaR > 0 ? `Seconds flip ${flipped} trades and add ${deltaR.toFixed(1)}R: the backtest's stop-first rule is on the cautious side.` : `Seconds flip ${flipped} trades and cost ${Math.abs(deltaR).toFixed(1)}R: the backtest flatters this strategy a little.`;
  return { from: "2026-07-24", to: new Date(last * 1000).toISOString().slice(0, 10), trades: inWindow.length, ambiguous, flipped, deltaR, totalR, text };
}
let job1s = 0;

// ── What the numbers say about the game ────────────────────────────────────────

function buildInsights(o: { p: NonNullable<ReturnType<typeof programByKey>>; walk: WalkResult; coin: { rate: number; costPerPass: number | null }; chosen: Variant; days: ReturnType<typeof toUnitDays>; money: Worth[]; riskMore: Worth[]; lockFails: number }): Insight[] {
  const { p, walk, coin, days, money, riskMore } = o;
  const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
  const out: Insight[] = [];
  const fails = walk.steps.filter((s) => s.result === "floor");
  if (fails.length >= 5) {
    const sorted = fails.map((s) => s.days).sort((a, b) => a - b);
    const early = fails.filter((s) => s.days <= 5).length / fails.length;
    const typical = sorted[sorted.length >> 1];
    out.push(early >= 0.4
      ? { title: `Attempts die early: ${Math.round(early * 100)}% within 5 trading days`, body: `The typical failed attempt lasted ${typical} trading days. The floor is closest at the start, so half size until you've banked a cushion costs little and removes the most common way to lose the fee.` }
      : { title: `A failed attempt lasts about ${typical} trading days`, body: `Only ${Math.round(early * 100)}% die in the first week. Most fail slowly, which points at the strategy over those weeks rather than one bad day. A day stop won't fix that; a better strategy or sitting out will.` });
  }
  if (coin.costPerPass) out.push({ title: `At no edge, a pass costs ${usd(coin.costPerPass)}`, body: `${Math.round(coin.rate * 100)}% of coin-flip traders pass this account, so the fee is only part of the business. Evaluation income doesn't depend on anyone being good, and the first payout has to clear all those fees before you are ahead.` });
  const lockable = p.lock != null && p.ddType !== "static";
  if (lockable) {
    const need = p.lock! + p.drawdown;
    out.push({ title: `The account gets easier after ${usd(need)} of profit`, body: `Until then every new high moves your floor up. Past that the floor stops at ${usd(p.size + p.lock!)} and every further dollar is new room. Same strategy, far safer account: size up there, not before.` });
  }
  if (p.ddType === "trailing-eod") out.push({ title: "Inside the day, your floor can't move", body: "An end-of-day floor only lifts at the close. Open profit you give back during the day costs nothing, so wider targets are safer here than at an intraday-trailing firm. Compare this to the same plan at a trailing-intraday firm in Best firm." });
  if (p.ddType === "trailing-intraday") out.push({ title: "Your best open trade sets your floor", body: "A trade that runs up and comes back has spent your room. Resting targets are the defence: a fixed exit stops open profit from turning into a higher floor with nothing banked." });
  const stuck = walk.steps.filter((s) => s.autopsy.causes.some((c) => c.id === "stuck")).length;
  if (stuck) out.push({ title: `${stuck} attempts reached the target and still couldn't pass`, body: "The consistency rule held them there while the floor stayed behind them. A stop-for-the-day at the best-day limit gives up a little on great days to pass sooner." });
  const trades = days.flatMap((d) => d.trades);
  if (trades.length > 200) {
    const by = new Map<number, { r: number; n: number }>();
    for (const t of trades) {
      const m = nyClock(t.entryT * 1000).minute;
      const hour = Math.floor(m / 60);
      const e = by.get(hour) ?? { r: 0, n: 0 };
      e.r += t.risk ? t.points / t.risk : 0;
      e.n++;
      by.set(hour, e);
    }
    const hours = [...by.entries()].filter(([, e]) => e.n >= 40).map(([h, e]) => ({ h, avg: e.r / e.n, n: e.n })).sort((a, b) => b.avg - a.avg);
    if (hours.length >= 2) {
      const fmt = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
      out.push({ title: `This strategy's best hour is ${fmt(hours[0].h)}, its worst ${fmt(hours[hours.length - 1].h)}`, body: `${hours[0].avg >= 0 ? "+" : ""}${hours[0].avg.toFixed(2)}R a trade against ${hours[hours.length - 1].avg >= 0 ? "+" : ""}${hours[hours.length - 1].avg.toFixed(2)}R, over ${hours[0].n} and ${hours[hours.length - 1].n} trades. Set your hours in Limits to test trading only the good part. Check it holds on newer data before trusting it.` });
    }
  }
  const top = money[0];
  const cheap = [...money].sort((a, b) => a.meanSpent - b.meanSpent)[0];
  if (top && cheap && top.key !== cheap.key) out.push({ title: "The cheapest firm isn't the one that pays you most", body: `${cheap.label} costs least over a year (${usd(cheap.meanSpent)}), but ${top.label} leaves the most: ${top.meanNet >= 0 ? "" : "-"}${usd(top.meanNet)} on average after fees, on these trades.` });
  const evalRows = riskMore.filter((r) => r.model === "eval");
  if (evalRows.length > 2) {
    const best = [...evalRows].sort((a, b) => b.meanNet - a.meanNet)[0];
    out.push({ title: best.meanNet > 0 ? `Risking more in the evaluation: ${best.label.toLowerCase().replace(" in the evaluation", "")} made the most` : "No evaluation risk level made money in a year on these trades", body: `${best.label} did best at ${best.meanNet >= 0 ? "" : "-"}${usd(best.meanNet)} a year after fees, with ${best.meanAttempts.toFixed(1)} evaluations bought. See Eval vs. funded for each level. Sizing can't rescue a strategy without an edge.` });
  }
  return out;
}

// ── Live money study ───────────────────────────────────────────────────────────

export interface LiveStudy {
  symbol: string;
  micro: boolean;
  at: number;
  dataTo: string;
  variant: string;
  variantLabel: string;
  winRate: number;
  avgR: number;
  t: number;
  table: LiveRow[];
  /** Smallest balance where a typical stop fits the risk limit at one contract. */
  minimum: { typicalRisk: number; capital: number };
  league: { id: string; label: string; trades: number; olderR: number; newerR: number; t: number }[];
  health: Health;
  /** One year at the best prop account, for the same trades. */
  prop: { label: string; meanNet: number; medianNet: number; meanSpent: number; pProfit: number } | null;
}

const liveFile = (symbol: string, micro: boolean) => path.join(ROOT, "studies", `live-${symbol}-${micro ? "micro" : "full"}.json`);
export const getLiveStudy = (symbol: string, micro: boolean): Promise<LiveStudy | null> => fs.readFile(liveFile(symbol, micro), "utf8").then((x) => JSON.parse(x) as LiveStudy, () => null);

export async function runLiveStudy(o: { symbol: string; micro: boolean }) {
  const key = `live|${o.symbol}|${o.micro ? 1 : 0}`;
  if (jobs.has(key) && !jobs.get(key)!.error) return jobs.get(key)!;
  const job: LabJob = { key, stage: "Getting ready", done: 0, total: 1 };
  jobs.set(key, job);
  void liveStudy(o, job).then(() => jobs.delete(key)).catch((e) => {
    job.error = e instanceof Error ? e.message : "The study failed.";
  });
  return job;
}

async function liveStudy(o: { symbol: string; micro: boolean }, job: LabJob) {
  const limits = await getLimits();
  const price = pricing(o.symbol, o.micro, undefined, true);
  if (!price) throw new Error(`${o.symbol} can't be studied.`);
  await ensureTrades(o.symbol, job);
  job.stage = "Ranking strategies on data they didn't see";
  await breathe();
  const variants = await loadVariants(o.symbol, limits);
  const stat = (rs: number[]) => {
    const n = rs.length || 1;
    const mean = rs.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1)) || 1;
    return { mean, t: (mean / sd) * Math.sqrt(n) };
  };
  const league = variants.map((v) => {
    const rs = v.trades.map((t) => (t.risk ? t.points / t.risk : 0));
    const cut = Math.floor(rs.length * 0.7);
    const older = stat(rs.slice(0, cut));
    const newer = stat(rs.slice(cut));
    return { id: v.id, label: v.label, trades: rs.length, olderR: older.mean, newerR: newer.mean, t: stat(rs).t, older: older.t };
  });
  // Chosen on the older part only; the newer column is its honest test.
  league.sort((a, b) => b.older - a.older);
  const best = variants.find((v) => v.id === league[0].id)!;
  const days = toUnitDays(best.trades);
  job.stage = "Compounding through every year";
  await breathe();
  const table = liveTable(days, price);
  const rs = best.trades.map((t) => (t.risk ? t.points / t.risk : 0));
  const s0 = stat(rs);
  const idx = await getIndex();
  const peers = FIRM_PROGRAMS.filter((x) => x.size === 50_000);
  const fundedPrice = pricing(o.symbol, o.micro, riskCap(limits, o.symbol, "funded"))!;
  const evalPrice = pricing(o.symbol, o.micro, riskCap(limits, o.symbol, "eval"))!;
  const fundedPlan: SizingPlan = { kind: "room", amount: 0.12, dayStop: 0.4, dayCap: true, coast: false };
  let prop: LiveStudy["prop"] = null;
  for (const q of peers) {
    await breathe();
    const w = worth(days, q, { kind: "room", amount: 0.16, dayStop: 0.4, dayCap: q.consistencyPct < 100, coast: true }, fundedPlan, evalPrice, fundedPrice, { cap: 14, fundedConsistencyPct: limits.fundedConsistencyPct });
    if (!prop || w.meanNet > prop.meanNet) prop = { label: w.label, meanNet: w.meanNet, medianNet: w.medianNet, meanSpent: w.meanSpent, pProfit: w.pProfit };
  }
  const out: LiveStudy = { symbol: o.symbol, micro: o.micro, at: Date.now(), dataTo: new Date((idx.series[o.symbol]?.to ?? 0) * 1000).toISOString().slice(0, 10), variant: best.id, variantLabel: best.label, winRate: rs.filter((r) => r > 0).length / Math.max(1, rs.length), avgR: s0.mean, t: s0.t, table, minimum: minimumCapital(days, limits.livePct, price), league: league.slice(0, 10).map((r) => ({ id: r.id, label: r.label, trades: r.trades, olderR: r.olderR, newerR: r.newerR, t: r.t })), health: healthCheck(rs), prop };
  const file = liveFile(o.symbol, o.micro);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(out));
}

// ── You against the machine ────────────────────────────────────────────────────

export async function versus(a: PropAccount): Promise<Versus | null> {
  const limits = await getLimits();
  const study = await getStudy(a.program, a.symbol, a.micro);
  const live = a.phase === "live" ? await getLiveStudy(a.symbol, a.micro) : null;
  const id = study?.walk.current?.variant ?? live?.variant;
  if (!id) return null;
  const v = (await loadVariants(a.symbol, limits)).find((x) => x.id === id);
  const price = pricing(a.symbol, a.micro);
  const p = programByKey(a.program);
  if (!v || !price || !p) return null;
  const mine = a.trades.filter((t) => t.source === "manual");
  if (!mine.length) return null;
  const qty = [...mine.map((t) => t.qty)].sort((x, y) => x - y)[mine.length >> 1];
  const capUsd = a.phase === "live" ? (p.size * limits.livePct) / 100 : p.drawdown * riskCap(limits, a.symbol, a.phase);
  return youVsMachine(a.trades, toUnitDays(v.trades), price, { contracts: qty, capUsd, machineLabel: v.label });
}

// ── Several accounts at once ───────────────────────────────────────────────────

export interface PortfolioStudy {
  program: string;
  at: number;
  books: Book[];
  correlation: { a: string; b: string; value: number }[];
  picks: { symbol: string; label: string; plan: SizingPlan }[];
}

const portfolioFile = (program: string) => path.join(ROOT, "studies", `book-${program.replace(/[^a-z0-9-]/gi, "_")}.json`);
export const getPortfolio = (program: string): Promise<PortfolioStudy | null> => fs.readFile(portfolioFile(program), "utf8").then((x) => JSON.parse(x) as PortfolioStudy, () => null);

export async function runPortfolio(o: { program: string }) {
  const key = `book|${o.program}`;
  if (jobs.has(key) && !jobs.get(key)!.error) return jobs.get(key)!;
  const job: LabJob = { key, stage: "Getting ready", done: 0, total: 1 };
  jobs.set(key, job);
  void portfolio(o, job).then(() => jobs.delete(key)).catch((e) => {
    job.error = e instanceof Error ? e.message : "The study failed.";
  });
  return job;
}

async function portfolio(o: { program: string }, job: LabJob) {
  const p = programByKey(o.program);
  if (!p) throw new Error("That firm program is no longer listed.");
  const limits = await getLimits();
  const legs: { symbol: string; label: string; days: ReturnType<typeof toUnitDays>; plan: SizingPlan; price: Pricing }[] = [];
  for (const symbol of ["NQ", "ES", "GC"]) {
    await ensureTrades(symbol, job);
    job.stage = `Choosing the best ${symbol} strategy`;
    await breathe();
    const price = pricing(symbol, true, riskCap(limits, symbol, p.model === "instant" ? "funded" : "eval"))!;
    const variants = await loadVariants(symbol, limits);
    const scored = variants.map((v) => {
      const rs = v.trades.map((t) => (t.risk ? t.points / t.risk : 0));
      const mean = rs.reduce((a, b) => a + b, 0) / Math.max(1, rs.length);
      const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rs.length - 1)) || 1;
      return { v, t: (mean / sd) * Math.sqrt(rs.length) };
    }).sort((a, b) => b.t - a.t);
    const best = scored[0].v;
    const days = toUnitDays(best.trades);
    legs.push({ symbol, label: `${symbol}: ${best.label}`, days, plan: { kind: "room", amount: Math.min(0.12, price.maxRisk ?? 0.12), dayStop: 0.4, dayCap: p.consistencyPct < 100, coast: true }, price });
  }
  job.stage = "Starting accounts together";
  await breathe();
  const nq = legs[0];
  const copy = (n: number) => Array.from({ length: n }, () => ({ label: nq.label, days: nq.days, plan: nq.plan, price: nq.price }));
  const books: Book[] = [bookOdds(copy(1), p, "1 account, NQ"), bookOdds(copy(3), p, "3 accounts, same NQ strategy"), bookOdds(copy(5), p, "5 accounts, same NQ strategy"), bookOdds(legs.map((l) => ({ label: l.label, days: l.days, plan: l.plan, price: l.price })), p, "3 accounts: NQ, ES and gold")];
  const correlation = [["NQ", "ES", 0, 1], ["NQ", "GC", 0, 2], ["ES", "GC", 1, 2]].map(([a, b, i, j]) => ({ a: String(a), b: String(b), value: dailyCorrelation(legs[Number(i)].days, legs[Number(j)].days) }));
  const out: PortfolioStudy = { program: o.program, at: Date.now(), books, correlation, picks: legs.map((l) => ({ symbol: l.symbol, label: l.label, plan: l.plan })) };
  const file = portfolioFile(o.program);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(out));
}

// ── Strategy scout ─────────────────────────────────────────────────────────────

const SCOUT_DIR = path.join(ROOT, "scout");
const RESULTS = "library/lab/scout-results.json";
const APPROVED = "library/lab/scout-approved.json";
const EXTRA = "library/lab/scout-candidates.json";

export interface ScoutState {
  at: number | null;
  results: ScoutResult[];
  approved: string[];
}

export const getScout = async (): Promise<ScoutState> => ({ ...(await readJson<{ at: number | null; results: ScoutResult[] }>(RESULTS, { at: null, results: [] })), approved: await readJson<string[]>(APPROVED, []) });

export async function setApproved(id: string, on: boolean) {
  const cur = await readJson<string[]>(APPROVED, []);
  const next = on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id);
  await fs.mkdir(path.join(LIB, "lab"), { recursive: true });
  await writeJson(APPROVED, next);
  return next;
}

const packedToUnit = (rows: Packed[], reader: string): UnitTrade[] => rows.map((x) => ({ entryT: x[0], exitT: x[1], side: x[2] ? "long" : "short", entry: x[3], stop: x[4], target: x[5], exit: x[6], risk: x[7], worst: x[8], best: x[9], points: x[10], outcome: x[11], session: x[12], reader }));

async function approvedVariants(symbol: string): Promise<Variant[]> {
  const ids = await readJson<string[]>(APPROVED, []);
  const out: Variant[] = [];
  for (const id of ids) {
    const [cand, sym] = id.split("@");
    if (sym !== symbol) continue;
    const rows = await fs.readFile(path.join(SCOUT_DIR, `${id.replace(/[^a-z0-9@_-]/gi, "_")}.json`), "utf8").then((x) => JSON.parse(x) as Packed[], () => null);
    const c = (await candidates()).find((x) => x.id === cand);
    if (rows && c) out.push({ id: `scout:${id}`, label: `${c.name}, from the scout`, trades: packedToUnit(rows, "custom") });
  }
  return out;
}

const candidates = async (): Promise<ScoutCandidate[]> => [...SCOUT_CATALOG, ...(await readJson<ScoutCandidate[]>(EXTRA, []))];

/** Runs every candidate over every year of each market and judges it on data it never saw. Finished candidates aren't run again. */
export async function runScout() {
  const key = "scout";
  if (jobs.has(key) && !jobs.get(key)!.error) return jobs.get(key)!;
  const job: LabJob = { key, stage: "Getting ready", done: 0, total: 1 };
  jobs.set(key, job);
  void scout(job).then(() => jobs.delete(key)).catch((e) => {
    job.error = e instanceof Error ? e.message : "The scout failed.";
  });
  return job;
}

export async function scout(job: LabJob) {
  const list = await candidates();
  const idx = await getIndex();
  const raw = await getContext();
  const reference = programByKey("topstep:topstep-50k")!;
  await fs.mkdir(SCOUT_DIR, { recursive: true });
  const prior = await readJson<{ at: number | null; results: ScoutResult[] }>(RESULTS, { at: null, results: [] });
  const results: ScoutResult[] = [];
  const symbols = ["NQ", "ES", "GC"].filter((s) => idx.series[s]);
  job.total = list.length * symbols.length;
  job.done = 0;
  for (const symbol of symbols) {
    const info = idx.series[symbol];
    const market = SYMBOLS[symbol as keyof typeof SYMBOLS];
    const price = pricing(symbol, true)!;
    const context = { fomc: raw.fomc, vix: raw.vix, early: (symbol === "GC" ? raw.earlyCloses.metals : raw.earlyCloses.equity).map((d) => d.date) };
    for (const c of list) {
      job.stage = `${c.name} on ${symbol}`;
      await breathe();
      const id = `${c.id}@${symbol}`;
      const file = path.join(SCOUT_DIR, `${id.replace(/[^a-z0-9@_-]/gi, "_")}.json`);
      let rows = await fs.readFile(file, "utf8").then((x) => JSON.parse(x) as Packed[], () => null);
      const old = prior.results.find((r) => r.id === id);
      if (!rows || (old && old.dataTo < new Date(info.to * 1000).toISOString().slice(0, 10))) {
        rows = [];
        for (const year of info.years) {
          await breathe();
          const from = Date.UTC(year, 0, 1) / 1000;
          const to = Date.UTC(year + 1, 0, 1) / 1000;
          const { bars } = await queryBars(symbol, from - 45 * 86_400, to + 7 * 86_400, TF_SECONDS[c.tf], Infinity);
          if (bars.length < 200) continue;
          const r = runBacktest(bars, { reader: "auto", custom: c.rules, anchor: "rth", side: c.rules.side, pointValue: 1, contracts: 1, balance: 50_000, commission: 0, slippageTicks: 1, tick: market.tick, maxHold: c.tf === "5m" ? 48 : 24, breakEvenR: c.rules.breakEvenR, maxPerDay: c.rules.maxPerDay, skipFomc: false, skipEarly: true, vix: "any", hours: c.rules.session ? SESSION_WINDOWS[c.rules.session].hours : null, context });
          for (const t of r.trades) if (t.entryT >= from && t.entryT < to) rows.push([t.entryT, t.exitT, t.side === "long" ? 1 : 0, t.entry, t.stop, t.target, t.exit, r4(t.riskUsd), r4(t.mae * t.riskUsd), r4(t.mfe * t.riskUsd), r4(t.pnl), t.outcome, t.session]);
        }
        await fs.writeFile(file, JSON.stringify(rows));
      }
      results.push(judge(c, symbol, packedToUnit(rows, "custom"), reference, price, coinFlipOdds(reference, { runs: 400 }).rate, new Date(info.to * 1000).toISOString().slice(0, 10)));
      job.done++;
    }
  }
  results.sort((a, b) => (b.verdict === "recommended" ? 1 : 0) - (a.verdict === "recommended" ? 1 : 0) || b.newer.t - a.newer.t);
  await fs.mkdir(path.join(LIB, "lab"), { recursive: true });
  await writeJson(RESULTS, { at: Date.now(), results });
  jobs.delete("scout");
}

// ── Discover ───────────────────────────────────────────────────────────────────
// Every idea Discover can show (the readers, Vision's patterns and the scout's
// ideas) run over every year of a market at 5m and 15m, each trade tagged with
// the scenario it fired in. Stored per year, so new data only costs the newest.

const DISCOVER_DIR = path.join(ROOT, "discover");
const DISCOVER_TFS: Timeframe[] = ["5m", "15m"];
const discoverFile = (symbol: string, tf: Timeframe, year: number) => path.join(DISCOVER_DIR, symbol.replace(/[^A-Z0-9]/gi, ""), `${tf}-${year}.json`);

export interface DiscoverState {
  symbol: string;
  tf: Timeframe;
  /** Ideas studied on this market across both timeframes: the m in the Bonferroni bar. */
  m: number;
  studies: DetectorStudy[];
  /** When the newest year was last run. */
  at: number | null;
}

export async function getDiscover(symbol: string, tf: Timeframe): Promise<DiscoverState | null> {
  const idx = await getIndex();
  const info = idx.series[symbol];
  if (!info || !DISCOVER_TFS.includes(tf)) return null;
  const merged = new Map<string, PackedRow[]>();
  let at: number | null = null;
  let any = false;
  const ids = new Set<string>();
  for (const t of DISCOVER_TFS)
    for (const year of info.years) {
      const file = discoverFile(symbol, t, year);
      const got = await fs.readFile(file, "utf8").then((x) => JSON.parse(x) as { rows: Record<string, PackedRow[]> }, () => null);
      if (!got) continue;
      for (const id of Object.keys(got.rows)) ids.add(`${t}|${id}`);
      if (t !== tf) continue;
      any = true;
      at = Math.max(at ?? 0, (await fs.stat(file)).mtimeMs);
      for (const [id, rows] of Object.entries(got.rows)) merged.set(id, [...(merged.get(id) ?? []), ...rows]);
    }
  if (!any) return null;
  const scout = await getScout();
  const studies = [...merged.entries()].map(([id, rows]) => {
    const st = summarize(id as DetectorStudy["id"], tf, rows.map(unpack), "library");
    if (id.startsWith("scout:")) {
      const r = scout.results.find((x) => x.id === `${id.slice(6)}@${symbol}`);
      if (r) st.scout = { verdict: r.verdict, reason: r.reason, newerT: r.newer.t };
    }
    return st;
  });
  return { symbol, tf, m: ids.size, studies, at };
}

/** The server's own say on whether a setup source may place a real order on this market: the five readers always; anything else only when Proven here, at the default dials. */
export async function provenHere(source: string, symbol: string): Promise<boolean> {
  if (isReader(source)) return true;
  for (const tf of DISCOVER_TFS) {
    const s = await getDiscover(symbol, tf).catch(() => null);
    const st = s?.studies.find((x) => x.id === source);
    if (s && st && judgeStudy(st, DISCOVER_DEFAULTS, s.m).verdict === "proven") return true;
  }
  return false;
}

export async function runDiscover(o: { symbol: string }) {
  const key = `discover|${o.symbol}`;
  if (jobs.has(key) && !jobs.get(key)!.error) return jobs.get(key)!;
  const job: LabJob = { key, stage: "Getting ready", done: 0, total: 1 };
  jobs.set(key, job);
  void discoverStudy(job, o.symbol)
    .then(() => jobs.delete(key))
    .catch((e) => {
      job.error = e instanceof Error ? e.message : "The Discover study failed.";
    });
  return job;
}

async function discoverStudy(job: LabJob, symbol: string) {
  const idx = await getIndex();
  const info = idx.series[symbol];
  if (!info) throw new Error(`No ${symbol} in your library yet. Add your data in the Library tab.`);
  if (!isSymbol(symbol) || SYMBOLS[symbol].kind !== "futures") throw new Error("Discover studies futures markets only.");
  const market = SYMBOLS[symbol];
  const raw = await getContext();
  const context = { fomc: raw.fomc, vix: raw.vix, early: (symbol === "GC" ? raw.earlyCloses.metals : raw.earlyCloses.equity).map((d) => d.date) };
  const extra = await readJson<ScoutCandidate[]>(EXTRA, []);
  const lastYear = new Date(info.to * 1000).getUTCFullYear();
  const todo: { year: number; tf: Timeframe; file: string }[] = [];
  for (const year of info.years)
    for (const tf of DISCOVER_TFS) {
      const file = discoverFile(symbol, tf, year);
      const old = await fs.readFile(file, "utf8").then((x) => JSON.parse(x) as { to: number }, () => null);
      if (!old || (year === lastYear && old.to < info.to)) todo.push({ year, tf, file });
    }
  const per = (tf: Timeframe) => ideasFor(symbol, tf, true, extra).length;
  job.total = todo.reduce((n, x) => n + per(x.tf), 0) || 1;
  job.done = 0;
  await fs.mkdir(path.dirname(discoverFile(symbol, "5m", 2000)), { recursive: true });
  for (const { year, tf, file } of todo) {
    const from = Date.UTC(year, 0, 1) / 1000;
    const to = Date.UTC(year + 1, 0, 1) / 1000;
    job.stage = `Studying every idea on ${symbol} ${tf}, ${year}`;
    const { bars } = await queryBars(symbol, from - 45 * 86_400, to + 7 * 86_400, TF_SECONDS[tf], Infinity);
    const rows: Record<string, PackedRow[]> = {};
    const ideas = ideasFor(symbol, tf, true, extra);
    if (bars.length > 200) {
      const ctx = patternContext(bars, "rth", levelsFor(bars));
      const series = scenarioSeries(ctx);
      const env: StudyEnv = { anchor: "rth", tick: market.tick, pointValue: market.pointValue!.micro, fee: FEES.micro, maxHold: tf === "5m" ? 48 : 24, context };
      for (const idea of ideas) {
        await breathe();
        const out = studyRows(bars, [idea], env, { ctx, series }, { from, to });
        rows[idea.id] = (out[idea.id] ?? []).map(pack);
        job.done++;
      }
    } else job.done += ideas.length;
    await fs.writeFile(file, JSON.stringify({ to: info.to, rows }));
  }
}
