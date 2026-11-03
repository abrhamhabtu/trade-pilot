import type { Bar } from "@/lib/pilot/market";

export function ema(values: number[], n: number) {
  const k = 2 / (n + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i ? v * k + out[i - 1] * (1 - k) : v));
  return out;
}

/** Wilder's RSI. The first `n` values are 50. */
export function rsi(closes: number[], n = 14) {
  const out = closes.map(() => 50);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    if (i <= n) {
      gain += g / n;
      loss += l / n;
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
    }
    if (i >= n) out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** Wilder's average true range. */
export function atr(bars: Bar[], n = 14) {
  const out: number[] = [];
  bars.forEach((b, i) => {
    const tr = i ? Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)) : b.h - b.l;
    out.push(i < n ? (i ? (out[i - 1] * i + tr) / (i + 1) : tr) : (out[i - 1] * (n - 1) + tr) / n);
  });
  return out;
}

export interface Pivot {
  i: number;
  price: number;
  kind: "high" | "low";
}

/**
 * Swing highs and lows: a bar whose high (low) beats the `span` bars on each
 * side. A pivot is only known `span` bars after it, so callers must not use it
 * before index i + span.
 */
export function pivots(bars: Bar[], span = 3): Pivot[] {
  const out: Pivot[] = [];
  for (let i = span; i < bars.length - span; i++) {
    let hi = true;
    let lo = true;
    for (let k = 1; k <= span; k++) {
      if (bars[i - k].h >= bars[i].h || bars[i + k].h > bars[i].h) hi = false;
      if (bars[i - k].l <= bars[i].l || bars[i + k].l < bars[i].l) lo = false;
    }
    if (hi) out.push({ i, price: bars[i].h, kind: "high" });
    if (lo) out.push({ i, price: bars[i].l, kind: "low" });
  }
  return out;
}
