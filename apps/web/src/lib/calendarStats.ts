// ─── Calendar page · the numbers ───────────────────────────────────────────────
// Everything the Calendar page shows, worked out from the trades. Dates stay plain
// YYYY-MM-DD strings throughout: `new Date("2026-06-01")` is May 31 anywhere west
// of London, which would put the first of each month in the wrong month.
// Patterns come with their sample sizes, and small samples say so.
// ───────────────────────────────────────────────────────────────────────────────

import { ECON_CALENDAR } from "@/lib/vision/econ-calendar";
import { nyClock, scheduledEvents } from "@/lib/pilot/market";

export interface CalTrade {
  date: string;
  netPL: number;
  outcome?: "win" | "loss";
  time?: string;
  symbol?: string;
  side?: string;
}

export interface CalDay {
  date: string;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  bestTrade: number;
  worstTrade: number;
  /** Running P&L after each trade, starting from zero. */
  path: number[];
  symbols: string[];
}

export const dayOf = (s: string) => s.slice(0, 10);
export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`;
/** Sunday is 0. Worked out at noon UTC, so it's the same day in every time zone. */
export const weekdayOf = (date: string) => new Date(`${dayOf(date)}T12:00:00Z`).getUTCDay();
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const addDays = (date: string, n: number) => new Date(Date.parse(`${dayOf(date)}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const isWin = (t: CalTrade) => (t.outcome ? t.outcome === "win" : t.netPL > 0);

/** Minutes after midnight from "9:27 AM" or "14:05". */
export function minuteOf(time?: string) {
  const m = time?.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h < 24 ? h * 60 + Number(m[2]) : null;
}

/** Trades in time order within each day, grouped into days in date order. */
export function buildDays(trades: CalTrade[]): CalDay[] {
  const by = new Map<string, CalTrade[]>();
  for (const t of trades) {
    const d = dayOf(t.date);
    by.set(d, [...(by.get(d) ?? []), t]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const ts = [...list].sort((a, b) => (minuteOf(a.time) ?? 0) - (minuteOf(b.time) ?? 0));
      const path = [0];
      for (const t of ts) path.push(path[path.length - 1] + t.netPL);
      return { date, pnl: path[path.length - 1], trades: ts.length, wins: ts.filter(isWin).length, losses: ts.filter((t) => !isWin(t)).length, bestTrade: Math.max(...ts.map((t) => t.netPL)), worstTrade: Math.min(...ts.map((t) => t.netPL)), path, symbols: [...new Set(ts.map((t) => t.symbol ?? "").filter(Boolean))] };
    });
}

export interface PeriodSummary {
  pnl: number;
  days: number;
  green: number;
  red: number;
  trades: number;
  wins: number;
  winRate: number;
  profitFactor: number | null;
  avgGreen: number;
  avgRed: number;
  best: CalDay | null;
  worst: CalDay | null;
  /** Longest runs of green and red days inside the period. */
  longestGreen: number;
  longestRed: number;
}

export function summarize(days: CalDay[]): PeriodSummary {
  const green = days.filter((d) => d.pnl > 0);
  const red = days.filter((d) => d.pnl < 0);
  const gross = green.reduce((a, d) => a + d.pnl, 0);
  const lost = -red.reduce((a, d) => a + d.pnl, 0);
  const trades = days.reduce((a, d) => a + d.trades, 0);
  const wins = days.reduce((a, d) => a + d.wins, 0);
  let g = 0;
  let r = 0;
  let longestGreen = 0;
  let longestRed = 0;
  for (const d of days) {
    g = d.pnl > 0 ? g + 1 : 0;
    r = d.pnl < 0 ? r + 1 : 0;
    longestGreen = Math.max(longestGreen, g);
    longestRed = Math.max(longestRed, r);
  }
  const by = (f: (a: number, b: number) => boolean) => days.reduce<CalDay | null>((m, d) => (!m || f(d.pnl, m.pnl) ? d : m), null);
  return { pnl: gross - lost, days: days.length, green: green.length, red: red.length, trades, wins, winRate: trades ? wins / trades : 0, profitFactor: lost ? gross / lost : null, avgGreen: green.length ? gross / green.length : 0, avgRed: red.length ? -lost / red.length : 0, best: by((a, b) => a > b), worst: by((a, b) => a < b), longestGreen, longestRed };
}

export const inMonth = (days: CalDay[], y: number, m: number) => days.filter((d) => d.date.startsWith(monthKey(y, m)));

/** The latest day's run of the same color. */
export function currentStreak(days: CalDay[]) {
  let n = 0;
  const last = days[days.length - 1];
  if (!last || last.pnl === 0) return { kind: "none" as const, n: 0 };
  const up = last.pnl > 0;
  for (let i = days.length - 1; i >= 0 && days[i].pnl > 0 === up && days[i].pnl !== 0; i--) n++;
  return { kind: up ? ("green" as const) : ("red" as const), n };
}

// ── What's on the calendar ─────────────────────────────────────────────────────

export type NewsKind = "cpi" | "jobs" | "fomc";
export const NEWS_LABEL: Record<NewsKind, string> = { cpi: "CPI", jobs: "Jobs report", fomc: "FOMC" };

const CPI = new Set(ECON_CALENDAR.cpi);
const JOBS = new Set(ECON_CALENDAR.jobs);

/** Scheduled news on a date. `fomc` adds past decision dates from the data library. */
export function newsOn(date: string, fomc?: Set<string>): NewsKind[] {
  const out: NewsKind[] = [];
  if (CPI.has(date)) out.push("cpi");
  const sched = scheduledEvents(date);
  // Past jobs reports are known exactly; future ones use the usual first Friday.
  if (JOBS.has(date) || (date > ECON_CALENDAR.jobs[ECON_CALENDAR.jobs.length - 1] && sched.some((e) => /Payrolls/.test(e.title)))) out.push("jobs");
  if (fomc?.has(date) || sched.some((e) => /FOMC/.test(e.title))) out.push("fomc");
  return out;
}

/** When each release lands, in New York minutes of the day. */
export const NEWS_MINUTE: Record<NewsKind, number> = { cpi: 8 * 60 + 30, jobs: 8 * 60 + 30, fomc: 14 * 60 };

/** A New York time on a date, shown in the trader's own time zone. New York is always behind UTC, so one step finds it. */
export function localTimeOf(date: string, nyMinute: number, timeZone?: string) {
  const guess = Date.parse(`${dayOf(date)}T00:00:00Z`) + nyMinute * 60_000;
  const behind = (nyMinute - nyClock(guess).minute + 1440) % 1440;
  return new Date(guess + behind * 60_000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone }).replace(/\s?AM$/, " am").replace(/\s?PM$/, " pm");
}

export interface Upcoming {
  date: string;
  title: string;
  detail: string;
  kind: NewsKind | "payout";
}

const NEWS_DETAIL: Record<NewsKind, string> = { cpi: "8:30 am New York", jobs: "8:30 am New York, usual date", fomc: "2:00 pm New York" };

export function upcoming(today: string, o: { days?: number; fomc?: Set<string>; payout?: { date: string; amount: number } | null } = {}): Upcoming[] {
  const out: Upcoming[] = [];
  for (let i = 0; i <= (o.days ?? 30); i++) {
    const date = addDays(today, i);
    for (const k of newsOn(date, o.fomc)) out.push({ date, title: NEWS_LABEL[k], detail: NEWS_DETAIL[k], kind: k });
    if (o.payout?.date === date) out.push({ date, title: "Payout eligible", detail: o.payout.amount > 0 ? `About $${Math.round(o.payout.amount).toLocaleString("en-US")} to you, if every day until then qualifies` : "If every day until then qualifies", kind: "payout" });
  }
  return out;
}

// ── Patterns ───────────────────────────────────────────────────────────────────

export interface Bucket {
  key: string;
  label: string;
  days: number;
  pnl: number;
  avg: number;
  green: number;
}

export interface Patterns {
  weekday: Bucket[];
  tradeCount: Bucket[];
  afterDay: Bucket[];
  news: Bucket[];
  hour: Bucket[];
  /** Plain findings from those, only where the sample is big enough. */
  findings: { tone: "good" | "bad"; text: string }[];
}

const bucket = (key: string, label: string, days: { pnl: number }[]): Bucket => {
  const pnl = days.reduce((a, d) => a + d.pnl, 0);
  return { key, label, days: days.length, pnl, avg: days.length ? pnl / days.length : 0, green: days.filter((d) => d.pnl > 0).length };
};

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const hourName = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
export const MIN_SAMPLE = 8;

export function patterns(days: CalDay[], trades: CalTrade[], fomc?: Set<string>): Patterns {
  const weekday = [1, 2, 3, 4, 5].map((d) => bucket(String(d), ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d], days.filter((x) => weekdayOf(x.date) === d)));
  const tradeCount = [bucket("1", "1 trade", days.filter((d) => d.trades === 1)), bucket("2-3", "2 to 3", days.filter((d) => d.trades >= 2 && d.trades <= 3)), bucket("4-6", "4 to 6", days.filter((d) => d.trades >= 4 && d.trades <= 6)), bucket("7+", "7 or more", days.filter((d) => d.trades >= 7))];
  const afterGreen = days.filter((_, i) => i > 0 && days[i - 1].pnl > 0);
  const afterRed = days.filter((_, i) => i > 0 && days[i - 1].pnl < 0);
  const afterBig = days.filter((_, i) => {
    if (!i) return false;
    const reds = days.filter((d) => d.pnl < 0).map((d) => d.pnl).sort((a, b) => a - b);
    return reds.length >= 4 && days[i - 1].pnl <= reds[Math.floor(reds.length / 4)];
  });
  const afterDay = [bucket("green", "After a green day", afterGreen), bucket("red", "After a red day", afterRed), bucket("big", "After a big loss", afterBig)];
  const isNews = (d: CalDay) => newsOn(d.date, fomc).length > 0;
  const news = [...(["cpi", "jobs", "fomc"] as NewsKind[]).map((k) => bucket(k, `${NEWS_LABEL[k]} days`, days.filter((d) => newsOn(d.date, fomc).includes(k)))), bucket("none", "No big news", days.filter((d) => !isNews(d)))];

  const hours = new Map<number, { pnl: number }[]>();
  for (const t of trades) {
    const m = minuteOf(t.time);
    if (m == null) continue;
    const h = Math.floor(m / 60);
    hours.set(h, [...(hours.get(h) ?? []), { pnl: t.netPL }]);
  }
  const hour = [...hours.entries()].sort(([a], [b]) => a - b).map(([h, xs]) => bucket(String(h), hourName(h), xs));

  const findings: Patterns["findings"] = [];
  const enough = (b: Bucket) => b.days >= MIN_SAMPLE;
  const worstDay = weekday.filter(enough).sort((a, b) => a.pnl - b.pnl)[0];
  const bestDay = weekday.filter(enough).sort((a, b) => b.pnl - a.pnl)[0];
  if (worstDay && worstDay.pnl < 0) findings.push({ tone: "bad", text: `${worstDay.label}s cost you ${usd(worstDay.pnl)} over ${worstDay.days} days.` });
  if (bestDay && bestDay.pnl > 0 && weekday.filter(enough).length > 1) findings.push({ tone: "good", text: `${bestDay.label}s are your best day: +${usd(bestDay.pnl)} over ${bestDay.days} days.` });
  const a = afterDay[1];
  const overall = days.length ? days.reduce((s, d) => s + d.pnl, 0) / days.length : 0;
  if (enough(a) && a.avg < overall && a.avg < 0) findings.push({ tone: "bad", text: `The day after a red day averages -${usd(a.avg)}, against ${overall >= 0 ? "+" : "-"}${usd(overall)} overall. Red days may be following you into the next session.` });
  else if (enough(a) && a.avg > 0) findings.push({ tone: "good", text: `You bounce back: the day after a red day averages +${usd(a.avg)}.` });
  const busy = tradeCount.slice(2).filter(enough).sort((x, y) => x.avg - y.avg)[0];
  const calm = tradeCount.slice(0, 2).filter(enough).sort((x, y) => y.avg - x.avg)[0];
  if (busy && calm && busy.avg < calm.avg && busy.avg < 0) findings.push({ tone: "bad", text: `Busy days hurt: ${busy.label.toLowerCase()} trades averages -${usd(busy.avg)} a day, and ${calm.label.toLowerCase()} ${calm.key === "1" ? "" : "trades "}averages ${calm.avg >= 0 ? "+" : "-"}${usd(calm.avg)}.` });
  const worstNews = news.slice(0, 3).filter(enough).sort((x, y) => x.avg - y.avg)[0];
  if (worstNews && worstNews.avg < 0 && worstNews.avg < news[3].avg) findings.push({ tone: "bad", text: `${worstNews.label} average -${usd(worstNews.avg)} over ${worstNews.days} days. Consider sitting those out.` });
  const worstHour = hour.filter(enough).sort((x, y) => x.pnl - y.pnl)[0];
  if (worstHour && worstHour.pnl < 0) findings.push({ tone: "bad", text: `Trades in the ${worstHour.label} hour lost ${usd(worstHour.pnl)} over ${worstHour.days} trades.` });
  return { weekday, tradeCount, afterDay, news, hour, findings };
}

/** Losing days with no note yet, biggest first: the reviews worth the most. */
export function toReview(days: CalDay[], hasNote: (date: string) => boolean, n = 5) {
  return days.filter((d) => d.pnl < 0 && !hasNote(d.date)).sort((a, b) => a.pnl - b.pnl).slice(0, n);
}

/** Weekdays in a month from `from` to its end, for pacing toward a goal. */
export function weekdaysLeft(y: number, m: number, from: string) {
  let n = 0;
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const date = ymd(y, m, d);
    const w = weekdayOf(date);
    if (date >= from && w > 0 && w < 6) n++;
  }
  return n;
}

export interface Pace {
  goal: number;
  made: number;
  left: number;
  daysLeft: number;
  /** Needed a day to get there. */
  perDay: number | null;
  /** Share of the goal reached. */
  share: number;
  /** Where the month ends if each weekday left averages what traded days have. */
  projected: number | null;
}

export function pace(goal: number, month: CalDay[], y: number, m: number, today: string): Pace {
  const made = month.reduce((a, d) => a + d.pnl, 0);
  const daysLeft = weekdaysLeft(y, m, today);
  const left = goal - made;
  return { goal, made, left, daysLeft, perDay: left > 0 && daysLeft ? left / daysLeft : null, share: goal ? Math.max(0, made / goal) : 0, projected: month.length >= 3 ? made + (made / month.length) * daysLeft : null };
}

export function monthCsv(days: CalDay[]) {
  return ["date,weekday,pnl,trades,wins,losses,best_trade,worst_trade,symbols", ...days.map((d) => [d.date, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekdayOf(d.date)], d.pnl.toFixed(2), d.trades, d.wins, d.losses, d.bestTrade.toFixed(2), d.worstTrade.toFixed(2), d.symbols.join(" ")].join(","))].join("\n");
}
