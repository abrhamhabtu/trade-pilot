"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ColorType, CrosshairMode, LineStyle, createChart, type IChartApi, type IPriceLine, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import type { Bar } from "@/lib/pilot/market";
import { READERS, type Scan } from "@/lib/vision/analyze";
import { formatPrice, type VisionSymbol } from "@/lib/vision/markets";
import type { VisionPosition, VisionTrade } from "@/store/visionStore";

export const ORANGE = "#FF8A3D";
const DOWN = "#5B6170";
const RED = "#FF5A4E";
const CARD_W = 248;
const CARD_H = 52;

export interface Phase {
  /** 0..1 while the scan line crosses the chart; null when not scanning. */
  scan: number | null;
  /** How many numbered callouts are on screen. */
  revealed: number;
  /** Setup box, projection and volume highlight. */
  projection: boolean;
  /** Where the reveal is: the callouts show while marking and planning, then step aside. */
  step?: "scanning" | "marking" | "planning" | "done";
}

interface Geo {
  w: number;
  h: number;
  plotW: number;
  x: (i: number) => number | null;
  y: (p: number) => number | null;
  bar: number;
}

/** Seconds to add so the chart's clock reads New York time for futures, local time for crypto. */
function shiftFor(sym: VisionSymbol, t: number) {
  const d = new Date(t * 1000);
  const zone = sym.kind === "futures" ? "America/New_York" : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const local = new Date(d.toLocaleString("en-US", { timeZone: zone }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((local.getTime() - utc.getTime()) / 1000);
}

const volColor = (b: Bar, on: boolean) => (on ? (b.c >= b.o ? "rgba(255,138,61,0.95)" : "rgba(205,210,220,0.75)") : b.c >= b.o ? "rgba(255,138,61,0.36)" : "rgba(120,126,140,0.32)");

export function VisionChart({ bars, sym, scan, phase, position, closed, height, label, story = false }: { bars: Bar[]; sym: VisionSymbol; scan: Scan | null; phase: Phase; position: VisionPosition | null; closed?: VisionTrade | null; height: number; label?: string; story?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const emaLine = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapLine = useRef<ISeriesApi<"Line"> | null>(null);
  const volume = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lines = useRef<IPriceLine[]>([]);
  const shape = useRef({ n: 0, first: 0, last: 0, sig: "" });
  const [geo, setGeo] = useState<Geo | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const shift = useMemo(() => (bars.length ? shiftFor(sym, bars[bars.length - 1].t) : 0), [sym, bars.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const fmt = (n: number) => formatPrice(sym, n);
  // What to draw. An open setup in full; a finished one only briefly and quietly,
  // unless a replay or demo is telling its story.
  const raw = scan?.setup ?? null;
  const ago = raw && raw.outcomeIndex != null ? bars.length - 2 - raw.outcomeIndex : 0;
  const setup = raw && (raw.outcome === "open" || story || ago <= 12) ? raw : null;
  const full = !!setup && (setup.outcome === "open" || story);
  const planShown = !!setup && (phase.projection || setup.outcome !== "open");
  const useVwap = setup ? READERS[setup.reader].line === "vwap" : scan?.reader && scan.reader !== "auto" ? READERS[scan.reader].line === "vwap" : false;

  const measure = () => {
    const c = chart.current;
    const el = box.current;
    if (!c || !el) return;
    const ts = c.timeScale();
    setGeo({
      w: el.clientWidth,
      h: el.clientHeight,
      plotW: Math.max(0, el.clientWidth - c.priceScale("right").width()),
      x: (i) => ts.logicalToCoordinate(i as never) as number | null,
      y: (p) => (candles.current?.priceToCoordinate(p) as number | null) ?? null,
      bar: ts.options().barSpacing,
    });
  };

  // ── Chart setup ──
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const c = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "rgba(235,235,245,0.45)", fontSize: 11, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.26 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 24, barSpacing: 9 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "rgba(255,138,61,0.3)", labelBackgroundColor: "#2A2A2E" }, horzLine: { color: "rgba(255,138,61,0.3)", labelBackgroundColor: "#2A2A2E" } },
    });
    candles.current = c.addCandlestickSeries({ upColor: ORANGE, downColor: DOWN, borderVisible: false, wickUpColor: "rgba(255,138,61,0.75)", wickDownColor: "rgba(140,146,160,0.7)", priceLineColor: ORANGE, priceLineStyle: LineStyle.Dashed });
    emaLine.current = c.addLineSeries({ color: "rgba(235,235,245,0.5)", lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    vwapLine.current = c.addLineSeries({ color: "rgba(120,170,255,0.75)", lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    volume.current = c.addHistogramSeries({ priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    chart.current = c;
    c.timeScale().subscribeVisibleLogicalRangeChange(() => measure());
    c.subscribeCrosshairMove((p) => setHover(p.logical == null ? null : Math.round(p.logical as number)));
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);
    return () => {
      ro.disconnect();
      c.remove();
      chart.current = null;
      lines.current = [];
      shape.current = { n: 0, first: 0, last: 0, sig: "" };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Candles and volume ──
  useEffect(() => {
    const c = chart.current;
    if (!c || !candles.current || !volume.current) return;
    if (!bars.length) {
      candles.current.setData([]);
      volume.current.setData([]);
      shape.current = { n: 0, first: 0, last: 0, sig: "" };
      return;
    }
    const at = (t: number) => (t + shift) as UTCTimestamp;
    const candle = (b: Bar) => ({ time: at(b.t), open: b.o, high: b.h, low: b.l, close: b.c });
    const on = (i: number) => full && planShown && !!setup && i >= setup.volume.from && i <= setup.volume.to;
    const vol = (b: Bar, i: number) => ({ time: at(b.t), value: b.v, color: volColor(b, on(i)) });
    // Incremental update only for the same series growing by at most one bar; anything else is a reset.
    const sig = `${sym.id}:${shift}`;
    const lastT = bars[bars.length - 1].t;
    const same = shape.current.sig === sig && shape.current.first === bars[0].t && bars.length - shape.current.n <= 1 && bars.length >= shape.current.n && lastT >= shape.current.last;
    let updated = false;
    if (same && shape.current.n) {
      try {
        candles.current.update(candle(bars[bars.length - 1]));
        volume.current.update(vol(bars[bars.length - 1], bars.length - 1));
        updated = true;
      } catch {
        updated = false;
      }
    }
    if (!updated) {
      const fresh = shape.current.first !== bars[0].t || shape.current.sig !== sig || bars.length < shape.current.n;
      candles.current.setData(bars.map(candle));
      volume.current.setData(bars.map(vol));
      if (fresh) c.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - 90), to: bars.length + 24 });
    }
    shape.current = { n: bars.length, first: bars[0].t, last: lastT, sig };
    candles.current.applyOptions({ priceFormat: { type: "price", precision: sym.decimals, minMove: sym.tick } });
    c.applyOptions({ localization: { priceFormatter: (p: number) => formatPrice(sym, p) } });
    requestAnimationFrame(measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, shift, sym]);

  // Light up the volume under the setup once its plan is on screen.
  useEffect(() => {
    if (!volume.current || !bars.length) return;
    const at = (t: number) => (t + shift) as UTCTimestamp;
    volume.current.setData(bars.map((b, i) => ({ time: at(b.t), value: b.v, color: volColor(b, full && planShown && !!setup && i >= setup.volume.from && i <= setup.volume.to) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.id, planShown, full]);

  // ── EMA or VWAP, whichever the strategy reads ──
  useEffect(() => {
    if (!emaLine.current || !vwapLine.current || !scan || !bars.length) return;
    const n = Math.min(bars.length, scan.ema.length);
    const at = (i: number) => (bars[i].t + shift) as UTCTimestamp;
    emaLine.current.setData(useVwap ? [] : scan.ema.slice(0, n).map((v, i) => ({ time: at(i), value: v })));
    vwapLine.current.setData(useVwap ? scan.vwap.slice(0, n).map((v, i) => (Number.isFinite(v) ? { time: at(i), value: v } : { time: at(i) })) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan, shift, useVwap]);

  // ── Level, target and stop on the price axis ──
  useEffect(() => {
    const cs = candles.current;
    if (!cs) return;
    lines.current.forEach((l) => cs.removePriceLine(l));
    lines.current = [];
    if (!planShown || !setup || !full) return;
    lines.current.push(cs.createPriceLine({ price: setup.level, color: "rgba(255,255,255,0.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" }));
    lines.current.push(cs.createPriceLine({ price: setup.target, color: ORANGE, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" }));
    lines.current.push(cs.createPriceLine({ price: setup.stop, color: RED, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" }));
  }, [setup, planShown, full]);

  // ── Frame the setup: from a little before its first mark to past its projection ──
  useEffect(() => {
    const c = chart.current;
    if (!c || !setup) return;
    const last = bars.length - 1;
    if (last - setup.index > 70) return;
    const horizon = Math.max(10, Math.min(24, setup.history.medianBarsToTarget ?? 16));
    const from = Math.max(0, Math.min(setup.levelIndex, setup.sweepIndex) - 40);
    const to = Math.max(last + 10, setup.index + horizon + 8);
    c.timeScale().setVisibleLogicalRange({ from: Math.min(from, to - 80), to });
    requestAnimationFrame(measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.id]);

  useEffect(() => {
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, scan, phase.projection, phase.revealed, height]);

  const hb = hover != null && bars[hover] ? bars[hover] : bars[bars.length - 1];
  const idx = Math.min(hover ?? Infinity, (scan?.ema.length ?? 1) - 1);
  const lineNow = scan ? (useVwap ? scan.vwap[idx] : scan.ema[idx]) : undefined;

  return (
    <div className="relative" style={{ height }}>
      {hb && (
        <div className="pointer-events-none absolute left-3 top-2 z-10 space-y-0.5 font-mono text-[11px] tabular-nums text-white/55">
          <p>
            O <span className="text-white/80">{fmt(hb.o)}</span> H <span className="text-white/80">{fmt(hb.h)}</span> L <span className="text-white/80">{fmt(hb.l)}</span> C{" "}
            <span className={hb.c >= hb.o ? "text-[#FF8A3D]" : "text-white/80"}>{fmt(hb.c)}</span>
          </p>
          {lineNow != null && Number.isFinite(lineNow) && (
            <p className="flex items-center gap-1.5">
              <span className={clsx("h-px w-3", useVwap ? "bg-[#78AAFF]" : "bg-white/60")} /> {useVwap ? "VWAP" : "EMA 21"} <span className="text-white/75">{fmt(lineNow)}</span>
            </p>
          )}
        </div>
      )}
      {label && <span className="pointer-events-none absolute bottom-[34px] left-14 z-10 rounded-full bg-[#FF8A3D]/15 px-2.5 py-0.5 text-[11px] font-bold tracking-[0.08em] text-[#FFB27D] ring-1 ring-[#FF8A3D]/30">{label}</span>}
      <div ref={box} className="absolute inset-0" />
      {geo && bars.length > 0 && <Overlay geo={geo} bars={bars} scan={scan} setup={setup} full={full} phase={phase} position={position} closed={closed ?? null} fmt={fmt} />}
    </div>
  );
}

function Overlay({ geo, bars, scan, setup, full, phase, position, closed, fmt }: { geo: Geo; bars: Bar[]; scan: Scan | null; setup: Scan["setup"]; full: boolean; phase: Phase; position: VisionPosition | null; closed: VisionTrade | null; fmt: (n: number) => string }) {
  const { w, h, plotW, x, y, bar } = geo;
  const s = setup;
  const volTop = h * 0.83;
  const volBottom = h - 28;
  const show = !!s && (phase.projection || s.outcome !== "open");
  const risk = s ? Math.abs(s.entry - s.stop) : 0;
  const dir = s?.side === "long" ? 1 : -1;
  const horizon = s ? Math.max(10, Math.min(24, s.history.medianBarsToTarget ?? 16)) : 0;
  const done = !!s && s.outcome !== "open";

  // Projection: a straight path to the target, with the cone of past matches (25th to 75th percentile) around it.
  const proj = useMemo(() => {
    if (!s) return null;
    const cone = s.history.cone.slice(0, horizon);
    const pts = (pick: (c: { p25: number; p50: number; p75: number }) => number) =>
      [{ k: 0, px: s.entry }, ...cone.map((c) => ({ k: c.k, px: s.entry + dir * pick(c) * risk }))].map((p) => [x(s.index + p.k), y(p.px)] as const);
    const mid = [[x(s.index), y(s.entry)], [x(s.index + horizon), y(s.target)]] as const;
    return cone.length >= 6 ? { mid, lo: pts((c) => c.p25), hi: pts((c) => c.p75) } : { mid, lo: null, hi: null };
  }, [s, horizon, dir, risk, x, y]);

  const path = (pts: readonly (readonly [number | null, number | null])[]) =>
    pts
      .filter((p): p is readonly [number, number] => p[0] != null && p[1] != null)
      .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
      .join(" ");

  // Callout cards: one column left of the pattern, ordered by where their points sit,
  // placed in the clearest band of that column (above or below the candles under it).
  const cards = useMemo(() => {
    if (!s || !full) return [];
    // Once the plan is on screen the callouts have done their job and step aside, like a presenter's notes.
    if (phase.step === "done" || (phase.step === undefined && phase.projection)) return [];
    const first = x(Math.min(s.levelIndex, s.sweepIndex)) ?? plotW / 2;
    const column = first - CARD_W - 60 > 8 ? Math.min(Math.max(12, first - CARD_W - 60), 36) : Math.min(plotW - CARD_W - 12, (x(s.index + horizon) ?? plotW) + 20);
    const placed: { n: number; title: string; detail: string; mark: "level" | "ring"; px: number; py: number; cx: number; cy: number }[] = [];
    for (const c of s.callouts.slice(0, phase.revealed)) {
      const px = x(c.i);
      const py = y(c.price);
      if (px == null || py == null) continue;
      placed.push({ ...c, px, py, cx: column, cy: py - CARD_H / 2 });
    }
    if (!placed.length) return placed;
    placed.sort((a, b) => a.py - b.py);
    // Where the candles under the column are.
    let occTop = Infinity;
    let occBot = -Infinity;
    for (let i = 0; i < bars.length; i++) {
      const px = x(i);
      if (px == null || px < column - bar || px > column + CARD_W + bar) continue;
      const yh = y(bars[i].h);
      const yl = y(bars[i].l);
      if (yh != null) occTop = Math.min(occTop, yh);
      if (yl != null) occBot = Math.max(occBot, yl);
    }
    const top = 44;
    const bottom = volTop - 8;
    let gap = CARD_H + 18;
    const total = (n: number, g: number) => (n - 1) * g + CARD_H;
    const zones = Number.isFinite(occTop)
      ? [
          { a: top, b: occTop - 10 },
          { a: occBot + 10, b: bottom },
        ]
      : [{ a: top, b: bottom }];
    const meanPy = placed.reduce((m, p) => m + p.py, 0) / placed.length;
    const fits = zones.filter((z) => z.b - z.a >= total(placed.length, CARD_H + 8));
    const zone = (fits.length ? fits : [{ a: top, b: bottom }]).sort((p, q) => Math.abs((p.a + p.b) / 2 - meanPy) - Math.abs((q.a + q.b) / 2 - meanPy))[0];
    while (gap > CARD_H + 8 && total(placed.length, gap) > zone.b - zone.a) gap -= 2;
    const span = total(placed.length, gap);
    const start = Math.max(zone.a, Math.min(zone.b - span, meanPy - span / 2));
    placed.forEach((p, k) => (p.cy = start + k * gap));
    return placed;
  }, [s, full, phase.revealed, phase.step, phase.projection, x, y, plotW, volTop, horizon, bars, bar]);

  const xi = s ? x(s.index) : null;
  const xs = s ? x(Math.min(s.sweepIndex, s.index)) : null;
  const xe = s ? x(s.index + horizon) : null;
  const yE = s ? y(s.entry) : null;
  const yT = s ? y(s.target) : null;
  const yS = s ? y(s.stop) : null;
  const pctOf = (p: number) => `${p >= s!.entry ? "+" : ""}${(((p - s!.entry) / s!.entry) * 100).toFixed(2)}%`;
  const right = Math.min(xe ?? plotW, plotW);
  const seg = s ? bars.slice(Math.min(s.sweepIndex, s.index), s.index + 1) : [];
  const patternTop = s ? Math.max(...seg.map((b) => b.h)) : 0;
  const patternBot = s ? Math.min(...seg.map((b) => b.l)) : 0;
  const mid = proj && proj.mid[0][0] != null && proj.mid[0][1] != null && proj.mid[1][0] != null && proj.mid[1][1] != null ? { x0: proj.mid[0][0]!, y0: proj.mid[0][1]!, x1: proj.mid[1][0]!, y1: proj.mid[1][1]! } : null;
  const ready = show && s && xs != null && xi != null && yE != null && yT != null && yS != null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg width={w} height={h} className="absolute inset-0">
        <defs>
          <linearGradient id="tp-scan" x1="0" x2="1">
            <stop offset="0" stopColor={ORANGE} stopOpacity="0" />
            <stop offset="0.8" stopColor={ORANGE} stopOpacity="0.12" />
            <stop offset="1" stopColor={ORANGE} stopOpacity="0.36" />
          </linearGradient>
          <linearGradient id="tp-tp" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={ORANGE} stopOpacity="0.22" />
            <stop offset="1" stopColor={ORANGE} stopOpacity="0.05" />
          </linearGradient>
          <filter id="tp-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Unswept liquidity, when there is no plan to draw */}
        {scan &&
          !s &&
          [scan.pools.below, scan.pools.above].map((p, k) => {
            if (!p) return null;
            const py = y(p.price);
            const px = x(p.i);
            if (py == null || px == null) return null;
            return (
              <g key={k} className="tp-fade-in">
                <line x1={px} x2={plotW} y1={py} y2={py} stroke={k ? RED : ORANGE} strokeOpacity="0.4" strokeDasharray="5 5" />
                <circle cx={px} cy={py} r="3" fill={k ? RED : ORANGE} />
              </g>
            );
          })}

        {ready && (
          <g className="tp-fade-in" opacity={done ? 0.6 : 1}>
            {s!.zone && x(s!.zone.from) != null && y(s!.zone.top) != null && y(s!.zone.bottom) != null && (
              <rect
                x={x(s!.zone.from)! - bar / 2}
                y={y(s!.zone.top)!}
                width={Math.max(0, right - x(s!.zone.from)! + bar / 2)}
                height={Math.max(1, y(s!.zone.bottom)! - y(s!.zone.top)!)}
                fill={s!.side === "long" ? ORANGE : RED}
                fillOpacity="0.08"
                stroke={s!.side === "long" ? ORANGE : RED}
                strokeOpacity="0.35"
              />
            )}
            <rect x={xi!} y={Math.min(yE!, yT!)} width={Math.max(0, right - xi!)} height={Math.abs(yT! - yE!)} fill="url(#tp-tp)" />
            <rect x={xi!} y={Math.min(yE!, yS!)} width={Math.max(0, right - xi!)} height={Math.abs(yS! - yE!)} fill="#ffffff" fillOpacity="0.045" />
            <line x1={xi!} x2={right} y1={yT!} y2={yT!} stroke={ORANGE} strokeOpacity="0.85" />
            <line x1={xi!} x2={right} y1={yS!} y2={yS!} stroke={RED} strokeOpacity="0.85" />
            <line x1={xi!} x2={plotW} y1={yE!} y2={yE!} stroke="rgba(255,255,255,0.45)" strokeDasharray="4 4" />
            <Brackets x0={xs! - bar * 0.7} x1={xi! + bar * 0.7} y0={y(patternTop)!} y1={y(patternBot)!} />
          </g>
        )}

        {ready && proj && s!.outcome === "open" && mid && (
          <g>
            {proj.lo && proj.hi && <path d={`${path(proj.hi)} ${path([...proj.lo].reverse()).replace(/^M/, "L")} Z`} fill={ORANGE} fillOpacity="0.1" className="tp-fade-in" />}
            <path d={path(proj.mid)} fill="none" stroke={ORANGE} strokeWidth="2" strokeDasharray="6 6" className="tp-draw" />
            <circle cx={mid.x1} cy={mid.y1} r="4.5" fill="#fff" stroke={ORANGE} strokeWidth="2" className="tp-fade-in" />
            <circle cx={mid.x0} cy={mid.y0} r="10" fill="none" stroke={ORANGE} strokeOpacity="0.6" className="tp-pulse-ring" />
          </g>
        )}

        {cards.map((c) => {
          const left = c.cx < c.px;
          const fromX = left ? c.cx + CARD_W : c.cx;
          const r = c.mark === "ring" ? 11 : 4;
          return (
            <g key={c.n} className="tp-fade-in" opacity={done ? 0.75 : 1}>
              {c.mark === "level" && <line x1={c.px} x2={Math.min(plotW, (xi ?? c.px) + bar * 3)} y1={c.py} y2={c.py} stroke="rgba(255,255,255,0.45)" strokeDasharray="5 4" />}
              <line x1={fromX} y1={c.cy + CARD_H / 2} x2={c.px + (left ? -r : r)} y2={c.py} stroke={ORANGE} strokeOpacity="0.8" strokeWidth="1.25" />
              {c.mark === "ring" ? (
                <>
                  <circle cx={c.px} cy={c.py} r={r} fill="none" stroke={ORANGE} strokeWidth="1.75" />
                  <circle cx={c.px} cy={c.py} r={r} fill="none" stroke={ORANGE} strokeOpacity="0.5" className="tp-pulse-ring" />
                  <circle cx={c.px} cy={c.py} r="2.75" fill="#fff" />
                </>
              ) : (
                <circle cx={c.px} cy={c.py} r={r} fill="#fff" stroke={ORANGE} strokeWidth="2" />
              )}
            </g>
          );
        })}

        {ready && full && x(s!.volume.from) != null && x(s!.volume.to) != null && (
          <rect
            x={x(s!.volume.from)! - bar * 0.7}
            y={volTop}
            width={Math.max(0, x(s!.volume.to)! - x(s!.volume.from)! + bar * 1.4)}
            height={Math.max(0, volBottom - volTop)}
            rx="6"
            fill={ORANGE}
            fillOpacity="0.06"
            stroke={ORANGE}
            strokeOpacity="0.75"
            className="tp-fade-in"
          />
        )}

        {position && y(position.entry) != null && <line x1={0} x2={plotW} y1={y(position.entry)!} y2={y(position.entry)!} stroke="#fff" strokeOpacity="0.7" strokeDasharray="2 3" />}

        {phase.scan != null && (
          <g>
            <rect x={0} y={0} width={Math.max(0, plotW * phase.scan)} height={Math.max(0, h - 26)} fill="url(#tp-scan)" />
            <line x1={plotW * phase.scan} x2={plotW * phase.scan} y1={0} y2={h - 26} stroke={ORANGE} strokeWidth="2" />
            <line x1={plotW * phase.scan} x2={plotW * phase.scan} y1={0} y2={h - 26} stroke={ORANGE} strokeWidth="10" opacity="0.45" filter="url(#tp-glow)" />
          </g>
        )}
      </svg>

      {phase.scan != null && (
        <span className="absolute top-1 -translate-x-1/2 rounded-full bg-[#FF8A3D] px-2.5 py-0.5 text-[10.5px] font-bold tracking-[0.06em] text-black shadow-[0_6px_20px_-4px_rgba(255,138,61,0.8)]" style={{ left: Math.max(60, Math.min(plotW - 60, plotW * phase.scan)) }}>
          ✦ ANALYZING {Math.round(phase.scan * 100)}%
        </span>
      )}

      {ready && (() => {
        const tagT = yT! + (s!.side === "long" ? -24 : 4);
        const tagS = yS! + (s!.side === "long" ? 4 : -24);
        const bracketTop = Math.min(y(patternTop)!, y(patternBot)!) - 10;
        // Above the box and its upper tag; below the box when the top of the chart is too close.
        const above = Math.min(bracketTop - 32, Math.min(tagT, tagS) - 30);
        const bracketBot = Math.max(y(patternTop)!, y(patternBot)!) + 10;
        const pillTop = above >= 40 ? above : Math.max(bracketBot, Math.max(tagT, tagS) + 24) + 8;
        return (
          <>
            {full && (
              <span className="tp-fade-in absolute whitespace-nowrap rounded-full bg-[#FF8A3D] px-2.5 py-1 text-[11px] font-bold tracking-[0.04em] text-black shadow-[0_8px_24px_-6px_rgba(255,138,61,0.9)]" style={{ left: Math.max(6, xs! - bar), top: pillTop }}>
                ✦ {s!.side === "long" ? "LONG" : "SHORT"} SETUP
              </span>
            )}
            <span className="tp-fade-in absolute -translate-x-full whitespace-nowrap rounded-md bg-[#FF8A3D] px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-black" style={{ left: right - 6, top: tagT }}>
              TP {fmt(s!.target)} {pctOf(s!.target)}
            </span>
            <span className="tp-fade-in absolute -translate-x-full whitespace-nowrap rounded-md bg-[#FF5A4E] px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-white" style={{ left: right - 6, top: tagS }}>
              SL {fmt(s!.stop)} {pctOf(s!.stop)}
            </span>
            {full && (
              <span className="tp-fade-in absolute -translate-x-full -translate-y-1/2 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold tracking-[0.05em] text-black shadow" style={{ left: xi! - 8, top: yE! }}>
                {s!.side === "long" ? "LONG" : "SHORT"}
              </span>
            )}
            {s!.outcome === "open" && mid && (
              <span className="tp-fade-in absolute -translate-y-1/2 whitespace-nowrap rounded-md bg-[#FF8A3D] px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-black" style={{ left: Math.min(plotW - 70, mid.x1 + 8), top: mid.y1 }}>
                ▍{fmt(s!.target)}
              </span>
            )}
            {s!.outcome === "open" && s!.history.matches > 0 && (
              <span className="tp-fade-in absolute -translate-x-full whitespace-nowrap text-[11px] font-medium text-white/50" style={{ left: right - 4, top: Math.max(yT!, yS!) + 30 }}>
                matched against {s!.history.matches} past setup{s!.history.matches === 1 ? "" : "s"}
              </span>
            )}
          </>
        );
      })()}

      {scan &&
        !s &&
        [scan.pools.below, scan.pools.above].map((p, k) =>
          p && y(p.price) != null ? (
            <Tag key={k} x={plotW - 190} y={y(p.price)! + (k ? -24 : 4)} tone={k ? "red" : "orange"} soft>
              {k ? "Liquidity above" : "Liquidity below"} {fmt(p.price)}
            </Tag>
          ) : null,
        )}

      {cards.map((c) => (
        <div
          key={c.n}
          className={clsx("tp-card-in absolute flex items-center gap-2.5 rounded-2xl border border-white/[0.12] bg-[#1B1B1E]/[0.96] px-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.85)]", done && "opacity-80")}
          style={{ left: c.cx, top: c.cy, width: CARD_W, height: CARD_H }}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#FF8A3D] text-[12px] font-bold text-black">{c.n}</span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-white">{c.title}</span>
            <span className="block truncate text-[11.5px] text-white/55">{c.detail}</span>
          </span>
        </div>
      ))}

      {/* Status pill along the top of the plot */}
      {ready && (
        <span
          className={clsx(
            "tp-pop absolute top-2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.06em] shadow-[0_8px_24px_-8px_rgba(255,138,61,0.9)]",
            s!.outcome === "stop" ? "bg-[#FF5A4E] text-white" : "bg-[#FF8A3D] text-black",
          )}
          style={{ left: plotW / 2 }}
        >
          ✦ {s!.outcome === "target" ? "PREDICTION CONFIRMED" : s!.outcome === "stop" ? "STOPPED OUT" : s!.history.hitRate !== null ? `PROJECTED · ${Math.round(s!.history.hitRate * 100)}% HIT RATE` : "PROJECTED · UNRATED"}
        </span>
      )}

      {/* The open position: where it filled, and what it is worth now */}
      {position && (() => {
        const last = bars[bars.length - 1];
        // The bar the fill landed in.
        let fillIdx = bars.length - 1;
        while (fillIdx > 0 && bars[fillIdx].t * 1000 > position.openedAt) fillIdx--;
        const fx = x(fillIdx);
        const fy = y(position.entry);
        const py = y(last.c);
        const pnl = (position.side === "long" ? last.c - position.entry : position.entry - last.c) * position.qty * position.pointValue;
        return (
          <>
            {fx != null && fy != null && (
              <span className="tp-fade-in absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-0.5 text-[10.5px] font-bold tracking-[0.05em] text-black" style={{ left: fx, top: fy + (position.side === "long" ? 10 : -26) }}>
                FILLED {position.qty} @ {fmt(position.entry)}
              </span>
            )}
            {py != null && (
              <Tag x={plotW - 96} y={py - 10} tone={pnl >= 0 ? "orange" : "red"}>
                {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
              </Tag>
            )}
          </>
        );
      })()}

      {/* A trade that just closed: the result, big */}
      {closed && Date.now() - closed.closedAt < 90_000 && y(closed.exit) != null && (
        <>
          <span className="tp-pop absolute -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1B1B1E] px-2 py-0.5 font-mono text-[11px] font-semibold text-white ring-1 ring-white/20" style={{ left: plotW - 150, top: y(closed.exit)! + 8 }}>
            {closed.reason === "target" ? "TP hit" : closed.reason === "stop" ? "SL hit" : "Closed"} {closed.pnl >= 0 ? "+" : "-"}${Math.abs(closed.pnl).toFixed(2)}
          </span>
          <span
            className={clsx("tp-pop absolute -translate-x-1/2 whitespace-nowrap rounded-full px-5 py-2 text-[22px] font-bold tabular-nums shadow-[0_20px_60px_-10px_rgba(255,138,61,0.9)]", closed.pnl >= 0 ? "bg-[#FF8A3D] text-black" : "bg-[#FF5A4E] text-white")}
            style={{ left: plotW * 0.72, top: Math.min(volTop - 60, Math.max(60, y(closed.exit)! + (closed.side === "long" ? 60 : -90))) }}
          >
            {closed.pnl >= 0 ? "+" : "-"}${Math.abs(closed.pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </>
      )}
    </div>
  );
}

function Brackets({ x0, x1, y0, y1 }: { x0: number; x1: number; y0: number; y1: number }) {
  if (![x0, x1, y0, y1].every(Number.isFinite)) return null;
  const top = Math.min(y0, y1) - 10;
  const bot = Math.max(y0, y1) + 10;
  const a = 12;
  const d = `M${x0},${top + a} V${top} H${x0 + a} M${x1 - a},${top} H${x1} V${top + a} M${x1},${bot - a} V${bot} H${x1 - a} M${x0 + a},${bot} H${x0} V${bot - a}`;
  return (
    <>
      <rect x={x0} y={top} width={Math.max(0, x1 - x0)} height={Math.max(0, bot - top)} fill={ORANGE} fillOpacity="0.05" />
      <path d={d} fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function Tag({ x, y, tone, children, soft }: { x: number; y: number; tone: "orange" | "red" | "white"; children: React.ReactNode; soft?: boolean }) {
  return (
    <span
      className={clsx(
        "tp-fade-in absolute whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
        tone === "orange" ? (soft ? "bg-[#FF8A3D]/15 text-[#FFB27D]" : "bg-[#FF8A3D] text-black") : tone === "red" ? (soft ? "bg-[#FF5A4E]/15 text-[#FF8D85]" : "bg-[#FF5A4E] text-white") : "bg-white text-black",
      )}
      style={{ left: x, top: y }}
    >
      {children}
    </span>
  );
}
