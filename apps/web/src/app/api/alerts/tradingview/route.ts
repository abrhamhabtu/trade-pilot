import { dispatch, getAlertSettings, keyMatches } from "@/lib/server/alerts";
import { noStore } from "@/lib/server/guard";
import { parseWebhook } from "@/lib/vision/alerts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TradingView's servers post here, so this is the one route open to the internet.
// The key in the address is the only credential, and all it can do is send the
// trader an alert about a chart. It can't read anything or place a trade.

const MAX_BODY = 16_000;
const hits: number[] = ((globalThis as Record<string, unknown>).__tpAlertHits ??= []) as number[];
const PER_MINUTE = 30;

export async function POST(req: Request) {
  const s = await getAlertSettings();
  if (!keyMatches(new URL(req.url).searchParams.get("key") ?? "", s.webhookKey)) return noStore({ error: "Wrong or missing key." }, 401);
  const now = Date.now();
  while (hits.length && now - hits[0] > 60_000) hits.shift();
  if (hits.length >= PER_MINUTE) return noStore({ error: "Too many alerts." }, 429);
  hits.push(now);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return noStore({ error: "Alert is too large." }, 413);
  // TradingView gives up after a few seconds, and a phone call takes longer than that to place.
  void dispatch(parseWebhook(raw, now)).catch(() => undefined);
  return noStore({ ok: true });
}
