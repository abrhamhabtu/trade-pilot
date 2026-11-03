"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ColorType, CrosshairMode, LineStyle, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import type { Bar } from "@/lib/pilot/market";
import type { Scan } from "@/lib/vision/analyze";
import { formatPrice, type VisionSymbol } from "@/lib/vision/markets";
import type { VisionPosition } from "@/store/visionStore";

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

export function VisionChart({ bars, sym, scan, phase, position, height }: { bars: Bar[]; sym: VisionSymbol; scan: Scan | null; phase: Phase; position: VisionPosition | null; height: number }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const emaLine = useRef<ISeriesApi<"Line"> | null>(null);
  const volume = useRef<ISeriesApi<"Histogram"> | null>(null);
  const shape = useRef({ n: 0, first: 0, last: 0, sig: "" });
  const [geo, setGeo] = useState<Geo | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const shift = useMemo(() => (bars.length ? shiftFor(sym, bars[bars.length - 1].t) : 0), [sym, bars.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const fmt = (n: number) => formatPrice(sym, n);

  // ── Chart setup ──
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const c = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "rgba(235,235,245,0.45)", fontSize: 11, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" },
      grid: { vertLines: { color: "rgba(255,255,255,0.035)" }, horzLines: { color: "rgba(255,255,255,0.035)" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 22, barSpacing: 8 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "rgba(255,138,61,0.35)", labelBackgroundColor: "#2A2A2E" }, horzLine: { color: "rgba(255,138,61,0.35)", labelBackgroundColor: "#2A2A2E" } },
    });
    candles.current = c.addCandlestickSeries({ upColor: ORANGE, downColor: DOWN, borderVisible: false, wickUpColor: "rgba(255,138,61,0.75)", wickDownColor: "rgba(140,146,160,0.7)", priceLineColor: ORANGE, priceLineStyle: LineStyle.Dashed });
    emaLine.current = c.addLineSeries({ color: "rgba(235,235,245,0.55)", lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    volume.current = c.addHistogramSeries({ priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chart.current = c;
    const measure = () => {
      const ts = c.timeScale();
      setGeo({
        w: el.clientWidth,
        h: el.clientHeight,
        plotW: el.clientWidth - c.priceScale("right").width(),
        x: (i) => ts.logicalToCoordinate(i as never) as number | null,
        y: (p) => (candles.current?.priceToCoordinate(p) as number | null) ?? null,
        bar: ts.options().barSpacing,
      });
    };
    c.timeScale().subscribeVisibleLogicalRangeChange(measure);
    c.subscribeCrosshairMove((p) => setHover(p.logical == null ? null : Math.round(p.logical as number)));
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);
    return () => {
      ro.disconnect();
      c.remove();
      chart.current = null;
      shape.current = { n: 0, first: 0, last: 0, sig: "" };
    };
  }, []);

  // ── Data ──
  useEffect(() => {
    const c = chart.current;
    if (!c || !candles.current || !volume.current || !emaLine.current) return;
    if (!bars.length) {
      candles.current.setData([]);
      volume.current.setData([]);
      emaLine.current.setData([]);
      shape.current = { n: 0, first: 0, last: 0, sig: "" };
      return;
    }
    const at = (t: number) => (t + shift) as UTCTimestamp;
    const candle = (b: Bar) => ({ time: at(b.t), open: b.o, high: b.h, low: b.l, close: b.c });
    const vol = (b: Bar) => ({ time: at(b.t), value: b.v, color: b.c >= b.o ? "rgba(255,138,61,0.45)" : "rgba(120,126,140,0.4)" });
    // Incremental update only for the same series growing by at most one bar; anything else is a reset.
    const sig = `${sym.id}:${shift}`;
    const lastT = bars[bars.length - 1].t;
    const same = shape.current.sig === sig && shape.current.first === bars[0].t && bars.length - shape.current.n <= 1 && bars.length >= shape.current.n && lastT >= shape.current.last;
    const shrank = shape.current.sig === sig && shape.current.first === bars[0].t && bars.length < shape.current.n;
    let updated = false;
    if (same && shape.current.n) {
      try {
        candles.current.update(candle(bars[bars.length - 1]));
        volume.current.update(vol(bars[bars.length - 1]));
        updated = true;
      } catch {
        updated = false;
      }
    }
    if (!updated) {
      const fresh = shape.current.first !== bars[0].t || shape.current.sig !== sig;
      candles.current.setData(bars.map(candle));
      volume.current.setData(bars.map(vol));
      if (fresh || shrank) {
        const n = bars.length;
        c.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 150), to: n + 22 });
      }
    }
    shape.current = { n: bars.length, first: bars[0].t, last: lastT, sig };
    candles.current.applyOptions({ priceFormat: { type: "price", precision: sym.decimals, minMove: sym.tick } });
    requestAnimationFrame(() => c.timeScale().applyOptions({}));
  }, [bars, shift, sym]);

  useEffect(() => {
    if (!emaLine.current || !scan || !bars.length) return;
    emaLine.current.setData(scan.ema.map((v, i) => ({ time: (bars[i].t + shift) as UTCTimestamp, value: v })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan, shift]);

  // Re-measure after data or layout moves the scales.
  useEffect(() => {
    const c = chart.current;
    const el = box.current;
    if (!c || !el) return;
    const id = requestAnimationFrame(() => {
      const ts = c.timeScale();
      setGeo({
        w: el.clientWidth,
        h: el.clientHeight,
        plotW: el.clientWidth - c.priceScale("right").width(),
        x: (i) => ts.logicalToCoordinate(i as never) as number | null,
        y: (p) => (candles.current?.priceToCoordinate(p) as number | null) ?? null,
        bar: ts.options().barSpacing,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [bars, scan, phase.projection, phase.revealed, height]);

  const hb = hover != null && bars[hover] ? bars[hover] : bars[bars.length - 1];
  const emaNow = scan?.ema[Math.min(hover ?? Infinity, scan.ema.length - 1)];

  return (
    <div className="relative" style={{ height }}>
      {hb && (
        <div className="pointer-events-none absolute left-3 top-2 z-10 space-y-0.5 font-mono text-[11px] tabular-nums text-white/55">
          <p>
            O <span className="text-white/80">{fmt(hb.o)}</span> H <span className="text-white/80">{fmt(hb.h)}</span> L <span className="text-white/80">{fmt(hb.l)}</span> C{" "}
            <span className={hb.c >= hb.o ? "text-[#FF8A3D]" : "text-white/80"}>{fmt(hb.c)}</span>
          </p>
          {emaNow != null && (
            <p className="flex items-center gap-1.5">
              <span className="h-px w-3 bg-white/60" /> EMA 21 <span className="text-white/75">{fmt(emaNow)}</span>
            </p>
          )}
        </div>
      )}
      <div ref={box} className="absolute inset-0" />
      {geo && bars.length > 0 && <Overlay geo={geo} bars={bars} scan={scan} phase={phase} position={position} fmt={fmt} />}
    </div>
  );
}

function Overlay({ geo, bars, scan, phase, position, fmt }: { geo: Geo; bars: Bar[]; scan: Scan | null; phase: Phase; position: VisionPosition | null; fmt: (n: number) => string }) {
  const { w, h, plotW, x, y, bar } = geo;
  const s = scan?.setup ?? null;
  const last = bars.length - 1;
  const volTop = h * 0.8;
  const volBottom = h - 28;
  const show = s && (phase.projection || s.outcome !== "open");
  const risk = s ? Math.abs(s.entry - s.stop) : 0;
  const dir = s?.side === "long" ? 1 : -1;
  const horizon = s ? Math.max(10, Math.min(24, s.history.medianBarsToTarget ?? 16)) : 0;

  // Projection: the median path of past matches, scaled to this setup's risk; a straight line when history is thin.
  const proj = useMemo(() => {
    if (!s) return null;
    const cone = s.history.cone.slice(0, horizon);
    const pts = (pick: (c: { p25: number; p50: number; p75: number }) => number) =>
      [{ k: 0, px: s.entry }, ...cone.map((c) => ({ k: c.k, px: s.entry + dir * pick(c) * risk }))].map((p) => [x(s.index + p.k), y(p.px)] as const);
    if (cone.length >= 6) return { mid: pts((c) => c.p50), lo: pts((c) => c.p25), hi: pts((c) => c.p75) };
    return { mid: [[x(s.index), y(s.entry)], [x(s.index + horizon), y(s.target)]] as const, lo: null, hi: null };
  }, [s, horizon, dir, risk, x, y]);

  const line = (pts: readonly (readonly [number | null, number | null])[]) =>
    pts
      .filter((p): p is readonly [number, number] => p[0] != null && p[1] != null)
      .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
      .join(" ");

  // Callout cards sit to the left of their points without overlapping each other.
  const cards = useMemo(() => {
    if (!s) return [];
    const placed: { n: number; title: string; detail: string; px: number; py: number; cx: number; cy: number }[] = [];
    for (const c of s.callouts.slice(0, phase.revealed)) {
      const px = x(c.i);
      const py = y(c.price);
      if (px == null || py == null) continue;
      // A column on the left of the chart, like annotations in a margin; beside the point when the point itself is on the left.
      const cx = px < 300 ? Math.min(px + 36, plotW - 262) : 14;
      placed.push({ ...c, px, py, cx, cy: py - 26 });
    }
    // Stack without overlap, then keep the whole stack inside the price area.
    const GAP = 64;
    // Read in order, 1 at the top: start the stack at the highest point and step down.
    placed.sort((a, b) => a.n - b.n);
    const start = Math.min(...placed.map((p) => p.cy));
    placed.forEach((p, k) => (p.cy = start + k * GAP));
    const top = 40;
    const bottom = volTop - 58;
    const over = placed.length ? placed[placed.length - 1].cy - bottom : 0;
    if (over > 0) placed.forEach((p) => (p.cy -= over));
    if (placed.length && placed[0].cy < top) {
      const under = top - placed[0].cy;
      placed.forEach((p) => (p.cy += under));
    }
    return placed;
  }, [s, phase.revealed, x, y, plotW, volTop]);

  const xs = s ? x(s.sweepIndex - 1) : null;
  const xe = s ? x(s.index + horizon) : null;
  const yE = s ? y(s.entry) : null;
  const yT = s ? y(s.target) : null;
  const yS = s ? y(s.stop) : null;
  const pctOf = (p: number) => `${p >= s!.entry ? "+" : ""}${(((p - s!.entry) / s!.entry) * 100).toFixed(2)}%`;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg width={w} height={h} className="absolute inset-0">
        <defs>
          <linearGradient id="tp-scan" x1="0" x2="1">
            <stop offset="0" stopColor={ORANGE} stopOpacity="0" />
            <stop offset="0.8" stopColor={ORANGE} stopOpacity="0.12" />
            <stop offset="1" stopColor={ORANGE} stopOpacity="0.38" />
          </linearGradient>
          <filter id="tp-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Unswept liquidity pools */}
        {scan &&
          !show &&
          [scan.pools.below, scan.pools.above].map((p, k) => {
            if (!p) return null;
            const py = y(p.price);
            const px = x(p.i);
            if (py == null || px == null) return null;
            return (
              <g key={k} className="tp-fade-in">
                <line x1={px} x2={plotW} y1={py} y2={py} stroke={k ? RED : ORANGE} strokeOpacity="0.45" strokeDasharray="5 5" />
                <circle cx={px} cy={py} r="3" fill={k ? RED : ORANGE} />
              </g>
            );
          })}

        {/* Setup box, brackets, levels */}
        {show && s && xs != null && xe != null && yE != null && yT != null && yS != null && (
          <g className="tp-fade-in" opacity={s.outcome === "open" ? 1 : 0.6}>
            <rect x={xs} y={Math.min(yE, yT)} width={Math.max(0, Math.min(xe, plotW) - xs)} height={Math.abs(yT - yE)} fill={ORANGE} fillOpacity="0.1" />
            <rect x={xs} y={Math.min(yE, yS)} width={Math.max(0, Math.min(xe, plotW) - xs)} height={Math.abs(yS - yE)} fill={RED} fillOpacity="0.1" />
            <line x1={xs} x2={plotW} y1={yE} y2={yE} stroke="rgba(255,255,255,0.55)" strokeDasharray="4 4" />
            <line x1={xs} x2={plotW} y1={yT} y2={yT} stroke={ORANGE} strokeOpacity="0.8" />
            <line x1={xs} x2={plotW} y1={yS} y2={yS} stroke={RED} strokeOpacity="0.8" />
            <Brackets x0={x(s.sweepIndex)! - bar} x1={x(s.index)! + bar} y0={y(s.side === "long" ? Math.max(s.level, bars[s.index].h) : Math.min(s.level, bars[s.index].l))!} y1={y(s.side === "long" ? s.stop : s.stop)!} />
          </g>
        )}

        {/* Projection cone and median path */}
        {show && s && proj && s.outcome === "open" && (
          <g>
            {proj.lo && proj.hi && <path d={`${line(proj.hi)} ${line([...proj.lo].reverse()).replace(/^M/, "L")} Z`} fill={ORANGE} fillOpacity="0.1" className="tp-fade-in" />}
            <path d={line(proj.mid)} fill="none" stroke={ORANGE} strokeWidth="2" strokeDasharray="6 6" className="tp-draw" />
          </g>
        )}

        {/* Leader lines and markers for callouts */}
        {cards.map((c) => (
          <g key={c.n} className="tp-fade-in">
            <line x1={c.cx > c.px ? c.cx : c.cx + 250} y1={c.cy + 26} x2={c.px} y2={c.py} stroke={ORANGE} strokeOpacity="0.75" strokeWidth="1.25" />
            <circle cx={c.px} cy={c.py} r="9" fill="none" stroke={ORANGE} strokeOpacity="0.6" className="tp-pulse-ring" />
            <circle cx={c.px} cy={c.py} r="3.5" fill="#fff" stroke={ORANGE} strokeWidth="2" />
          </g>
        ))}

        {/* Volume highlight under the setup */}
        {show && s && x(s.volume.from) != null && x(s.volume.to) != null && (
          <rect
            x={x(s.volume.from)! - bar * 0.7}
            y={volTop}
            width={Math.max(0, x(s.volume.to)! - x(s.volume.from)! + bar * 1.4)}
            height={Math.max(0, volBottom - volTop)}
            rx="8"
            fill={ORANGE}
            fillOpacity="0.08"
            stroke={ORANGE}
            strokeOpacity="0.7"
            className="tp-fade-in"
          />
        )}

        {/* Open position */}
        {position && y(position.entry) != null && <line x1={0} x2={plotW} y1={y(position.entry)!} y2={y(position.entry)!} stroke="#fff" strokeOpacity="0.7" strokeDasharray="2 3" />}

        {/* The scan line */}
        {phase.scan != null && (
          <g>
            <rect x={0} y={0} width={Math.max(0, plotW * phase.scan)} height={Math.max(0, h - 26)} fill="url(#tp-scan)" />
            <line x1={plotW * phase.scan} x2={plotW * phase.scan} y1={0} y2={h - 26} stroke={ORANGE} strokeWidth="2" />
            <line x1={plotW * phase.scan} x2={plotW * phase.scan} y1={0} y2={h - 26} stroke={ORANGE} strokeWidth="10" opacity="0.45" filter="url(#tp-glow)" />
            {(() => {
              const i = Math.round(bars.length * phase.scan) - 1;
              const b = bars[Math.max(0, Math.min(last, i))];
              const py = y(b.c);
              return py != null ? <circle cx={plotW * phase.scan} cy={py} r="5" fill="#fff" stroke={ORANGE} strokeWidth="2" /> : null;
            })()}
          </g>
        )}
      </svg>

      {/* Labels */}
      {phase.scan != null && (
        <span className="absolute top-1 -translate-x-1/2 rounded-full bg-[#FF8A3D] px-2.5 py-0.5 text-[10.5px] font-bold tracking-[0.06em] text-black shadow-[0_6px_20px_-4px_rgba(255,138,61,0.8)]" style={{ left: plotW * phase.scan }}>
          ✦ ANALYZING {Math.round(phase.scan * 100)}%
        </span>
      )}
      {show && s && xs != null && yE != null && yT != null && yS != null && (
        <>
          <Tag x={Math.min(plotW - 170, (xe ?? plotW) - 170)} y={yT - 26} tone="orange" className="tp-fade-in">
            TP {fmt(s.target)} {pctOf(s.target)}
          </Tag>
          <Tag x={Math.min(plotW - 170, (xe ?? plotW) - 170)} y={yS + 6} tone="red" className="tp-fade-in">
            SL {fmt(s.stop)} {pctOf(s.stop)}
          </Tag>
          <span className="tp-fade-in absolute rounded-full bg-[#FF8A3D] px-2.5 py-1 text-[11px] font-bold tracking-[0.04em] text-black shadow-[0_8px_24px_-6px_rgba(255,138,61,0.9)]" style={{ left: Math.max(6, xs - 30), top: (s.side === "long" ? Math.min(yE, y(bars[s.index].h) ?? yE) : Math.max(yE, y(bars[s.index].l) ?? yE)) + (s.side === "long" ? -34 : 12) }}>
            ✦ {s.side === "long" ? "LONG" : "SHORT"} SETUP
          </span>
          {s.outcome === "open" && s.history.matches > 0 && xe != null && (
            <span className="tp-fade-in absolute whitespace-nowrap text-[11px] text-white/55" style={{ left: Math.min(plotW - 230, (x(s.index) ?? 0) - 60), top: (yE + yT) / 2 - 8 }}>
              matched against {s.history.matches} past setup{s.history.matches === 1 ? "" : "s"}
            </span>
          )}
          {s.outcome !== "open" && s.outcomeIndex != null && x(s.outcomeIndex) != null && (
            <span
              className={clsx("tp-pop absolute -translate-x-1/2 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.05em]", s.outcome === "target" ? "bg-[#FF8A3D] text-black" : "bg-[#FF5A4E] text-white")}
              style={{ left: x(s.outcomeIndex)!, top: (s.outcome === "target" ? yT : yS) + (s.outcome === "target" === (s.side === "long") ? -32 : 10) }}
            >
              {s.outcome === "target" ? "✓ PREDICTION CONFIRMED" : "✕ STOPPED OUT"}
            </span>
          )}
        </>
      )}
      {scan &&
        !show &&
        [scan.pools.below, scan.pools.above].map((p, k) =>
          p && y(p.price) != null ? (
            <Tag key={k} x={plotW - 190} y={y(p.price)! + (k ? -24 : 4)} tone={k ? "red" : "orange"} className="tp-fade-in" soft>
              {k ? "Liquidity above" : "Liquidity below"} {fmt(p.price)}
            </Tag>
          ) : null,
        )}
      {cards.map((c) => (
        <div key={c.n} className={clsx("tp-card-in absolute flex w-[250px] items-start gap-2.5 rounded-2xl border border-white/[0.12] bg-[#1C1C1F]/[0.96] px-3 py-2.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl", s && s.outcome !== "open" && "opacity-75")} style={{ left: c.cx, top: c.cy }}>
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#FF8A3D] text-[12px] font-bold text-black">{c.n}</span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold text-white">{c.title}</span>
            <span className="block text-[12px] leading-snug text-white/55">{c.detail}</span>
          </span>
        </div>
      ))}
      {position && y(position.entry) != null && (
        <Tag x={plotW - 160} y={y(position.entry)! - 24} tone="white">
          {position.side === "long" ? "LONG" : "SHORT"} {position.qty} @ {fmt(position.entry)}
        </Tag>
      )}
    </div>
  );
}

function Brackets({ x0, x1, y0, y1 }: { x0: number; x1: number; y0: number; y1: number }) {
  if (![x0, x1, y0, y1].every(Number.isFinite)) return null;
  const top = Math.min(y0, y1) - 8;
  const bot = Math.max(y0, y1) + 8;
  const a = 12;
  const d = `M${x0},${top + a} V${top} H${x0 + a} M${x1 - a},${top} H${x1} V${top + a} M${x1},${bot - a} V${bot} H${x1 - a} M${x0 + a},${bot} H${x0} V${bot - a}`;
  return <path d={d} fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" />;
}

function Tag({ x, y, tone, children, className, soft }: { x: number; y: number; tone: "orange" | "red" | "white"; children: React.ReactNode; className?: string; soft?: boolean }) {
  return (
    <span
      className={clsx(
        "absolute whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
        tone === "orange" ? (soft ? "bg-[#FF8A3D]/15 text-[#FFB27D]" : "bg-[#FF8A3D] text-black") : tone === "red" ? (soft ? "bg-[#FF5A4E]/15 text-[#FF8D85]" : "bg-[#FF5A4E] text-white") : "bg-white text-black",
        className,
      )}
      style={{ left: x, top: y }}
    >
      {children}
    </span>
  );
}
