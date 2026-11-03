// ─── Chart read ────────────────────────────────────────────────────────────────
// An AI looks at a real screenshot of the chart. To show it really looked, it is
// asked for things only the picture contains, then the app grades its answers
// against the actual bars. The high and low of the visible chart are held back
// from the facts it gets, so it can't copy them.
// ───────────────────────────────────────────────────────────────────────────────

export interface ChartTruth {
  high: number;
  low: number;
  last: number;
  lastCandle: "up" | "down";
  bars: number;
}

export interface ModelRead {
  seen: { high: number | null; low: number | null; last: number | null; lastCandle: string; trend: string };
  read: string;
  levels: { price: number; why: string }[];
  stance: "take" | "wait" | "skip" | "";
  invalidation: string;
}

export interface ReadCheck {
  ok: boolean;
  what: string;
  detail: string;
}

export interface ReadResult {
  read: ModelRead;
  checks: ReadCheck[];
  /** The model demonstrably read this picture. */
  verified: boolean;
}

export function readPrompt(o: { market: string; tf: string; facts: unknown }) {
  return `You are looking at a screenshot of a live ${o.market} ${o.tf} candlestick chart from a trading app. Orange candles closed up and grey candles closed down. The right axis shows prices. The blue line is VWAP, the pale line is the 21 EMA.

These are facts the app computed, from real bars. Use them and do not invent other numbers:
${JSON.stringify(o.facts)}

Work from the picture for the "seen" fields, reading the axis. If you can't read one, use null. Never guess.

Answer with only this JSON, no other text:
{"seen":{"high":<highest price visible in the candles>,"low":<lowest price visible in the candles>,"last":<latest price>,"lastCandle":"up or down","trend":"up, down or sideways"},"read":"<two or three plain sentences on what the chart is doing and what a careful trader would watch. Treat the history in the facts as the only evidence for odds.>","levels":[{"price":<number>,"why":"<a few words>"}],"stance":"take, wait or skip","invalidation":"<the one thing that would prove this read wrong>"}`;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && Number.isFinite(Number(v.replace(/,/g, ""))) && v.trim() ? Number(v.replace(/,/g, "")) : null);

/** Takes the answer's JSON even when the model wraps it in words or a code fence. */
export function parseRead(text: string): ModelRead | null {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    const j = JSON.parse(text.slice(a, b + 1)) as Record<string, unknown>;
    const seen = (j.seen ?? {}) as Record<string, unknown>;
    const stance = String(j.stance ?? "").toLowerCase();
    return {
      seen: { high: num(seen.high), low: num(seen.low), last: num(seen.last), lastCandle: String(seen.lastCandle ?? "").toLowerCase(), trend: String(seen.trend ?? "").toLowerCase() },
      read: String(j.read ?? "").slice(0, 1200),
      levels: (Array.isArray(j.levels) ? j.levels : []).slice(0, 6).flatMap((l: Record<string, unknown>) => (num(l?.price) != null ? [{ price: num(l.price)!, why: String(l.why ?? "").slice(0, 80) }] : [])),
      stance: (["take", "wait", "skip"].includes(stance) ? stance : "") as ModelRead["stance"],
      invalidation: String(j.invalidation ?? "").slice(0, 300),
    };
  } catch {
    return null;
  }
}

/** Grades the model against the real bars. Tolerance is a slice of the visible range, about what an axis can be read to. */
export function gradeRead(r: ModelRead, t: ChartTruth): ReadResult {
  const range = Math.max(t.high - t.low, 1e-9);
  const tol = range * 0.04;
  const near = (a: number | null, b: number) => a != null && Math.abs(a - b) <= tol;
  const f = (n: number | null) => (n == null ? "couldn't read it" : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));
  const real = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const checks: ReadCheck[] = [
    { ok: near(r.seen.high, t.high), what: "Top of the chart", detail: `It read ${f(r.seen.high)}. Actual ${real(t.high)}.` },
    { ok: near(r.seen.low, t.low), what: "Bottom of the chart", detail: `It read ${f(r.seen.low)}. Actual ${real(t.low)}.` },
    { ok: near(r.seen.last, t.last), what: "Latest price", detail: `It read ${f(r.seen.last)}. Actual ${real(t.last)}.` },
    { ok: r.seen.lastCandle === t.lastCandle, what: "Latest candle", detail: `It read ${r.seen.lastCandle || "nothing"}. Actual ${t.lastCandle}.` },
  ];
  const outside = r.levels.filter((l) => l.price > t.high + range * 0.25 || l.price < t.low - range * 0.25);
  if (r.levels.length) checks.push({ ok: !outside.length, what: "Levels it named", detail: outside.length ? `${outside.map((l) => real(l.price)).join(", ")} ${outside.length === 1 ? "is" : "are"} far off this chart.` : `All ${r.levels.length} are on or near this chart.` });
  // High and low were kept from its facts, so getting them right means it read the picture.
  const verified = near(r.seen.high, t.high) && near(r.seen.low, t.low);
  return { read: r, checks, verified };
}

export const SESSION_TOOLS = ["claude-code", "codex"] as const;
