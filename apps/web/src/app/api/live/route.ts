import { nyClock } from "@/lib/pilot/market";
import { localOnly, noStore } from "@/lib/server/guard";
import { addBot, arm, flattenAll, getBots, getLog, getRuns, liveState, saveBots, setMode, type LiveBot } from "@/lib/server/live/bots";
import * as px from "@/lib/server/live/projectx";
import * as tv from "@/lib/server/live/tradovate";
import type { StrategyConfig } from "@/lib/proving/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function snapshot() {
  const s = await px.getSecrets();
  const t = await tv.getSecrets();
  const runs = await getRuns();
  const date = nyClock(Date.now()).date;
  return {
    connected: !!s.apiKey || !!t.sec,
    projectx: { connected: !!s.apiKey, userName: s.userName ?? null, base: s.base ?? px.DEFAULT_BASE, liveData: !!s.liveData },
    tradovate: { connected: !!t.sec, userName: t.name ?? null, environment: t.environment ?? "demo" },
    userName: s.userName ?? null,
    base: s.base ?? px.DEFAULT_BASE,
    liveData: !!s.liveData,
    loop: { running: !!liveState.started, lastTick: liveState.lastTick, error: liveState.lastError },
    date,
    bots: await getBots(),
    runs: Object.fromEntries(Object.entries(runs).filter(([, r]) => r.date === date)),
    log: await getLog(80),
  };
}

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const out = await snapshot();
  const url = new URL(req.url);
  if (url.searchParams.get("accounts") === "1" && out.connected) {
    const errors: string[] = [];
    const tag = <T extends { id: number; name: string }>(broker: "projectx" | "tradovate", list: T[]) => list.map((a) => ({ ...a, broker }));
    const [p, t] = await Promise.all([
      out.projectx.connected ? px.accounts().then((l) => tag("projectx", l)).catch((e) => (errors.push(`TopstepX: ${e.message}`), [])) : [],
      out.tradovate.connected ? tv.accounts().then((l) => tag("tradovate", l)).catch((e) => (errors.push(`Tradovate: ${e.message}`), [])) : [],
    ]);
    return noStore({ ...out, accounts: [...t, ...p], accountsError: errors.join(" · ") || undefined });
  }
  return noStore(out);
}

const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);

export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (body.action) {
      case "connect": {
        if (typeof body.userName !== "string" || !body.userName.trim() || typeof body.apiKey !== "string" || !body.apiKey || body.apiKey.length > 4096)
          return noStore({ error: "Enter your ProjectX username and API key." }, 400);
        const base = typeof body.base === "string" && body.base.trim() ? body.base.trim().replace(/\/$/, "") : px.DEFAULT_BASE;
        const accounts = await px.connect(body.userName.trim(), body.apiKey, base, body.liveData === true);
        return noStore({ ...(await snapshot()), accounts });
      }
      case "connect-tradovate": {
        const strings = [body.name, body.password, body.appId, body.sec];
        const cid = Number(body.cid);
        if (!strings.every((v) => typeof v === "string" && v.length > 0 && v.length <= 4096) || !Number.isSafeInteger(cid) || cid <= 0)
          return noStore({ error: "Enter your Tradovate username, password, API app ID, CID and secret." }, 400);
        const environment = body.environment === "live" ? "live" : "demo";
        await tv.connect({ name: String(body.name).trim(), password: String(body.password), appId: String(body.appId), cid, sec: String(body.sec), environment });
        return noStore(await snapshot());
      }
      case "disconnect":
      case "disconnect-projectx":
        await flattenAll("TopstepX disconnected");
        await px.disconnect();
        return noStore(await snapshot());
      case "disconnect-tradovate":
        await flattenAll("Tradovate disconnected");
        await tv.disconnect();
        return noStore(await snapshot());
      case "add-bot": {
        const cfg = body.cfg as StrategyConfig | undefined;
        const accountId = num(body.accountId, 1, Number.MAX_SAFE_INTEGER);
        const maxContracts = num(body.maxContracts, 1, 50);
        const dailyLossStop = num(body.dailyLossStop, 0, 100_000);
        if (!cfg || typeof cfg.strategy !== "string" || cfg.strategy === "tv-signals" || !accountId || !maxContracts || dailyLossStop === null || typeof body.name !== "string")
          return noStore({ error: "Pick a test, an account, a contract cap and a daily loss stop." }, 400);
        const broker = body.broker === "tradovate" ? "tradovate" : "projectx";
        await addBot({ name: body.name.slice(0, 60), cfg, accountId, accountName: String(body.accountName ?? accountId).slice(0, 60), maxContracts, dailyLossStop, broker });
        return noStore(await snapshot());
      }
      case "update-bot": {
        const patch: Partial<LiveBot> = {};
        const max = num(body.maxContracts, 1, 50);
        const stop = num(body.dailyLossStop, 0, 100_000);
        if (max) patch.maxContracts = max;
        if (stop !== null) patch.dailyLossStop = stop;
        if (typeof body.firmAllowsAutomation === "boolean") patch.firmAllowsAutomation = body.firmAllowsAutomation;
        await saveBots((bots) =>
          bots.map((b) => {
            if (b.id !== body.id) return b;
            const next = { ...b, ...patch };
            // Taking back the firm confirmation disarms the bot on the spot.
            if (patch.firmAllowsAutomation === false && next.mode === "armed") return { ...next, mode: "shadow" as const, armedOn: undefined };
            return next;
          }),
        );
        return noStore(await snapshot());
      }
      case "arm":
        if (body.confirm !== "ARM") return noStore({ error: "Type ARM to confirm real orders for today's session." }, 400);
        await arm(String(body.id));
        return noStore(await snapshot());
      case "shadow":
      case "off":
        await setMode(String(body.id), body.action, "by you");
        return noStore(await snapshot());
      case "remove-bot":
        await setMode(String(body.id), "off", "removed");
        await saveBots((bots) => bots.filter((b) => b.id !== body.id));
        return noStore(await snapshot());
      case "flatten-all":
        return noStore({ ...(await snapshot()), message: await flattenAll("kill switch in the app") });
      default:
        return noStore({ error: "Unknown action." }, 400);
    }
  } catch (e) {
    return noStore({ error: e instanceof Error ? e.message : "Live request failed." }, 502);
  }
}
