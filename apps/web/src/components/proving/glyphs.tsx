import type { StrategyId } from "@/lib/proving/engine";

// A tiny drawing of each setup: price in white, VWAP in blue, levels in amber,
// the entry as a green dot.
const SHAPES: Record<StrategyId, { price: number[]; vwap?: number[]; level?: number; range?: [number, number]; entry: number }> = {
  "double-break-vwap": { price: [30, 28, 24, 18, 14, 19, 24, 20, 15, 11, 8, 6], vwap: [21, 20, 19, 18, 17, 17, 17, 17, 16, 16, 16, 16], entry: 9 },
  "sr-retest": { price: [30, 27, 24, 20, 16, 12, 15, 17, 14, 10, 7, 5], level: 17, entry: 9 },
  orb: { price: [20, 14, 24, 18, 22, 16, 19, 12, 9, 7, 5, 4], range: [12, 26], entry: 8 },
  "vwap-pullback": { price: [30, 26, 22, 18, 14, 11, 14, 17, 15, 11, 8, 5], vwap: [28, 26, 24, 22, 21, 19, 18, 17, 16, 15, 14, 13], entry: 8 },
  "failed-breakout": { price: [24, 20, 16, 12, 9, 5, 12, 15, 18, 21, 24, 27], level: 10, entry: 6 },
  "tv-signals": { price: [26, 24, 25, 21, 22, 18, 17, 14, 15, 11, 9, 7], entry: 5 },
};

export function StrategyGlyph({ id, active }: { id: StrategyId; active?: boolean }) {
  const s = SHAPES[id];
  const x = (i: number) => 4 + i * 10;
  const path = (v: number[]) => v.map((y, i) => `${i ? "L" : "M"}${x(i)},${y}`).join(" ");
  return (
    <svg viewBox="0 0 118 34" className="h-9 w-full" aria-hidden>
      {s.range && <rect x="4" y={s.range[0]} width="30" height={s.range[1] - s.range[0]} fill="#FFB800" fillOpacity="0.12" stroke="#FFB800" strokeOpacity="0.5" strokeDasharray="2 2" />}
      {s.level != null && <line x1="0" x2="118" y1={s.level} y2={s.level} stroke="#FFB800" strokeOpacity="0.7" strokeDasharray="3 3" />}
      {s.vwap && <path d={path(s.vwap)} fill="none" stroke="#4F9CF9" strokeWidth="1.5" />}
      <path d={path(s.price)} fill="none" stroke={active ? "#E4E4E7" : "#A1A1AA"} strokeWidth="1.6" strokeLinejoin="round" />
      {id === "tv-signals" && <path d={`M${x(s.entry)},2 v28`} stroke="#4F9CF9" strokeDasharray="2 2" />}
      <circle cx={x(s.entry)} cy={s.price[s.entry]} r="3" fill="#00D68F" />
      <circle cx={x(s.entry)} cy={s.price[s.entry]} r="6" fill="#00D68F" fillOpacity="0.2" />
    </svg>
  );
}
