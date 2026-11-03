// ─── Vision · demo mode ────────────────────────────────────────────────────────
// Real setups can take hours to appear. Demo mode builds a simulated chart in
// which the chosen strategy's pattern forms, then plays it out to a win or a
// loss, so the whole flow can be watched on demand.
//
// Honesty rules: every demo is labelled as simulated on screen; the pattern is
// only shown if the real reader detects it (each scenario is checked with the
// same detector the live chart uses, and rebuilt until it passes); and the
// odds on the forecast card come from the real chart's history, not from the
// simulated bars.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import { RTH_OPEN, sessionOf } from "@/lib/pilot/market";
import { _internal, analyze, type Anchor, type ReaderId, type Side } from "./analyze";

export interface Demo {
  bars: Bar[];
  /** First bar shown when playback starts. */
  start: number;
  reader: ReaderId;
  side: Side;
  win: boolean;
  /** Index of the bar that fires the setup. */
  fires: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The most recent session anchor at or before now: UTC midnight, or 09:30 New York. */
function anchorTime(anchor: Anchor, now: number) {
  if (anchor === "utc") return Math.floor(now / 1000 / 86_400) * 86_400;
  let t = Math.floor(now / 1000 / 60) * 60;
  for (let k = 0; k < 3 * 1440; k++, t -= 60) if (sessionOf(t).minute === RTH_OPEN) return t;
  return Math.floor(now / 1000 / 60) * 60;
}

const PREFIX = 200;

function build(reader: ReaderId, side: Side, win: boolean, price: number, tfSec: number, anchor: Anchor, seed: number): Demo | null {
  const r = rng(seed);
  const gauss = () => {
    let s = 0;
    for (let k = 0; k < 6; k++) s += r();
    return s - 3;
  };
  const a = price * 0.0011 * Math.sqrt(tfSec / 300);
  const dir = side === "long" ? 1 : -1;
  const S = PREFIX;
  const t0 = anchorTime(anchor, Date.now()) - S * tfSec;
  const bars: Bar[] = [];
  let close = price;
  // Session VWAP from the anchor bar, kept as bars are added.
  let pv = 0;
  let vv = 0;
  const vwap = () => (vv ? pv / vv : close);
  const push = (c: number, o = close, wickUp = Math.abs(gauss()) * 0.35 * a, wickDn = Math.abs(gauss()) * 0.35 * a, v = 80 + r() * 60) => {
    const t = t0 + bars.length * tfSec;
    const b = { t, o, h: Math.max(o, c) + wickUp, l: Math.min(o, c) - wickDn, c, v };
    if (bars.length >= S) {
      pv += ((b.h + b.l + b.c) / 3) * v;
      vv += v;
    }
    bars.push(b);
    close = c;
  };
  const walk = (n: number, delta: number, noise = 0.45) => {
    const from = close;
    for (let k = 1; k <= n; k++) push(from + (delta * a * k) / n + gauss() * noise * a);
  };
  // A quiet prefix that ends near the starting price.
  for (let k = 0; k < S; k++) push(close + gauss() * 0.5 * a + (price - close) * 0.04);

  switch (reader) {
    case "sweep": {
      walk(8, -2.6 * dir);
      const swing = dir > 0 ? Math.min(...bars.slice(-3).map((b) => b.l)) : Math.max(...bars.slice(-3).map((b) => b.h));
      walk(4, 1.8 * dir, 0.3);
      walk(4, -1.4 * dir, 0.3);
      // The sweep: a long wick through the swing that closes back on the right side.
      const o = close;
      const c = swing + dir * 0.35 * a;
      if (dir > 0) push(c, o, 0.1 * a, Math.max(0, Math.min(o, c) - (swing - 0.9 * a)), 260);
      else push(c, o, Math.max(0, swing + 0.9 * a - Math.max(o, c)), 0.1 * a, 260);
      walk(1, 1.9 * dir, 0.1);
      break;
    }
    case "dbvwap": {
      for (let k = 0; k < 6; k++) push(vwap() - dir * (0.7 + r() * 0.3) * a);
      push(vwap() + dir * 0.7 * a, close, undefined, undefined, 200);
      push(vwap() + dir * 0.45 * a);
      push(vwap() - dir * 0.5 * a);
      push(vwap() - dir * 0.35 * a);
      push(vwap() + dir * 0.9 * a, close, undefined, undefined, 240);
      break;
    }
    case "sd": {
      walk(6, -2 * dir, 0.35);
      // The base: two small bodies.
      push(close + gauss() * 0.08 * a, close, 0.15 * a, 0.15 * a);
      push(close + gauss() * 0.08 * a, close, 0.15 * a, 0.15 * a);
      const base = bars.slice(-2);
      const top = dir > 0 ? Math.max(...base.map((b) => b.h)) : Math.max(...base.map((b) => b.h));
      const bottom = Math.min(...base.map((b) => b.l));
      walk(3, 3.4 * dir, 0.15);
      walk(5, 0.6 * dir, 0.3);
      walk(5, -2.6 * dir, 0.25);
      // Back into the zone, then out with a strong close: opens inside, closes beyond the edge.
      const edge = dir > 0 ? top : bottom;
      const o = edge - dir * 0.15 * a;
      const c = edge + dir * 0.6 * a;
      const depth = 0.25 * (top - bottom);
      if (dir > 0) push(c, o, 0.1 * a, Math.max(0, o - (top - depth)), 230);
      else push(c, o, Math.max(0, bottom + depth - o), 0.1 * a, 230);
      break;
    }
    case "orb": {
      const n = Math.max(1, Math.round(900 / tfSec));
      for (let k = 0; k < n; k++) push(close + gauss() * 0.6 * a);
      const range = bars.slice(-n);
      const hi = Math.max(...range.map((b) => b.h));
      const lo = Math.min(...range.map((b) => b.l));
      for (let k = 0; k < 4; k++) push(Math.min(hi - 0.15 * a, Math.max(lo + 0.15 * a, close + gauss() * 0.3 * a)), close, 0.05 * a, 0.05 * a);
      push((dir > 0 ? hi : lo) + dir * 0.6 * a, close, undefined, undefined, 260);
      break;
    }
    case "vwappb": {
      for (let k = 0; k < 10; k++) push(close + dir * 0.4 * a + gauss() * 0.15 * a, close, 0.1 * a, 0.1 * a);
      for (let k = 0; k < 3; k++) push(close - dir * 0.45 * a, close, 0.1 * a, 0.1 * a);
      const v = vwap();
      const o = close;
      const c = v + dir * 0.7 * a;
      if (dir > 0) push(c, o, 0.1 * a, Math.max(0, Math.min(o, c) - (v + 0.05 * a)), 220);
      else push(c, o, Math.max(0, v - 0.05 * a - Math.max(o, c)), 0.1 * a, 220);
      break;
    }
  }

  // Did the real reader see it?
  const ctx = _internal.context(bars, anchor);
  let fired: ReturnType<typeof _internal.detectAt> = null;
  let at = -1;
  for (let i = bars.length - 3; i < bars.length; i++) {
    const f = _internal.detectAt(ctx, i, [reader]);
    if (f && f.side === side) {
      fired = f;
      at = i;
    }
  }
  if (!fired || at < 0) return null;
  const cut = bars.slice(0, at + 1);
  close = cut[cut.length - 1].c;
  bars.length = 0;
  bars.push(...cut);

  // Play it out toward the target or the stop.
  const goal = win ? fired.target : fired.stop;
  const steps = win ? 10 + Math.floor(r() * 8) : 2 + Math.floor(r() * 2);
  for (let k = 0; k < 40; k++) {
    const remaining = goal - close;
    const step = remaining / Math.max(1, steps - k) + gauss() * 0.2 * a;
    push(close + step);
    const hit = win ? (side === "long" ? close >= goal : close <= goal) : side === "long" ? close <= goal : close >= goal;
    if (hit || (side === "long" ? bars[bars.length - 1].h >= fired.target || bars[bars.length - 1].l <= fired.stop : bars[bars.length - 1].l <= fired.target || bars[bars.length - 1].h >= fired.stop)) break;
  }
  // Two quiet bars so the exit is on a closed bar.
  for (let k = 0; k < 2; k++) push(close + gauss() * 0.1 * a, close, 0.05 * a, 0.05 * a);
  // The finished demo must read back exactly as intended, or it is rebuilt.
  // A losing setup can flip into a new one on the bar that stops it (a failed
  // long double-break is a short double-break); then the original is checked
  // bar by bar instead.
  const check = analyze(bars, { forming: true, reader, anchor, maxAge: 80 }).setup;
  const asPlanned = check && check.index === at && check.side === side && check.outcome === (win ? "target" : "stop");
  if (!asPlanned) {
    if (win || !check || check.index <= at) return null;
    let first: "stop" | "target" | null = null;
    for (let k = at + 1; k < bars.length - 1 && !first; k++) {
      const x = bars[k];
      if (side === "long" ? x.l <= fired.stop : x.h >= fired.stop) first = "stop";
      else if (side === "long" ? x.h >= fired.target : x.l <= fired.target) first = "target";
    }
    if (first !== "stop") return null;
  }
  return { bars, start: Math.max(60, at - 26), reader, side, win, fires: at };
}

/**
 * A demo of `reader` on a chart near `price`. Returns null only if no seed
 * produced a pattern the reader accepts.
 */
export function buildDemo(opts: { reader: ReaderId; side?: Side; win?: boolean; price: number; tfSeconds: number; anchor: Anchor; seed?: number }): Demo | null {
  const base = opts.seed ?? Math.floor(Math.random() * 1e9);
  for (let k = 0; k < 80; k++) {
    const r = rng(base + k);
    const side = opts.side ?? (r() < 0.5 ? "long" : "short");
    const win = opts.win ?? r() < 0.5;
    const d = build(opts.reader, side, win, opts.price, opts.tfSeconds, opts.anchor, base + k * 7919);
    if (d) return d;
  }
  return null;
}
