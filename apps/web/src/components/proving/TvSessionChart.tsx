"use client";

import { useEffect, useRef } from "react";
import { ColorType, CrosshairMode, LineStyle, createChart, type SeriesMarker, type Time, type UTCTimestamp } from "lightweight-charts";
import { ExternalLink } from "lucide-react";
import type { Bar } from "@/lib/pilot/market";
import type { Instrument, SimTrade } from "@/lib/proving/engine";

const TV_SYMBOL: Record<Instrument, string> = { MNQ: "CME_MINI:MNQ1!", MES: "CME_MINI:MES1!", NQ: "CME_MINI:NQ1!", ES: "CME_MINI:ES1!" };

/** Theme colours, read from the app's CSS variables so the chart follows the palette. */
function palette() {
  const css = getComputedStyle(document.documentElement);
  const rgb = (name: string, a = 1) => `rgba(${css.getPropertyValue(name).trim().split(/\s+/).join(", ")}, ${a})`;
  return { green: rgb("--tp-green"), red: rgb("--tp-red"), blue: rgb("--tp-blue"), yellow: rgb("--tp-yellow"), redSoft: rgb("--tp-red", 0.55), greenSoft: rgb("--tp-green", 0.55) };
}

/** Seconds to add to a UTC timestamp so the chart's clock reads New York time. */
function etShift(t: number) {
  const d = new Date(t * 1000);
  const ny = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((ny.getTime() - utc.getTime()) / 1000);
}

/**
 * One session on TradingView's own charting library: candles, RTH VWAP, the
 * levels the strategy knew that morning, and every simulated trade with its
 * entry, exit, stop and target.
 */
export function TvSessionChart({ bars, trades, levels, instrument, height = 340 }: { bars: Bar[]; trades: SimTrade[]; levels: { label: string; px: number }[]; instrument: Instrument; height?: number }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || !bars.length) return;
    const c = palette();
    const shift = etShift(bars[0].t);
    const at = (t: number) => (t + shift) as UTCTimestamp;
    const chart = createChart(el, {
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#a1a1aa", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    });

    const candles = chart.addCandlestickSeries({ upColor: c.green, downColor: c.red, borderVisible: false, wickUpColor: c.greenSoft, wickDownColor: c.redSoft });
    candles.setData(bars.map((b) => ({ time: at(b.t), open: b.o, high: b.h, low: b.l, close: b.c })));

    let pv = 0;
    let vol = 0;
    const vwap = chart.addLineSeries({ color: c.blue, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    vwap.setData(
      bars.map((b) => {
        pv += ((b.h + b.l + b.c) / 3) * (b.v || 1);
        vol += b.v || 1;
        return { time: at(b.t), value: pv / vol };
      }),
    );

    const lo = Math.min(...bars.map((b) => b.l));
    const hi = Math.max(...bars.map((b) => b.h));
    for (const l of levels.filter((x) => x.px >= lo * 0.997 && x.px <= hi * 1.003))
      candles.createPriceLine({ price: l.px, color: c.yellow, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: l.label });

    // The open bar each trade entered and left on.
    const barAt = (t: number) => bars.reduce((best, b) => (b.t <= t ? b : best), bars[0]).t;
    const markers: SeriesMarker<Time>[] = [];
    for (const t of trades) {
      const long = t.side === "long";
      markers.push({ time: at(barAt(t.entryT)), position: long ? "belowBar" : "aboveBar", shape: long ? "arrowUp" : "arrowDown", color: long ? c.green : c.red, text: `${long ? "Long" : "Short"} ${t.qty}` });
      if (t.exit !== "open")
        markers.push({ time: at(barAt(t.exitT)), position: long ? "aboveBar" : "belowBar", shape: "circle", color: t.pnl >= 0 ? c.green : c.red, text: `${t.pnl >= 0 ? "+" : "-"}$${Math.abs(Math.round(t.pnl))}` });
      const end = t.exit === "open" ? bars[bars.length - 1].t : t.exitT;
      // A trade opened and closed on one bar still draws to the next bar.
      const from = barAt(t.entryT);
      const to = barAt(end) > from ? barAt(end) : (bars.find((x) => x.t > from)?.t ?? from + 60);
      const span = [at(from), at(to)];
      for (const [px, color] of [
        [t.stopPx, c.redSoft],
        [t.targetPx, c.greenSoft],
      ] as const) {
        const s = chart.addLineSeries({ color, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        s.setData(span.map((time) => ({ time, value: px })));
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    candles.setMarkers(markers);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, trades, levels, height]);

  if (!bars.length) return <div className="grid h-40 place-items-center text-[13px] text-zinc-500">No bars for this session yet.</div>;
  return (
    <div>
      <div ref={box} style={{ height }} className="w-full" />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-tp-blue" /> VWAP
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t border-dashed border-tp-yellow" /> Levels known at the open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t border-dashed border-tp-red/70" /> Stop
          <span className="ml-2 h-0 w-4 border-t border-dashed border-tp-green/70" /> Target
        </span>
        <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(TV_SYMBOL[instrument])}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-tp-blue hover:underline">
          Open {instrument} on TradingView <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
