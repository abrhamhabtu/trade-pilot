import { nyClock } from "@/lib/pilot/market";
import { localOnly, noStore } from "@/lib/server/guard";
import { notify } from "@/lib/server/notify";
import { appendLine, readJson, updateJson } from "@/lib/server/store";
import { VENUES } from "@/lib/server/vision/venues";
import { SYMBOLS, isSymbol } from "@/lib/vision/markets";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Real orders from Vision. Arming is per venue and account, lasts one New
// York session, needs a typed confirmation and the trader's word that their
// firm allows automated trading, and caps the size of every order.

interface Arm {
  date: string;
  venue: string;
  accountId: number;
  accountName: string;
  maxQty: number;
}

const FILE = "vision-arm.json";
const today = () => nyClock(Date.now()).date;

async function armed(): Promise<Arm | null> {
  const a = await readJson<Arm | null>(FILE, null);
  return a && a.date === today() ? a : null;
}

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const connected = Object.fromEntries(await Promise.all(Object.values(VENUES).map(async (v) => [v.id, await v.connected()] as const)));
  return noStore({ armed: await armed(), connected, venues: Object.values(VENUES).map((v) => ({ id: v.id, label: v.label, markets: v.markets })) });
}

export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (body.action === "arm") {
      const venue = VENUES[String(body.venue)];
      const accountId = Number(body.accountId);
      const maxQty = Number(body.maxQty);
      if (!venue) return noStore({ error: "Pick Tradovate or TopstepX." }, 400);
      if (body.confirm !== "ARM") return noStore({ error: "Type ARM to allow real orders for today's session." }, 400);
      if (body.firmAllows !== true) return noStore({ error: "Confirm your firm allows automated trading on this account." }, 400);
      if (!Number.isSafeInteger(accountId) || accountId <= 0 || !Number.isInteger(maxQty) || maxQty < 1 || maxQty > 50) return noStore({ error: "Pick an account and a contract cap from 1 to 50." }, 400);
      if (!(await venue.connected())) return noStore({ error: `${venue.label} is not connected. Connect it in Proving Ground → Live.` }, 400);
      const arm: Arm = { date: today(), venue: venue.id, accountId, accountName: String(body.accountName ?? accountId).slice(0, 60), maxQty };
      await updateJson<Arm | null>(FILE, null, () => arm);
      await appendLine("live-log.jsonl", { at: Date.now(), level: "warn", text: `⚠️ Vision ARMED on ${venue.label} · ${arm.accountName} for ${arm.date}, max ${maxQty} contracts.` });
      await notify("live", `⚠️ Vision armed on ${venue.label} · ${arm.accountName} for today, max ${maxQty} contracts.`);
      return noStore({ armed: arm });
    }
    if (body.action === "disarm") {
      await updateJson<Arm | null>(FILE, null, () => null);
      return noStore({ armed: null });
    }
    const arm = await armed();
    if (!arm) return noStore({ error: "Vision is not armed for real orders today." }, 403);
    const venue = VENUES[arm.venue];
    const symbol = String(body.symbol);
    if (!isSymbol(symbol) || SYMBOLS[symbol].kind !== "futures") return noStore({ error: "Real orders from Vision are futures only for now; crypto trades on paper." }, 400);
    const micro = body.micro !== false;
    if (body.action === "flatten") {
      await venue.flatten({ accountId: arm.accountId, symbol, micro });
      await appendLine("live-log.jsonl", { at: Date.now(), level: "order", text: `🛑 Vision flattened ${symbol} on ${venue.label}.` });
      await notify("live", `🛑 Vision flattened ${symbol} on ${venue.label} · ${arm.accountName}.`);
      return noStore({ ok: true });
    }
    if (body.action === "order") {
      const qty = Number(body.qty);
      const refPx = Number(body.refPx);
      const stopPts = Number(body.stopPts);
      const targetPts = Number(body.targetPts);
      const side = body.side === "short" ? "short" : "long";
      if (!Number.isInteger(qty) || qty < 1 || qty > arm.maxQty) return noStore({ error: `Size must be 1 to ${arm.maxQty} contracts.` }, 400);
      if (![refPx, stopPts, targetPts].every((n) => Number.isFinite(n) && n > 0)) return noStore({ error: "The plan needs a price, a stop and a target." }, 400);
      const id = await venue.placeBracket({ accountId: arm.accountId, accountName: arm.accountName, symbol, micro, side, qty, refPx, stopPts, targetPts, tag: `tp-vision-${Date.now().toString(36)}` });
      const text = `🚀 Vision ${side === "long" ? "BUY" : "SELL"} ${qty} ${micro ? SYMBOLS[symbol].roots!.micro : SYMBOLS[symbol].roots!.full} on ${venue.label} · stop ${stopPts} pts, target ${targetPts} pts (order ${id})`;
      await appendLine("live-log.jsonl", { at: Date.now(), level: "order", text });
      await notify("live", text);
      return noStore({ ok: true, orderId: id });
    }
    return noStore({ error: "Unknown action." }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Order failed.";
    await appendLine("live-log.jsonl", { at: Date.now(), level: "error", text: `⛔ Vision: ${msg}` }).catch(() => undefined);
    return noStore({ error: msg }, 502);
  }
}
