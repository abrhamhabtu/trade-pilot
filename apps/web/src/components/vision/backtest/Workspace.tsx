"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowRight, Building2, Compass, FlaskConical, FolderOpen, Hand, History, LineChart, ShieldCheck, Sparkles } from "lucide-react";
import { READERS, type ReaderId } from "@/lib/vision/analyze";
import { runBacktest, type BacktestOptions, type BacktestResult, type BacktestTrade } from "@/lib/vision/backtest";
import { accountState, type AccountTrade, type PropAccount } from "@/lib/vision/account";
import type { BacktestRequest } from "@/lib/vision/backtest.worker";
import { SESSION_WINDOWS, parseRules } from "@/lib/vision/custom";
import { SYMBOLS, TF_SECONDS, isSymbol } from "@/lib/vision/markets";
import type { PropReport } from "@/lib/vision/prop";
import type { Verdict } from "@/lib/vision/verdict";
import { programByKey } from "@/lib/proving/firms";
import { useVisionStore, type BacktestSettings } from "@/store/visionStore";
import { dateOf, money, useAccounts, useContext, useHistory, useLibrary, useSaved, type Loaded, type SavedItem } from "./data";
import type { CoinFlipReport, DoctorReport } from "@/lib/vision/doctor";
import { DEFAULT_LIMITS, riskCap, type RiskLimits } from "@/lib/vision/limits";
import { PropDesk, type AutoRunRequest, type AutoRunResult } from "./prop/PropDesk";
import { Library } from "./Library";
import { Replay } from "./Replay";
import { Results, type LeagueRow } from "./Results";
import { SCENARIOS, practiceMonths, type Scenario } from "./scenarios";
import { SetupPanel } from "./SetupPanel";
import { QuickBar } from "./QuickBar";
import { Matrix } from "./Matrix";
import { Gallery } from "./Gallery";
import { Drill } from "./Drill";
import { Card, Pill, Seg } from "./ui";

type Run = { result: BacktestResult; loaded: Loaded; settings: BacktestSettings; league: LeagueRow[] | null; verdict: Verdict | null; prop?: PropReport | null; coin?: CoinFlipReport; doctor?: DoctorReport };

const strategyName = (s: BacktestSettings) => (s.logic === "custom" ? "Your rules" : s.reader === "auto" ? "Every strategy" : READERS[s.reader].label);
const flat = (t: Record<string, unknown>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, /T$/.test(k) && typeof v === "number" ? new Date(v * 1000).toISOString() : v]));

let lastRunNonce = 0;

export function BacktestWorkspace() {
  const tab = useVisionStore((s) => s.btTab);
  const bt = useVisionStore((s) => s.bt);
  const set = useVisionStore((s) => s.set);
  const setBt = useVisionStore((s) => s.setBt);
  const library = useLibrary();
  const saved = useSaved();
  const { ctx, has } = useContext(bt.symbol);
  const history = useHistory(library.lib);
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [replay, setReplay] = useState<{ loaded: Loaded; settings: BacktestSettings; at?: number; scenario?: Scenario; account?: PropAccount } | null>(null);
  const [extra, setExtra] = useState<"matrix" | "gallery" | null>(null);
  const [replayMode, setReplayMode] = useState<"free" | "drill">("free");
  const [drill, setDrill] = useState<{ key: string; trades: BacktestTrade[]; bars: Loaded["bars"] } | null>(null);
  const showGallery = useVisionStore((s) => s.btShow);
  const enterDrill = async () => {
    if (!replay) return;
    setReplayMode("drill");
    const key = `${replay.loaded.key}|${replay.settings.logic}|${replay.settings.reader}|${replay.settings.text}`;
    if (drill?.key === key) return;
    setDrill(null);
    const r = await runQuiet(replay.settings);
    setDrill(r ? { key, trades: r.result.trades, bars: r.loaded.bars } : { key, trades: [], bars: replay.loaded.bars });
  };
  // "Practise" from Discover: straight into the drill once replay has loaded.
  useEffect(() => {
    if (showGallery === "drill" && replay && tab === "replay") {
      set({ btShow: null });
      void enterDrill();
    }
  }, [showGallery, replay, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  // "See examples" from Discover: the gallery opens once that run is in.
  useEffect(() => {
    if (showGallery === "gallery" && run && !running) {
      setExtra("gallery");
      set({ btShow: null });
    }
  }, [showGallery, run, running]); // eslint-disable-line react-hooks/exhaustive-deps
  const desk = useAccounts();
  // The newest copy of each account, for saves that land while replay runs.
  const latest = useRef(new Map<string, PropAccount>());
  useEffect(() => {
    for (const a of desk.accounts ?? []) latest.current.set(a.id, a);
  }, [desk.accounts]);
  const saveAccount = useCallback(
    async (a: PropAccount) => {
      latest.current.set(a.id, a);
      return desk.save(a);
    },
    [desk],
  );
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  useEffect(() => () => worker.current?.terminate(), []);

  /** The engine's options for a set of settings: one place, so every run (the test, the matrix, presets) runs the same way. */
  const buildOptions = useCallback(
    (s: BacktestSettings) => {
      const m = isSymbol(s.symbol) ? SYMBOLS[s.symbol] : null;
      const crypto = m?.kind === "crypto";
      const program = !crypto && s.prop.on ? programByKey(s.prop.program) : null;
      const balance = program ? program.size : s.balance;
      const pointValue = crypto || !m ? 1 : s.micro ? m.pointValue!.micro : m.pointValue!.full;
      const rules = s.logic === "custom" ? (s.rules ?? parseRules(s.text).rules) : null;
      const byRisk = !crypto && s.sizing === "risk";
      const cap = program ? (s.micro ? program.maxMicros : program.maxMinis) : 50;
      const options: BacktestOptions = {
        reader: s.reader,
        custom: rules,
        anchor: crypto ? "utc" : "rth",
        side: s.side !== "both" ? s.side : (rules?.side ?? "both"),
        pointValue,
        contracts: Math.max(1, s.contracts),
        riskDollars: crypto ? s.riskDollars : byRisk ? (balance * s.riskPct) / 100 : undefined,
        integer: byRisk,
        maxUnits: cap,
        balance,
        commission: s.commission,
        slippageTicks: s.slippageTicks,
        tick: m?.tick ?? 0.25,
        maxHold: s.maxHold,
        breakEvenR: rules ? rules.breakEvenR : s.breakEvenR,
        maxPerDay: rules ? rules.maxPerDay : s.maxPerDay,
        skipFomc: s.skipFomc && has.fomc,
        skipEarly: s.skipEarly && has.early,
        vix: has.vix ? s.vix : "any",
        hours: SESSION_WINDOWS[s.session].hours,
        context: ctx,
      };
      return { options, program, byRisk, cap, pointValue };
    },
    [ctx, has],
  );
  /** A run with no screen of its own: for the matrix and presets. Its own worker, so the main test is untouched. */
  const quiet = useRef<Worker | null>(null);
  const runQuiet = useCallback(
    async (patch: Partial<BacktestSettings>): Promise<{ result: BacktestResult; prop: PropReport | null; settings: BacktestSettings; loaded: Loaded } | null> => {
      const s = { ...useVisionStore.getState().bt, ...patch };
      const loaded = await history.load(s);
      if (!loaded) return null;
      const { options, program, byRisk, cap, pointValue } = buildOptions(s);
      quiet.current ??= new Worker(new URL("../../../lib/vision/backtest.worker.ts", import.meta.url));
      const w = quiet.current;
      const id = Date.now() + Math.random();
      return new Promise((resolve) => {
        let result: BacktestResult | null = null;
        w.onmessage = (e: MessageEvent) => {
          const msg = e.data;
          if (msg.id !== id) return;
          if (msg.type === "done") {
            result = msg.result;
            if (!program) resolve({ result: msg.result, prop: null, settings: s, loaded });
          } else if (msg.type === "prop" && result) resolve({ result, prop: msg.report, settings: s, loaded });
          else if (msg.type === "error") resolve(null);
        };
        w.postMessage({ id, bars: loaded.bars, options, league: false, prop: program ? { programKey: program.key, contracts: byRisk ? cap : Math.max(1, s.contracts), micro: s.micro, pointValue, stepSeconds: TF_SECONDS[s.tf], fixedSize: !byRisk } : null } satisfies BacktestRequest);
      });
    },
    [history, buildOptions],
  );
  const stopQuiet = useCallback(() => {
    quiet.current?.terminate();
    quiet.current = null;
  }, []);
  useEffect(() => () => quiet.current?.terminate(), []);

  const start = useCallback(
    async (override?: Partial<BacktestSettings>) => {
      const s = { ...useVisionStore.getState().bt, ...override };
      if (override) setBt(override);
      setError("");
      setRunning(true);
      setProgress(null);
      const loaded = await history.load(s);
      if (!loaded) {
        setRunning(false);
        return;
      }
      const { options, program, byRisk, cap, pointValue } = buildOptions(s);
      worker.current ??= new Worker(new URL("../../../lib/vision/backtest.worker.ts", import.meta.url));
      const id = ++seq.current;
      worker.current.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.id !== seq.current) return;
        if (msg.type === "progress") setProgress(msg.done / msg.total);
        else if (msg.type === "done") {
          setRun({ result: msg.result, loaded, settings: s, league: null, verdict: null, prop: program ? undefined : null });
          setSaveState("idle");
          setRunning(false);
          setProgress(null);
        } else if (msg.type === "verdict") setRun((r) => (r ? { ...r, verdict: msg.verdict } : r));
        else if (msg.type === "doctor") setRun((r) => (r ? { ...r, coin: msg.coin, doctor: msg.doctor } : r));
        else if (msg.type === "prop") setRun((r) => (r ? { ...r, prop: msg.report } : r));
        else if (msg.type === "league") setRun((r) => (r ? { ...r, league: msg.rows } : r));
        else if (msg.type === "error") {
          setError(msg.error);
          setRunning(false);
        }
      };
      worker.current.postMessage({
        id,
        bars: loaded.bars,
        options,
        league: true,
        prop: program ? { programKey: program.key, contracts: byRisk ? cap : Math.max(1, s.contracts), micro: s.micro, pointValue, stepSeconds: TF_SECONDS[s.tf], fixedSize: !byRisk } : null,
      } satisfies BacktestRequest);
    },
    [history, buildOptions, setBt],
  );

  const startReplay = async (override?: Partial<BacktestSettings>, scenario?: Scenario) => {
    const s = { ...useVisionStore.getState().bt, ...override };
    if (override) setBt(override);
    setError("");
    setRunning(true);
    const loaded = await history.load(s);
    setRunning(false);
    if (loaded) {
      setReplay({ loaded, settings: s, scenario });
      set({ btTab: "replay" });
    }
  };

  // "Backtest this" from the chart, Discover or the quick bar: run once the library index is in, so a run never falls back to delayed free data by accident.
  const runNonce = useVisionStore((s) => s.btRunNonce);
  const libReady = !!library.lib || !!library.error;
  useEffect(() => {
    // The request usually arrives before this tab mounts, so the last run is kept outside the component.
    if (runNonce === lastRunNonce || !libReady || running) return;
    lastRunNonce = runNonce;
    if (useVisionStore.getState().btTab === "replay") void startReplay();
    else void start();
  }, [runNonce, libReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Prop accounts ──
  const windowFor = (a: PropAccount, daysAhead: number) => {
    const fromT = a.cursorT ?? Date.parse(`${a.startDate}T12:00:00Z`) / 1000;
    const iso = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
    return { fromT, settings: { ...useVisionStore.getState().bt, symbol: a.symbol, tf: a.tf, source: library.lib?.series[a.symbol] ? ("library" as const) : ("feed" as const), days: -1, from: iso(fromT - 12 * 86_400), to: iso(fromT + daysAhead * 86_400), micro: a.micro, contracts: a.contracts, sizing: a.sizing, riskPct: a.riskPct, prop: { on: true, program: a.program } } };
  };
  const openAccountReplay = async (a0: PropAccount) => {
    const a = latest.current.get(a0.id) ?? a0;
    const { settings } = windowFor(a, 130);
    setError("");
    setRunning(true);
    const loaded = await history.load(settings);
    setRunning(false);
    if (!loaded) return;
    const s = accountState(a);
    await saveAccount({ ...a, events: [...a.events, { at: Date.now(), kind: "session", text: `Replay from ${dateOf(a.cursorT ?? Date.parse(`${a.startDate}T14:30:00Z`) / 1000)}${s ? ` at $${Math.round(s.balance).toLocaleString("en-US")}` : ""}` }] });
    setReplay({ loaded, settings, account: latest.current.get(a.id) });
    set({ btTab: "replay" });
  };
  const addAccountTrade = (id: string, t: AccountTrade) => {
    const a = latest.current.get(id);
    if (!a || a.trades.some((x) => x.id === t.id)) return;
    const before = accountState(a)?.status;
    const next: PropAccount = { ...a, trades: [...a.trades, t], cursorT: Math.max(a.cursorT ?? 0, t.exitT) };
    const after = accountState(next);
    if (after && after.status !== before && after.status !== "active") next.events = [...next.events, { at: Date.now(), kind: after.status === "passed" ? "passed" : "blown", text: after.headline }];
    saveAccount(next);
  };
  const saveCursor = (id: string, t: number) => {
    const a = latest.current.get(id);
    if (a && a.cursorT !== t) saveAccount({ ...a, cursorT: t });
  };
  const autoRun = async (a0: PropAccount, req: AutoRunRequest): Promise<AutoRunResult> => {
    const a = latest.current.get(a0.id) ?? a0;
    const s0 = accountState(a);
    if (!s0) return { error: "That firm program is no longer listed." };
    if (s0.status !== "active") return { error: `This account is ${s0.status}. Reset it to try again.` };
    const horizon = req.horizon === "pass" ? 365 : Math.ceil(req.horizon * 1.5) + 7;
    const { fromT, settings } = windowFor(a, horizon);
    const loaded = await history.load(settings);
    if (!loaded) return { error: history.error || "No bars for that period." };
    const m = isSymbol(a.symbol) ? SYMBOLS[a.symbol] : null;
    const program = s0.program;
    const cap = a.micro ? program.maxMicros : program.maxMinis;
    const bt0 = useVisionStore.getState().bt;
    const limits = await fetch("/api/library/lab?view=limits", { cache: "no-store" }).then((r) => r.json()).then((j) => j.limits as RiskLimits).catch(() => DEFAULT_LIMITS);
    const capUsd = a.phase === "live" ? (program.size * limits.livePct) / 100 : program.drawdown * riskCap(limits, a.symbol, a.phase);
    const rules = req.strategy.logic === "custom" ? (bt0.rules ?? parseRules(bt0.text).rules) : null;
    const pv = m ? (a.micro ? m.pointValue!.micro : m.pointValue!.full) : 1;
    const r = runBacktest(loaded.bars, {
      reader: req.strategy.logic === "vision" ? req.strategy.reader : "auto",
      custom: rules,
      anchor: "rth",
      side: rules?.side ?? "both",
      pointValue: pv,
      contracts: Math.min(cap, Math.max(1, a.contracts)),
      riskDollars: a.sizing === "risk" ? (program.size * a.riskPct) / 100 : undefined,
      integer: a.sizing === "risk",
      maxUnits: cap,
      balance: program.size,
      commission: bt0.commission,
      slippageTicks: bt0.slippageTicks,
      tick: m?.tick ?? 0.25,
      maxHold: bt0.maxHold,
      breakEvenR: rules ? rules.breakEvenR : bt0.breakEvenR,
      maxPerDay: rules ? rules.maxPerDay : bt0.maxPerDay,
      skipFomc: bt0.skipFomc && has.fomc,
      skipEarly: bt0.skipEarly && has.early,
      vix: has.vix ? bt0.vix : "any",
      hours: SESSION_WINDOWS[req.session].hours,
      context: ctx,
    });
    const name = rules ? "Your rules" : req.strategy.logic === "vision" && req.strategy.reader !== "auto" ? READERS[req.strategy.reader].label : "Every Vision strategy";
    const fresh = r.trades.filter((t) => t.entryT > fromT);
    // Add a day at a time and stop the moment the firm would.
    const days: string[] = [];
    for (const t of fresh) if (days[days.length - 1] !== t.session) days.push(t.session);
    let next = a;
    let used = 0;
    let st = s0;
    for (const d of days.slice(0, req.horizon === "pass" ? undefined : req.horizon)) {
      // Anything over the trader's risk limit is cut to fit, and skipped if one contract is too much.
      const add: AccountTrade[] = fresh.filter((t) => t.session === d).flatMap((t) => {
        const qty = Math.min(t.units, Math.floor(capUsd / Math.max(0.01, t.riskUsd / t.units)));
        if (qty <= 0) return [];
        const f = qty / t.units;
        return [{ id: `a${t.entryT}${t.n}`, entryT: t.entryT, exitT: t.exitT, session: t.session, side: t.side, qty, entry: t.entry, exit: t.exit, stop: t.stop, target: t.target, pnl: t.pnl * f, r: t.r, worst: t.mae * t.riskUsd * f, best: t.mfe * t.riskUsd * f, reason: t.outcome, source: "auto" as const, strategy: name }];
      });
      if (!add.length) continue;
      next = { ...next, trades: [...next.trades, ...add], cursorT: add[add.length - 1].exitT };
      used += add.length;
      st = accountState(next)!;
      if (st.status !== "active") break;
    }
    const pnl = st.balance - s0.balance;
    const endT = used ? next.cursorT! : loaded.bars[loaded.bars.length - 1].t;
    const text = used
      ? `${name}: ${used} trades over ${new Set(next.trades.slice(-used).map((t) => t.session)).size} days, ${money(pnl)}. ${st.status === "passed" ? `Passed — ${st.headline}.` : st.status === "blown" ? `Blown — ${st.headline}.` : `Still going: ${st.headline}.`}`
      : `${name} found no trades in ${SESSION_WINDOWS[req.session].label} after ${dateOf(fromT)}.`;
    await saveAccount({ ...next, cursorT: endT, events: [...next.events, { at: Date.now(), kind: "run", text }, ...(st.status !== "active" ? [{ at: Date.now() + 1, kind: st.status === "passed" ? ("passed" as const) : ("blown" as const), text: st.headline }] : [])] });
    return { added: used, pnl, text };
  };

  const replayTrade = (t: BacktestTrade) => {
    if (!run) return;
    setReplay({ loaded: run.loaded, settings: run.settings, at: Math.max(0, t.entryIndex - 40) });
    set({ btTab: "replay" });
  };

  const saveRun = async () => {
    if (!run) return;
    setSaveState("saving");
    const { result, settings } = run;
    const st = result.stats;
    const journal = useVisionStore.getState().journal;
    const item = await saved.save({
      item: {
        kind: "backtest",
        name: `${strategyName(settings)} · ${settings.symbol} ${settings.tf} · ${dateOf(result.from)} – ${dateOf(result.to)}`,
        symbol: settings.symbol,
        tf: settings.tf,
        summary: { trades: st.trades, winRate: st.winRate, netR: st.netR, pnl: st.pnl, profitFactor: st.profitFactor === Infinity ? 999 : st.profitFactor, maxDrawdown: st.maxDrawdown, sharpe: st.sharpe, grade: run.verdict?.grade ?? "", from: result.from, to: result.to },
      },
      settings,
      trades: result.trades.map((t) => {
        const j = journal[`${settings.symbol}:${t.entryT}`];
        return flat({ ...(t as unknown as Record<string, unknown>), tags: j?.tags.join("; ") ?? "", note: j?.note ?? "" });
      }),
      extra: { stats: result.stats, by: result.by, daily: result.daily, skipped: result.skipped, source: run.loaded.label, league: run.league, verdict: run.verdict, prop: run.prop ? { program: run.prop.program.key, first: run.prop.first.headline, rolling: run.prop.rolling, funded: run.prop.funded, firms: run.prop.firms.map((f) => ({ key: f.key, passRate: f.rolling.passRate })) } : null },
    });
    setSaveState(item ? "saved" : "error");
  };

  const openSaved = async (s: SavedItem) => {
    const r = await fetch(`/api/library/saved?id=${s.id}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    set({ btTab: "test" });
    start(j.settings as BacktestSettings);
  };

  const stale = run && JSON.stringify(run.settings) !== JSON.stringify(bt);
  const nq = library.lib?.series.NQ;
  const runSym = run && isSymbol(run.settings.symbol) ? SYMBOLS[run.settings.symbol] : null;

  return (
    <div className="space-y-5">
      {/* You are in backtest mode */}
      <section className="flex flex-wrap items-center gap-4 rounded-[24px] border border-[#5AC8FA]/25 bg-[linear-gradient(100deg,rgba(90,200,250,0.16),rgba(90,200,250,0.04)_60%,rgba(18,18,20,0.6))] px-5 py-3.5 backdrop-blur-2xl">
        <span className="relative grid h-10 w-10 place-items-center rounded-[13px] bg-gradient-to-br from-[#A6E8FF] to-[#2FA8EE] text-black shadow-[0_12px_28px_-12px_rgba(90,200,250,0.9)]">
          <FlaskConical className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] font-bold text-white">
            Backtesting <Pill tone="cyan">HISTORY ONLY</Pill>
            {bt.prop.on && <span className="rounded-full bg-[#BF5AF2]/18 px-2 py-0.5 text-[11.5px] font-semibold text-[#E3B5FF]">PROP FIRM MODE</span>}
          </p>
          <p className="text-[13px] text-white/60">Your strategies run over past bars. Nothing here touches your paper book, your stats or a broker.</p>
        </div>
        <span className="flex items-center gap-1.5 text-[12.5px] text-white/50">
          <ShieldCheck className="h-4 w-4 text-[#9BE1FF]" />
          {nq ? `NQ ${new Date(nq.from * 1000).getUTCFullYear()}–${new Date(nq.to * 1000).getUTCFullYear()} · ${(nq.bars / 1e6).toFixed(1)}M bars in your library` : "Free feeds · add files for years of history"}
        </span>
      </section>

      <Seg
        value={tab}
        onChange={(btTab) => set({ btTab })}
        label="Backtest section"
        options={[
          { v: "test" as const, l: <span className="flex items-center gap-1.5"><LineChart className="h-4 w-4" /> Strategy test</span> },
          { v: "prop" as const, l: <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> Prop firm{desk.accounts?.length ? ` · ${desk.accounts.length}` : ""}</span> },
          { v: "replay" as const, l: <span className="flex items-center gap-1.5"><History className="h-4 w-4" /> Replay</span> },
          { v: "library" as const, l: <span className="flex items-center gap-1.5"><FolderOpen className="h-4 w-4" /> Library{saved.items?.length ? ` · ${saved.items.length}` : ""}</span> },
        ]}
      />

      {(error || history.error) && <p className="rounded-2xl bg-[#FF7A85]/12 px-4 py-2.5 text-[13.5px] text-[#FFA3AB]">{error || history.error}</p>}

      {tab === "test" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-3">
            <QuickBar onRun={(patch) => start(patch)} run={runQuiet} />
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setExtra(extra === "matrix" ? null : "matrix")} className={clsx("rounded-full px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-white/[0.06]", extra === "matrix" ? "bg-white text-black" : "bg-white/[0.06] text-white/75 hover:bg-white/[0.1]")}>
                Run everywhere
              </button>
              <button disabled={!run?.result.trades.length} onClick={() => setExtra(extra === "gallery" ? null : "gallery")} className={clsx("rounded-full px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-white/[0.06] disabled:opacity-40", extra === "gallery" ? "bg-white text-black" : "bg-white/[0.06] text-white/75 hover:bg-white/[0.1]")}>
                Setup gallery{run?.result.trades.length ? ` · ${run.result.trades.length}` : ""}
              </button>
            </div>
            {extra === "matrix" && <Matrix settings={bt} run={runQuiet} stop={stopQuiet} onOpen={(patch) => { setExtra(null); void start(patch); }} />}
            {extra === "gallery" && run && isSymbol(run.settings.symbol) && <Gallery trades={run.result.trades} bars={run.loaded.bars} symbol={run.settings.symbol} onOpen={replayTrade} />}
            {stale && !running && (
              <button onClick={() => start()} className="flex w-full items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-2.5 text-left text-[13px] text-white/65 ring-1 ring-white/[0.06] hover:bg-white/[0.08]">
                <span>Settings changed since this run.</span>
                <span className="font-semibold text-[#9BE1FF]">Run again</span>
              </button>
            )}
            {run ? (
              <Results
                result={run.result}
                loaded={run.loaded}
                sym={runSym}
                tf={run.settings.tf}
                anchor={runSym?.kind === "crypto" ? "utc" : "rth"}
                title={`${strategyName(run.settings)} · ${runSym?.kind === "futures" ? `/${run.settings.micro ? runSym.roots!.micro : runSym.roots!.full}` : run.settings.symbol}`}
                label={`${SESSION_WINDOWS[run.settings.session].label} · ${run.loaded.label}${run.loaded.truncated ? " · latest bars only" : ""}`}
                onSave={saveRun}
                saved={saveState}
                league={run.league}
                verdict={run.verdict}
                prop={run.prop}
                coin={run.coin ?? null}
                doctor={run.doctor ?? null}
                onApply={(patch) => start(patch)}
                onUse={(reader: ReaderId) => start({ logic: "vision", reader })}
                onReplayTrade={replayTrade}
                onProgram={(program) => start({ prop: { on: true, program } })}
                onSize={(contracts) => start({ sizing: "fixed", contracts })}
              />
            ) : (
              <Home running={running} onGuided={() => set({ btTab: "replay" })} onManual={() => set({ btTab: "replay" })} />
            )}
          </div>
          <div>
            <SetupPanel lib={library.lib} has={has} onRun={() => start()} running={running} progress={progress} />
          </div>
        </div>
      )}

      {tab === "replay" &&
        (replay && isSymbol(replay.settings.symbol) ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="cyan">
                {replay.settings.symbol} · {replay.settings.tf}
              </Pill>
              <Pill>
                {dateOf(replay.loaded.bars[0].t)} – {dateOf(replay.loaded.bars[replay.loaded.bars.length - 1].t)}
              </Pill>
              {replay.account && (
                <button onClick={() => set({ btTab: "prop", propAccount: replay.account!.id })} className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold text-white ring-1 ring-white/15" style={{ background: `${replay.account.color}30` }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: replay.account.color }} /> {replay.account.name}
                </button>
              )}
              {replay.scenario ? <Pill tone="cyan">Scenario · {replay.scenario.name}</Pill> : <Pill>Vision hints · {replay.settings.logic === "custom" || replay.settings.reader === "auto" ? "every Vision strategy" : READERS[replay.settings.reader].label}</Pill>}
              <Seg
                size="sm"
                value={replayMode}
                label="Replay mode"
                onChange={(m) => (m === "drill" ? void enterDrill() : setReplayMode("free"))}
                options={[
                  { v: "free" as const, l: "Free play" },
                  { v: "drill" as const, l: "Drill" },
                ]}
              />
              <button onClick={() => setReplay(null)} className="ml-auto rounded-full bg-white/[0.07] px-3 py-1.5 text-[12.5px] font-semibold text-white/75 hover:bg-white/[0.12]">
                Change market or period
              </button>
            </div>
            {replayMode === "drill" &&
              (drill ? (
                <Drill
                  key={drill.key}
                  bars={drill.bars}
                  trades={drill.trades}
                  name={strategyName(replay.settings)}
                  onOpen={(t) => {
                    setReplayMode("free");
                    setReplay((r) => (r ? { ...r, at: Math.max(0, t.entryIndex - 40) } : r));
                  }}
                  onSave={async (picks) =>
                    !!(await saved.save({
                      item: { kind: "replay", name: `Decision drill · ${strategyName(replay.settings)} · ${replay.settings.symbol} ${replay.settings.tf}`, symbol: replay.settings.symbol, tf: replay.settings.tf, summary: { setups: picks.length, taken: picks.filter((p) => p.take).length, yourR: +picks.filter((p) => p.take).reduce((a, p) => a + p.t.r, 0).toFixed(2), allR: +picks.reduce((a, p) => a + p.t.r, 0).toFixed(2) } },
                      settings: replay.settings,
                      trades: picks.map((p) => flat({ ...(p.t as unknown as Record<string, unknown>), took: p.take ? 1 : 0 })),
                      extra: { drill: true },
                    }))
                  }
                />
              ) : (
                <p className="rounded-2xl bg-white/[0.04] p-4 text-[13.5px] text-white/55">Finding every setup in this period…</p>
              ))}
            {replayMode === "free" && (
            <Replay
              key={`${replay.loaded.key}:${replay.at ?? ""}:${replay.account?.id ?? ""}`}
              account={replay.account}
              onAccountTrade={replay.account ? (t) => addAccountTrade(replay.account!.id, t) : undefined}
              onCursor={replay.account ? (t) => saveCursor(replay.account!.id, t) : undefined}
              onMore={replay.account ? () => openAccountReplay(replay.account!) : undefined}
              loaded={replay.loaded}
              sym={SYMBOLS[replay.settings.symbol]}
              tf={replay.settings.tf}
              anchor={SYMBOLS[replay.settings.symbol].kind === "crypto" ? "utc" : "rth"}
              reader={replay.scenario?.reader ?? (replay.settings.logic === "custom" ? "auto" : replay.settings.reader)}
              scenario={replay.scenario}
              startAt={replay.at}
              settings={replay.settings}
              onSave={async ({ trades, from, to }) => {
                const net = trades.reduce((a, t) => a + t.pnl, 0);
                const journal = useVisionStore.getState().journal;
                const item = await saved.save({
                  item: {
                    kind: "replay",
                    name: `Replay · ${replay.settings.symbol} ${replay.settings.tf} · ${dateOf(from)}${dateOf(to) !== dateOf(from) ? ` – ${dateOf(to)}` : ""}`,
                    symbol: replay.settings.symbol,
                    tf: replay.settings.tf,
                    summary: { trades: trades.length, winRate: trades.filter((t) => t.pnl > 0).length / trades.length, pnl: net, netR: trades.reduce((a, t) => a + t.r, 0) },
                  },
                  settings: replay.settings,
                  trades: trades.map((t) => {
                    const j = journal[`${replay.settings.symbol}:${t.entryT}`];
                    return flat({ ...(t as unknown as Record<string, unknown>), tags: j?.tags.join("; ") ?? "", note: j?.note ?? "" });
                  }),
                });
                return !!item;
              }}
            />
            )}
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-5">
              <Card>
                <span className="grid h-12 w-12 place-items-center rounded-[15px] bg-[#5AC8FA]/14 text-[#9BE1FF]">
                  <History className="h-6 w-6" />
                </span>
                <h2 className="mt-4 text-[28px] font-bold tracking-[-0.02em] text-white">
                  Replay it by hand, <span className="bg-gradient-to-r from-[#5AC8FA] to-[#BF5AF2] bg-clip-text text-transparent">bar by bar</span>.
                </h2>
                <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-white/60">
                  Step through real history with the future hidden, placing market, limit and stop orders as price moves. Size by % risk, move stops to break-even automatically, keep a higher timeframe in view, and in prop firm mode the firm&apos;s drawdown and daily limit run live.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-4">
                  {[
                    ["Load", "A symbol and a start date anywhere in your history"],
                    ["Replay", "One candle at a time, or play up to 25×"],
                    ["Trade", "Orders fill bar by bar against real prices"],
                    ["Review", "Every fill journals with tags and notes"],
                  ].map(([a, b], i) => (
                    <div key={a} className="rounded-[18px] bg-white/[0.04] p-3 ring-1 ring-inset ring-white/[0.05]">
                      <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
                        <span className="grid h-5 w-5 place-items-center rounded-md bg-white/[0.1] text-[11px]">{i + 1}</span> {a}
                      </p>
                      <p className="mt-1 text-[12px] leading-snug text-white/50">{b}</p>
                    </div>
                  ))}
                </div>
              </Card>
              <Scenarios lib={library.lib} onUse={(sc, month) => startReplay({ symbol: sc.symbol, source: library.lib?.series[sc.symbol] ? "library" : "feed", tf: sc.tf, session: sc.session, days: -1, from: month.from, to: month.to, reader: sc.reader }, sc)} busy={running} />
            </div>
            <SetupPanel lib={library.lib} has={has} onRun={() => startReplay()} running={running} progress={null} rules={false} runLabel="Start replay" />
          </div>
        ))}

      {tab === "prop" && <PropDesk accounts={desk.accounts} lib={library.lib} error={desk.error || history.error} onSave={saveAccount} onRemove={desk.remove} onReplay={openAccountReplay} onAutoRun={autoRun} />}

      {tab === "library" && <Library lib={library.lib} error={library.error} refresh={library.refresh} saved={saved.items} onRemoveSaved={saved.remove} onOpenRun={openSaved} />}
    </div>
  );
}

/** Where to start: find an edge, test execution, or test rules. */
function Home({ running, onGuided, onManual }: { running: boolean; onGuided: () => void; onManual: () => void }) {
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#9BE1FF]">● How it works</p>
        <h2 className="mt-2 text-[34px] font-bold leading-[1.05] tracking-[-0.035em] text-white">{running ? "Running your strategy over history…" : "Learn your strategy's edge in 3 steps."}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ["1", "Describe it", "Pick the market, balance and session, then choose one of your Vision strategies or write the logic in plain English."],
            ["2", "Vision reads and runs it", "Your words become named rules you can read back and adjust, run over every bar with real fills, costs and slippage."],
            ["3", "Read the results", "A full report and an edge verdict, prop firm pass odds, and every trade to replay, tag and journal."],
          ].map(([n, a, b]) => (
            <div key={n} className="rounded-[20px] bg-white/[0.04] p-4 ring-1 ring-inset ring-white/[0.05]">
              <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-white text-[13px] font-bold text-black">{n}</span>
              <p className="mt-3 text-[15px] font-bold text-white">{a}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-white/50">{b}</p>
            </div>
          ))}
        </div>
      </Card>
      <div>
        <p className="mb-2 px-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/45">Choose your starting point</p>
        <div className="grid gap-3 md:grid-cols-3">
          <Start icon={<Compass className="h-5 w-5" />} kicker="Guided scenarios" title="I'm finding my edge" body="Pick a setup; Vision points you to where it formed so you can practise it cold." onClick={onGuided} />
          <Start icon={<Hand className="h-5 w-5" />} kicker="Manual replay" title="I want to test my execution" body="Trade history bar by bar with real order types and the firm's rules running." onClick={onManual} />
          <Start icon={<Sparkles className="h-5 w-5" />} kicker="Automated" title="I want to test my rules" body="Set it up on the right and run years of history in seconds." active />
        </div>
      </div>
    </div>
  );
}

function Start({ icon, kicker, title, body, onClick, active }: { icon: React.ReactNode; kicker: string; title: string; body: string; onClick?: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={!onClick} className={clsx("group rounded-[22px] p-4 text-left ring-1 transition", active ? "bg-[#5AC8FA]/[0.08] ring-[#5AC8FA]/40" : "bg-[#121214]/80 ring-white/[0.07] hover:bg-white/[0.05]")}>
      <span className={clsx("grid h-9 w-9 place-items-center rounded-[11px]", active ? "bg-[#5AC8FA] text-black" : "bg-white/[0.07] text-white/75")}>{icon}</span>
      <p className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{kicker}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[15px] font-bold text-white">
        {title} {onClick && <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />}
      </p>
      <p className="mt-1 text-[12.5px] leading-snug text-white/50">{body}</p>
    </button>
  );
}

function Scenarios({ lib, onUse, busy }: { lib: ReturnType<typeof useLibrary>["lib"]; onUse: (s: Scenario, m: { from: string; to: string }) => void; busy: boolean }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/45">
            <span className="rounded-full bg-gradient-to-r from-[#5AC8FA] to-[#BF5AF2] px-2 py-0.5 text-[9.5px] text-white">GUIDED</span> For &quot;I&apos;m finding my edge&quot;
          </p>
          <h3 className="mt-1 text-[22px] font-bold tracking-tight text-white">Practise a guided scenario</h3>
          <p className="text-[13px] text-white/50">We tell you what to test and where it formed; you build the rep.</p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {SCENARIOS.map((sc) => {
          const months = practiceMonths(lib?.series[sc.symbol] ?? null, sc.months);
          return (
            <div key={sc.id} className="rounded-[22px] bg-[#121214]/80 p-4 ring-1 ring-white/[0.07]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] font-bold text-white">{sc.name}</p>
                <span className="rounded-full bg-gradient-to-r from-[#5AC8FA] to-[#BF5AF2] px-2 py-0.5 font-mono text-[9.5px] font-bold text-white">SCENARIO</span>
              </div>
              <p className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">What to test</p>
              <p className="mt-0.5 text-[13px] leading-snug text-white/70">{sc.what}</p>
              <p className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                Practice periods · {sc.symbol} {sc.tf} · {SESSION_WINDOWS[sc.session].label}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {months.map((m) => (
                  <button key={m.label} disabled={busy} onClick={() => onUse(sc, m)} className="rounded-lg bg-white/[0.06] px-2.5 py-1 font-mono text-[11.5px] text-white/75 ring-1 ring-white/[0.06] hover:bg-white hover:text-black disabled:opacity-40">
                    {m.label}
                  </button>
                ))}
              </div>
              <button disabled={busy || !months.length} onClick={() => months[0] && onUse(sc, months[0])} className="mt-3 w-full rounded-[13px] bg-white py-2.5 text-[13.5px] font-bold text-black disabled:opacity-40">
                Use this scenario
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
