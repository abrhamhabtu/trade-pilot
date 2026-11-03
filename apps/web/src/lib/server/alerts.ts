// Sending alerts: phone calls and texts through the trader's own Twilio account,
// Telegram and Discord through notify.ts. Also the two things that create alerts
// by themselves: a watcher that reads the market, and a morning wake-up call.
// Credentials stay in alerts.json on this machine, readable by its owner only.

import { randomBytes, timingSafeEqual } from "crypto";
import { SYMBOLS, TF_SECONDS, isSymbol } from "@/lib/vision/markets";
import { DEFAULT_RULES, DEFAULT_WAKE, DEFAULT_WATCH, SETUP_LABEL, alertText, callScript, localClock, routeAlert, scanLatest, xmlEscape, type AlertEvent, type AlertRule, type Channel, type WakeUp, type Watch } from "@/lib/vision/alerts";
import { ECON_CALENDAR } from "@/lib/vision/econ-calendar";
import { nyClock } from "@/lib/pilot/market";
import { yahooBars } from "@/lib/pilot/yahoo";
import { getContext } from "./library";
import { getNotify, notify } from "./notify";
import { appendLine, readJson, tailLines, updateJson } from "./store";

export interface AlertSettings {
  webhookKey: string;
  publicUrl: string;
  tz: string;
  twilio: { sid: string; token: string; from: string; to: string };
  rules: AlertRule[];
  watch: Watch;
  wake: WakeUp;
}

export interface AlertLog {
  at: number;
  source: string;
  title: string;
  text: string;
  sent: string[];
  errors: string[];
  skipped: { rule: string; why: string }[];
}

const FILE = "alerts.json";
const LOG = "alerts-log.jsonl";
const SEEN = "alerts-seen.json";
const newKey = () => randomBytes(24).toString("base64url");

const DEFAULTS = (): AlertSettings => ({ webhookKey: "", publicUrl: "", tz: "America/Los_Angeles", twilio: { sid: "", token: "", from: "", to: "" }, rules: DEFAULT_RULES, watch: DEFAULT_WATCH, wake: DEFAULT_WAKE });
const normalise = (s: Partial<AlertSettings>): AlertSettings => ({ ...DEFAULTS(), ...s, twilio: { ...DEFAULTS().twilio, ...s.twilio }, watch: { ...DEFAULT_WATCH, ...s.watch }, wake: { ...DEFAULT_WAKE, ...s.wake } });

export async function getAlertSettings(): Promise<AlertSettings> {
  const s = normalise(await readJson<Partial<AlertSettings>>(FILE, {}));
  if (s.webhookKey) return s;
  return saveAlertSettings((x) => {
    x.webhookKey = newKey();
  });
}

export const saveAlertSettings = (change: (s: AlertSettings) => void) =>
  updateJson<AlertSettings>(
    FILE,
    DEFAULTS(),
    (raw) => {
      const s = normalise(raw);
      change(s);
      return s;
    },
    { secret: true },
  );

/** What a browser may see: never the auth token. */
export function publicAlerts(s: AlertSettings) {
  return { webhookKey: s.webhookKey, publicUrl: s.publicUrl, tz: s.tz, twilio: { configured: !!(s.twilio.sid && s.twilio.token), sid: s.twilio.sid ? `${s.twilio.sid.slice(0, 6)}…` : "", from: s.twilio.from, to: s.twilio.to }, rules: s.rules, watch: s.watch, wake: s.wake };
}

export const keyMatches = (given: string, real: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(real);
  return !!real && a.length === b.length && timingSafeEqual(a, b);
};

async function twilio(t: AlertSettings["twilio"], path: "Messages" | "Calls", form: Record<string, string>) {
  if (!t.sid || !t.token || !t.from || !t.to) throw new Error("Phone isn't set up yet.");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${t.sid}/${path}.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${t.sid}:${t.token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: t.from, To: t.to, ...form }).toString(),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => ({}))) as { message?: string; sid?: string };
  if (!res.ok) throw new Error(`Twilio: ${j.message ?? `request failed (${res.status})`}`);
  return j.sid ?? "";
}

export const sendText = (t: AlertSettings["twilio"], body: string) => twilio(t, "Messages", { Body: body.slice(0, 480) });
export const placeCall = (t: AlertSettings["twilio"], twiml: string) => twilio(t, "Calls", { Twiml: twiml, Timeout: "30" });

async function toChannels(channels: Channel[], e: AlertEvent, s: AlertSettings, spoken?: string) {
  const sent: string[] = [];
  const errors: string[] = [];
  const text = alertText(e);
  for (const c of channels) {
    try {
      if (c === "sms") {
        await sendText(s.twilio, text);
        sent.push(c);
      } else if (c === "call") {
        await placeCall(s.twilio, spoken ?? callScript(e));
        sent.push(c);
      } else {
        const n = await getNotify();
        const on = c === "telegram" ? n.telegram.enabled && !!n.telegram.token : n.discord.enabled && !!n.discord.webhook;
        if (!on) continue;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `${c} failed`);
    }
  }
  if (channels.includes("telegram") || channels.includes("discord")) {
    const out = await sendChat(channels, text);
    sent.push(...out.sent);
    errors.push(...out.errors);
  }
  return { sent, errors };
}

/** Telegram and Discord honour their own on-off switches; only the ones this alert asked for are used. */
async function sendChat(channels: Channel[], text: string) {
  const n = await getNotify();
  const both = channels.includes("telegram") && channels.includes("discord");
  if (both) return notify(null, text);
  const only = channels.includes("telegram") ? "telegram" : "discord";
  const out = await notify(null, text);
  return { sent: out.sent.filter((x) => x === only), errors: out.errors.filter((x) => x.toLowerCase().startsWith(only)), n };
}

/** One alert through the rules and out to the phone. */
export async function dispatch(e: AlertEvent, o: { now?: number; dryRun?: boolean } = {}) {
  const now = o.now ?? Date.now();
  const s = await getAlertSettings();
  const last = await readJson<Record<string, number>>(SEEN, {});
  const route = routeAlert(e, s.rules, { now, tz: s.tz, last });
  if (o.dryRun) return { ...route, sent: [] as string[], errors: [] as string[], text: alertText(e) };
  if (route.fired.length) await updateJson<Record<string, number>>(SEEN, {}, (x) => {
    for (const k of route.fired) x[k] = now;
    return x;
  });
  const { sent, errors } = route.channels.length ? await toChannels(route.channels, e, s) : { sent: [], errors: [] };
  await appendLine(LOG, { at: now, source: e.source, title: e.title, text: alertText(e), sent, errors, skipped: route.skipped } satisfies AlertLog);
  return { ...route, sent, errors, text: alertText(e) };
}

export const alertLog = (n = 80) => tailLines<AlertLog>(LOG, n);

export async function testPhone(kind: "sms" | "call") {
  const s = await getAlertSettings();
  if (kind === "sms") return sendText(s.twilio, "TradePilot is connected. Alerts will text you here.");
  return placeCall(s.twilio, `<Response><Say>${xmlEscape("Trade Pilot is connected. This is how an alert will call you. Goodbye.")}</Say></Response>`);
}

// ── Watching the market and waking the trader ──────────────────────────────────

const state: { started: boolean; lastTick: number; lastError: string; lastScan: number } = ((globalThis as Record<string, unknown>).__tpAlertState ??= { started: false, lastTick: 0, lastError: "", lastScan: 0 }) as never;
export const alertDaemon = state;

export async function watchTick(now = Date.now(), bars: (source: string, tf: string) => Promise<{ t: number; o: number; h: number; l: number; c: number; v: number }[]> = async (source, tf) => (await yahooBars(source, tf, tf === "5m" ? "10d" : "30d")).bars) {
  const s = await getAlertSettings();
  const w = s.watch;
  if (!w.enabled) return [];
  const ny = nyClock(now);
  if (ny.weekday < 1 || ny.weekday > 5 || ny.minute < w.hours[0] || ny.minute >= w.hours[1]) return [];
  state.lastScan = now;
  const out: AlertEvent[] = [];
  for (const symbol of w.symbols) {
    if (!isSymbol(symbol)) continue;
    const list = await bars(SYMBOLS[symbol].source, w.tf);
    for (const setup of w.setups) {
      const f = scanLatest(list, setup, TF_SECONDS[w.tf], now);
      if (!f) continue;
      const mark = `watch|${symbol}|${setup}|${f.t}`;
      const seen = await readJson<Record<string, number>>(SEEN, {});
      if (seen[mark]) continue;
      await updateJson<Record<string, number>>(SEEN, {}, (x) => {
        x[mark] = now;
        for (const k of Object.keys(x)) if (k.startsWith("watch|") && now - x[k] > 3 * 86_400_000) delete x[k];
        return x;
      });
      const e: AlertEvent = { source: "watcher", title: SETUP_LABEL[setup], symbol, side: f.side, price: f.price, stop: f.stop, target: f.target, tf: w.tf, message: "From the free feed, up to about 10 minutes late.", at: Math.floor(now / 1000) };
      await dispatch(e, { now });
      out.push(e);
    }
  }
  return out;
}

const WAKE_DONE = "alerts-wake.json";

/** What's on today, for the morning call. Dates come from the calendars in the app. */
export async function morningBrief(date: string) {
  const fomc = (await getContext()).fomc.includes(date);
  const items = [ECON_CALENDAR.cpi.includes(date) ? "C P I at 8:30 New York time" : "", ECON_CALENDAR.jobs.includes(date) ? "the jobs report at 8:30 New York time" : "", fomc ? "the Fed decision at 2 p.m. New York time" : ""].filter(Boolean);
  return items.length ? `Today has ${items.join(" and ")}.` : "No major scheduled news in the app's calendar today.";
}

export async function wakeTick(now = Date.now()) {
  const s = await getAlertSettings();
  const w = s.wake;
  if (!w.enabled) return false;
  const clock = localClock(now, s.tz);
  const [h, m] = w.time.split(":").map(Number);
  if (!w.weekdays.includes(clock.weekday) || clock.minute < h * 60 + m || clock.minute > h * 60 + m + 5) return false;
  const done = await readJson<{ date: string }>(WAKE_DONE, { date: "" });
  if (done.date === clock.date) return false;
  const ctx = await getContext();
  const nyDate = nyClock(now).date;
  await updateJson(WAKE_DONE, { date: "" }, () => ({ date: clock.date }));
  // Don't wake anyone for a closed market.
  if (ctx.holidays.equity.includes(nyDate)) return false;
  const brief = await morningBrief(nyDate);
  const e: AlertEvent = { source: "wake", title: "Good morning", symbol: "", side: "", price: null, stop: null, target: null, tf: "", message: brief, at: Math.floor(now / 1000) };
  const script = `<Response><Say>${xmlEscape(`Good morning. This is Trade Pilot. New York opens at 9:30 Eastern. ${brief}`)}</Say><Pause length="1"/><Say>${xmlEscape(brief)} Time to get to your charts.</Say></Response>`;
  const { sent, errors } = await toChannels(w.channels, e, s, script);
  await appendLine(LOG, { at: now, source: "wake", title: "Wake-up", text: brief, sent, errors, skipped: [] } satisfies AlertLog);
  return true;
}

export function startAlertDaemon() {
  if (state.started) return;
  state.started = true;
  const tick = async () => {
    try {
      await wakeTick();
      await watchTick();
      state.lastError = "";
    } catch (e) {
      state.lastError = e instanceof Error ? e.message : "The watcher failed.";
    }
    state.lastTick = Date.now();
    setTimeout(tick, 60_000);
  };
  setTimeout(tick, 15_000);
}
