// What a chart draws. Density sets how much of a setup is drawn; the layers
// switch whole groups on or off. Stored per chart, so a busy two-chart screen
// can stay clean while a single chart shows everything.

export type Density = "clean" | "standard" | "full";

export interface ChartView {
  density: Density;
  /** Day levels and resting liquidity in the right-hand gutter. */
  levels: boolean;
  /** Faint bands for Asia, London and New York. */
  sessions: boolean;
  /** Numbered pins and their notes. */
  story: boolean;
  /** Entry, stop and target. */
  plan: boolean;
  /** The cone of past matches (Full only). */
  projection: boolean;
  /** Other setups that fired nearby, as chips. */
  others: boolean;
}

export const PRESETS: Record<Density, ChartView> = {
  clean: { density: "clean", levels: false, sessions: false, story: true, plan: true, projection: false, others: false },
  standard: { density: "standard", levels: true, sessions: false, story: true, plan: true, projection: false, others: true },
  full: { density: "full", levels: true, sessions: true, story: true, plan: true, projection: true, others: true },
};

/** A chart nobody has set yet: clean when two share the screen, standard alone. */
export const viewOf = (v: ChartView | undefined, compact: boolean): ChartView => (v ? { ...PRESETS[v.density] , ...v } : PRESETS[compact ? "clean" : "standard"]);

/** Exactly which marks a view draws. */
export function layers(v: ChartView) {
  const clean = v.density === "clean";
  return {
    pins: v.story,
    /** Short titles beside the pins while the setup is being explained. */
    notes: v.story && !clean,
    planLines: v.plan,
    /** Reward and risk boxes, the R tags and the pattern's corner brackets. */
    planBoxes: v.plan && !clean,
    setupPill: !clean,
    zone: !clean,
    projection: v.plan && v.projection && v.density === "full",
    volume: v.density === "full",
    levels: v.levels,
    sessions: v.sessions,
    others: v.others,
  };
}
