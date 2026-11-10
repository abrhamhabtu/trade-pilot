"use client";

import { useEffect, useRef } from "react";
import type { Bar } from "@/lib/pilot/market";

const ORANGE = "#FF8A3D";
const RED = "#FF5A4E";

export interface MiniTrade {
  side: "long" | "short";
  entryIndex: number;
  exitIndex: number;
  entry: number;
  stop: number;
  target: number;
  exit: number;
}

/**
 * One trade on a small canvas: 40 bars before entry to 10 after the exit, the
 * plan as lines, and (unless `upTo` hides the outcome) where it went. Cheap
 * enough to draw hundreds of them in a scrolling wall.
 */
export function MiniChart({ bars, t, width, height, upTo, win }: { bars: Bar[]; t: MiniTrade; width: number; height: number; upTo?: number; win?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = width * dpr;
    c.height = height * dpr;
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, height);
    const from = Math.max(0, t.entryIndex - 40);
    const end = upTo ?? Math.min(bars.length - 1, t.exitIndex + 10);
    const span = bars.slice(from, end + 1);
    if (!span.length) return;
    // The frame always holds the plan, even before price reaches it.
    let hi = Math.max(t.stop, t.target, ...span.map((b) => b.h));
    let lo = Math.min(t.stop, t.target, ...span.map((b) => b.l));
    const pad = (hi - lo) * 0.06 || 1;
    hi += pad;
    lo -= pad;
    const total = upTo != null ? Math.max(span.length + 12, 60) : span.length;
    const w = width / total;
    const x = (i: number) => (i - from) * w + w / 2;
    const y = (p: number) => ((hi - p) / (hi - lo)) * height;
    span.forEach((b, k) => {
      const i = from + k;
      const up = b.c >= b.o;
      g.strokeStyle = up ? "rgba(255,138,61,0.8)" : "rgba(150,156,170,0.75)";
      g.fillStyle = up ? ORANGE : "#5B6170";
      g.beginPath();
      g.moveTo(x(i), y(b.h));
      g.lineTo(x(i), y(b.l));
      g.stroke();
      const top = y(Math.max(b.o, b.c));
      g.fillRect(x(i) - Math.max(0.5, w * 0.32), top, Math.max(1, w * 0.64), Math.max(1, y(Math.min(b.o, b.c)) - top));
    });
    const x0 = x(t.entryIndex);
    const x1 = upTo != null ? width : x(Math.min(end, t.exitIndex));
    const line = (p: number, color: string, dash: number[]) => {
      g.strokeStyle = color;
      g.setLineDash(dash);
      g.beginPath();
      g.moveTo(x0, y(p));
      g.lineTo(x1, y(p));
      g.stroke();
      g.setLineDash([]);
    };
    g.fillStyle = "rgba(255,138,61,0.08)";
    g.fillRect(x0, Math.min(y(t.entry), y(t.target)), x1 - x0, Math.abs(y(t.target) - y(t.entry)));
    g.fillStyle = "rgba(255,90,78,0.08)";
    g.fillRect(x0, Math.min(y(t.entry), y(t.stop)), x1 - x0, Math.abs(y(t.stop) - y(t.entry)));
    line(t.target, ORANGE, []);
    line(t.stop, RED, []);
    line(t.entry, "rgba(255,255,255,0.7)", [3, 3]);
    if (upTo == null) {
      g.fillStyle = win ? ORANGE : RED;
      g.beginPath();
      g.arc(x(t.exitIndex), y(t.exit), 3, 0, Math.PI * 2);
      g.fill();
    }
  }, [bars, t, width, height, upTo, win]);
  return <canvas ref={ref} style={{ width, height }} className="block" />;
}
