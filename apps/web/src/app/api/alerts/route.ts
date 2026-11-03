import { alertDaemon, alertLog, dispatch, getAlertSettings, publicAlerts, saveAlertSettings, testPhone } from "@/lib/server/alerts";
import { localOnly, noStore } from "@/lib/server/guard";
import { E164, TWILIO_SID, type AlertRule, type WakeUp, type Watch } from "@/lib/vision/alerts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  return noStore({ settings: publicAlerts(await getAlertSettings()), log: (await alertLog()).reverse(), daemon: alertDaemon });
}

export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (b.action === "phone") {
      const sid = String(b.sid ?? "").trim();
      const token = String(b.token ?? "").trim();
      const from = String(b.from ?? "").replace(/[\s()-]/g, "");
      const to = String(b.to ?? "").replace(/[\s()-]/g, "");
      if (sid && !TWILIO_SID.test(sid)) return noStore({ error: "An Account SID starts with AC and has 34 characters." }, 400);
      if ((from && !E164.test(from)) || (to && !E164.test(to))) return noStore({ error: "Write phone numbers with the country code, like +14155550123." }, 400);
      const saved = await saveAlertSettings((s) => {
        if (sid) s.twilio.sid = sid;
        if (token) s.twilio.token = token;
        if (from) s.twilio.from = from;
        if (to) s.twilio.to = to;
        if (b.clear === true) s.twilio = { sid: "", token: "", from: "", to: "" };
      });
      return noStore({ settings: publicAlerts(saved) });
    }
    if (b.action === "settings") {
      const saved = await saveAlertSettings((s) => {
        if (typeof b.publicUrl === "string") s.publicUrl = b.publicUrl.trim().replace(/\/+$/, "").slice(0, 200);
        if (typeof b.tz === "string" && b.tz) {
          new Intl.DateTimeFormat("en-US", { timeZone: b.tz });
          s.tz = b.tz;
        }
        if (Array.isArray(b.rules)) s.rules = (b.rules as AlertRule[]).slice(0, 40);
        if (b.watch && typeof b.watch === "object") s.watch = { ...s.watch, ...(b.watch as Partial<Watch>) };
        if (b.wake && typeof b.wake === "object") s.wake = { ...s.wake, ...(b.wake as Partial<WakeUp>) };
      });
      return noStore({ settings: publicAlerts(saved) });
    }
    if (b.action === "rotate-key") {
      const { randomBytes } = await import("crypto");
      const saved = await saveAlertSettings((s) => {
        s.webhookKey = randomBytes(24).toString("base64url");
      });
      return noStore({ settings: publicAlerts(saved) });
    }
    if (b.action === "test-text" || b.action === "test-call") return noStore({ ok: true, sid: await testPhone(b.action === "test-call" ? "call" : "sms") });
    if (b.action === "simulate") {
      const out = await dispatch({ source: "test", title: String(b.title ?? "Double-break VWAP").slice(0, 80), symbol: String(b.symbol ?? "NQ").slice(0, 20), side: "long", price: Number(b.price) || null, stop: null, target: null, tf: "5m", message: "", at: Math.floor(Date.now() / 1000) }, { dryRun: b.send !== true });
      return noStore(out);
    }
    if (b.action === "check-url") {
      const s = await getAlertSettings();
      if (!/^https:\/\//.test(s.publicUrl)) return noStore({ error: "TradingView needs an https address." }, 400);
      const r = await fetch(`${s.publicUrl}/api/alerts/ping`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
      const j = (await r.json().catch(() => ({}))) as { app?: string };
      if (j.app !== "TradePilot") return noStore({ error: "That address answered, but it isn't this app." }, 400);
      return noStore({ ok: true });
    }
    return noStore({ error: "Unknown action." }, 400);
  } catch (e) {
    return noStore({ error: e instanceof Error ? e.message : "Alerts failed." }, 502);
  }
}
