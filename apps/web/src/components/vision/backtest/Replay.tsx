"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { FastForward, FolderDown, Pause, Play, RotateCcw, SkipForward, StepForward, Wand2 } from "lucide-react";
import type { Bar } from "@/lib/pilot/market";
import { sessionOf } from "@/lib/pilot/market";
import { READERS, READER_ORDER, _internal, analyze, type ReaderChoice, type ReaderId, type Side } from "@/lib/vision/analyze";
import { formatPrice, type VisionSymbol } from "@/lib/vision/markets";
import type { VisionPosition, VisionTrade } from "@/store/visionStore";
import { VisionChart } from "../VisionChart";
import { money, timeOf, type Loaded } from "./data";
import { CY, Card, Num, Pill, Seg } from "./ui";

const SPEEDS = [1, 2, 5, 10, 25] as const;
const PHASE = { scan: null, revealed: 99, projection: true, step: "done" as const };
const WARMUP = 400;

type Session = { side: Side; qty: number; entry: number; exit: number; stop: number; target: number; entryT: number; exitT: number; pnl: number; r: number; reason: "target" | "stop" | "manual"; vision: boolean };

/**
 * Bar-by-bar replay over history, the way a simulator works: price hides what
 * comes next, you place trades with a stop and target, and Vision (if you want
 * it) marks setups as they form.
 */
export function Replay({
  loaded,
  sym,
  anchor,
  reader,
  contracts,
  micro,
  riskDollars,
  onSave,
}: {
  loaded: Loaded;
  sym: VisionSymbol;
  anchor: "rth" | "utc";
  reader: ReaderChoice;
  contracts: number;
  micro: boolean;
  riskDollars: number;
  onSave: (s: { trades: Session[]; from: number; to: number }) => Promise<boolean>;
}) {
  const bars = loaded.bars;
  const n = bars.length;
  const startAt = Math.max(WARMUP, n - 1500);
  const [cursor, setCursor] = useState(startAt);
  const [base, setBase] = useState(Math.max(0, startAt - WARMUP));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const [hints, setHints] = useState(true);
  const [pos, setPos] = useState<(VisionPosition & { vision: boolean }) | null>(null);
  const [trades, setTrades] = useState<Session[]>([]);
  const [lastClosed, setLastClosed] = useState<VisionTrade | null>(null);
  const [qty, setQty] = useState(sym.kind === "crypto" ? 0 : contracts);
  const [stopPts, setStopPts] = useState(0);
  const [rr, setRr] = useState(2);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const fmt = useCallback((p: number) => formatPrice(sym, p), [sym]);
  const pointValue = sym.kind === "crypto" ? 1 : micro ? sym.pointValue!.micro : sym.pointValue!.full;

  // A new data set starts the session over.
  useEffect(() => {
    setCursor(startAt);
    setBase(Math.max(0, startAt - WARMUP));
    setPos(null);
    setTrades([]);
    setLastClosed(null);
    setPlaying(false);
    setSaved("idle");
  }, [loaded.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every bar where the strategy fires, to jump between setups.
  const signals = useMemo(() => {
    const ctx = _internal.context(bars, anchor);
    const readers: ReaderId[] = reader === "auto" ? READER_ORDER : [reader];
    const out: number[] = [];
    for (let i = 30; i < n; i++) if (_internal.detectAt(ctx, i, readers)) out.push(i);
    return out;
  }, [bars, anchor, reader, n]);

  const view = useMemo(() => bars.slice(base, cursor), [bars, base, cursor]);
  const scan = useMemo(() => (hints && view.length > 60 ? analyze(view, { fmt, reader, anchor, maxAge: 30 }) : null), [view, hints, reader, anchor, fmt]);
  const last = bars[cursor - 1];
  const atr = scan?.atr[scan.atr.length - 1] ?? (last ? last.h - last.l : 0);
  const plan = scan?.setup && scan.setup.outcome === "open" && cursor - 1 - base - scan.setup.index <= 3 ? scan.setup : null;
  const defaultStop = Math.max(sym.tick * 4, Math.round((atr * 1.2) / sym.tick) * sym.tick);
  const stopDist = stopPts > 0 ? stopPts : defaultStop;
  const autoQty = sym.kind === "crypto" ? Math.max(0, Math.floor((riskDollars / stopDist) * 1e4) / 1e4) : Math.max(1, Math.round(qty || contracts));

  // ── Moving forward: exits are checked on every bar the cursor passes ──
  const prev = useRef(cursor);
  useEffect(() => {
    const from = prev.current;
    prev.current = cursor;
    if (!pos || cursor <= from) return;
    for (let k = from; k < cursor; k++) {
      const b = bars[k];
      if (b.t * 1000 <= pos.openedAt) continue;
      const stopHit = pos.side === "long" ? b.l <= pos.stop : b.h >= pos.stop;
      const targetHit = pos.side === "long" ? b.h >= pos.target : b.l <= pos.target;
      if (stopHit || targetHit) {
        close(stopHit ? pos.stop : pos.target, stopHit ? "stop" : "target", b.t);
        break;
      }
    }
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
  const nextSetup = () => {
    const i = signals.find((s) => s >= cursor);
    if (i == null) return;
    setPlaying(false);
    if (i + 1 - base > 3000) setBase(i + 1 - WARMUP);
    setCursor(i + 1);
  };
  const jumpTo = (date: string) => {
    const i = bars.findIndex((b) => {
      const s = sessionOf(b.t);
      return s.date >= date && (anchor === "utc" || s.date > date || s.minute >= 570);
    });
    if (i < 0) return;
    const c = Math.max(WARMUP, i + 1);
    setPlaying(false);
    setPos(null);
    setBase(Math.max(0, c - WARMUP));
    prev.current = c;
    setCursor(c);
  };

  const open = (side: Side, usePlan: boolean) => {
    if (!last || pos) return;
    const entry = last.c;
    const p = usePlan && plan ? plan : null;
    const stop = p ? p.stop : side === "long" ? entry - stopDist : entry + stopDist;
    const target = p ? p.target : side === "long" ? entry + stopDist * rr : entry - stopDist * rr;
    if ((side === "long" && (stop >= entry || target <= entry)) || (side === "short" && (stop <= entry || target >= entry))) return;
    const size = sym.kind === "crypto" ? Math.max(0, Math.floor((riskDollars / Math.abs(entry - stop)) * 1e4) / 1e4) : autoQty;
    if (size <= 0) return;
    setPos({ id: `r${cursor}`, symbol: sym.id, side, qty: size, entry, stop, target, openedAt: last.t * 1000, setupId: p?.id ?? "", auto: false, venue: "paper", pointValue, vision: !!p });
  };
  const close = (exit: number, reason: Session["reason"], t = last?.t ?? 0) => {
    const p = pos;
    if (!p) return;
    const dir = p.side === "long" ? 1 : -1;
    const pnl = (exit - p.entry) * dir * p.qty * p.pointValue;
    const r = ((exit - p.entry) * dir) / Math.abs(p.entry - p.stop);
    setPos(null);
    setTrades((ts) => [...ts, { side: p.side, qty: p.qty, entry: p.entry, exit, stop: p.stop, target: p.target, entryT: p.openedAt / 1000, exitT: t, pnl, r, reason, vision: p.vision }]);
    setLastClosed({ ...p, exit, closedAt: Date.now(), pnl, reason });
    setSaved("idle");
  };

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
      else if (k === "b") open("long", false);
      else if (k === "s") open("short", false);
      else if (k === "x" && pos && last) close(last.c, "manual");
      else if (k === "n") nextSetup();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const wins = trades.filter((t) => t.pnl > 0).length;
  const net = trades.reduce((a, t) => a + t.pnl, 0);
  const netR = trades.reduce((a, t) => a + t.r, 0);
  const openPnl = pos && last ? (last.c - pos.entry) * (pos.side === "long" ? 1 : -1) * pos.qty * pos.pointValue : 0;
  const progress = (cursor - startAt) / Math.max(1, n - startAt);
  const nextIn = signals.find((s) => s >= cursor);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-3">
        <Card className="!p-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <span className="text-[17px] font-bold text-white">{sym.label}</span>
            <Pill tone="cyan">REPLAY</Pill>
            <span className="text-[13px] tabular-nums text-white/55">{last ? timeOf(last.t) : ""}</span>
            <span className="ml-auto text-[12px] text-white/40">{loaded.label}</span>
          </div>
          <VisionChart bars={view} sym={sym} scan={scan} phase={PHASE} position={pos} closed={lastClosed} height={520} label="REPLAY" />
          {/* Transport */}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-3">
            <button
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause" : "Play"}
              className="grid h-11 w-11 place-items-center rounded-full bg-[#5AC8FA] text-black shadow-[0_10px_24px_-10px_rgba(90,200,250,0.9)] active:scale-95"
            >
              {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
            </button>
            <IconBtn label="One bar (→)" onClick={() => step(1)}>
              <StepForward className="h-4 w-4" />
            </IconBtn>
            <IconBtn label="Ten bars (Shift →)" onClick={() => step(10)}>
              <FastForward className="h-4 w-4" />
            </IconBtn>
            <button
              onClick={nextSetup}
              disabled={nextIn == null}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-semibold text-white ring-1 ring-white/[0.06] hover:bg-white/[0.12] disabled:opacity-35"
              title="Jump to the next bar where the strategy fires (N)"
            >
              <SkipForward className="h-4 w-4" /> Next setup
            </button>
            <Seg size="sm" value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ v: s, l: `${s}×` }))} label="Speed" />
            <label className="ml-auto flex items-center gap-2 text-[12.5px] text-white/55">
              Go to
              <input type="date" onChange={(e) => e.target.value && jumpTo(e.target.value)} className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-[12.5px] text-white [color-scheme:dark] ring-1 ring-inset ring-white/[0.07]" />
            </label>
          </div>
          <div className="h-1 bg-white/[0.05]">
            <div className="h-full bg-[#5AC8FA]/70 transition-[width]" style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
          </div>
        </Card>
        <p className="px-1 text-[12px] text-white/38">Keys: Space play/pause · → one bar · Shift → ten · B buy · S sell · X close · N next setup</p>
      </div>

      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card title="Order ticket">
          {plan && !pos && (
            <button onClick={() => open(plan.side, true)} className="mb-3 flex w-full items-center gap-3 rounded-[16px] bg-[#5AC8FA]/12 px-3 py-2.5 text-left ring-1 ring-[#5AC8FA]/40 hover:bg-[#5AC8FA]/18">
              <Wand2 className="h-5 w-5 shrink-0 text-[#9BE1FF]" />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-white">
                  Take Vision&apos;s {plan.side} · {READERS[plan.reader].short}
                </span>
                <span className="block truncate text-[12px] text-white/55">
                  Stop {fmt(plan.stop)} · target {fmt(plan.target)} · {plan.rr.toFixed(1)}R{plan.history.hitRate != null ? ` · ${Math.round(plan.history.hitRate * 100)}% before` : ""}
                </span>
              </span>
            </button>
          )}
          <div className="grid grid-cols-3 gap-2">
            {sym.kind === "crypto" ? (
              <div className="col-span-1">
                <p className="mb-1 text-[11.5px] font-semibold text-white/50">Size</p>
                <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-[14px] font-semibold tabular-nums text-white/80">{autoQty}</p>
              </div>
            ) : (
              <div>
                <p className="mb-1 text-[11.5px] font-semibold text-white/50">{micro ? sym.roots!.micro : sym.roots!.full}</p>
                <Num value={qty || contracts} onChange={(v) => setQty(Math.round(v))} min={1} max={50} />
              </div>
            )}
            <div>
              <p className="mb-1 text-[11.5px] font-semibold text-white/50">Stop pts</p>
              <Num value={Number(stopDist.toFixed(sym.decimals))} onChange={setStopPts} min={sym.tick} step={sym.tick} />
            </div>
            <div>
              <p className="mb-1 text-[11.5px] font-semibold text-white/50">Target</p>
              <Num value={rr} onChange={setRr} min={0.5} max={10} step={0.5} suffix="R" />
            </div>
          </div>
          {pos ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-[16px] bg-white/[0.05] px-3 py-2.5">
                <span className="text-[13px] text-white/75">
                  <span className={clsx("font-bold", pos.side === "long" ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{pos.side === "long" ? "Long" : "Short"}</span> {pos.qty} @ {fmt(pos.entry)}
                  <span className="block text-[11.5px] text-white/45">
                    SL {fmt(pos.stop)} · TP {fmt(pos.target)}
                  </span>
                </span>
                <span className={clsx("text-[17px] font-bold tabular-nums", openPnl >= 0 ? "text-white" : "text-white/60")}>{money(openPnl, 2)}</span>
              </div>
              <button onClick={() => last && close(last.c, "manual")} className="w-full rounded-[14px] bg-white/[0.1] py-2.5 text-[14px] font-semibold text-white hover:bg-white/[0.14]">
                Close at {last ? fmt(last.c) : "—"} (X)
              </button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => open("long", false)} className="rounded-[14px] bg-[#5AC8FA] py-3 text-[15px] font-bold text-black active:scale-[0.98]">
                Buy (B)
              </button>
              <button onClick={() => open("short", false)} className="rounded-[14px] bg-[#FF7A85] py-3 text-[15px] font-bold text-black active:scale-[0.98]">
                Sell (S)
              </button>
            </div>
          )}
          <p className="mt-2 text-[11.5px] text-white/38">Market fills at the last close. The stop wins a bar that touches both.</p>
        </Card>

        <Card
          title="This session"
          aside={
            <button
              onClick={() => setHints(!hints)}
              title="Vision marks setups as they form"
              className={clsx("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1", hints ? "bg-[#5AC8FA]/14 text-[#9BE1FF] ring-[#5AC8FA]/35" : "bg-white/[0.05] text-white/50 ring-white/[0.08]")}
            >
              <Wand2 className="h-3.5 w-3.5" /> Vision hints {hints ? "on" : "off"}
            </button>
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Net" value={money(net)} tone={net >= 0 ? "pos" : "neg"} />
            <Stat label="Win rate" value={trades.length ? `${Math.round((wins / trades.length) * 100)}%` : "—"} />
            <Stat label="Net R" value={trades.length ? `${netR >= 0 ? "+" : ""}${netR.toFixed(1)}R` : "—"} />
          </div>
          <div className="mt-3 max-h-[260px] space-y-1 overflow-y-auto">
            {trades.length === 0 && <p className="py-3 text-center text-[12.5px] text-white/40">Trades you take show up here.</p>}
            {[...trades].reverse().map((t, k) => (
              <div key={k} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-[12.5px]">
                <span className="text-white/70">
                  <span className={clsx("font-semibold", t.side === "long" ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{t.side === "long" ? "L" : "S"}</span> {timeOf(t.entryT)}
                  {t.vision && <span className="ml-1 text-[#9BE1FF]">✦</span>}
                  <span className="ml-1 text-white/40">{t.reason}</span>
                </span>
                <span className="font-semibold tabular-nums text-white">
                  {money(t.pnl, 2)}{" "}
                  <span className="text-white/45">
                    {t.r >= 0 ? "+" : ""}
                    {t.r.toFixed(2)}R
                  </span>
                </span>
              </div>
            ))}
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
            <button
              onClick={() => {
                setTrades([]);
                setPos(null);
                setLastClosed(null);
                setSaved("idle");
              }}
              aria-label="Reset session"
              title="Reset session"
              className="grid w-11 place-items-center rounded-[14px] bg-white/[0.07] text-white/70 hover:bg-white/[0.12]"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </Card>
      </div>
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
