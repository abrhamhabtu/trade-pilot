"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Building2, FastForward, FolderDown, MapPin, Pause, Play, RotateCcw, Shuffle, SkipForward, StepForward, Wand2, X } from "lucide-react";
import { sessionOf } from "@/lib/pilot/market";
import { READERS, READER_ORDER, _internal, analyze, infoOf, type ReaderChoice, type ReaderId, type Side } from "@/lib/vision/analyze";
import { inHours } from "@/lib/vision/backtest";
import { SESSION_WINDOWS } from "@/lib/vision/custom";
import { TF_SECONDS, aggregate, formatPrice, type Timeframe, type VisionSymbol } from "@/lib/vision/markets";
import { programByKey } from "@/lib/proving/firms";
import { accountState, type AccountTrade, type PropAccount } from "@/lib/vision/account";
import { riskCap } from "@/lib/vision/limits";
import { useLimits } from "./prop/useLab";
import type { BacktestSettings, VisionPosition, VisionTrade } from "@/store/visionStore";
import { VisionChart } from "../VisionChart";
import { money, timeOf, type Loaded } from "./data";
import type { Scenario } from "./scenarios";
import { Journal } from "./TradeReview";
import { CY, Card, Num, Pill, Seg, Toggle } from "./ui";

const SPEEDS = [1, 2, 5, 10, 25] as const;
const PHASE = { scan: null, revealed: 99, projection: true, step: "done" as const };
const WARMUP = 400;
const HTF: Partial<Record<Timeframe, Timeframe>> = { "1m": "15m", "5m": "1h", "15m": "4h", "1h": "4h" };

type OrderType = "market" | "limit" | "stop";
type Session = { side: Side; qty: number; entry: number; exit: number; stop: number; target: number; entryT: number; exitT: number; pnl: number; r: number; reason: "target" | "stop" | "breakeven" | "manual" | "flattened"; vision: boolean; worst: number; best: number };
type Pending = { side: Side; type: Exclude<OrderType, "market">; price: number; stopDist: number; rr: number; placedAt: number };
type Pos = VisionPosition & { vision: boolean; risk: number; moved: boolean; mfe: number; worst: number; best: number };

const toAccountTrade = (t: Session): AccountTrade => ({ id: `m${t.entryT}${Math.round(t.entry * 100)}`, entryT: t.entryT, exitT: t.exitT, session: sessionOf(t.entryT).session, side: t.side, qty: t.qty, entry: t.entry, exit: t.exit, stop: t.stop, target: t.target, pnl: t.pnl, r: t.r, worst: t.worst, best: t.best, reason: t.reason, source: "manual", strategy: t.vision ? "Vision plan" : undefined });

/**
 * Bar-by-bar replay over history, the way a simulator works: price hides what
 * comes next, orders fill against each new bar, and Vision (if you want it)
 * marks setups as they form. In prop firm mode the firm's rules run live.
 */
export function Replay({ loaded, sym, tf, anchor, reader, scenario, startAt, settings, onSave, account, onAccountTrade, onCursor, onMore }: { loaded: Loaded; sym: VisionSymbol; tf: Timeframe; anchor: "rth" | "utc"; reader: ReaderChoice; scenario?: Scenario; startAt?: number; settings: BacktestSettings; onSave: (s: { trades: Session[]; from: number; to: number }) => Promise<boolean>; account?: PropAccount; onAccountTrade?: (t: AccountTrade) => void; onCursor?: (t: number) => void; onMore?: () => void }) {
  const { limits } = useLimits();
  const bars = loaded.bars;
  const n = bars.length;
  // An account picks up where it stopped, or at its start date's New York open.
  const accountStart = useMemo(() => {
    if (!account) return null;
    const i = account.cursorT != null ? bars.findIndex((b) => b.t > account.cursorT!) : bars.findIndex((b) => {
      const s = sessionOf(b.t);
      return s.date >= account.startDate && (s.date > account.startDate || s.minute >= 570);
    });
    return i < 0 ? n : i;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const first = accountStart != null ? Math.min(n, Math.max(1, accountStart)) : startAt != null ? Math.min(n, Math.max(WARMUP, startAt + 1)) : Math.max(WARMUP, n - 1500);
  const [cursor, setCursor] = useState(first);
  const [base, setBase] = useState(Math.max(0, first - WARMUP));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const [hints, setHints] = useState(true);
  const [htf, setHtf] = useState(!!HTF[tf]);
  const [pos, setPos] = useState<Pos | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [trades, setTrades] = useState<Session[]>([]);
  const [lastClosed, setLastClosed] = useState<VisionTrade | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [orderPx, setOrderPx] = useState(0);
  const [sizing, setSizing] = useState<"fixed" | "risk">(sym.kind === "crypto" ? "risk" : (account?.sizing ?? settings.sizing));
  const [qty, setQty] = useState(account?.contracts ?? settings.contracts);
  const [riskPct, setRiskPct] = useState(account?.riskPct ?? settings.riskPct);
  const [stopPts, setStopPts] = useState(0);
  const [rr, setRr] = useState(2);
  const [autoBe, setAutoBe] = useState(false);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const fmt = useCallback((p: number) => formatPrice(sym, p), [sym]);
  const micro = account ? account.micro : settings.micro;
  const pointValue = sym.kind === "crypto" ? 1 : micro ? sym.pointValue!.micro : sym.pointValue!.full;
  const program = account ? programByKey(account.program) : sym.kind === "futures" && settings.prop.on ? programByKey(settings.prop.program) : null;
  // The account as it stood when replay opened; this session's trades build on it.
  const [snap] = useState(() => (account ? accountState(account) : null));
  const size = program ? program.size : settings.balance;
  const balance0 = snap ? snap.balance : size;

  // Every bar where the strategy fires, to jump between setups and list where it formed.
  const signals = useMemo(() => {
    const ctx = _internal.context(bars, anchor);
    const readers: ReaderId[] = reader === "auto" ? READER_ORDER : [reader];
    const out: number[] = [];
    for (let i = 30; i < n; i++) if (_internal.detectAt(ctx, i, readers)) out.push(i);
    return out;
  }, [bars, anchor, reader, n]);
  const formed = useMemo(() => {
    const m = new Map<string, { date: string; first: number; n: number }>();
    for (const i of signals) {
      const s = sessionOf(bars[i].t);
      const h = SESSION_WINDOWS[settings.session].hours;
      if (h && anchor === "rth" && !inHours(s.minute, h)) continue;
      const x = m.get(s.session) ?? { date: s.session, first: i, n: 0 };
      x.n++;
      m.set(s.session, x);
    }
    return [...m.values()];
  }, [signals, bars, settings.session, anchor]);

  const view = useMemo(() => bars.slice(base, cursor), [bars, base, cursor]);
  const scan = useMemo(() => (hints && view.length > 60 ? analyze(view, { fmt, reader, anchor, maxAge: 30 }) : null), [view, hints, reader, anchor, fmt]);
  const htfTf = HTF[tf];
  const htfBars = useMemo(() => (htf && htfTf ? aggregate(bars.slice(Math.max(0, cursor - 3000), cursor), TF_SECONDS[htfTf]) : []), [htf, htfTf, bars, cursor]);
  const last = bars[cursor - 1];
  const atr = scan?.atr[scan.atr.length - 1] ?? (last ? last.h - last.l : 0);
  const plan = scan?.setup && scan.setup.outcome === "open" && cursor - 1 - base - scan.setup.index <= 3 ? scan.setup : null;
  const defaultStop = Math.max(sym.tick * 4, Math.round((atr * 1.2) / sym.tick) * sym.tick);
  const stopDist = stopPts > 0 ? stopPts : defaultStop;
  const realized = trades.reduce((a, t) => a + t.pnl, 0);
  const sizeFor = useCallback(
    (dist: number) => {
      if (sym.kind === "crypto") return Math.max(0, Math.floor((settings.riskDollars / dist) * 1e4) / 1e4);
      const firmCap = program ? (micro ? program.maxMicros : program.maxMinis) : 50;
      // The trader's own limit on risk per trade holds here too.
      const limitUsd = !program ? Infinity : account?.phase === "live" ? ((balance0 + realized) * limits.livePct) / 100 : program.drawdown * riskCap(limits, sym.id, account?.phase === "funded" ? "funded" : "eval");
      const cap = Math.min(firmCap, Math.floor(limitUsd / (dist * pointValue)));
      if (cap <= 0) return 0;
      if (sizing === "risk") return Math.max(0, Math.min(cap, Math.floor(((balance0 + realized) * riskPct) / 100 / (dist * pointValue))));
      return Math.min(cap, Math.max(1, Math.round(qty)));
    },
    [sym.kind, sym.id, settings.riskDollars, sizing, balance0, realized, riskPct, pointValue, qty, program, micro, limits, account?.phase],
  );

  // ── The prop firm account, live ──
  const fresh = () => ({ peak: snap ? snap.peak : size, threshold: snap ? snap.threshold : program ? size - program.drawdown : -Infinity, day: snap?.lastDay ?? "", dayStart: snap ? -snap.lastDayPnl : 0, blown: snap?.status === "blown" ? "This account is blown" : "", halted: "" });
  const acct = useRef(fresh());
  const [acctTick, setAcctTick] = useState(0);
  const openPnl = pos && last ? (last.c - pos.entry) * (pos.side === "long" ? 1 : -1) * pos.qty * pos.pointValue : 0;
  const equity = balance0 + realized + openPnl;

  const closeAt = useCallback(
    (p: Pos, exit: number, reason: Session["reason"], t: number) => {
      const dir = p.side === "long" ? 1 : -1;
      const pnl = (exit - p.entry) * dir * p.qty * p.pointValue - (sym.kind === "crypto" ? settings.commission : settings.commission * p.qty);
      const done: Session = { side: p.side, qty: p.qty, entry: p.entry, exit, stop: p.stop, target: p.target, entryT: p.openedAt / 1000, exitT: t, pnl, r: ((exit - p.entry) * dir) / p.risk, reason, vision: p.vision, worst: Math.min(p.worst, pnl), best: Math.max(p.best, pnl) };
      setTrades((ts) => [...ts, done]);
      onAccountTrade?.(toAccountTrade(done));
      setLastClosed({ ...p, exit, closedAt: Date.now(), pnl, reason: reason === "target" ? "target" : reason === "stop" ? "stop" : "manual" });
      setSaved("idle");
      return pnl;
    },
    [sym.kind, settings.commission, onAccountTrade],
  );

  const fill = useCallback(
    (side: Side, entry: number, dist: number, ratio: number, t: number, usePlan: { stop: number; target: number; id: string } | null): Pos | null => {
      const stop = usePlan ? usePlan.stop : side === "long" ? entry - dist : entry + dist;
      const target = usePlan ? usePlan.target : side === "long" ? entry + dist * ratio : entry - dist * ratio;
      const risk = Math.abs(entry - stop);
      if (!(risk > 0) || (side === "long" ? target <= entry : target >= entry)) return null;
      const size = sizeFor(risk);
      if (size <= 0) return null;
      return { id: `r${t}`, symbol: sym.id, side, qty: size, entry, stop, target, openedAt: t * 1000, setupId: usePlan?.id ?? "", auto: false, venue: "paper", pointValue, vision: !!usePlan, risk, moved: false, mfe: 0, worst: 0, best: 0 };
    },
    [sizeFor, sym.id, pointValue],
  );

  // ── Moving forward: pending orders, exits, break-even and the firm's rules on every bar passed ──
  const prev = useRef(cursor);
  useEffect(() => {
    const from = prev.current;
    prev.current = cursor;
    if (cursor <= from) return;
    let p = pos;
    let o = pending;
    let realizedNow = realized;
    const a = acct.current;
    for (let k = from; k < cursor; k++) {
      const b = bars[k];
      const day = sessionOf(b.t).session;
      if (day !== a.day) {
        // A new session: end-of-day trailing moves, and yesterday's daily stop lifts.
        if (program && a.day && program.ddType === "trailing-eod") {
          a.peak = Math.max(a.peak, balance0 + realizedNow);
          a.threshold = Math.min(a.peak - program.drawdown, program.lock == null ? Infinity : size + program.lock);
        }
        a.day = day;
        a.dayStart = realizedNow;
        a.halted = "";
      }
      if (o && !p) {
        const hit = o.type === "limit" ? (o.side === "long" ? b.l <= o.price : b.h >= o.price) : o.side === "long" ? b.h >= o.price : b.l <= o.price;
        if (hit) {
          const px = o.type === "limit" ? (o.side === "long" ? Math.min(b.o, o.price) : Math.max(b.o, o.price)) : o.side === "long" ? Math.max(b.o, o.price) : Math.min(b.o, o.price);
          p = fill(o.side, px, o.stopDist, o.rr, b.t, null);
          o = null;
          // The fill bar can still stop it out.
          if (p && (p.side === "long" ? b.l <= p.stop : b.h >= p.stop)) {
            realizedNow += closeAt(p, p.stop, "stop", b.t);
            p = null;
          }
          continue;
        }
      }
      if (p && b.t * 1000 > p.openedAt) {
        const stopHit = p.side === "long" ? b.l <= p.stop : b.h >= p.stop;
        const targetHit = p.side === "long" ? b.h >= p.target : b.l <= p.target;
        if (stopHit || targetHit) {
          const dir = p.side === "long" ? 1 : -1;
          const exitPx = stopHit ? p.stop : p.target;
          const edge = stopHit ? exitPx : p.side === "long" ? Math.max(b.l, p.stop) : Math.min(b.h, p.stop);
          p = { ...p, worst: Math.min(p.worst, (edge - p.entry) * dir * p.qty * p.pointValue) };
          realizedNow += closeAt(p, exitPx, stopHit ? (p.moved ? "breakeven" : "stop") : "target", b.t);
          p = null;
        } else {
          const dir = p.side === "long" ? 1 : -1;
          const mfe = Math.max(p.mfe, (((p.side === "long" ? b.h : b.l) - p.entry) * dir) / p.risk);
          const usdAt = (px: number) => (px - p!.entry) * dir * p!.qty * p!.pointValue;
          p = { ...p, mfe, worst: Math.min(p.worst, usdAt(p.side === "long" ? b.l : b.h)), best: Math.max(p.best, usdAt(p.side === "long" ? b.h : b.l)), ...(autoBe && !p.moved && mfe >= 1 ? { stop: p.entry, moved: true } : {}) };
        }
      }
      // The firm watches the worst of each bar.
      if (program && !a.blown) {
        const worst = p ? (((p.side === "long" ? b.l : b.h) - p.entry) * (p.side === "long" ? 1 : -1) * p.qty * p.pointValue) : 0;
        const best = p ? (((p.side === "long" ? b.h : b.l) - p.entry) * (p.side === "long" ? 1 : -1) * p.qty * p.pointValue) : 0;
        if (program.ddType === "trailing-intraday") {
          a.peak = Math.max(a.peak, balance0 + realizedNow + best);
          a.threshold = Math.min(a.peak - program.drawdown, program.lock == null ? Infinity : size + program.lock);
        }
        if (balance0 + realizedNow + worst <= a.threshold) {
          if (p) realizedNow += closeAt({ ...p, worst: Math.min(p.worst, worst) }, p.side === "long" ? b.l : b.h, "flattened", b.t);
          p = null;
          o = null;
          a.blown = `Drawdown hit on ${timeOf(b.t)}`;
          setPlaying(false);
          break;
        }
        if (program.dll != null && realizedNow - a.dayStart + worst <= -program.dll && !a.halted) {
          if (p) realizedNow += closeAt({ ...p, worst: Math.min(p.worst, worst) }, p.side === "long" ? b.l : b.h, "flattened", b.t);
          p = null;
          o = null;
          a.halted = `Daily loss limit hit at ${timeOf(b.t)}; trading resumes next session`;
        }
      }
    }
    setPos(p);
    setPending(o);
    setAcctTick((x) => x + 1);
  }, [cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save where the account is, a moment after the cursor stops.
  useEffect(() => {
    if (!onCursor || !bars[cursor - 1]) return;
    const id = setTimeout(() => onCursor(bars[cursor - 1].t), 1200);
    return () => clearTimeout(id);
  }, [cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the chart light: once the window grows long, start it closer to now.
  useEffect(() => {
    if (cursor - base > 3000) setBase(cursor - WARMUP);
  }, [cursor, base]);

  useEffect(() => {
    if (!playing) return;
    if (cursor >= n) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setCursor((c) => Math.min(n, c + 1)), 650 / speed);
    return () => clearTimeout(id);
  }, [playing, cursor, speed, n]);

  const step = (k = 1) => setCursor((c) => Math.min(n, c + k));
  const jump = (c: number) => {
    setPlaying(false);
    setPos(null);
    setPending(null);
    setBase(Math.max(0, c - WARMUP));
    prev.current = c;
    setCursor(c);
  };
  const nextSetup = () => {
    const i = signals.find((s) => s >= cursor);
    if (i == null) return;
    setPlaying(false);
    if (i + 1 - base > 3000) setBase(i + 1 - WARMUP);
    setCursor(i + 1);
  };
  // A session picked at random from those where the strategy formed: practice without knowing what's coming.
  const randomDay = () => {
    if (!formed.length) return;
    const f = formed[Math.floor(Math.random() * formed.length)];
    jump(Math.max(WARMUP, f.first - 24));
  };
  const jumpTo = (date: string) => {
    const i = bars.findIndex((b) => {
      const s = sessionOf(b.t);
      return s.date >= date && (anchor === "utc" || s.date > date || s.minute >= 570);
    });
    if (i >= 0) jump(Math.max(WARMUP, i + 1));
  };

  // The account with this session's trades, graded the same way as everywhere else.
  const live = useMemo(() => (account && snap ? accountState({ ...account, trades: [...account.trades, ...trades.map(toAccountTrade)] }) : null), [trades]); // eslint-disable-line react-hooks/exhaustive-deps
  const passed = live?.status === "passed";
  const locked = !!acct.current.blown || !!acct.current.halted || passed || live?.status === "blown";
  const place = (side: Side, usePlan: boolean) => {
    if (!last || pos || pending || locked) return;
    if (orderType !== "market" && !usePlan) {
      const px = orderPx > 0 ? orderPx : last.c;
      setPending({ side, type: orderType, price: px, stopDist, rr, placedAt: last.t });
      return;
    }
    const p = fill(side, last.c, stopDist, rr, last.t, usePlan && plan ? { stop: plan.stop, target: plan.target, id: plan.id } : null);
    if (p) setPos(p);
  };
  const closeNow = () => {
    if (!pos || !last) return;
    closeAt(pos, last.c, "manual", last.t);
    setPos(null);
  };

  // A limit or stop starts at the last price, on a tick.
  useEffect(() => {
    if (orderType === "market" || !last) return;
    setOrderPx(Math.round(last.c / sym.tick) * sym.tick);
  }, [orderType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: space play/pause, → one bar, B buy, S sell, X close, N next setup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (k === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (k === "arrowright") step(e.shiftKey ? 10 : 1);
      else if (k === "b") place("long", false);
      else if (k === "s") place("short", false);
      else if (k === "x") closeNow();
      else if (k === "n") nextSetup();
      else if (k === "r") randomDay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const wins = trades.filter((t) => t.pnl > 0).length;
  const netR = trades.reduce((a, t) => a + t.r, 0);
  const progress = (cursor - first) / Math.max(1, n - first);
  const nextIn = signals.find((s) => s >= cursor);
  const a = acct.current;
  void acctTick;
  const dayPnl = realized - a.dayStart + openPnl;
  const shownPos: VisionPosition | null = pos;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-3">
        {program && (
          <div className={clsx("grid gap-3 rounded-[22px] p-4 ring-1 sm:grid-cols-[auto_1fr_1fr_1fr]", a.blown || live?.status === "blown" ? "bg-[#FF7A85]/10 ring-[#FF7A85]/40" : passed ? "bg-[#30D158]/10 ring-[#30D158]/40" : "bg-[#BF5AF2]/[0.08] ring-[#BF5AF2]/35")}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#BF5AF2] text-white">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-bold text-white">{account ? `You're trading ${account.name}` : `${program.firm} ${program.sizeLabel}`}</p>
                <p className="text-[11.5px] text-white/50">{passed ? "Passed: target, days and consistency met" : a.blown || (live?.status === "blown" ? live.headline : "") || a.halted || (account ? `${program.firm} ${program.sizeLabel} · saving as you trade` : "Rules running live")}</p>
              </div>
            </div>
            {account?.phase === "live" ? <Meter label="Return" value={Math.max(0, equity - size)} max={size} text={`${money(equity - size)}, ${(((equity - size) / size) * 100).toFixed(1)}%`} color="#30D158" /> : <Meter label={account?.phase === "funded" ? "Profit" : "Profit target"} value={equity - size} max={program.target} text={`${money(equity - size)} of ${money(program.target).replace("+", "")}`} color="#30D158" />}
            <Meter label={account?.phase === "live" ? "Room to your stop" : "Drawdown left"} value={equity - a.threshold} max={program.drawdown} text={`${money(equity - a.threshold).replace("+", "")} · ${account?.phase === "live" ? "stops at" : "floor"} $${Math.round(a.threshold).toLocaleString("en-US")}`} color="#BF5AF2" />
            <Meter label="Daily loss left" value={program.dll != null ? program.dll + dayPnl : 1} max={program.dll ?? 1} text={program.dll != null ? `${money(program.dll + dayPnl).replace("+", "")} of ${money(program.dll).replace("+", "")}` : "No daily limit"} color="#FFD60A" />
          </div>
        )}
        <Card className="!p-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <span className="text-[17px] font-bold text-white">/{sym.kind === "futures" ? (micro ? sym.roots!.micro : sym.roots!.full) : sym.id}</span>
            <Pill tone="cyan">REPLAY</Pill>
            <span className="rounded-full bg-white/[0.07] px-2 py-0.5 font-mono text-[11px] text-white/60">
              {tf}
              {htf && htfTf ? ` + ${htfTf}` : ""}
            </span>
            <span className="text-[13px] tabular-nums text-white/55">{last ? timeOf(last.t) : ""}</span>
            <span className="ml-auto flex items-center gap-2">
              {htfTf && (
                <button onClick={() => setHtf(!htf)} className={clsx("rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1", htf ? "bg-white/[0.1] text-white ring-white/15" : "text-white/45 ring-white/[0.08]")}>
                  {htfTf} context
                </button>
              )}
              <button onClick={() => setHints(!hints)} title="Vision marks setups as they form" className={clsx("flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1", hints ? "bg-[#FF8A3D]/14 text-[#FFB27D] ring-[#FF8A3D]/35" : "text-white/45 ring-white/[0.08]")}>
                <Wand2 className="h-3 w-3" /> Vision hints
              </button>
            </span>
          </div>
          <VisionChart bars={view} sym={sym} scan={scan} phase={PHASE} position={shownPos} closed={lastClosed} height={htf && htfTf ? 440 : 520} label="REPLAY" />
          {cursor >= n && onMore && (
            <div className="flex items-center gap-2 border-t border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-[12.5px] text-white/75">
              End of the loaded history.
              <button onClick={onMore} className="ml-auto rounded-full bg-white px-3 py-1 text-[12px] font-bold text-black">
                Load the next months
              </button>
            </div>
          )}
          {pending && (
            <div className="flex items-center gap-2 border-t border-white/[0.06] bg-[#5AC8FA]/[0.06] px-4 py-2 text-[12.5px] text-white/75">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#5AC8FA]" />
              Working {pending.side === "long" ? "buy" : "sell"} {pending.type} at <span className="font-semibold text-white">{fmt(pending.price)}</span>
              <button onClick={() => setPending(null)} className="ml-auto flex items-center gap-1 rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[12px] font-semibold text-white/75 hover:bg-white/[0.14]">
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          )}
          {htf && htfTf && htfBars.length > 5 && (
            <div className="border-t border-white/[0.06]">
              <VisionChart bars={htfBars} sym={sym} scan={null} phase={PHASE} position={shownPos} closed={null} height={200} label={htfTf.toUpperCase()} />
            </div>
          )}
          {/* Transport */}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-3">
            <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} className="grid h-11 w-11 place-items-center rounded-full bg-[#5AC8FA] text-black shadow-[0_10px_24px_-10px_rgba(90,200,250,0.9)] active:scale-95">
              {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
            </button>
            <IconBtn label="One bar (→)" onClick={() => step(1)}>
              <StepForward className="h-4 w-4" />
            </IconBtn>
            <IconBtn label="Ten bars (Shift →)" onClick={() => step(10)}>
              <FastForward className="h-4 w-4" />
            </IconBtn>
            <button onClick={nextSetup} disabled={nextIn == null} className="flex h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-semibold text-white ring-1 ring-white/[0.06] hover:bg-white/[0.12] disabled:opacity-35" title="Jump to the next bar where the strategy fires (N)">
              <SkipForward className="h-4 w-4" /> Next setup
            </button>
            <Seg size="sm" value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ v: s, l: `${s}×` }))} label="Speed" />
            <button onClick={randomDay} disabled={!formed.length} title="A random session where the strategy formed (R)" className="ml-auto flex h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-semibold text-white ring-1 ring-white/[0.06] hover:bg-white/[0.12] disabled:opacity-35">
              <Shuffle className="h-4 w-4" /> Random day
            </button>
            <label className="flex items-center gap-2 text-[12.5px] text-white/55">
              Go to
              <input type="date" onChange={(e) => e.target.value && jumpTo(e.target.value)} className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-[12.5px] text-white [color-scheme:dark] ring-1 ring-inset ring-white/[0.07]" />
            </label>
          </div>
          <div className="h-1 bg-gradient-to-r from-white/[0.03] to-white/[0.06]">
            <div className="h-full bg-gradient-to-r from-[#5AC8FA] to-[#BF5AF2] transition-[width]" style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
          </div>
        </Card>
        <p className="px-1 text-[12px] text-white/38">Keys: Space play/pause · → one bar · Shift → ten · B buy · S sell · X close · N next setup · R random day</p>
      </div>

      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card title="Place order">
          {plan && !pos && !pending && !locked && (
            <button onClick={() => place(plan.side, true)} className="mb-3 flex w-full items-center gap-3 rounded-[16px] bg-[#FF8A3D]/12 px-3 py-2.5 text-left ring-1 ring-[#FF8A3D]/40 hover:bg-[#FF8A3D]/18">
              <Wand2 className="h-5 w-5 shrink-0 text-[#FFB27D]" />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-white">
                  Take Vision&apos;s {plan.side} · {infoOf(plan.reader).short}
                </span>
                <span className="block truncate text-[12px] text-white/55">
                  Stop {fmt(plan.stop)} · target {fmt(plan.target)} · {plan.rr.toFixed(1)}R{plan.history.hitRate != null ? ` · ${Math.round(plan.history.hitRate * 100)}% before` : ""}
                </span>
              </span>
            </button>
          )}
          {pos ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-[16px] bg-white/[0.05] px-3 py-2.5">
                <span className="text-[13px] text-white/75">
                  <span className={clsx("font-bold", pos.side === "long" ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{pos.side === "long" ? "Long" : "Short"}</span> {pos.qty} @ {fmt(pos.entry)}
                  <span className="block text-[11.5px] text-white/45">
                    SL {fmt(pos.stop)}
                    {pos.moved ? " (break-even)" : ""} · TP {fmt(pos.target)}
                  </span>
                </span>
                <span className={clsx("text-[17px] font-bold tabular-nums", openPnl >= 0 ? "text-white" : "text-white/60")}>{money(openPnl, 2)}</span>
              </div>
              <button onClick={closeNow} className="w-full rounded-[14px] bg-white/[0.1] py-2.5 text-[14px] font-semibold text-white hover:bg-white/[0.14]">
                Close at {last ? fmt(last.c) : "—"} (X)
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={locked || !!pending} onClick={() => place("long", false)} className="rounded-[14px] bg-[#30D158]/18 py-3 text-[15px] font-bold text-[#7CE59A] ring-1 ring-[#30D158]/40 active:scale-[0.98] disabled:opacity-40">
                  Buy (B)
                </button>
                <button disabled={locked || !!pending} onClick={() => place("short", false)} className="rounded-[14px] bg-[#FF7A85]/14 py-3 text-[15px] font-bold text-[#FFA3AB] ring-1 ring-[#FF7A85]/40 active:scale-[0.98] disabled:opacity-40">
                  Sell (S)
                </button>
              </div>
              <div className="mt-3">
                <Seg full size="sm" value={orderType} onChange={setOrderType} options={[{ v: "market" as const, l: "Market" }, { v: "limit" as const, l: "Limit" }, { v: "stop" as const, l: "Stop" }]} />
                {orderType !== "market" && (
                  <div className="mt-2">
                    <Num value={orderPx} onChange={setOrderPx} step={sym.tick} min={0} prefix="@" />
                  </div>
                )}
              </div>
            </>
          )}
          <div className="mt-3 space-y-2">
            <Row k="Take profit" v={<Num value={rr} onChange={setRr} min={0.5} max={10} step={0.5} suffix="R" width="w-24" />} />
            <Row k="Stop loss" v={<Num value={Number(stopDist.toFixed(sym.decimals))} onChange={setStopPts} min={sym.tick} step={sym.tick} suffix="pts" width="w-28" />} />
            {sym.kind === "futures" ? (
              <Row
                k={
                  <Seg size="sm" value={sizing} onChange={setSizing} options={[{ v: "fixed" as const, l: "Contracts" }, { v: "risk" as const, l: "% risk" }]} />
                }
                v={sizing === "fixed" ? <Num value={qty} onChange={(v) => setQty(Math.round(v))} min={1} max={50} width="w-20" /> : <Num value={riskPct} onChange={setRiskPct} min={0.1} max={10} step={0.1} suffix="%" width="w-24" />}
              />
            ) : (
              <Row k="Size" v={<span className="text-[13px] font-semibold tabular-nums text-white/80">{sizeFor(stopDist)}</span>} />
            )}
            {sym.kind === "futures" && sizing === "risk" && <p className="text-right text-[11.5px] text-white/40">{sizeFor(stopDist)} contracts at this stop</p>}
            {sym.kind === "futures" && program && sizeFor(stopDist) === 0 && <p className="text-right text-[11.5px] text-[#FFD08A]">One contract at this stop is over your risk limit.</p>}
            <div className="rounded-[14px] bg-white/[0.03] px-3">
              <Toggle label="Auto break-even at +1R" on={autoBe} onChange={setAutoBe} />
            </div>
          </div>
          <p className="mt-2 text-[11.5px] text-white/38">Market fills at the last close; limits and stops fill on the bar that trades through them. The stop wins a bar that touches both.</p>
        </Card>

        <Card title="This session">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Net" value={money(realized)} tone={realized >= 0 ? "pos" : "neg"} />
            <Stat label="Win rate" value={trades.length ? `${Math.round((wins / trades.length) * 100)}%` : "—"} />
            <Stat label="Net R" value={trades.length ? `${netR >= 0 ? "+" : ""}${netR.toFixed(1)}R` : "—"} />
          </div>
          <div className="mt-3 max-h-[300px] space-y-1 overflow-y-auto">
            {trades.length === 0 && <p className="py-3 text-center text-[12.5px] text-white/40">Trades you take show up here; tap one to tag it.</p>}
            {[...trades].reverse().map((t, k) => {
              const idx = trades.length - 1 - k;
              return (
                <div key={idx} className="rounded-xl bg-white/[0.03]">
                  <button onClick={() => setOpenRow(openRow === idx ? null : idx)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px]">
                    <span className="text-white/70">
                      <span className={clsx("font-semibold", t.side === "long" ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{t.side === "long" ? "L" : "S"}</span> {timeOf(t.entryT)}
                      {t.vision && <span className="ml-1 text-[#FFB27D]">✦</span>}
                      <span className="ml-1 text-white/40">{t.reason}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-white">
                      {money(t.pnl, 2)}{" "}
                      <span className="text-white/45">
                        {t.r >= 0 ? "+" : ""}
                        {t.r.toFixed(2)}R
                      </span>
                    </span>
                  </button>
                  {openRow === idx && (
                    <div className="px-3 pb-3">
                      <Journal k={`${sym.id}:${t.entryT}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              disabled={!trades.length || saved !== "idle"}
              onClick={async () => {
                setSaved("saving");
                const ok = await onSave({ trades, from: trades[0].entryT, to: trades[trades.length - 1].exitT });
                setSaved(ok ? "saved" : "idle");
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#5AC8FA]/15 py-2.5 text-[13.5px] font-semibold text-[#9BE1FF] ring-1 ring-[#5AC8FA]/30 disabled:opacity-40"
            >
              <FolderDown className="h-4 w-4" /> {saved === "saved" ? "Saved" : saved === "saving" ? "Saving…" : "Save session"}
            </button>
            {!account && (
            <button
              onClick={() => {
                setTrades([]);
                setPos(null);
                setPending(null);
                setLastClosed(null);
                setSaved("idle");
                acct.current = fresh();
                setAcctTick((x) => x + 1);
              }}
              aria-label="Reset session"
              title="Reset session"
              className="grid w-11 place-items-center rounded-[14px] bg-white/[0.07] text-white/70 hover:bg-white/[0.12]"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            )}
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Where it formed · {formed.length} sessions</span>}>
          {scenario && <p className="-mt-1 mb-2 text-[12.5px] leading-snug text-white/60">{scenario.what}</p>}
          {formed.length === 0 ? (
            <p className="text-[12.5px] text-white/40">{reader === "auto" ? "No setups" : `${READERS[reader as ReaderId].label} didn't fire`} in this period.</p>
          ) : (
            <div className="flex max-h-[220px] flex-wrap gap-1.5 overflow-y-auto">
              {formed.map((f) => (
                <button key={f.date} onClick={() => jump(Math.max(WARMUP, f.first - 24))} className={clsx("rounded-lg px-2 py-1 font-mono text-[11.5px] ring-1", bars[cursor - 1] && sessionOf(bars[cursor - 1].t).session === f.date ? "bg-white text-black ring-white" : "bg-white/[0.05] text-white/70 ring-white/[0.07] hover:bg-white/[0.1]")}>
                  {new Date(`${f.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                  {f.n > 1 && <span className="ml-1 text-white/40">×{f.n}</span>}
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11.5px] text-white/38">Tap a day to start a little before the setup and watch it form.</p>
        </Card>
      </div>
    </div>
  );
}

function Meter({ label, value, max, text, color }: { label: string; value: number; max: number; text: string; color: string }) {
  const f = Math.max(0, Math.min(1, value / (max || 1)));
  return (
    <div>
      <p className="flex justify-between text-[11.5px] font-semibold text-white/50">
        <span>{label}</span>
      </p>
      <div className="mt-1.5 h-2 rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${f * 100}%`, background: color }} />
      </div>
      <p className="mt-1 truncate text-[12px] tabular-nums text-white/75">{text}</p>
    </div>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[14px] bg-white/[0.03] px-3 py-2">
      <span className="text-[13px] text-white/70">{k}</span>
      {v}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.08] text-white/80 ring-1 ring-white/[0.06] hover:bg-white/[0.12] hover:text-white">
      {children}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-[14px] bg-white/[0.05] px-3 py-2">
      <p className="text-[11px] font-semibold text-white/45">{label}</p>
      <p className="text-[16px] font-bold tabular-nums" style={{ color: tone === "pos" ? CY : tone === "neg" ? "#FFA3AB" : "#fff" }}>
        {value}
      </p>
    </div>
  );
}
