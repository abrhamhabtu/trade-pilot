// ─── Vision · label layout ─────────────────────────────────────────────────────
// Every tag on the chart goes through here, so nothing is placed by its own
// hand-tuned offset and nothing lands on another tag. Two tools:
//
//   place()  Free labels next to the point they explain. Each label tries its
//            preferred sides at a few distances, slid along the edge, and takes
//            the cheapest spot: overlap with labels already placed costs most,
//            overlap with candles or the volume pane costs by weight, and a long
//            leader costs a little. A label that still collides tries its
//            compact form, then hides if it is optional.
//   stack()  The right-hand gutter: tags kept in price order, a minimum gap
//            apart, and inside the gutter.
//
// Pure and deterministic: the same input always gives the same picture, which
// is what keeps labels from jittering as bars tick.
// ───────────────────────────────────────────────────────────────────────────────

export type Side = "r" | "l" | "t" | "b" | "tr" | "tl" | "br" | "bl";

export interface Label {
  id: string;
  w: number;
  h: number;
  /** The point it explains. */
  ax: number;
  ay: number;
  prefer: Side[];
  /** Higher places first. */
  priority: number;
  /** May be hidden when nothing fits. */
  optional?: boolean;
  /** Smaller form to try before hiding. */
  compact?: { w: number; h: number };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Obstacle = Rect & { weight: number };

export interface Placed {
  id: string;
  x: number;
  y: number;
  compact: boolean;
  hidden: boolean;
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
}

const OFFSETS = [10, 24, 44];
const SLIDE = 12;
const SLIDE_MAX = 120;
/** Obstacles at or above this weight are other tags: a label must not sit on them. */
export const HARD = 1000;
/** A leader is drawn only when the label sits this far from its point. */
const LEADER_MIN = 14;
const KEEP = 0.15;

export const overlap = (a: Rect, b: Rect) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

const inside = (r: Rect, b: Rect) => r.x >= b.x && r.y >= b.y && r.x + r.w <= b.x + b.w && r.y + r.h <= b.y + b.h;

/** The nearest point of a rectangle to (x, y). */
function nearest(r: Rect, x: number, y: number) {
  return { x: Math.max(r.x, Math.min(x, r.x + r.w)), y: Math.max(r.y, Math.min(y, r.y + r.h)) };
}

/** Where a label of this size sits on one side of its point, before sliding. */
function at(side: Side, ax: number, ay: number, w: number, h: number, off: number): { x: number; y: number; along: "x" | "y" } {
  switch (side) {
    case "r":
      return { x: ax + off, y: ay - h / 2, along: "y" };
    case "l":
      return { x: ax - off - w, y: ay - h / 2, along: "y" };
    case "t":
      return { x: ax - w / 2, y: ay - off - h, along: "x" };
    case "b":
      return { x: ax - w / 2, y: ay + off, along: "x" };
    case "tr":
      return { x: ax + off, y: ay - off - h, along: "x" };
    case "tl":
      return { x: ax - off - w, y: ay - off - h, along: "x" };
    case "br":
      return { x: ax + off, y: ay + off, along: "x" };
    case "bl":
      return { x: ax - off - w, y: ay + off, along: "x" };
  }
}

/**
 * A coarse grid over the obstacles, so each candidate only checks the few near
 * it. With 200 candle columns and 500 candidates per label this is the
 * difference between a dropped frame and none.
 */
class Grid {
  private cells = new Map<number, number[]>();
  private items: Obstacle[];
  private size: number;
  constructor(items: Obstacle[], size = 64) {
    this.items = items;
    this.size = size;
    items.forEach((o, k) => this.cover(o, (key) => (this.cells.get(key) ?? this.cells.set(key, []).get(key)!).push(k)));
  }
  private cover(r: Rect, fn: (key: number) => void) {
    const x0 = Math.floor(r.x / this.size);
    const x1 = Math.floor((r.x + r.w) / this.size);
    const y0 = Math.floor(r.y / this.size);
    const y1 = Math.floor((r.y + r.h) / this.size);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) fn(gx * 100_003 + gy);
  }
  private stamp = 0;
  private seen: Int32Array = new Int32Array(0);
  /** Weighted overlap with every obstacle, and whether any of it is a hard one. */
  cost(r: Rect) {
    if (this.seen.length !== this.items.length) this.seen = new Int32Array(this.items.length);
    const mark = ++this.stamp;
    let sum = 0;
    let hard = false;
    this.cover(r, (key) => {
      const list = this.cells.get(key);
      if (!list) return;
      for (const k of list) {
        if (this.seen[k] === mark) continue;
        this.seen[k] = mark;
        const o = this.items[k];
        const a = overlap(r, o);
        if (!a) continue;
        sum += a * o.weight;
        if (o.weight >= HARD) hard = true;
      }
    });
    return { sum, hard };
  }
}

interface Candidate {
  x: number;
  y: number;
  cost: number;
  clash: boolean;
}

function best(l: Label, w: number, h: number, placed: Rect[], grid: Grid, bounds: Rect): Candidate | null {
  let top: Candidate | null = null;
  // Nearest spots first, so a clean one is found early and the rest are cut by their leader alone.
  for (const off of OFFSETS) {
    for (let s = 0; s <= SLIDE_MAX; s += SLIDE) {
      for (const side of l.prefer) {
        const base = at(side, l.ax, l.ay, w, h, off);
        for (const sign of s ? [1, -1] : [1]) {
          const x = base.along === "x" ? base.x + sign * s : base.x;
          const y = base.along === "y" ? base.y + sign * s : base.y;
          const r = { x, y, w, h };
          if (!inside(r, bounds)) continue;
          const n = nearest(r, l.ax, l.ay);
          const lead = Math.hypot(n.x - l.ax, n.y - l.ay) * 0.5;
          // Overlap only adds cost, so a leader this long can't win.
          if (top && lead >= top.cost) continue;
          const c = score(l, r, placed, grid);
          if (!top || c.cost < top.cost) top = { x, y, ...c };
        }
      }
    }
  }
  return top;
}

function score(l: Label, r: Rect, placed: Rect[], grid: Grid) {
  let labels = 0;
  for (const p of placed) labels += overlap(r, p);
  const obs = grid.cost(r);
  const n = nearest(r, l.ax, l.ay);
  const leader = Math.hypot(n.x - l.ax, n.y - l.ay);
  return { cost: labels * 1000 + obs.sum + leader * 0.5, clash: labels > 0 || obs.hard };
}

function leaderOf(l: Label, r: Rect): Placed["leader"] {
  const n = nearest(r, l.ax, l.ay);
  return Math.hypot(n.x - l.ax, n.y - l.ay) >= LEADER_MIN ? { x1: l.ax, y1: l.ay, x2: n.x, y2: n.y } : null;
}

export function place(labels: Label[], obstacles: Obstacle[], bounds: Rect, prev?: Placed[]): Placed[] {
  const grid = new Grid(obstacles);
  const order = [...labels].sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const placed: Rect[] = [];
  const out = new Map<string, Placed>();
  const before = new Map((prev ?? []).filter((p) => !p.hidden).map((p) => [p.id, p]));
  for (const l of order) {
    const hide = () => out.set(l.id, { id: l.id, x: l.ax, y: l.ay, compact: false, hidden: true, leader: null });
    let size = { w: l.w, h: l.h, compact: false };
    let c = best(l, l.w, l.h, placed, grid, bounds);
    if ((!c || c.clash) && l.compact) {
      const small = best(l, l.compact.w, l.compact.h, placed, grid, bounds);
      if (small && (!c || !small.clash || small.cost < c.cost)) {
        c = small;
        size = { ...l.compact, compact: true };
      }
    }
    if (!c || (c.clash && l.optional)) {
      hide();
      continue;
    }
    // Stay put when last frame's spot is nearly as good: labels that hop every tick are worse than slightly longer leaders.
    const was = before.get(l.id);
    if (was && was.compact === size.compact) {
      const r = { x: was.x, y: was.y, w: size.w, h: size.h };
      if (inside(r, bounds)) {
        const s = score(l, r, placed, grid);
        if (!s.clash && s.cost <= c.cost * (1 + KEEP) + 0.5) c = { x: was.x, y: was.y, ...s };
      }
    }
    const r = { x: c.x, y: c.y, w: size.w, h: size.h };
    placed.push(r);
    out.set(l.id, { id: l.id, x: c.x, y: c.y, compact: size.compact, hidden: false, leader: leaderOf(l, r) });
  }
  return labels.map((l) => out.get(l.id)!);
}

/**
 * The gutter: each item wants to sit at `y` (its top). Keeps price order, at
 * least `gap` apart, and inside [top, bottom]; when the run is too tall for the
 * space the top wins.
 */
export function stack(items: { id: string; y: number; h: number }[], top: number, bottom: number, gap = 3): { id: string; y: number }[] {
  const run = [...items].sort((a, b) => a.y - b.y || (a.id < b.id ? -1 : 1)).map((x) => ({ ...x }));
  // Down from the top: nothing above the gutter, nothing on the one before it.
  for (let k = 0; k < run.length; k++) run[k].y = Math.max(run[k].y, k ? run[k - 1].y + run[k - 1].h + gap : top);
  // Up from the bottom: whatever ran out of room slides the run up.
  for (let k = run.length - 1; k >= 0; k--) run[k].y = Math.min(run[k].y, k < run.length - 1 ? run[k + 1].y - run[k].h - gap : bottom - run[k].h);
  // And the top wins if the run is taller than the space.
  for (let k = 0; k < run.length; k++) run[k].y = Math.max(run[k].y, k ? run[k - 1].y + run[k - 1].h + gap : top);
  return run.map((x) => ({ id: x.id, y: x.y }));
}

/** Rough text width for the chart's 11px UI font, for sizing labels before they render. */
export const textWidth = (s: string, px = 11) => Math.ceil(s.length * px * 0.6);
