// ─── Vision · index divergence ─────────────────────────────────────────────────
// NQ and ES usually run each other's stops together. When one takes out its
// swing and the other doesn't, traders call it divergence and some read it as
// a stronger reversal. That claim is measured here before anyone trusts it:
// the tag is shown on the chart and recorded in Discover's study.
// Gold has no pair, so it is never tagged.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import type { SetupSource, Side } from "./analyze";
import type { DayLevels } from "./levels";
import type { VisionSymbolId } from "./markets";

export const PAIR: Partial<Record<VisionSymbolId | string, VisionSymbolId>> = { NQ: "ES", ES: "NQ" };
export const SWEEP_FAMILY = new Set<SetupSource>(["sweep", "pd_sweep", "on_sweep", "asia_sweep"]);
const LEVEL_OF: Partial<Record<SetupSource, (l: DayLevels, side: Side) => number | null>> = {
  pd_sweep: (l, s) => (s === "long" ? l.pdl : l.pdh),
  on_sweep: (l, s) => (s === "long" ? l.onl : l.onh),
  asia_sweep: (l, s) => (s === "long" ? l.asiaL : l.asiaH),
};

/** Index of the bar opening at `t`, or -1. Bars are in time order. */
function at(bars: Bar[], t: number) {
  let lo = 0;
  let hi = bars.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (bars[m].t === t) return m;
    if (bars[m].t < t) lo = m + 1;
    else hi = m - 1;
  }
  return -1;
}

/**
 * Whether the paired index also took out its matching level within two bars
 * of this sweep. Day-level sweeps compare the same day level on the other
 * index; swing sweeps compare the other's extreme where this swing formed.
 * Only bars up to the setup's own bar are read. null when it can't be told.
 */
export function pairConfirmed(
  s: { reader: SetupSource; side: Side; sweepIndex: number; levelIndex: number; index: number },
  mine: Bar[],
  other: Bar[],
  otherLevels?: (DayLevels | null)[],
): boolean | null {
  if (!SWEEP_FAMILY.has(s.reader)) return null;
  const o = at(other, mine[s.sweepIndex]?.t);
  const end = at(other, mine[s.index]?.t);
  if (o < 0 || end < 0) return null;
  const long = s.side === "long";
  let ref: number | null = null;
  const level = LEVEL_OF[s.reader];
  if (level) {
    const l = otherLevels?.[o];
    ref = l ? level(l, s.side) : null;
  } else {
    const ol = at(other, mine[s.levelIndex]?.t);
    if (ol < 0) return null;
    const from = Math.max(0, ol - 3);
    const to = Math.min(o - 1, ol + 3);
    if (to < from) return null;
    ref = long ? Infinity : -Infinity;
    for (let k = from; k <= to; k++) ref = long ? Math.min(ref, other[k].l) : Math.max(ref, other[k].h);
  }
  if (ref == null || !Number.isFinite(ref)) return null;
  for (let k = Math.max(0, o - 2); k <= Math.min(end, o + 2); k++) if (long ? other[k].l < ref : other[k].h > ref) return true;
  return false;
}

/** The tag's words: "ES did not confirm the low". */
export const divergenceText = (pair: string, side: Side) => `${pair} did not confirm the ${side === "long" ? "low" : "high"}`;
