// Guided scenarios: a setup described in plain words, the market and session to
// practise it in, and months to replay. Replay then lists every session where
// the setup formed, so the trader knows where to look.

import type { ReaderChoice } from "@/lib/vision/analyze";
import type { SessionKey } from "@/lib/vision/custom";
import type { Timeframe } from "@/lib/vision/markets";

export interface Scenario {
  id: string;
  name: string;
  what: string;
  symbol: string;
  tf: Timeframe;
  session: SessionKey;
  reader: ReaderChoice;
  /** Months worth practising beyond the most recent ones, when the data has them. */
  months: string[];
}

export const SCENARIOS: Scenario[] = [
  { id: "open-drive", name: "NY open drive", what: "The first close outside New York's opening range, in the direction of the break. Wait for the close; don't anticipate it.", symbol: "NQ", tf: "5m", session: "open", reader: "orb", months: ["2024-08", "2025-04"] },
  { id: "dbvwap", name: "Double-break VWAP", what: "Price closes through VWAP, gets pushed back, then closes through again. Take the second break, stop beyond the push.", symbol: "NQ", tf: "5m", session: "ny", reader: "dbvwap", months: ["2023-03", "2024-08"] },
  { id: "sweep", name: "Liquidity sweep and reclaim", what: "Stops get run under a clear swing low (or over a high) and price closes back inside. Trade the reclaim, not the wick.", symbol: "NQ", tf: "5m", session: "ny", reader: "sweep", months: ["2020-03", "2022-06"] },
  { id: "octavia", name: "Supply & demand retest", what: "The first return to the base that launched an impulse. Look for a reaction at the zone, with the stop beyond it.", symbol: "NQ", tf: "15m", session: "ny", reader: "sd", months: ["2022-01", "2025-04"] },
];

const MONTH = (y: number, m: number) => {
  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 0));
  return { label: from.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }), from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), key: from.toISOString().slice(0, 7) };
};

/** The last three full months in the data, plus the scenario's classic months when covered. */
export function practiceMonths(series: { from: number; to: number; years: number[] } | null, classic: string[]) {
  const end = series ? new Date(series.to * 1000) : new Date();
  const out: ReturnType<typeof MONTH>[] = [];
  // Without library data the free feed only reaches back about two months.
  for (let k = series ? 1 : 0; out.length < (series ? 3 : 1); k++) out.unshift(MONTH(end.getUTCFullYear(), end.getUTCMonth() - k));
  if (series) {
    for (const c of classic) {
      const [y, m] = c.split("-").map(Number);
      if (series.years.includes(y) && !out.some((o) => o.key === c)) out.unshift(MONTH(y, m - 1));
    }
  }
  return out.slice(-5);
}
