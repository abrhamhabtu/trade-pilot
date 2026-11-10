"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, FlaskConical, Layers, Play, RefreshCw, Sparkles, Square, X } from "lucide-react";
import { PRESETS, type ChartView, type Density } from "@/lib/vision/chartView";
import { READERS, READER_ORDER, _internal, analyze, infoOf, isReader, readerStats, type ReaderChoice, type ReaderId, type Scan, type Setup, type SetupSource, type Side } from "@/lib/vision/analyze";
import { DISCOVER_DEFAULTS, calendarOf, detectorFor, fitLine, ideasFor, isNew, judgeStudy, rankIdeas, scenarioAt, scenarioSeries, sourceLine, type ChartRead, type Idea, type Ranked, type Scenario, type Verdict } from "@/lib/vision/discover";
import { enrich, patternContext } from "@/lib/vision/patterns";
import { useDiscover } from "@/lib/vision/useDiscover";
import type { SessionKey } from "@/lib/vision/custom";
import type { Bucket } from "@/lib/vision/levels";
import { useVisionStore, type BacktestSettings } from "@/store/visionStore";
import { runBacktest } from "@/lib/vision/backtest";
import { FEES } from "@/lib/vision/limits";
import { DiscoverPanel, FitChip, NewBadge, VERDICT, VerdictBadge, statLine } from "./DiscoverPanel";
import { buildDemo, type Demo } from "@/lib/vision/demo";
import { useFeed, type Feed } from "@/lib/vision/feed";
import type { DayLevels } from "@/lib/vision/levels";
import { sessionStartIndex, useLevels } from "@/lib/vision/useLevels";
import type { Bar } from "@/lib/pilot/market";
import { SYMBOLS, TF_SECONDS, TIMEFRAMES, formatPrice, type Timeframe, type VisionSymbolId } from "@/lib/vision/markets";
import type { VisionPosition, VisionTrade } from "@/store/visionStore";
import { VisionChart, type GutterLevel, type Phase } from "./VisionChart";

const SCAN_MS = 2400;
const CALLOUT_MS = 700;

type Step = "scanning" | "marking" | "planning" | "done";

/**
 * The reveal: a scan line crosses the chart, each callout appears in turn,
 * then the plan and projection. Runs again whenever the chart, timeframe,
 * strategy or setup changes, or the trader asks for a rescan.
 */
function usePhase(key: string, callouts: number): Phase & { done: boolean; step: Step; key: string } {
  const [p, setP] = useState<Phase & { done: boolean; step: Step; key: string }>({ scan: 0, revealed: 0, projection: false, done: false, step: "scanning", key: "" });
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setP({ scan: null, revealed: callouts, projection: true, done: true, step: "done", key });
      return;
    }
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const start = performance.now();
    setP({ scan: 0, revealed: 0, projection: false, done: false, step: "scanning", key });
    const frame = (now: number) => {
      const f = Math.min(1, (now - start) / SCAN_MS);
      setP((x) => ({ ...x, scan: f }));
      if (f < 1) raf = requestAnimationFrame(frame);
      else {
        setP((x) => ({ ...x, scan: null, step: callouts ? "marking" : "done", done: !callouts }));
        for (let k = 1; k <= callouts; k++) timers.push(setTimeout(() => setP((x) => ({ ...x, revealed: k })), k * CALLOUT_MS));
        if (callouts) {
          timers.push(setTimeout(() => setP((x) => ({ ...x, projection: true, step: "planning" })), (callouts + 1) * CALLOUT_MS));
          timers.push(setTimeout(() => setP((x) => ({ ...x, step: "done", done: true })), (callouts + 2.5) * CALLOUT_MS));
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [key, callouts]);
  return p;
}

export type ChartMode = "live" | "replay" | "demo";

export interface ChartState {
  feed: Feed;
  /** The bars on screen: live, the replay so far, or the demo so far. */
  bars: Bar[];
  scan: Scan | null;
  phase: ReturnType<typeof usePhase>;
  mode: ChartMode;
  /** Replaying history: nothing on screen may be traded. */
  replaying: boolean;
  /** Auto-execute may take the setup on screen: one of the five readers, or a pinned idea Proven on this market. */
  allowAuto: boolean;
  /** What the setup on screen is, in Discover's words, for the copilot. */
  explain: Explain | null;
}

export interface Explain {
  id: SetupSource;
  label: string;
  idea: string;
  isNew: boolean;
  verdict: Verdict | null;
  reason: string;
  fit: string;
  source: string;
  /** Other reads that fired on the same bar and side. */
  also: string[];
  playbook?: string;
  pinned: boolean;
  /** Open Strategy test on this idea and run it. */
  test: () => void;
  pin: () => void;
  /** The same idea, tested right here on the bars loaded. Small on purpose: a sanity check, not evidence. */
  quick: () => QuickTest | null;
}

export interface QuickTest {
  trades: number;
  meanR: number;
  winShare: number;
  /** Cumulative R after each trade. */
  curve: number[];
  bars: number;
  from: number;
  to: number;
}

const SESSION_OF: Record<Bucket, SessionKey> = { asia: "asia", london: "london", pre: "all", "ny-open": "open", "ny-mid": "ny", "ny-pm": "ny", off: "all" };

/**
 * Strategy test settings for one idea, in the session it fits now when it
 * really trades there; otherwise in all of its own hours, so a test never comes
 * back empty just because it is the wrong time of day.
 */
export function backtestPatch(idea: Idea, symbol: string, tf: Timeframe, bucket: Bucket | null, tradesThere = Infinity): Partial<BacktestSettings> {
  const session = bucket && tradesThere >= 30 ? SESSION_OF[bucket] : "all";
  return idea.kind === "reader"
    ? { symbol, tf, source: "library", logic: "vision", reader: idea.id as ReaderId, session }
    : { symbol, tf, source: "library", logic: "custom", rules: idea.rules, text: `${idea.label}.`, session };
}

const isChoice = (r: ChartRead): r is ReaderChoice => r === "auto" || isReader(r);
export const readLabel = (r: ChartRead) => (r === "discover" ? "Discover" : r === "auto" ? "Any of my strategies" : infoOf(r).label);

type DemoOpts = { reader: ReaderChoice; side: Side | "random"; outcome: "random" | "win" | "loss"; speed: 1 | 2 | 4 };

export function ChartCard({
  symbol,
  tf,
  read,
  focused,
  compact,
  position,
  closed,
  tradeLabel,
  view,
  onFocus,
  onTf,
  onRead,
  onView,
  onClose,
  onState,
}: {
  symbol: VisionSymbolId;
  tf: Timeframe;
  read: ChartRead;
  focused: boolean;
  compact: boolean;
  position: VisionPosition | null;
  closed: VisionTrade | null;
  tradeLabel: string;
  view: ChartView;
  onFocus: () => void;
  onView: (v: ChartView) => void;
  onTf: (tf: Timeframe) => void;
  onRead: (r: ChartRead) => void;
  onClose?: () => void;
  onState: (s: ChartState) => void;
}) {
  const sym = SYMBOLS[symbol];
  const feed = useFeed(symbol, tf);
  const fmt = (n: number) => formatPrice(sym, n);
  const anchor = sym.kind === "futures" ? "rth" : "utc";

  // Replay walks the latest real setup forward; demo plays a simulated one.
  const [replay, setReplay] = useState<{ cursor: number; end: number } | null>(null);
  const [demo, setDemo] = useState<{ d: Demo; cursor: number; speed: number } | null>(null);
  const [demoOpts, setDemoOpts] = useState<DemoOpts>({ reader: "auto", side: "random", outcome: "random", speed: 2 });
  const [menu, setMenu] = useState<"reader" | "demo" | "layers" | null>(null);
  const mode: ChartMode = demo ? "demo" : replay ? "replay" : "live";
  const bars = demo ? demo.d.bars.slice(0, demo.cursor) : replay ? feed.bars.slice(0, replay.cursor) : feed.bars;
  const reader: ReaderChoice = isChoice(read) ? read : "auto";
  const activeReader: ReaderChoice = demo ? demo.d.reader : reader;
  const pinned = useVisionStore((s) => s.pinned);
  const togglePin = useVisionStore((s) => s.togglePin);
  const dials = useVisionStore((s) => s.discover);
  const setStore = useVisionStore((s) => s.set);
  const openBacktest = useVisionStore((s) => s.openBacktest);
  const [panel, setPanel] = useState(false);
  const futures = sym.kind === "futures";
  // Detectors read the chart for Discover, for one pattern or idea, and for "any of mine" once something is pinned. Demo stays on the readers.
  const viaDetectors = !demo && (!isChoice(read) || (read === "auto" && pinned.length > 0));
  // Day levels come from their own 5m history; replay and demo bars aren't today's, so they get none.
  const day = useLevels(symbol, tf, feed.bars);
  const gutter = useMemo(() => (mode === "live" ? gutterLevels(day.now, sessionStartIndex(feed.bars)) : []), [day.now, mode, feed.bars.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const disc = useDiscover(symbol, tf, viaDetectors || menu === "reader" || panel);
  const ideas = useMemo(() => ideasFor(symbol, tf, futures), [symbol, tf, futures]);
  const discKey = `${disc.source}:${disc.studies.size}:${disc.m}`;
  const levelKey = `${day.ready}:${day.now?.session ?? ""}:${day.now?.orH ?? ""}:${day.now?.ibH ?? ""}:${day.now?.asiaH ?? ""}`;

  // Analyse closed bars only: recompute when a bar closes, not on every tick.
  const closedKey = `${mode}:${activeReader}:${bars.length > 1 ? `${bars.length}:${bars[bars.length - 2].t}` : ""}`;
  // Today in plain facts, from the closed bars.
  const scenario = useMemo<Scenario | null>(() => {
    if (mode === "demo" || bars.length < 62) return null;
    const closed = bars.slice(0, -1);
    const c = patternContext(closed, anchor, day.perBar.slice(0, closed.length));
    return scenarioAt(c, closed.length - 1, calendarOf(), scenarioSeries(c), sym.label);
  }, [closedKey, levelKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const ranked = useMemo<Ranked[]>(() => (scenario ? rankIdeas(ideas, disc.studies, scenario, dials, disc.m) : ideas.map((idea) => ({ idea, study: null, judged: null, fit: null }))), [scenario, ideas, discKey, dials]); // eslint-disable-line react-hooks/exhaustive-deps
  const rankOf = useMemo(() => new Map(ranked.map((r) => [r.idea.id as string, r])), [ranked]);
  const enrichWith = (n: number) => (c: Parameters<typeof enrich>[0]) => enrich(c, anchor, day.perBar.slice(0, n));
  const base = useMemo(() => {
    if (bars.length <= 1) return null;
    if (!viaDetectors) return analyze(bars, { forming: true, fmt, reader: activeReader, anchor, maxAge: demo ? 80 : 30, historyBars: demo ? feed.bars : undefined, minIndex: demo ? demo.d.fires - 2 : undefined });
    const closed = bars.slice(0, -1);
    const chosen = read === "discover" ? ideas.filter((i) => !(dials.hideLosing && rankOf.get(i.id)?.judged?.verdict === "losing")) : read === "auto" ? ideas.filter((i) => i.kind === "reader" || pinned.includes(i.id)) : ideas.filter((i) => i.id === read);
    return analyze(bars, {
      forming: true,
      fmt,
      anchor,
      maxAge: 30,
      detectors: chosen.map((i) => detectorFor(i, closed, anchor, sym.tick)),
      enrich: enrichWith(closed.length),
      rank: (id) => rankOf.get(id)?.fit?.score ?? -9,
      readName: read === "discover" ? "everything Discover reads" : readLabel(read),
    });
  }, [closedKey, read, viaDetectors, pinned.join(","), discKey, levelKey, dials.hideLosing]); // eslint-disable-line react-hooks/exhaustive-deps
  // A chip clicked on the chart: that read becomes the one explained, with its own history.
  const [promoted, setPromoted] = useState<Setup | null>(null);
  useEffect(() => setPromoted(null), [symbol, tf, read, mode]);
  const scan = useMemo<Scan | null>(() => {
    if (!base || !promoted) return base;
    const rest = [...(base.others ?? []).filter((o) => o.id !== promoted.id), ...(base.setup && base.setup.id !== promoted.id ? [base.setup] : [])];
    return { ...base, setup: promoted, others: rest.slice(0, 4) };
  }, [base, promoted]);
  const promote = (o: Setup) => {
    const idea = ideas.find((i) => i.id === o.reader);
    if (!idea || bars.length < 2) return;
    const closed = bars.slice(0, -1);
    const s = analyze(bars, { forming: true, fmt, anchor, atIndex: o.index, detectors: [detectorFor(idea, closed, anchor, sym.tick)], enrich: enrichWith(closed.length) }).setup;
    if (s) setPromoted(s);
  };
  const [rescan, setRescan] = useState(0);
  const setup = scan?.setup ?? null;
  const phaseKey = `${symbol}|${tf}|${activeReader}|${read}|${setup?.id ?? "none"}|${rescan}|${mode}|${bars.length ? 1 : 0}`;
  const phase = usePhase(phaseKey, setup ? setup.callouts.length : 0);
  const testIdea = (idea: Idea, show?: "gallery" | "drill") => {
    const b = scenario?.bucket ?? null;
    const n = b ? (disc.studies.get(idea.id)?.dims.bucket[b]?.[0] ?? 0) : 0;
    openBacktest(backtestPatch(idea, symbol, tf, b, n), { run: true, tab: show === "drill" ? "replay" : "test", show });
  };
  const explain = useMemo<Explain | null>(() => {
    if (!setup) return null;
    const r = rankOf.get(setup.reader);
    const info = infoOf(setup.reader);
    const idea = r?.idea ?? ideas.find((i) => i.id === setup.reader);
    return {
      id: setup.reader,
      label: info.label,
      idea: idea?.idea ?? info.blurb,
      isNew: isNew(setup.reader, pinned),
      verdict: r?.judged?.verdict ?? null,
      reason: r?.judged?.reason ?? "",
      fit: r?.fit && r.study ? fitLine(r.fit, r.study) : "",
      source: r?.study ? sourceLine(r.study) : "",
      also: (setup.also ?? []).map((a) => infoOf(a).label),
      playbook: idea?.playbooks?.[0],
      pinned: pinned.includes(setup.reader),
      test: () => idea && testIdea(idea),
      pin: () => togglePin(setup.reader),
      quick: () => {
        if (!idea || bars.length < 100) return null;
        const closed = bars.slice(0, -1);
        const r = runBacktest(closed, { reader: "auto", custom: idea.rules, anchor, side: idea.rules.side, pointValue: futures ? sym.pointValue!.micro : 1, contracts: 1, commission: futures ? FEES.micro : 0, slippageTicks: 1, tick: sym.tick, maxHold: 48, breakEvenR: null, maxPerDay: idea.rules.maxPerDay, skipFomc: false, skipEarly: false, vix: "any", hours: null, context: { fomc: [], early: [], vix: {} } });
        const rs = r.trades.map((t) => (t.riskUsd ? t.pnl / t.riskUsd : 0));
        let run = 0;
        return { trades: rs.length, meanR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0, winShare: rs.length ? rs.filter((x) => x > 0).length / rs.length : 0, curve: rs.map((x) => (run += x)), bars: closed.length, from: closed[0].t, to: closed[closed.length - 1].t };
      },
    };
  }, [setup?.id, rankOf, pinned, scenario?.bucket]); // eslint-disable-line react-hooks/exhaustive-deps
  // Real money only follows the five readers, or a pinned idea that is Proven here at the strict defaults.
  const allowAuto = useMemo(() => {
    if (!setup) return false;
    if (isReader(setup.reader)) return true;
    if (!pinned.includes(setup.reader) || disc.source !== "library") return false;
    const st = disc.studies.get(setup.reader);
    return !!st && judgeStudy(st, DISCOVER_DEFAULTS, disc.m).verdict === "proven";
  }, [setup?.reader, pinned, discKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // How often each idea fired on the bars loaded here, for the panel.
  const firesHere = useMemo(() => {
    if (!panel || bars.length < 62) return null;
    const closed = bars.slice(0, -1);
    const c = enrich(_internal.context(closed, anchor), anchor, day.perBar.slice(0, closed.length));
    const out = new Map<string, number>();
    for (const idea of ideas) {
      const d = detectorFor(idea, closed, anchor, sym.tick);
      let n = 0;
      for (let i = 30; i < closed.length; i++) if (c.atr[i] && d.detect(c, i)) n++;
      out.set(idea.id, n);
    }
    return out;
  }, [panel, closedKey, levelKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = useMemo(() => new Set([...(setup && setup.outcome === "open" ? [setup.reader] : []), ...(scan?.others ?? []).map((o) => o.reader)] as string[]), [setup, scan?.others]);
  const report = useRef(onState);
  report.current = onState;

  useEffect(() => {
    setReplay(null);
    setDemo(null);
  }, [symbol, tf]);

  // Advance replay and demo one bar at a time, holding while a reveal plays.
  useEffect(() => {
    if (!replay && !demo) return;
    const end = replay ? replay.end : demo!.d.bars.length;
    const cursor = replay ? replay.cursor : demo!.cursor;
    if (cursor >= end) {
      if (replay) {
        const id = setTimeout(() => setReplay(null), 3000);
        return () => clearTimeout(id);
      }
      return;
    }
    if (!phase.done && phase.step !== "done") return;
    const ms = replay ? 160 : 340 / (demo!.speed || 1);
    const id = setTimeout(() => (replay ? setReplay((r) => (r ? { ...r, cursor: r.cursor + 1 } : r)) : setDemo((d) => (d ? { ...d, cursor: d.cursor + 1 } : d))), ms);
    return () => clearTimeout(id);
  }, [replay, demo, phase.done, phase.step]);

  const startReplay = () => {
    setDemo(null);
    const past = analyze(feed.bars, { forming: true, fmt, reader, anchor, maxAge: 800 }).setup;
    if (!past) return;
    setReplay({ cursor: Math.max(70, Math.min(past.levelIndex, past.sweepIndex) - 14), end: Math.min(feed.bars.length, (past.outcomeIndex ?? feed.bars.length - 1) + 8) });
  };
  const [demoError, setDemoError] = useState("");
  const startDemo = (o: DemoOpts) => {
    setReplay(null);
    setMenu(null);
    const price = feed.bars[feed.bars.length - 1]?.c ?? (sym.kind === "crypto" ? 70_000 : 20_000);
    const options = READER_ORDER.filter((r) => r !== "orb" || TF_SECONDS[tf] <= 900);
    const pick: ReaderId = o.reader === "auto" ? options[Math.floor(Math.random() * options.length)] : o.reader === "orb" && TF_SECONDS[tf] > 900 ? "sweep" : o.reader;
    const d = buildDemo({ reader: pick, side: o.side === "random" ? undefined : o.side, win: o.outcome === "random" ? undefined : o.outcome === "win", price, tfSeconds: TF_SECONDS[tf], anchor });
    if (!d) {
      setDemoError("Couldn't build that demo; try another strategy.");
      return;
    }
    setDemoError("");
    setDemo({ d, cursor: d.start, speed: o.speed });
  };

  // A reveal still belonging to the previous setup reports as not done, so nothing acts on it early.
  const current = phase.key === phaseKey ? phase : { ...phase, done: false, projection: false, step: "scanning" as Step };
  useEffect(() => report.current({ feed, bars, scan, phase: current, mode, replaying: mode === "replay", allowAuto, explain }), [feed, bars, scan, phase, mode, allowAuto, explain]); // eslint-disable-line react-hooks/exhaustive-deps

  const loaded = feed.bars.length > 80;
  const stats = useMemo(() => (menu === "reader" && loaded ? readerStats(feed.bars, { forming: true, anchor }) : {}), [menu, loaded, symbol, tf]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = bars[bars.length - 1];
  const first = bars.find((b) => last && b.t >= last.t - 86_400);
  const change = last && first ? ((last.c - first.o) / first.o) * 100 : null;
  const recentClose = closed && Date.now() - closed.closedAt < 90_000 ? closed : null;

  const banner = (() => {
    if (feed.loading && !feed.bars.length && mode === "live") return { title: "Loading the chart", detail: `Pulling ${sym.label} ${tf} bars` };
    if (feed.error && !feed.bars.length && mode === "live") return { title: "No data right now", detail: feed.error };
    if (phase.step === "scanning") return { title: `Scanning the chart${mode === "demo" ? (activeReader === "auto" ? "" : ` · ${READERS[activeReader as ReaderId].label}`) : read === "auto" && !viaDetectors ? "" : ` · ${readLabel(read)}`}`, detail: read === "discover" && mode !== "demo" ? `Every idea at once, ranked for today: ${scenario?.text ?? "reading the day"}` : "Reading structure, liquidity, volume and momentum on every candle" };
    if (setup && phase.step === "marking") {
      const c = setup.callouts[Math.max(0, phase.revealed - 1)];
      return { title: c ? (c.n === 1 ? `Marks the ${c.title.toLowerCase()}` : c.title) : "Pattern recognised", detail: c?.detail ?? "" };
    }
    if (setup && phase.step === "planning" && setup.outcome === "open") return { title: "Vision projects the next move", detail: `${setup.side === "long" ? "Up" : "Down"} to ${fmt(setup.target)}, a ${(((setup.target - setup.entry) / setup.entry) * 100).toFixed(2)}% move · ${matchLine(setup)}` };
    if (recentClose) return { title: recentClose.reason === "target" ? "Prediction confirmed" : recentClose.reason === "stop" ? "Stopped out" : "Position closed", detail: `${recentClose.side === "long" ? "Long" : "Short"} ${recentClose.qty} closed ${recentClose.pnl >= 0 ? "+" : "-"}$${Math.abs(recentClose.pnl).toFixed(2)}` };
    if (position) return { title: position.auto ? "Auto-executed" : "Price follows the plan", detail: `${position.side === "long" ? "Long" : "Short"} ${position.qty} filled at ${fmt(position.entry)} · stop ${fmt(position.stop)} · target ${fmt(position.target)}` };
    if (setup && setup.outcome === "target") return { title: "Prediction confirmed", detail: `Reached ${fmt(setup.target)}. Scanning for the next setup` };
    if (setup && setup.outcome === "stop") return { title: "Stopped out", detail: `The ${setup.side} setup hit ${fmt(setup.stop)}. Scanning for the next one` };
    if (setup && setup.outcome === "open") {
      // A read that isn't one of the five readers is named with its badge, so nobody mistakes it for a proven strategy.
      const named = explain && !isReader(explain.id) ? `${explain.label}${explain.isNew ? " · NEW" : ""}${explain.verdict ? ` · ${VERDICT[explain.verdict].label}` : ""}` : null;
      const more = scan?.others?.length ? ` · ${scan.others.length + (scan.extra ?? 0)} more read${scan.others.length + (scan.extra ?? 0) === 1 ? "" : "s"} open` : "";
      const agree = setup.also?.length ? ` · ${setup.also.length + 1} reads agree` : "";
      return setup.fresh
        ? { title: named ?? "Your call", detail: `${matchLine(setup)}${agree}${more}. ${explain && !allowAuto ? "Your call: auto-execute only takes strategies you have proven" : "Take it, skip it, or let auto-execute take it"}` }
        : { title: named ?? `${setup.side === "long" ? "Long" : "Short"} setup in play`, detail: `Fired ${scan!.closed - 1 - setup.index} bars ago; the plan is still open · ${matchLine(setup)}${agree}${more}` };
    }
    if (mode === "demo") return { title: "Demo", detail: "Simulated price. The setup forms in a moment" };
    if (mode === "replay") return { title: "Replaying history", detail: "Watching the latest real setup play out. Nothing here can be traded" };
    const below = scan?.pools.below;
    const above = scan?.pools.above;
    return { title: "Waiting for a high-probability setup", detail: below || above ? `Watching ${[below && fmt(below.price) + " below", above && fmt(above.price) + " above"].filter(Boolean).join(" and ")}` : "Watching for your setups" };
  })();
  const progress = phase.step === "scanning" ? (phase.scan ?? 0) : phase.step === "marking" ? 0.35 + 0.18 * phase.revealed : 1;
  const sourceLabel = mode === "demo" ? "Simulated" : feed.source === "coinbase" ? "Coinbase · live" : feed.source === "tradovate" ? `Tradovate · live${feed.contract ? ` · ${feed.contract}` : ""}` : feed.source === "projectx" ? `TopstepX · live${feed.contract ? ` · ${feed.contract}` : ""}` : feed.source === "yahoo" ? "Delayed ~10 min" : "";
  const fresh = Date.now() - feed.lastTick < (sym.kind === "crypto" ? 15_000 : 60_000);
  const readerLabel = mode === "demo" ? (activeReader === "auto" ? "Any strategy" : READERS[activeReader as ReaderId].label) : readLabel(read);

  return (
    <section
      onMouseDown={onFocus}
      className={clsx("relative rounded-[28px] border bg-[#121214]/80 backdrop-blur-2xl transition", focused ? "border-white/[0.14] shadow-[0_30px_80px_-40px_rgba(255,138,61,0.35)]" : "border-white/[0.07]")}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-white">{sym.label}</h2>
          {last && <span className="text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-white">{fmt(last.c)}</span>}
          {change != null && (
            <span className={clsx("rounded-full px-2 py-0.5 text-[12.5px] font-semibold tabular-nums", change >= 0 ? "bg-[#FF8A3D]/15 text-[#FFB27D]" : "bg-white/[0.08] text-white/70")}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)}%
            </span>
          )}
          <span className="text-[12px] text-white/40">
            {sym.name} · {tf}
            {sourceLabel && ` · ${sourceLabel}`}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className={clsx("mr-1 flex items-center gap-1.5 text-[11.5px] font-bold tracking-[0.06em]", mode === "demo" ? "text-[#FFB27D]" : feed.delayed ? "text-white/45" : "text-[#FF8A3D]")}>
            {mode === "demo" ? "DEMO" : mode === "replay" ? "REPLAY" : feed.delayed ? "DELAYED" : "LIVE"}
            <span className={clsx("h-1.5 w-1.5 rounded-full", feed.delayed && mode === "live" ? "bg-white/40" : "bg-[#FF8A3D]", (fresh || mode !== "live") && "animate-pulse")} />
          </span>
          <div className="flex rounded-full bg-white/[0.06] p-0.5">
            {TIMEFRAMES.map((t) => (
              <button key={t} onClick={() => onTf(t)} className={clsx("rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition", t === tf ? "bg-white/[0.16] text-white" : "text-white/50 hover:text-white")}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Toolbar: strategy, demo, replay, rescan */}
      <div className="mt-3 flex flex-wrap items-center gap-2 px-5">
        <div className="relative">
          <button onClick={() => setMenu(menu === "reader" ? null : "reader")} className="flex h-9 items-center gap-2 rounded-full bg-white/[0.07] pl-3 pr-2.5 text-[13px] font-semibold text-white ring-1 ring-white/[0.06] hover:bg-white/[0.1]">
            <Sparkles className="h-3.5 w-3.5 text-[#FF8A3D]" /> {readerLabel}
            <ChevronDown className="h-3.5 w-3.5 text-white/50" />
          </button>
          {menu === "reader" && (
            <Popover onClose={() => setMenu(null)} wide>
              <ReadMenu
                read={read}
                tf={tf}
                stats={stats}
                ranked={ranked}
                pinned={pinned}
                loading={disc.status === "loading"}
                source={disc.source}
                demo={mode === "demo"}
                onPick={(r) => {
                  onRead(r);
                  setMenu(null);
                }}
                onTest={(idea) => {
                  setMenu(null);
                  testIdea(idea);
                }}
                onAll={() => {
                  setMenu(null);
                  setPanel(true);
                }}
              />
            </Popover>
          )}
        </div>

        {mode !== "demo" && (
          <button onClick={() => setPanel(true)} title="Everything that fits this chart right now" className={clsx("flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 transition", read === "discover" ? "bg-gradient-to-r from-[#FFB27D] to-[#FF7A2D] text-black ring-transparent" : "bg-white/[0.07] text-white ring-white/[0.06] hover:bg-white/[0.1]")}>
            ✦ Discover
            {disc.status === "loading" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          </button>
        )}

        <div className="relative">
          <button
            aria-label="Chart layers"
            title="What the chart draws"
            onClick={() => setMenu(menu === "layers" ? null : "layers")}
            className={clsx("grid h-9 w-9 place-items-center rounded-full ring-1 ring-white/[0.06]", menu === "layers" ? "bg-white/[0.16] text-white" : "bg-white/[0.07] text-white/75 hover:bg-white/[0.1]")}
          >
            <Layers className="h-4 w-4" />
          </button>
          {menu === "layers" && (
            <Popover onClose={() => setMenu(null)}>
              <LayersMenu view={view} onView={onView} futures={sym.kind === "futures"} />
            </Popover>
          )}
        </div>

        <div className="relative">
          {mode === "demo" ? (
            <button onClick={() => setDemo(null)} className="flex h-9 items-center gap-1.5 rounded-full bg-[#FF8A3D] px-3 text-[13px] font-semibold text-black">
              <Square className="h-3.5 w-3.5" /> End demo
            </button>
          ) : (
            <button onClick={() => setMenu(menu === "demo" ? null : "demo")} className="flex h-9 items-center gap-1.5 rounded-full bg-white/[0.07] px-3 text-[13px] font-semibold text-white ring-1 ring-white/[0.06] hover:bg-white/[0.1]">
              <FlaskConical className="h-3.5 w-3.5 text-[#FF8A3D]" /> Demo
            </button>
          )}
          {menu === "demo" && (
            <Popover onClose={() => setMenu(null)}>
              <div className="space-y-3 p-3">
                <div>
                  <p className="text-[15px] font-semibold text-white">Play a demo setup</p>
                  <p className="text-[12px] leading-snug text-white/45">Simulated price, clearly marked. The pattern is checked by the real reader, and the odds shown come from this chart&apos;s real history.</p>
                </div>
                <Choice label="Strategy" value={demoOpts.reader} options={[{ v: "auto" as ReaderChoice, l: "Surprise me" }, ...READER_ORDER.map((r) => ({ v: r as ReaderChoice, l: READERS[r].short }))]} onChange={(v) => setDemoOpts((o) => ({ ...o, reader: v }))} />
                <Choice label="Direction" value={demoOpts.side} options={[{ v: "random" as const, l: "Either" }, { v: "long" as const, l: "Long" }, { v: "short" as const, l: "Short" }]} onChange={(v) => setDemoOpts((o) => ({ ...o, side: v }))} />
                <Choice label="Outcome" value={demoOpts.outcome} options={[{ v: "random" as const, l: "Either" }, { v: "win" as const, l: "Win" }, { v: "loss" as const, l: "Loss" }]} onChange={(v) => setDemoOpts((o) => ({ ...o, outcome: v }))} />
                <Choice label="Speed" value={demoOpts.speed} options={[{ v: 1 as const, l: "1×" }, { v: 2 as const, l: "2×" }, { v: 4 as const, l: "4×" }]} onChange={(v) => setDemoOpts((o) => ({ ...o, speed: v }))} />
                <button onClick={() => startDemo(demoOpts)} className="w-full rounded-xl bg-[#FF8A3D] py-2.5 text-[14px] font-bold text-black">
                  Start demo
                </button>
              </div>
            </Popover>
          )}
        </div>

        <button
          onClick={() => (replay ? setReplay(null) : startReplay())}
          title="Replay the latest real setup bar by bar"
          className={clsx("flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-white/[0.06]", replay ? "bg-[#FF8A3D] text-black" : "bg-white/[0.07] text-white hover:bg-white/[0.1]")}
        >
          {replay ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 text-[#FF8A3D]" />} {replay ? "Stop replay" : "Replay"}
        </button>
        {demoError && <span className="text-[12px] text-[#FF8D85]">{demoError}</span>}
        <span className="flex-1" />
        <button aria-label="Scan again" title="Scan again" onClick={() => setRescan((r) => r + 1)} className="grid h-9 w-9 place-items-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white">
          <RefreshCw className="h-4 w-4" />
        </button>
        {onClose && (
          <button aria-label="Close chart" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mx-5 mt-3 overflow-hidden rounded-2xl border border-[#FF8A3D]/20 bg-gradient-to-r from-[#FF8A3D]/[0.12] via-white/[0.03] to-transparent">
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FFB27D] to-[#FF7A2D] text-black shadow-[0_6px_18px_-6px_rgba(255,138,61,0.9)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div key={banner.title} className="tp-card-in min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-white">{banner.title}</p>
            <p className="truncate text-[12.5px] text-white/55">{banner.detail}</p>
          </div>
          <span className="hidden shrink-0 rounded-full bg-[#FF8A3D]/15 px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] text-[#FFB27D] sm:inline">{mode === "demo" ? "DEMO" : tradeLabel}</span>
        </div>
        <div className="h-0.5 bg-white/[0.04]">
          <div className="h-full bg-gradient-to-r from-[#FF8A3D] to-[#FFB27D] transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="overflow-hidden rounded-b-[28px] px-2 pb-2 pt-2">
        {bars.length ? (
          <VisionChart
            bars={bars}
            sym={sym}
            scan={scan}
            phase={phase}
            position={mode === "replay" ? null : position}
            closed={mode === "replay" ? null : closed}
            height={compact ? 400 : 580}
            label={mode === "demo" ? "DEMO · SIMULATED PRICE" : mode === "replay" ? "REPLAY · PAST BARS" : undefined}
            story={mode !== "live"}
            view={view}
            levels={gutter}
            others={mode === "demo" ? [] : (scan?.others ?? [])}
            onPromote={promote}
          />
        ) : (
          <div className="tp-shimmer m-3 rounded-2xl" style={{ height: compact ? 380 : 560 }} />
        )}
      </div>
      {feed.note && mode === "live" && <p className="px-5 pb-3 text-[12px] text-white/45">{feed.note}</p>}
      {panel && (
        <DiscoverPanel
          onClose={() => setPanel(false)}
          title={`${sym.label} ${tf}`}
          scenario={scenario}
          ranked={ranked}
          data={disc}
          pinned={pinned}
          onPin={togglePin}
          current={read}
          onShow={(r) => {
            onRead(r);
            setPanel(false);
          }}
          live={live}
          firesHere={firesHere}
          onBacktest={(r, show) => {
            setPanel(false);
            testIdea(r.idea, show);
          }}
          dials={dials}
          onDials={(d) => setStore({ discover: d })}
        />
      )}
    </section>
  );
}

function Popover({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const id = setTimeout(() => window.addEventListener("mousedown", away), 0);
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  return (
    <div ref={ref} className={clsx("tp-card-in absolute left-0 top-11 z-40 max-h-[70vh] overflow-y-auto rounded-[20px] border border-white/[0.1] bg-[#1B1B1E]/[0.97] p-1.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl", wide ? "w-[400px]" : "w-[340px]")}>
      {children}
    </div>
  );
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1 text-[12px] text-white/50">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={String(o.v)} onClick={() => onChange(o.v)} className={clsx("rounded-lg px-2.5 py-1 text-[12.5px] font-semibold transition", o.v === value ? "bg-white text-black" : "bg-white/[0.07] text-white/70 hover:bg-white/[0.12]")}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

/** How the banner states a setup's record: rated, or plainly too thin to rate. */
function matchLine(s: NonNullable<Scan["setup"]>) {
  const h = s.history;
  const decided = h.wins + h.losses;
  if (h.hitRate != null) return `${Math.round(h.hitRate * 100)}% of ${decided} past matches reached target`;
  return h.matches ? `${h.matches} past match${h.matches === 1 ? "" : "es"} here, too few to rate` : "No past matches on these bars";
}

const DENSITY: { v: Density; l: string; d: string }[] = [
  { v: "clean", l: "Clean", d: "Pins, plan lines, prices" },
  { v: "standard", l: "Standard", d: "Plus boxes and notes" },
  { v: "full", l: "Full", d: "Plus projection and volume" },
];

function LayersMenu({ view, onView, futures }: { view: ChartView; onView: (v: ChartView) => void; futures: boolean }) {
  const toggles: { k: keyof Omit<ChartView, "density">; l: string; d: string; off?: string }[] = [
    { k: "levels", l: "Day levels", d: "Prior day, overnight, Asia, London, opening range" },
    { k: "sessions", l: "Session shading", d: "Faint bands for Asia, London and New York", off: futures ? undefined : "Futures only" },
    { k: "story", l: "Setup story", d: "Numbered pins on the candles that made the setup" },
    { k: "plan", l: "Plan", d: "Entry, stop and target" },
    { k: "projection", l: "Projection", d: "Where past matches went next", off: view.density === "full" ? undefined : "Full density only" },
    { k: "others", l: "Other setups", d: "Other reads that fired nearby" },
  ];
  return (
    <div className="p-2">
      <p className="px-1 pb-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-white/40">Density</p>
      <div className="grid grid-cols-3 gap-1">
        {DENSITY.map((d) => (
          <button key={d.v} onClick={() => onView({ ...PRESETS[d.v] })} className={clsx("rounded-xl px-2 py-2 text-left transition", view.density === d.v ? "bg-white text-black" : "bg-white/[0.06] text-white hover:bg-white/[0.1]")}>
            <span className="block text-[13px] font-semibold">{d.l}</span>
            <span className={clsx("block text-[10.5px] leading-tight", view.density === d.v ? "text-black/55" : "text-white/45")}>{d.d}</span>
          </button>
        ))}
      </div>
      <p className="px-1 pb-1 pt-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-white/40">Layers</p>
      {toggles.map((t) => (
        <button key={t.k} disabled={!!t.off} onClick={() => onView({ ...view, [t.k]: !view[t.k] })} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05] disabled:opacity-40">
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-white">{t.l}</span>
            <span className="block truncate text-[11.5px] text-white/45">{t.off ?? t.d}</span>
          </span>
          <span className={clsx("relative h-5 w-9 shrink-0 rounded-full transition", view[t.k] && !t.off ? "bg-[#FF8A3D]" : "bg-white/15")}>
            <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", view[t.k] && !t.off ? "left-[18px]" : "left-0.5")} />
          </span>
        </button>
      ))}
    </div>
  );
}

/** The day's levels as gutter tags: highs red, lows orange, the opening range and first hour blue. */
function gutterLevels(l: DayLevels | null, from: number): GutterLevel[] {
  if (!l) return [];
  const out: GutterLevel[] = [];
  const add = (id: string, abbr: string, name: string, price: number | null, tone: GutterLevel["tone"]) => price != null && Number.isFinite(price) && out.push({ id, abbr, name, price, tone, from });
  add("pdh", "PDH", "Prior day high", l.pdh, "red");
  add("pdl", "PDL", "Prior day low", l.pdl, "orange");
  add("pdc", "PDC", "Prior day close", l.pdc, "white");
  add("onh", "ON H", "Overnight high", l.onh, "red");
  add("onl", "ON L", "Overnight low", l.onl, "orange");
  add("ash", "AS H", "Asia high", l.asiaH, "red");
  add("asl", "AS L", "Asia low", l.asiaL, "orange");
  add("lnh", "LN H", "London high", l.lonH, "red");
  add("lnl", "LN L", "London low", l.lonL, "orange");
  add("orh", "OR H", "Opening range high (first 15 minutes)", l.orH, "blue");
  add("orl", "OR L", "Opening range low (first 15 minutes)", l.orL, "blue");
  add("ibh", "IB H", "Initial balance high (first hour)", l.ibH, "blue");
  add("ibl", "IB L", "Initial balance low (first hour)", l.ibL, "blue");
  // Two levels at the same price say the same thing: keep the first, name both on hover.
  const seen = new Map<number, GutterLevel>();
  return out.filter((g) => {
    const was = seen.get(g.price);
    if (was) {
      was.name = `${was.name} · ${g.name}`;
      return false;
    }
    seen.set(g.price, g);
    return true;
  });
}

/** The strategy dropdown: Discover, your strategies, and what Discover found on this chart. */
function ReadMenu({
  read,
  tf,
  stats,
  ranked,
  pinned,
  loading,
  source,
  demo,
  onPick,
  onTest,
  onAll,
}: {
  read: ChartRead;
  tf: Timeframe;
  stats: Partial<Record<ReaderId, { expectancyR: number | null; matches: number; hitRate: number | null }>>;
  ranked: Ranked[];
  pinned: SetupSource[];
  loading: boolean;
  source: "library" | "recent" | null;
  demo: boolean;
  onPick: (r: ChartRead) => void;
  onTest: (idea: Idea) => void;
  onAll: () => void;
}) {
  const mine = ranked.filter((r) => pinned.includes(r.idea.id));
  const found = ranked.filter((r) => !isReader(r.idea.id) && !pinned.includes(r.idea.id));
  const top = found.slice(0, 3);
  const row = (r: ChartRead, title: React.ReactNode, sub: React.ReactNode, right?: React.ReactNode, disabled = false, test?: Idea) => (
    <div key={r} className={clsx("group flex items-center gap-1 rounded-xl transition", r === read ? "bg-white/[0.08]" : "hover:bg-white/[0.05]", disabled && "opacity-35")}>
      <button disabled={disabled} onClick={() => onPick(r)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-white">{title}</span>
          <span className="block truncate text-[12px] text-white/45">{sub}</span>
        </span>
        {right}
        {r === read && <Check className="h-4 w-4 shrink-0 text-[#FF8A3D]" />}
      </button>
      {test && (
        <button aria-label={`Backtest ${test.label}`} title="Backtest it" onClick={() => onTest(test)} className="mr-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/40 opacity-0 transition hover:bg-white/[0.1] hover:text-white group-hover:opacity-100">
          <FlaskConical className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
  const studied = (r: Ranked) => (
    <span className="shrink-0 text-right text-[11.5px] tabular-nums">
      {r.study ? (
        <>
          <span className={clsx("block font-semibold", r.study.newer.avgR >= 0 ? "text-[#FFB27D]" : "text-[#FF8D85]")}>
            {r.study.newer.avgR >= 0 ? "+" : ""}
            {r.study.newer.avgR.toFixed(2)}R
          </span>
          <span className="block text-white/40">t {r.study.newer.t.toFixed(1)}</span>
        </>
      ) : (
        <span className="text-white/35">{loading ? "rating…" : "not rated"}</span>
      )}
    </span>
  );
  const divider = (t: string) => <p className="px-3 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/35">{t}</p>;
  return (
    <>
      <p className="px-3 pb-1 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-white/40">Read this chart with</p>
      {row("discover", <span className="bg-gradient-to-r from-[#FFB27D] to-[#FF7A2D] bg-clip-text text-transparent">✦ Discover</span>, "Finds what fits this chart right now, including setups you don't trade yet", undefined, demo)}
      {row("auto", "Any of my strategies", pinned.length ? "Whichever of yours fires first, pins included" : "Whichever of yours fires first")}
      {divider("My strategies")}
      {READER_ORDER.map((r) => {
        const st = stats[r];
        const off = r === "orb" && TF_SECONDS[tf] > 900;
        return row(
          r,
          READERS[r].label,
          off ? "Needs 15m bars or faster" : READERS[r].blurb,
          st ? (
            <span className="shrink-0 text-right text-[11.5px] tabular-nums">
              <span className={clsx("block font-semibold", st.expectancyR == null ? "text-white/40" : st.expectancyR >= 0 ? "text-[#FFB27D]" : "text-[#FF8D85]")}>{st.expectancyR == null ? "unrated" : `${st.expectancyR >= 0 ? "+" : ""}${st.expectancyR.toFixed(2)}R`}</span>
              <span className="block text-white/40">
                {st.matches} here{st.hitRate != null ? ` · ${Math.round(st.hitRate * 100)}%` : ""}
              </span>
            </span>
          ) : undefined,
          off,
          ranked.find((x) => x.idea.id === r)?.idea,
        );
      })}
      {mine.map((r) => row(r.idea.id as ChartRead, <>{r.idea.label} {r.judged && <VerdictBadge v={r.judged.verdict} title={r.judged.reason} />}</>, statLine(r), studied(r), demo, r.idea))}
      {!demo && (
        <>
          {divider("Found on this chart")}
          {top.map((r) =>
            row(
              r.idea.id as ChartRead,
              <>
                {r.idea.label} <NewBadge />
                {r.judged && <VerdictBadge v={r.judged.verdict} title={r.judged.reason} />}
                <FitChip r={r} />
              </>,
              r.idea.idea,
              studied(r),
              false,
              r.idea,
            ),
          )}
          <button onClick={onAll} className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-[#FFB27D] hover:bg-white/[0.05]">
            See all {found.length} →
          </button>
        </>
      )}
      <p className="px-3 pb-2 pt-1 text-[11px] leading-snug text-white/35">
        Your strategies show their record on the bars loaded here. Found ideas are rated on {source === "library" ? "your library's years of history" : "recent history only"}, after costs, on the newest 30% of trades.
      </p>
    </>
  );
}
