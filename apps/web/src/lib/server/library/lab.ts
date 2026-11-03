// ─── The lab's long work ───────────────────────────────────────────────────────
// Runs every strategy variant over the library, a year at a time, and keeps the
// trades per contract on disk. Each year is done once, so adding new data only
// costs the new year, and every study after the first is arithmetic on stored
// trades (lib/vision/lab.ts). Runs in this process between other requests.
// ───────────────────────────────────────────────────────────────────────────────

import { promises as fs } from "fs";
import path from "path";
import { READERS, READER_ORDER, type ReaderId } from "@/lib/vision/analyze";
import { runBacktest } from "@/lib/vision/backtest";
import { SESSION_WINDOWS, type SessionKey } from "@/lib/vision/custom";
import { accountState, resetAccount, type AccountTrade, type PropAccount } from "@/lib/vision/account";
import { baselineWalk, coinFlipOdds, planKey, planLabel, rollingOdds, simulate, sizingStudy, toUnitDays, walkSteps, type Attempt, type Odds, type Pricing, type SizingPlan, type SizingStudy, type UnitTrade, type Variant, type WalkResult } from "@/lib/vision/lab";
import { SYMBOLS, TF_SECONDS, isSymbol, type Timeframe } from "@/lib/vision/markets";
import { programByKey } from "@/lib/proving/firms";
import { LIB, getContext, getIndex, queryBars } from "./index";

const VERSION = "v1";
const ROOT = path.join(LIB, "lab", VERSION);
const SESSIONS: SessionKey[] = ["ny", "open", "london"];
const TFS: Timeframe[] = ["5m", "15m"];
const BREAKEVEN: (number | null)[] = [null, 1];
/** Round-trip cost per contract, an estimate of commissions and exchange fees. */
export const FEES = { micro: 1.04, full: 3.64 };

export const pricing = (symbol: string, micro: boolean): Pricing | null => {
  if (!isSymbol(symbol)) return null;
  const pv = SYMBOLS[symbol].pointValue;
  return pv ? { pointValue: micro ? pv.micro : pv.full, fee: micro ? FEES.micro : FEES.full, micro } : null;
};

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
export async function loadVariants(symbol: string): Promise<Variant[]> {
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
}

const studyFile = (program: string, symbol: string, micro: boolean) => path.join(ROOT, "studies", `${program.replace(/[^a-z0-9-]/gi, "_")}-${symbol}-${micro ? "micro" : "full"}.json`);

export const getStudy = (program: string, symbol: string, micro: boolean): Promise<Study | null> =>
  fs.readFile(studyFile(program, symbol, micro), "utf8").then((x) => JSON.parse(x) as Study, () => null);

const contractWord = (symbol: string, micro: boolean) => {
  const roots = isSymbol(symbol) ? SYMBOLS[symbol].roots : undefined;
  return roots ? (micro ? roots.micro : roots.full) : micro ? "micros" : "contracts";
};

const CAUSE_NAMES: Record<string, string> = { streak: "A long losing streak", trail: "The trailing floor took it", oversize: "Too big for the room", "one-day": "One day did most of it", bleed: "It was winning, then gave it back", stuck: "Stuck over the target", stalled: "Ran out of road" };

const stripAttempt = <T extends { attempt?: Attempt }>({ attempt: _gone, ...rest }: T) => rest; // eslint-disable-line @typescript-eslint/no-unused-vars

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
  const price = pricing(o.symbol, o.micro);
  if (!p) throw new Error("That firm program is no longer listed.");
  if (!price) throw new Error(`${o.symbol} can't be studied.`);
  await ensureTrades(o.symbol, job);
  job.stage = "Reading the trades";
  await breathe();
  const variants = await loadVariants(o.symbol);
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
    coin: coinFlipOdds(p, { runs: 800 }),
    walk: { ...walk, steps: walk.steps.map(stripAttempt) },
    sizing,
    league: league.slice(0, 16),
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
  const price = pricing(a.symbol, a.micro);
  if (!s || !price) throw new Error("This account can't be traded here.");
  const v = (await loadVariants(a.symbol)).find((x) => x.id === o.variant);
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
  const price = pricing(a.symbol, a.micro);
  if (!p || !price) throw new Error("This account can't be traded here.");
  const variants = await loadVariants(a.symbol);
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
