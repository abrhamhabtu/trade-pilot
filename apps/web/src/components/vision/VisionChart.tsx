"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ColorType, CrosshairMode, LineStyle, createChart, type IChartApi, type IPriceLine, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import type { Bar } from "@/lib/pilot/market";
import { READERS, infoOf, type Scan } from "@/lib/vision/analyze";
import { PRESETS, layers, type ChartView } from "@/lib/vision/chartView";
import { HARD, place, stack, textWidth, type Label, type Obstacle, type Placed } from "@/lib/vision/layout";
import { sessionRuns } from "@/lib/vision/levels";
import { formatPrice, type VisionSymbol } from "@/lib/vision/markets";
import type { VisionPosition, VisionTrade } from "@/store/visionStore";

export const ORANGE = "#FF8A3D";
const DOWN = "#5B6170";
const RED = "#FF5A4E";

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

/** A finished historical trade, drawn as entry, exit and its risk and reward boxes. */
export interface ReviewMark {
  side: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  exit: number;
  entryT: number;
  exitT: number;
  label: string;
  win: boolean;
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

// The charts on screen by market, so the copilot can take a real picture of what the trader sees.
const shown = new Map<string, IChartApi>();

/** A PNG of the chart as drawn, and which bars are in view. */
export function captureChart(symbol: string): { image: string; from: number; to: number } | null {
  const c = shown.get(symbol);
  if (!c) return null;
  const shot = c.takeScreenshot();
  const out = document.createElement("canvas");
  out.width = shot.width;
  out.height = shot.height;
  const g = out.getContext("2d");
  if (!g) return null;
  // The chart's background is see-through; a model needs a real one.
  g.fillStyle = "#101014";
  g.fillRect(0, 0, out.width, out.height);
  g.drawImage(shot, 0, 0);
  const r = c.timeScale().getVisibleLogicalRange();
  return { image: out.toDataURL("image/png"), from: r ? Math.floor(r.from) : 0, to: r ? Math.ceil(r.to) : Number.MAX_SAFE_INTEGER };
}

export function VisionChart({
  bars,
  sym,
  scan,
  phase,
  position,
  closed,
  height,
  label,
  story = false,
  review,
  view = PRESETS.standard,
  levels = [],
}: {
  bars: Bar[];
  sym: VisionSymbol;
  scan: Scan | null;
  phase: Phase;
  position: VisionPosition | null;
  closed?: VisionTrade | null;
  height: number;
  label?: string;
  story?: boolean;
  review?: ReviewMark | null;
  /** Density and layers; Standard when the caller doesn't say. */
  view?: ChartView;
  /** Day levels for the gutter. */
  levels?: GutterLevel[];
}) {
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
  const lit = layers(view).volume;
  const useVwap = setup ? infoOf(setup.reader).line === "vwap" : scan?.reader && scan.reader !== "auto" ? READERS[scan.reader].line === "vwap" : false;

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
    const key = sym.id;
    shown.set(key, c);
    c.timeScale().subscribeVisibleLogicalRangeChange(() => measure());
    c.subscribeCrosshairMove((p) => setHover(p.logical == null ? null : Math.round(p.logical as number)));
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (shown.get(key) === c) shown.delete(key);
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
    const on = (i: number) => lit && full && planShown && !!setup && i >= setup.volume.from && i <= setup.volume.to;
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
    volume.current.setData(bars.map((b, i) => ({ time: at(b.t), value: b.v, color: volColor(b, lit && full && planShown && !!setup && i >= setup.volume.from && i <= setup.volume.to) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.id, planShown, full, lit]);

  // ── EMA or VWAP, whichever the strategy reads ──
  useEffect(() => {
    if (!emaLine.current || !vwapLine.current || !scan || !bars.length) return;
    const n = Math.min(bars.length, scan.ema.length);
    const at = (i: number) => (bars[i].t + shift) as UTCTimestamp;
    emaLine.current.setData(useVwap ? [] : scan.ema.slice(0, n).map((v, i) => ({ time: at(i), value: v })));
    vwapLine.current.setData(useVwap ? scan.vwap.slice(0, n).map((v, i) => (Number.isFinite(v) ? { time: at(i), value: v } : { time: at(i) })) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan, shift, useVwap]);

  // ── Entry, target and stop: one line each, labelled on the price axis, where the library stacks them clear of the candles ──
  const planLines = layers(view).planLines;
  useEffect(() => {
    const cs = candles.current;
    if (!cs) return;
    lines.current.forEach((l) => cs.removePriceLine(l));
    lines.current = [];
    if (!planShown || !setup || !full || !planLines) return;
    lines.current.push(cs.createPriceLine({ price: setup.entry, color: "rgba(255,255,255,0.55)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" }));
    lines.current.push(cs.createPriceLine({ price: setup.target, color: ORANGE, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" }));
    lines.current.push(cs.createPriceLine({ price: setup.stop, color: RED, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" }));
  }, [setup, planShown, full, planLines]);

  // ── A reviewed trade: its levels on the axis, and the view framed around it ──
  useEffect(() => {
    const cs = candles.current;
    const c = chart.current;
    if (!cs || !c || !review || !bars.length) return;
    const made = [
      cs.createPriceLine({ price: review.entry, color: "rgba(255,255,255,0.6)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" }),
      cs.createPriceLine({ price: review.target, color: ORANGE, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" }),
      cs.createPriceLine({ price: review.stop, color: RED, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" }),
    ];
    const ei = Math.max(0, bars.findIndex((b) => b.t >= review.entryT));
    let xi = bars.findIndex((b) => b.t >= review.exitT);
    if (xi < 0) xi = bars.length - 1;
    // An invisible series at the stop and target keeps both inside the price scale.
    const frame = c.addLineSeries({ color: "rgba(0,0,0,0)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const at = (t: number) => (t + shift) as UTCTimestamp;
    frame.setData(xi > ei ? [{ time: at(bars[ei].t), value: review.stop }, { time: at(bars[xi].t), value: review.target }] : [{ time: at(bars[ei].t), value: review.stop }]);
    c.timeScale().setVisibleLogicalRange({ from: Math.max(0, ei - Math.max(40, (xi - ei) * 0.8)), to: xi + Math.max(14, (xi - ei) * 0.4) });
    requestAnimationFrame(measure);
    return () => {
      // On unmount the chart may already be gone.
      if (chart.current !== c) return;
      made.forEach((l) => cs.removePriceLine(l));
      c.removeSeries(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review, bars]);

  // ── Frame the setup: from a little before its first mark to past its projection ──
  useEffect(() => {
    const c = chart.current;
    if (!c || !setup || review) return;
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
        <div data-ov="legend" className="pointer-events-none absolute left-3 top-2 z-10 space-y-0.5 font-mono text-[11px] tabular-nums text-white/55">
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
      {label && <span data-ov="mode-label" className="pointer-events-none absolute bottom-[34px] left-14 z-10 rounded-full bg-[#FF8A3D]/15 px-2.5 py-0.5 text-[11px] font-bold tracking-[0.08em] text-[#FFB27D] ring-1 ring-[#FF8A3D]/30">{label}</span>}
      <div ref={box} className="absolute inset-0" />
      {geo && bars.length > 0 && <Overlay geo={geo} bars={bars} scan={scan} setup={setup} full={full} phase={phase} position={position} closed={closed ?? null} fmt={fmt} view={view} levels={levels} sessions={sym.kind === "futures" && layers(view).sessions} modeLabel={!!label} />}
      {geo && bars.length > 0 && review && <ReviewOverlay geo={geo} bars={bars} r={review} fmt={fmt} />}
    </div>
  );
}

/** A tag in the right-hand gutter: a day level, resting liquidity, or the open position's P&L. */
export interface GutterLevel {
  id: string;
  /** Short tag: PDH, ON L, AS H. */
  abbr: string;
  /** Full name for the hover. */
  name: string;
  price: number;
  tone: "orange" | "red" | "blue" | "white";
  /** Bar the level's line starts from; the left edge when absent. */
  from?: number;
}

const GUTTER = 64;
const PIN = 16;
const LEGEND = { x: 0, y: 0, w: 360, h: 46 };
const TONE = { orange: ORANGE, red: RED, blue: "#78AAFF", white: "rgba(255,255,255,0.8)" };
const SHADE = { asia: "rgba(120,170,255,0.045)", london: "rgba(190,140,255,0.04)", ny: "rgba(255,138,61,0.03)" };

function Overlay({
  geo,
  bars,
  scan,
  setup,
  full,
  phase,
  position,
  closed,
  fmt,
  view,
  levels,
  sessions,
  modeLabel,
}: {
  geo: Geo;
  bars: Bar[];
  scan: Scan | null;
  setup: Scan["setup"];
  full: boolean;
  phase: Phase;
  position: VisionPosition | null;
  closed: VisionTrade | null;
  fmt: (n: number) => string;
  view: ChartView;
  levels: GutterLevel[];
  sessions: boolean;
  modeLabel: boolean;
}) {
  const { w, h, plotW, x, y, bar } = geo;
  const L = layers(view);
  const s = setup;
  const volTop = h * 0.83;
  const volBottom = h - 28;
  const gutterX = plotW - GUTTER;
  const show = !!s && (phase.projection || s.outcome !== "open");
  const risk = s ? Math.abs(s.entry - s.stop) : 0;
  const dir = s?.side === "long" ? 1 : -1;
  const horizon = s ? Math.max(10, Math.min(24, s.history.medianBarsToTarget ?? 16)) : 0;
  const done = !!s && s.outcome !== "open";
  const prev = useRef<Placed[]>([]);
  const [hoverPin, setHoverPin] = useState<number | null>(null);

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

  const xi = s ? x(s.index) : null;
  const xs = s ? x(Math.min(s.sweepIndex, s.index)) : null;
  const xe = s ? x(s.index + horizon) : null;
  const yE = s ? y(s.entry) : null;
  const yT = s ? y(s.target) : null;
  const yS = s ? y(s.stop) : null;
  // The plan box stops short of the gutter, so its tags never meet the level tags.
  const right = Math.min(xe ?? gutterX, gutterX - 2);
  const seg = s ? bars.slice(Math.min(s.sweepIndex, s.index), s.index + 1) : [];
  const patternTop = s ? Math.max(...seg.map((b) => b.h)) : 0;
  const patternBot = s ? Math.min(...seg.map((b) => b.l)) : 0;
  const mid = proj && proj.mid[0][0] != null && proj.mid[0][1] != null && proj.mid[1][0] != null && proj.mid[1][1] != null ? { x0: proj.mid[0][0]!, y0: proj.mid[0][1]!, x1: proj.mid[1][0]!, y1: proj.mid[1][1]! } : null;
  const ready = show && s && xs != null && xi != null && yE != null && yT != null && yS != null;
  const boxes = ready && L.planBoxes;

  // Session bands, worked out once per series.
  const runs = useMemo(() => (sessions ? sessionRuns(bars.map((b) => b.t)) : []), [sessions, bars.length, bars[0]?.t]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pins: one per callout on its bar; pins that share a bar stack apart ──
  const pins = useMemo(() => {
    if (!s || !full || !L.pins) return [];
    const pts = s.callouts
      .slice(0, phase.revealed)
      .map((c) => ({ c, px: x(c.i), py: y(c.price) }))
      .filter((p): p is { c: (typeof s.callouts)[number]; px: number; py: number } => p.px != null && p.py != null)
      .sort((a, b) => a.px - b.px || a.c.n - b.c.n);
    const out: { c: (typeof pts)[number]["c"]; px: number; py: number; cy: number }[] = [];
    for (let k = 0; k < pts.length; ) {
      let j = k;
      while (j + 1 < pts.length && pts[j + 1].px - pts[k].px < PIN + 2) j++;
      const run = pts.slice(k, j + 1);
      // Under the price legend there is no room: pins there start below it.
      const top = run[0].px < LEGEND.w + PIN ? LEGEND.h + 4 : 4;
      const ys = stack(run.map((p) => ({ id: String(p.c.n), y: p.py - PIN / 2, h: PIN })), top, volTop - 2, 3);
      for (const p of run) out.push({ ...p, cy: ys.find((q) => q.id === String(p.c.n))!.y + PIN / 2 });
      k = j + 1;
    }
    return out;
  }, [s, full, L.pins, phase.revealed, x, y, volTop]);

  // ── Reward and risk tags, inside the plan box at its right edge ──
  const rTags = useMemo(() => {
    if (!boxes) return [];
    const tags: { id: string; text: string; x: number; y: number; w: number; tone: "orange" | "red" }[] = [];
    const add = (id: string, text: string, y0: number, y1: number, tone: "orange" | "red") => {
      const tw = textWidth(text, 10.5) + 10;
      if (Math.abs(y1 - y0) < 18 || right - xi! < tw + 18) return;
      tags.push({ id, text, x: right - 4 - tw, y: (y0 + y1) / 2 - 8, w: tw, tone });
    };
    add("r-reward", `+${s!.rr.toFixed(1)}R`, yE!, yT!, "orange");
    add("r-risk", "−1R", yE!, yS!, "red");
    return tags;
  }, [boxes, s, yE, yT, yS, xi, right]);

  // ── The right-hand gutter: levels in price order ──
  const gutter = useMemo(() => {
    const items: (GutterLevel & { w?: number })[] = [];
    const last = bars[bars.length - 1];
    const a = scan?.atr[Math.min(scan.atr.length - 1, bars.length - 1)] ?? 0;
    const near = (p: number) => !a || !last || Math.abs(p - last.c) <= 3 * a;
    if (L.levels) {
      for (const l of levels) if (near(l.price)) items.push(l);
      if (scan && !s) {
        if (scan.pools.below && near(scan.pools.below.price)) items.push({ id: "liq-below", abbr: "LIQ ↓", name: "Resting liquidity below", price: scan.pools.below.price, tone: "orange", from: scan.pools.below.i });
        if (scan.pools.above && near(scan.pools.above.price)) items.push({ id: "liq-above", abbr: "LIQ ↑", name: "Resting liquidity above", price: scan.pools.above.price, tone: "red", from: scan.pools.above.i });
      }
    }
    if (position && last) {
      const pnl = (position.side === "long" ? last.c - position.entry : position.entry - last.c) * position.qty * position.pointValue;
      items.push({ id: "pnl", abbr: `${pnl >= 0 ? "+" : "-"}$${Math.round(Math.abs(pnl)).toLocaleString("en-US")}`, name: "Open position, marked to the last price", price: last.c, tone: pnl >= 0 ? "orange" : "red" });
    }
    const wanted = items.map((l) => ({ l, py: y(l.price) })).filter((q): q is { l: GutterLevel; py: number } => q.py != null && q.py > 0 && q.py < volTop);
    const ys = stack(wanted.map((q) => ({ id: q.l.id, y: q.py - 8, h: 16 })), 4, volTop - 2, 3);
    return wanted.map((q) => ({ ...q, ty: ys.find((v) => v.id === q.l.id)!.y }));
  }, [L.levels, levels, scan, s, position, bars, y, volTop]);

  // ── Free labels: notes, the setup pill, fills and the closing result ──
  const notesOn = L.notes && !(phase.step === "done" || (phase.step === undefined && phase.projection));
  const placed = useMemo(() => {
    const obstacles: Obstacle[] = [];
    // Candles, merged into 8px columns.
    const cols = new Map<number, { top: number; bot: number }>();
    for (let i = 0; i < bars.length; i++) {
      const px = x(i);
      if (px == null || px < -bar || px > plotW) continue;
      const yh = y(bars[i].h);
      const yl = y(bars[i].l);
      if (yh == null || yl == null) continue;
      const k = Math.floor(px / 8);
      const c = cols.get(k);
      cols.set(k, c ? { top: Math.min(c.top, yh), bot: Math.max(c.bot, yl) } : { top: yh, bot: yl });
    }
    cols.forEach((c, k) => obstacles.push({ x: k * 8, y: c.top, w: 8, h: Math.max(1, c.bot - c.top), weight: 3 }));
    obstacles.push({ x: 0, y: volTop, w: plotW, h: h - volTop, weight: 6 });
    obstacles.push({ ...LEGEND, weight: HARD });
    if (modeLabel) obstacles.push({ x: 50, y: h - 58, w: 220, h: 26, weight: HARD });
    if (boxes) {
      obstacles.push({ x: xi!, y: Math.min(yE!, yT!), w: Math.max(0, right - xi!), h: Math.abs(yT! - yE!), weight: 1 });
      obstacles.push({ x: xi!, y: Math.min(yE!, yS!), w: Math.max(0, right - xi!), h: Math.abs(yS! - yE!), weight: 1 });
    }
    for (const p of pins) obstacles.push({ x: p.px - PIN / 2 - 2, y: p.cy - PIN / 2 - 2, w: PIN + 4, h: PIN + 4, weight: HARD });
    for (const t of rTags) obstacles.push({ x: t.x - 2, y: t.y - 2, w: t.w + 4, h: 20, weight: HARD });

    const labels: (Label & { text: string; kind: string })[] = [];
    if (closed && Date.now() - closed.closedAt < 90_000 && y(closed.exit) != null) {
      const big = `${closed.pnl >= 0 ? "+" : "-"}$${Math.abs(closed.pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const tag = `${closed.reason === "target" ? "TP hit" : closed.reason === "stop" ? "SL hit" : "Closed"} ${closed.pnl >= 0 ? "+" : "-"}$${Math.abs(closed.pnl).toFixed(2)}`;
      const up = closed.side === "long";
      labels.push({ id: "closed-big", kind: "big", text: big, w: textWidth(big, 22) + 44, h: 42, ax: plotW * 0.7, ay: y(closed.exit)!, prefer: up ? ["b", "br", "bl", "t"] : ["t", "tr", "tl", "b"], priority: 100, optional: true, compact: { w: textWidth(big, 16) + 28, h: 32 } });
      labels.push({ id: "closed-tag", kind: "tag", text: tag, w: textWidth(tag, 11) + 18, h: 20, ax: gutterX - 40, ay: y(closed.exit)!, prefer: ["l", "bl", "tl", "b", "t"], priority: 90, optional: true });
    }
    if (position) {
      let fillIdx = bars.length - 1;
      while (fillIdx > 0 && bars[fillIdx].t * 1000 > position.openedAt) fillIdx--;
      const fx = x(fillIdx);
      const fy = y(position.entry);
      const text = `FILLED ${position.qty} @ ${fmt(position.entry)}`;
      if (fx != null && fy != null) labels.push({ id: "filled", kind: "fill", text, w: textWidth(text, 10.5) + 22, h: 20, ax: fx, ay: fy, prefer: position.side === "long" ? ["b", "br", "bl", "t"] : ["t", "tr", "tl", "b"], priority: 80, optional: true });
    }
    if (ready && full && L.setupPill) {
      const text = `✦ ${s!.side === "long" ? "LONG" : "SHORT"} SETUP`;
      const top = Math.min(y(patternTop)!, y(patternBot)!) - 10;
      labels.push({ id: "setup", kind: "pill", text, w: textWidth(text, 11) + 24, h: 24, ax: xs! - bar * 0.7, ay: top, prefer: ["tr", "tl", "t", "l"], priority: 70, optional: true, compact: { w: textWidth("✦ LONG", 11) + 20, h: 22 } });
    }
    if (notesOn)
      for (const p of pins) {
        const tw = Math.min(160, textWidth(p.c.title, 12) + 22);
        labels.push({ id: `note-${p.c.n}`, kind: "note", text: p.c.title, w: tw, h: 26, ax: p.px, ay: p.cy, prefer: ["l", "tl", "bl", "t", "b", "r", "tr", "br"], priority: 60 - p.c.n, optional: true, compact: { w: Math.min(tw, 96), h: 22 } });
      }
    const out = place(labels, obstacles, { x: 0, y: 0, w: gutterX - 2, h: h - 28 }, prev.current);
    return labels.map((l, k) => ({ l, p: out[k] }));
  }, [bars, x, y, bar, plotW, h, volTop, gutterX, modeLabel, boxes, xi, yE, yT, yS, right, pins, rTags, closed, position, fmt, ready, full, L.setupPill, s, xs, patternTop, patternBot, notesOn]);
  useEffect(() => {
    prev.current = placed.map((q) => q.p);
  }, [placed]);
  const spot = (id: string) => placed.find((q) => q.l.id === id && !q.p.hidden);

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
            <stop offset="0" stopColor={ORANGE} stopOpacity="0.14" />
            <stop offset="1" stopColor={ORANGE} stopOpacity="0.03" />
          </linearGradient>
          <filter id="tp-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Sessions: faint bands behind everything */}
        {runs.map((r) => {
          const x0 = x(r.from);
          const x1 = x(r.to);
          if (x0 == null || x1 == null || x1 < 0 || x0 > plotW) return null;
          return <rect key={`${r.shade}-${r.from}`} x={x0 - bar / 2} y={0} width={Math.max(0, x1 - x0 + bar)} height={volBottom} fill={SHADE[r.shade]} />;
        })}

        {/* Levels: a thin line across the plot to the gutter, with an elbow to its tag */}
        {gutter.map((q) => {
          const from = q.l.from != null ? (x(q.l.from) ?? 0) : 0;
          const c = TONE[q.l.tone];
          return (
            <g key={q.l.id} className="tp-fade-in">
              {q.l.id !== "pnl" && <line x1={Math.max(0, from)} x2={gutterX} y1={q.py} y2={q.py} stroke={c} strokeOpacity="0.32" strokeDasharray="4 5" />}
              {Math.abs(q.ty + 8 - q.py) > 1 && <path d={`M${gutterX - 6},${q.py} L${gutterX},${q.ty + 8}`} stroke={c} strokeOpacity="0.5" fill="none" />}
            </g>
          );
        })}

        {ready && (
          <g className="tp-fade-in" opacity={done ? 0.6 : 1}>
            {L.zone && s!.zone && x(s!.zone.from) != null && y(s!.zone.top) != null && y(s!.zone.bottom) != null && (
              <rect
                x={x(s!.zone.from)! - bar / 2}
                y={y(s!.zone.top)!}
                width={Math.max(0, right - x(s!.zone.from)! + bar / 2)}
                height={Math.max(1, y(s!.zone.bottom)! - y(s!.zone.top)!)}
                fill={s!.side === "long" ? ORANGE : RED}
                fillOpacity="0.06"
                stroke={s!.side === "long" ? ORANGE : RED}
                strokeOpacity="0.3"
              />
            )}
            {boxes && (
              <>
                <rect x={xi!} y={Math.min(yE!, yT!)} width={Math.max(0, right - xi!)} height={Math.abs(yT! - yE!)} fill="url(#tp-tp)" />
                <rect x={xi!} y={Math.min(yE!, yS!)} width={Math.max(0, right - xi!)} height={Math.abs(yS! - yE!)} fill={RED} fillOpacity="0.05" />
                <Brackets x0={xs! - bar * 0.7} x1={xi! + bar * 0.7} y0={y(patternTop)!} y1={y(patternBot)!} />
              </>
            )}
          </g>
        )}

        {ready && L.projection && proj && s!.outcome === "open" && mid && (
          <g>
            {proj.lo && proj.hi && <path d={`${path(proj.hi)} ${path([...proj.lo].reverse()).replace(/^M/, "L")} Z`} fill={ORANGE} fillOpacity="0.08" className="tp-fade-in" />}
            <path d={path(proj.mid)} fill="none" stroke={ORANGE} strokeWidth="2" strokeDasharray="6 6" className="tp-draw" />
            <circle cx={mid.x1} cy={mid.y1} r="4.5" fill="#fff" stroke={ORANGE} strokeWidth="2" className="tp-fade-in" />
            <circle cx={mid.x0} cy={mid.y0} r="10" fill="none" stroke={ORANGE} strokeOpacity="0.6" className="tp-pulse-ring" />
          </g>
        )}

        {/* What each pin marks: a ring round the candle, or a level with a short dashed run */}
        {pins.map((p) => (
          <g key={p.c.n} className="tp-fade-in" opacity={done ? 0.75 : 1}>
            {p.c.mark === "level" && <line x1={p.px} x2={Math.min(gutterX, (xi ?? p.px) + bar * 3)} y1={p.py} y2={p.py} stroke="rgba(255,255,255,0.4)" strokeDasharray="5 4" />}
            {p.c.mark === "ring" && <circle cx={p.px} cy={p.py} r={11} fill="none" stroke={ORANGE} strokeOpacity="0.55" className="tp-pulse-ring" />}
            {Math.abs(p.cy - p.py) > 2 && <line x1={p.px} y1={p.py} x2={p.px} y2={p.cy} stroke={ORANGE} strokeOpacity="0.6" />}
          </g>
        ))}
        {placed.map(({ l, p }) =>
          !p.hidden && p.leader && l.kind === "note" ? <line key={`ld-${l.id}`} x1={p.leader.x1} y1={p.leader.y1} x2={p.leader.x2} y2={p.leader.y2} stroke={ORANGE} strokeOpacity="0.55" strokeWidth="1" className="tp-fade-in" /> : null,
        )}

        {ready && L.volume && full && x(s!.volume.from) != null && x(s!.volume.to) != null && (
          <rect
            x={x(s!.volume.from)! - bar * 0.7}
            y={volTop}
            width={Math.max(0, x(s!.volume.to)! - x(s!.volume.from)! + bar * 1.4)}
            height={Math.max(0, volBottom - volTop)}
            rx="6"
            fill={ORANGE}
            fillOpacity="0.05"
            stroke={ORANGE}
            strokeOpacity="0.6"
            className="tp-fade-in"
          />
        )}

        {position && y(position.entry) != null && <line x1={0} x2={gutterX} y1={y(position.entry)!} y2={y(position.entry)!} stroke="#fff" strokeOpacity="0.7" strokeDasharray="2 3" />}
        {position && !full && y(position.stop) != null && <line x1={0} x2={gutterX} y1={y(position.stop)!} y2={y(position.stop)!} stroke={RED} strokeOpacity="0.7" strokeDasharray="4 3" />}
        {position && !full && y(position.target) != null && <line x1={0} x2={gutterX} y1={y(position.target)!} y2={y(position.target)!} stroke={ORANGE} strokeOpacity="0.7" strokeDasharray="4 3" />}

        {phase.scan != null && (
          <g>
            <rect x={0} y={0} width={Math.max(0, plotW * phase.scan)} height={Math.max(0, h - 26)} fill="url(#tp-scan)" />
            <line x1={plotW * phase.scan} x2={plotW * phase.scan} y1={0} y2={h - 26} stroke={ORANGE} strokeWidth="2" />
            <line x1={plotW * phase.scan} x2={plotW * phase.scan} y1={0} y2={h - 26} stroke={ORANGE} strokeWidth="10" opacity="0.45" filter="url(#tp-glow)" />
          </g>
        )}
      </svg>

      {phase.scan != null && (
        <span data-ov="scan" className="absolute top-1 -translate-x-1/2 rounded-full bg-[#FF8A3D] px-2.5 py-0.5 text-[10.5px] font-bold tracking-[0.06em] text-black shadow-[0_6px_20px_-4px_rgba(255,138,61,0.8)]" style={{ left: Math.max(60, Math.min(plotW - 60, plotW * phase.scan)) }}>
          ✦ ANALYZING {Math.round(phase.scan * 100)}%
        </span>
      )}

      {/* Reward and risk, inside the plan box */}
      {rTags.map((t) => (
        <span key={t.id} data-ov={t.id} className={clsx("tp-fade-in absolute flex h-4 items-center justify-center rounded font-mono text-[10.5px] font-semibold tabular-nums", t.tone === "orange" ? "text-[#FFB27D]" : "text-[#FF8D85]")} style={{ left: t.x, top: t.y, width: t.w }}>
          {t.text}
        </span>
      ))}

      {/* Gutter tags */}
      {gutter.map((q) => (
        <span
          key={q.l.id}
          data-ov={`lvl-${q.l.id}`}
          title={q.l.id === "pnl" ? q.l.name : `${q.l.name} ${fmt(q.l.price)}`}
          className={clsx(
            "tp-fade-in pointer-events-auto absolute flex h-4 items-center justify-center truncate rounded px-1 font-mono text-[10px] font-semibold tabular-nums",
            q.l.id === "pnl" ? (q.l.tone === "orange" ? "bg-[#FF8A3D] text-black" : "bg-[#FF5A4E] text-white") : q.l.tone === "orange" ? "bg-[#FF8A3D]/15 text-[#FFB27D]" : q.l.tone === "red" ? "bg-[#FF5A4E]/15 text-[#FF8D85]" : q.l.tone === "blue" ? "bg-[#78AAFF]/15 text-[#A9C8FF]" : "bg-white/10 text-white/75",
          )}
          style={{ left: gutterX + 2, top: q.ty, width: GUTTER - 4 }}
        >
          {q.l.abbr}
        </span>
      ))}

      {/* Pins: numbered, on the bar they explain; hover for the full note */}
      {pins.map((p) => (
        <span
          key={p.c.n}
          data-ov={`pin-${p.c.n}`}
          onMouseEnter={() => setHoverPin(p.c.n)}
          onMouseLeave={() => setHoverPin(null)}
          className={clsx("tp-fade-in pointer-events-auto absolute grid cursor-default place-items-center rounded-full text-[10px] font-bold shadow-[0_4px_12px_-2px_rgba(0,0,0,0.7)]", p.c.mark === "level" ? "bg-white text-black ring-2 ring-[#FF8A3D]" : "bg-[#FF8A3D] text-black ring-2 ring-[#121214]")}
          style={{ left: p.px - PIN / 2, top: p.cy - PIN / 2, width: PIN, height: PIN }}
        >
          {p.c.n}
        </span>
      ))}
      {hoverPin != null &&
        (() => {
          const p = pins.find((q) => q.c.n === hoverPin);
          if (!p) return null;
          const left = Math.max(8, Math.min(gutterX - 250, p.px - 120));
          const top = p.cy > h / 2 ? p.cy - 72 : p.cy + 14;
          return (
            <div className="tp-card-in absolute z-20 w-[240px] rounded-xl border border-white/[0.12] bg-[#1B1B1E]/[0.97] px-3 py-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.85)]" style={{ left, top }}>
              <p className="text-[12.5px] font-semibold text-white">
                {p.c.n}. {p.c.title}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-white/60">{p.c.detail}</p>
            </div>
          );
        })()}

      {/* Everything placed by the layout engine */}
      {placed.map(({ l, p }) => {
        if (p.hidden) return null;
        const style = { left: p.x, top: p.y };
        if (l.kind === "note")
          return (
            <span key={l.id} data-ov={l.id} className="tp-fade-in absolute flex items-center truncate rounded-lg border border-white/[0.12] bg-[#1B1B1E]/[0.94] px-2.5 text-[12px] font-semibold text-white shadow-[0_10px_28px_-10px_rgba(0,0,0,0.9)]" style={{ ...style, width: p.compact ? l.compact!.w : l.w, height: p.compact ? l.compact!.h : l.h }}>
              <span className="truncate">{l.text}</span>
            </span>
          );
        if (l.kind === "pill")
          return (
            <span key={l.id} data-ov={l.id} className="tp-fade-in absolute flex items-center justify-center whitespace-nowrap rounded-full bg-[#FF8A3D] text-[11px] font-bold tracking-[0.04em] text-black shadow-[0_8px_24px_-6px_rgba(255,138,61,0.9)]" style={{ ...style, width: p.compact ? l.compact!.w : l.w, height: p.compact ? l.compact!.h : l.h }}>
              {p.compact ? l.text.replace(" SETUP", "") : l.text}
            </span>
          );
        if (l.kind === "fill")
          return (
            <span key={l.id} data-ov={l.id} className="tp-fade-in absolute flex items-center justify-center whitespace-nowrap rounded-full bg-white/90 text-[10.5px] font-bold tracking-[0.05em] text-black" style={{ ...style, width: l.w, height: l.h }}>
              {l.text}
            </span>
          );
        if (l.kind === "tag")
          return (
            <span key={l.id} data-ov={l.id} className="tp-fade-in absolute flex items-center justify-center whitespace-nowrap rounded-md bg-[#1B1B1E] font-mono text-[11px] font-semibold text-white ring-1 ring-white/20" style={{ ...style, width: l.w, height: l.h }}>
              {l.text}
            </span>
          );
        return (
          <span
            key={l.id}
            data-ov={l.id}
            className={clsx("tp-fade-in absolute flex items-center justify-center whitespace-nowrap rounded-full font-bold tabular-nums shadow-[0_20px_60px_-10px_rgba(255,138,61,0.9)]", p.compact ? "text-[16px]" : "text-[22px]", closed && closed.pnl >= 0 ? "bg-[#FF8A3D] text-black" : "bg-[#FF5A4E] text-white")}
            style={{ ...style, width: p.compact ? l.compact!.w : l.w, height: p.compact ? l.compact!.h : l.h }}
          >
            {l.text}
          </span>
        );
      })}
    </div>
  );
}

function Brackets({ x0, x1, y0, y1 }: { x0: number; x1: number; y0: number; y1: number }) {
  if (![x0, x1, y0, y1].every(Number.isFinite)) return null;
  const top = Math.min(y0, y1) - 10;
  const bot = Math.max(y0, y1) + 10;
  const a = 12;
  const d = `M${x0},${top + a} V${top} H${x0 + a} M${x1 - a},${top} H${x1} V${top + a} M${x1},${bot - a} V${bot} H${x1 - a} M${x0 + a},${bot} H${x0} V${bot - a}`;
  return <path d={d} fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" />;
}

function ReviewOverlay({ geo, bars, r, fmt }: { geo: Geo; bars: Bar[]; r: ReviewMark; fmt: (n: number) => string }) {
  const { plotW, x, y, bar } = geo;
  let ei = bars.findIndex((b) => b.t >= r.entryT);
  if (ei < 0) return null;
  // The entry fills on the signal bar's close; the box starts at that bar.
  if (bars[ei].t > r.entryT && ei > 0) ei--;
  let xi = bars.findIndex((b) => b.t >= r.exitT);
  if (xi < 0) xi = bars.length - 1;
  const x0 = x(ei);
  const x1 = x(xi);
  const yE = y(r.entry);
  const yS = y(r.stop);
  const yT = y(r.target);
  const yX = y(r.exit);
  if (x0 == null || x1 == null || yE == null || yS == null || yT == null || yX == null) return null;
  const left = x0;
  const width = Math.max(bar, x1 - x0);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg width={geo.w} height={geo.h} className="absolute inset-0">
        <rect x={left} y={Math.min(yE, yT)} width={width} height={Math.abs(yT - yE)} fill={ORANGE} fillOpacity="0.12" stroke={ORANGE} strokeOpacity="0.35" />
        <rect x={left} y={Math.min(yE, yS)} width={width} height={Math.abs(yS - yE)} fill={RED} fillOpacity="0.12" stroke={RED} strokeOpacity="0.35" />
        <line x1={x0} y1={yE} x2={x1} y2={yX} stroke="#fff" strokeOpacity="0.75" strokeDasharray="3 3" strokeWidth="1.5" />
        <circle cx={x0} cy={yE} r="5" fill="#fff" stroke="#121214" strokeWidth="2" />
        <circle cx={x1} cy={yX} r="5.5" fill={r.win ? ORANGE : RED} stroke="#121214" strokeWidth="2" />
      </svg>
      <span className="absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold tracking-[0.04em] text-black" style={{ left: Math.max(40, x0), top: r.side === "long" ? yE + 10 : yE - 26 }}>
        {r.side === "long" ? "LONG" : "SHORT"} @ {fmt(r.entry)}
      </span>
      <span
        className={clsx("absolute whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold", r.win ? "bg-[#FF8A3D] text-black" : "bg-[#FF5A4E] text-white")}
        style={{ left: Math.min(plotW - 150, x1 + 10), top: yX - 11 }}
      >
        {r.label}
      </span>
    </div>
  );
}
