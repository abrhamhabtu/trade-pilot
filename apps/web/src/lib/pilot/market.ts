// ─── Market read ───────────────────────────────────────────────────────────────
// Turns raw intraday bars into the handful of numbers a futures trader marks
// before the open: prior-day high/low/close, the overnight range, the RTH VWAP.
// Everything here is pure so the API route and the tests share one definition.
//
// All session math is in New York time. Futures trade 18:00 → 17:00 ET, so a
// bar at 19:00 on Monday belongs to Tuesday's session.
// ───────────────────────────────────────────────────────────────────────────────

export interface Bar {
  /** Unix seconds. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type Bias = "bullish" | "bearish" | "balanced";

export interface MarketRead {
  /** The trader's root symbol, e.g. "MNQ". */
  symbol: string;
  /** The contract we priced it from, e.g. "NQ=F". */
  source: string;
  name: string;
  price: number;
  prevClose: number | null;
  changePct: number | null;
  pdh: number | null;
  pdl: number | null;
  onh: number | null;
  onl: number | null;
  rthOpen: number | null;
  /** RTH-anchored VWAP. Null before 09:30 ET. */
  vwap: number | null;
  /** Opening range (09:30–09:45 ET), once it has closed. */
  orh: number | null;
  orl: number | null;
  /** Average RTH high–low range over the prior sessions in the data. */
  adr: number | null;
  sessionDate: string;
  bias: Bias;
  reasons: string[];
  asOf: number;
}

export interface VixRead {
  level: number;
  changePct: number | null;
}

export type Impact = "high" | "med" | "low";

export interface MacroEvent {
  date: string;
  /** "HH:MM" New York time, or "" for all-day. */
  time: string;
  title: string;
  impact: Impact;
  forecast?: string;
  previous?: string;
}

/** Root symbol → a continuous contract we can quote for free. */
const QUOTE_SOURCE: Record<string, { source: string; name: string }> = {
  NQ: { source: "NQ=F", name: "Nasdaq 100 futures" },
  MNQ: { source: "NQ=F", name: "Nasdaq 100 futures" },
  ES: { source: "ES=F", name: "S&P 500 futures" },
  MES: { source: "ES=F", name: "S&P 500 futures" },
  YM: { source: "YM=F", name: "Dow futures" },
  MYM: { source: "YM=F", name: "Dow futures" },
  RTY: { source: "RTY=F", name: "Russell 2000 futures" },
  M2K: { source: "RTY=F", name: "Russell 2000 futures" },
  CL: { source: "CL=F", name: "Crude oil futures" },
  MCL: { source: "CL=F", name: "Crude oil futures" },
  GC: { source: "GC=F", name: "Gold futures" },
  MGC: { source: "GC=F", name: "Gold futures" },
  SPY: { source: "SPY", name: "SPDR S&P 500 ETF" },
  QQQ: { source: "QQQ", name: "Invesco QQQ" },
};

/**
 * "MNQZ5", "MNQ 12-25", "/MNQ", "CME_MINI:MNQ1!" → "MNQ". Unknown symbols come
 * back upper-cased and trimmed so the caller can still show them.
 */
export function rootSymbol(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/^.*:/, "").replace(/^\//, "");
  const known = Object.keys(QUOTE_SOURCE).sort((a, b) => b.length - a.length);
  for (const k of known) {
    if (s === k || s.startsWith(`${k} `) || s.startsWith(`${k}1!`)) return k;
    // Month code + 1–2 digit year: MNQZ5, MNQZ25.
    if (new RegExp(`^${k}[FGHJKMNQUVXZ]\\d{1,2}$`).test(s)) return k;
  }
  return s.split(/[\s!]/)[0];
}

export function quoteSource(root: string) {
  return QUOTE_SOURCE[root] ?? null;
}

/** The symbols a trader actually trades, most-traded first, quotable only. */
export function tradedRoots(symbols: string[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const s of symbols) {
    const root = rootSymbol(s);
    if (!quoteSource(root)) continue;
    counts.set(root, (counts.get(root) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
  // Two roots that price from the same contract are one market read.
  const seen = new Set<string>();
  return ranked
    .filter((r) => {
      const src = quoteSource(r)!.source;
      if (seen.has(src)) return false;
      seen.add(src);
      return true;
    })
    .slice(0, limit);
}

const NY = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

/** New York calendar date, minute of day and weekday (0 = Sunday) for a timestamp in ms. */
export function nyClock(ms: number) {
  const parts = Object.fromEntries(
    NY.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.weekday,
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
    weekday,
  };
}

export const RTH_OPEN = 9 * 60 + 30;
export const RTH_CLOSE = 16 * 60;
const GLOBEX_OPEN = 18 * 60;

function nextDate(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The futures session a bar belongs to: bars from 18:00 ET roll into the next day. */
export function sessionOf(tSeconds: number) {
  const { date, minute } = nyClock(tSeconds * 1000);
  return { session: minute >= GLOBEX_OPEN ? nextDate(date) : date, date, minute };
}

const round = (n: number) => Math.round(n * 100) / 100;

export function readMarket(
  symbol: string,
  bars: Bar[],
  vix: VixRead | null = null,
  now = Date.now(),
): MarketRead | null {
  const clean = bars.filter(
    (b) => [b.o, b.h, b.l, b.c].every(Number.isFinite) && b.h >= b.l,
  );
  if (!clean.length) return null;
  const src = quoteSource(symbol);
  const tagged = clean.map((b) => ({ ...b, ...sessionOf(b.t) }));
  const last = tagged[tagged.length - 1];
  const session = last.session;
  const isRth = (b: (typeof tagged)[number]) =>
    b.minute >= RTH_OPEN && b.minute < RTH_CLOSE;

  // Prior RTH: the most recent calendar date before this session with RTH bars.
  const priorDates = [
    ...new Set(tagged.filter((b) => isRth(b) && b.date < session).map((b) => b.date)),
  ].sort();
  const priorDate = priorDates[priorDates.length - 1];
  const prior = tagged.filter((b) => b.date === priorDate && isRth(b));

  const todayRth = tagged.filter((b) => b.date === session && isRth(b));
  // Overnight: this session's bars before the 09:30 open.
  const overnight = tagged.filter(
    (b) => b.session === session && !(b.date === session && b.minute >= RTH_OPEN),
  );

  let pv = 0;
  let vol = 0;
  for (const b of todayRth) {
    pv += ((b.h + b.l + b.c) / 3) * b.v;
    vol += b.v;
  }

  const openingRange = todayRth.filter((b) => b.minute < RTH_OPEN + 15);
  const orDone = todayRth.some((b) => b.minute >= RTH_OPEN + 15);
  const ranges = priorDates.map((d) => {
    const xs = tagged.filter((b) => b.date === d && isRth(b));
    return Math.max(...xs.map((b) => b.h)) - Math.min(...xs.map((b) => b.l));
  });

  const hi = (xs: typeof tagged) => (xs.length ? Math.max(...xs.map((b) => b.h)) : null);
  const lo = (xs: typeof tagged) => (xs.length ? Math.min(...xs.map((b) => b.l)) : null);
  const price = last.c;
  const prevClose = prior.length ? prior[prior.length - 1].c : null;
  const read: MarketRead = {
    symbol,
    source: src?.source ?? symbol,
    name: src?.name ?? symbol,
    price: round(price),
    prevClose,
    changePct: prevClose ? round(((price - prevClose) / prevClose) * 100) : null,
    pdh: hi(prior),
    pdl: lo(prior),
    onh: hi(overnight),
    onl: lo(overnight),
    rthOpen: todayRth.length ? todayRth[0].o : null,
    vwap: vol > 0 ? round(pv / vol) : null,
    orh: orDone ? hi(openingRange) : null,
    orl: orDone ? lo(openingRange) : null,
    adr: ranges.length ? round(ranges.reduce((a, b) => a + b, 0) / ranges.length) : null,
    sessionDate: session,
    bias: "balanced",
    reasons: [],
    asOf: Math.min(now, last.t * 1000),
  };
  const { bias, reasons } = biasFor(read, vix);
  read.bias = bias;
  read.reasons = reasons;
  return read;
}

/**
 * A transparent lean, not a forecast: each input adds or subtracts a point and
 * says why, so the trader can disagree with a specific reason.
 */
export function biasFor(
  m: Pick<MarketRead, "price" | "prevClose" | "pdh" | "pdl" | "onh" | "onl" | "vwap">,
  vix: VixRead | null,
): { bias: Bias; score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (m.prevClose != null) {
    const up = m.price >= m.prevClose;
    score += up ? 1 : -1;
    reasons.push(`${up ? "Above" : "Below"} prior close ${fmt(m.prevClose)}`);
  }
  if (m.pdh != null && m.price > m.pdh) {
    score += 1;
    reasons.push(`Trading above prior-day high ${fmt(m.pdh)}`);
  } else if (m.pdl != null && m.price < m.pdl) {
    score -= 1;
    reasons.push(`Trading below prior-day low ${fmt(m.pdl)}`);
  } else if (m.pdh != null && m.pdl != null) {
    reasons.push("Inside yesterday's range");
  }
  if (m.onh != null && m.onl != null && m.onh > m.onl) {
    const pos = (m.price - m.onl) / (m.onh - m.onl);
    if (pos >= 0.66) {
      score += 1;
      reasons.push("Holding the top third of the overnight range");
    } else if (pos <= 0.33) {
      score -= 1;
      reasons.push("Sitting in the bottom third of the overnight range");
    }
  }
  if (m.vwap != null) {
    const up = m.price >= m.vwap;
    score += up ? 1 : -1;
    reasons.push(`${up ? "Above" : "Below"} RTH VWAP ${fmt(m.vwap)}`);
  }
  if (vix?.changePct != null && Math.abs(vix.changePct) >= 5) {
    score += vix.changePct > 0 ? -1 : 1;
    reasons.push(
      `VIX ${vix.changePct > 0 ? "up" : "down"} ${Math.abs(vix.changePct).toFixed(1)}% (${vix.changePct > 0 ? "risk-off" : "risk-on"})`,
    );
  }
  return {
    bias: score >= 2 ? "bullish" : score <= -2 ? "bearish" : "balanced",
    score,
    reasons,
  };
}

// ─── Economic calendar ─────────────────────────────────────────────────────────

/** FOMC decision days (second day of each meeting), 14:00 ET. */
const FOMC_DECISIONS = new Set([
  "2026-01-28",
  "2026-03-18",
  "2026-04-29",
  "2026-06-17",
  "2026-07-29",
  "2026-09-16",
  "2026-10-28",
  "2026-12-09",
]);

/**
 * The US releases that land on a predictable weekday. Used when a live calendar
 * is unreachable — it will miss CPI, PPI and GDP, which move around, and the
 * UI says so.
 */
export function scheduledEvents(date: string): MacroEvent[] {
  const d = new Date(`${date}T12:00:00Z`);
  const weekday = d.getUTCDay();
  const events: MacroEvent[] = [];
  if (weekday === 5 && d.getUTCDate() <= 7)
    events.push({ date, time: "08:30", title: "Nonfarm Payrolls (usual slot)", impact: "high" });
  if (weekday === 4)
    events.push({ date, time: "08:30", title: "Initial Jobless Claims", impact: "med" });
  if (FOMC_DECISIONS.has(date)) {
    events.push({ date, time: "14:00", title: "FOMC rate decision", impact: "high" });
    events.push({ date, time: "14:30", title: "FOMC press conference", impact: "high" });
  }
  return events;
}

interface CalendarRow {
  title?: unknown;
  country?: unknown;
  date?: unknown;
  impact?: unknown;
  forecast?: unknown;
  previous?: unknown;
}

/** A weekly calendar feed (Forex Factory JSON shape) → today's US events. */
export function calendarEvents(rows: unknown, date: string): MacroEvent[] {
  if (!Array.isArray(rows)) return [];
  const impactOf: Record<string, Impact> = { High: "high", Medium: "med", Low: "low" };
  return (rows as CalendarRow[])
    .filter((r) => r?.country === "USD" && typeof r.date === "string" && typeof r.title === "string")
    .map((r): MacroEvent | null => {
      const ms = Date.parse(r.date as string);
      if (!Number.isFinite(ms)) return null;
      const clock = nyClock(ms);
      const impact = impactOf[String(r.impact)];
      if (!impact || clock.date !== date) return null;
      const hh = String(Math.floor(clock.minute / 60)).padStart(2, "0");
      const mm = String(clock.minute % 60).padStart(2, "0");
      return {
        date,
        time: `${hh}:${mm}`,
        title: String(r.title),
        impact,
        forecast: typeof r.forecast === "string" && r.forecast ? r.forecast : undefined,
        previous: typeof r.previous === "string" && r.previous ? r.previous : undefined,
      };
    })
    .filter((e): e is MacroEvent => !!e && e.impact !== "low")
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function hhmmToMinute(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
