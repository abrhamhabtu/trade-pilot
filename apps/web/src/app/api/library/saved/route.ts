import { localOnly, noStore } from "@/lib/server/guard";
import { getSaved, listSaved, removeSaved, saveItem, toCsv } from "@/lib/server/library/saved";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Saved backtests and replay sessions: list, download (?id=&format=json|csv), save, remove.

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const p = new URL(req.url).searchParams;
  const id = p.get("id");
  if (!id) return noStore({ items: await listSaved() });
  const s = await getSaved(id);
  if (!s) return new Response("Not found", { status: 404 });
  const base = `${s.item.kind}-${s.item.symbol}-${s.item.tf}-${new Date(s.item.at).toISOString().slice(0, 10)}`.replace(/[^A-Za-z0-9._-]/g, "_");
  if (p.get("format") === "csv")
    return new Response(toCsv(s.trades), { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${base}-trades.csv"` } });
  if (p.get("format") === "json")
    return new Response(JSON.stringify(s, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${base}.json"` } });
  return noStore(s);
}

export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const text = await req.text();
  if (text.length > 8_000_000) return noStore({ error: "That is too large to save." }, 413);
  const body = JSON.parse(text || "{}") as Record<string, unknown>;
  if (body.action === "remove") {
    await removeSaved(String(body.id));
    return noStore({ ok: true });
  }
  if (body.action === "save") {
    const item = body.item as { kind?: string; name?: string; symbol?: string; tf?: string; summary?: Record<string, number | string> };
    if (!item || (item.kind !== "backtest" && item.kind !== "replay") || !Array.isArray(body.trades)) return noStore({ error: "Nothing to save." }, 400);
    const saved = await saveItem({
      item: { kind: item.kind, name: String(item.name ?? "Untitled"), symbol: String(item.symbol ?? ""), tf: String(item.tf ?? ""), summary: item.summary ?? {} },
      settings: body.settings ?? null,
      trades: body.trades as Record<string, unknown>[],
      extra: body.extra,
    });
    return noStore({ item: saved });
  }
  return noStore({ error: "Unknown action." }, 400);
}
