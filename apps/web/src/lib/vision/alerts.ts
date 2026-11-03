// ─── Alerts ────────────────────────────────────────────────────────────────────
// What happens when a setup fires: which channels hear about it, when, and in
// what words. Pure rules, shared by the server, the screen and the tests. Alerts
// only ever tell you to look at the chart. Nothing here can place a trade.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import { sessionOf } from "@/lib/pilot/market";
import { _internal, type ReaderId } from "./analyze";

export type Channel = "telegram" | "discord" | "sms" | "call";
export const CHANNELS: Channel[] = ["call", "sms", "telegram", "discord"];

export interface AlertEvent {
  source: "tradingview" | "watcher" | "wake" | "test";
  /** What fired, in the trader's words: "Double-break VWAP". */
  title: string;
  symbol: string;
  side: "long" | "short" | "";
  price: number | null;
  stop: number | null;
  target: number | null;
  tf: string;
  message: string;
  /** Unix seconds. */
  at: number;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  /** Which alerts it covers: empty matches all. Case-insensitive, any word of the alert. */
  match: string;
  channels: Channel[];
  /** Local minutes of the day it may fire, or null for any time. */
  hours: [number, number] | null;
  weekdays: number[];
  /** Quiet time after it fires for the same market and side, in minutes. */
  cooldownMin: number;
}

export interface Watch {
  enabled: boolean;
  symbols: string[];
  setups: (ReaderId | "vwap_touch")[];
  tf: "5m" | "15m";
  /** New York minutes to watch. */
  hours: [number, number];
}

export interface WakeUp {
  enabled: boolean;
  /** Local time, "06:15". */
  time: string;
  weekdays: number[];
  channels: Channel[];
}

export const DEFAULT_RULES: AlertRule[] = [
  { id: "dbv-call", name: "Double-break VWAP: call me", enabled: true, match: "double break vwap dbvwap", channels: ["call", "telegram"], hours: [6 * 60, 13 * 60], weekdays: [1, 2, 3, 4, 5], cooldownMin: 30 },
  { id: "all-text", name: "Everything else: text me", enabled: true, match: "", channels: ["sms", "telegram", "discord"], hours: null, weekdays: [1, 2, 3, 4, 5], cooldownMin: 5 },
];
export const DEFAULT_WATCH: Watch = { enabled: false, symbols: ["NQ"], setups: ["dbvwap"], tf: "5m", hours: [9 * 60 + 30, 11 * 60 + 30] };
export const DEFAULT_WAKE: WakeUp = { enabled: false, time: "06:15", weekdays: [1, 2, 3, 4, 5], channels: ["call"] };

export const E164 = /^\+[1-9]\d{7,14}$/;
export const TWILIO_SID = /^AC[0-9a-fA-F]{32}$/;

const text = (v: unknown, max: number) => (typeof v === "string" || typeof v === "number" ? String(v) : "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Anything TradingView can send, JSON or plain words, as one event. Treated as untrusted text. */
export function parseWebhook(raw: string, now = Date.now()): AlertEvent {
  let j: Record<string, unknown> = {};
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && !Array.isArray(p)) j = p as Record<string, unknown>;
    else j = { message: String(p) };
  } catch {
    j = { message: raw };
  }
  const rawSide = text(j.side ?? j.action ?? j.direction, 12).toLowerCase();
  const message = text(j.message ?? j.text ?? j.comment, 300);
  const side = /^(long|buy|bull)/.test(rawSide) ? "long" : /^(short|sell|bear)/.test(rawSide) ? "short" : "";
  const title = text(j.name ?? j.setup ?? j.alert ?? j.title, 80).replace(/[-_]+/g, " ") || message.slice(0, 80) || "TradingView alert";
  return { source: "tradingview", title, symbol: text(j.symbol ?? j.ticker, 20).toUpperCase(), side, price: num(j.price ?? j.close), stop: num(j.stop), target: num(j.target), tf: text(j.tf ?? j.interval, 8), message, at: Math.floor(now / 1000) };
}

const localParts = (ms: number, tz: string) => {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "numeric", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), minute: (Number(p.hour) % 24) * 60 + Number(p.minute), date: `${p.year}-${p.month}-${p.day}` };
};
export const localClock = localParts;

const inHours = (m: number, h: [number, number]) => (h[0] <= h[1] ? m >= h[0] && m < h[1] : m >= h[0] || m < h[1]);

/** The rules an alert triggers right now, leaving out any still cooling down. */
export function routeAlert(e: AlertEvent, rules: AlertRule[], o: { now: number; tz: string; last: Record<string, number> }) {
  const clock = localParts(o.now, o.tz);
  const hay = `${e.title} ${e.message}`.toLowerCase();
  const channels = new Set<Channel>();
  const fired: string[] = [];
  const skipped: { rule: string; why: string }[] = [];
  let specific = false;
  for (const r of rules) {
    if (!r.enabled) continue;
    const words = r.match.toLowerCase().split(/[\s,]+/).filter(Boolean);
    const isSpecific = words.length > 0;
    if (isSpecific && !words.some((w) => hay.includes(w))) continue;
    // A catch-all only covers what no named rule already handled.
    if (!isSpecific && specific) continue;
    if (!r.weekdays.includes(clock.weekday)) {
      skipped.push({ rule: r.name, why: "not one of its days" });
      continue;
    }
    if (r.hours && !inHours(clock.minute, r.hours)) {
      skipped.push({ rule: r.name, why: "outside its hours" });
      continue;
    }
    const key = `${r.id}|${e.symbol}|${e.side}`;
    if (o.now - (o.last[key] ?? 0) < r.cooldownMin * 60_000) {
      skipped.push({ rule: r.name, why: "cooling down" });
      continue;
    }
    if (isSpecific) specific = true;
    fired.push(key);
    for (const c of r.channels) channels.add(c);
  }
  return { channels: [...channels], fired, skipped };
}

/** The words for a text or chat message. */
export function alertText(e: AlertEvent) {
  const head = [e.symbol, e.side ? e.side.toUpperCase() : "", e.title].filter(Boolean).join(" ");
  const plan = [e.price != null ? `at ${e.price}` : "", e.stop != null ? `stop ${e.stop}` : "", e.target != null ? `target ${e.target}` : "", e.tf ? `(${e.tf})` : ""].filter(Boolean).join(", ");
  const note = e.message && e.message !== e.title ? ` ${e.message}` : "";
  return `${head}${plan ? ` ${plan}` : ""}.${note} Check your chart.`;
}

const say = (s: string) => s.replace(/\bNQ\b/g, "N Q").replace(/\bES\b/g, "E S").replace(/\bGC\b/g, "gold").replace(/\bMNQ\b/g, "micro N Q").replace(/\bVWAP\b/gi, "V-WAP").replace(/\bDBVWAP\b/gi, "double break V-WAP");
export const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** What a phone call says: the alert, then again, so a half-asleep trader catches it. */
export function callScript(e: AlertEvent) {
  const line = xmlEscape(say(`${e.symbol ? `${e.symbol}. ` : ""}${e.side ? `${e.side}. ` : ""}${e.title}.${e.price != null ? ` Price ${e.price}.` : ""}`));
  return `<Response><Say>Trade Pilot alert. ${line}</Say><Pause length="1"/><Say>${line} Go look at your charts.</Say></Response>`;
}

// ── Reading the market on the server ───────────────────────────────────────────

export const SETUP_LABEL: Record<Watch["setups"][number], string> = { dbvwap: "Double-break VWAP", sd: "Supply & demand", sweep: "Liquidity sweep", orb: "Opening range breakout", vwappb: "VWAP trend pullback", vwap_touch: "VWAP touched" };

/** Whether a setup fired on the last closed bar, using the same readers as the Vision chart. */
export function scanLatest(bars: Bar[], setup: Watch["setups"][number], tfSeconds: number, now: number) {
  let i = bars.length - 1;
  while (i >= 0 && bars[i].t + tfSeconds > now / 1000) i--;
  if (i < 30) return null;
  const ctx = _internal.context(bars.slice(0, i + 1), "rth");
  if (setup === "vwap_touch") {
    const v = ctx.vwap[i];
    const touches = (k: number) => Number.isFinite(ctx.vwap[k]) && bars[k].l <= ctx.vwap[k] && bars[k].h >= ctx.vwap[k];
    if (!Number.isFinite(v) || !touches(i) || touches(i - 1)) return null;
    return { t: bars[i].t, side: "" as const, price: bars[i].c, stop: null, target: null, session: sessionOf(bars[i].t).session };
  }
  const f = _internal.detectAt(ctx, i, [setup]);
  return f ? { t: bars[i].t, side: f.side, price: f.entry, stop: f.stop, target: f.target, session: sessionOf(bars[i].t).session } : null;
}
