import { localOnly, noStore } from "@/lib/server/guard";
import { getIndex, queryBars } from "@/lib/server/library";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TF: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400 };

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const p = new URL(req.url).searchParams;
  const symbol = (p.get("symbol") ?? "").toUpperCase();
  const tf = TF[p.get("tf") ?? "5m"];
  const info = (await getIndex()).series[symbol];
  if (!info || !tf) return noStore({ error: "No library data for that symbol." }, 404);
  const to = Number(p.get("to")) || info.to;
  const from = Number(p.get("from")) || Math.max(info.from, to - 60 * 86_400);
  const { bars, truncated } = await queryBars(symbol, from, to, tf, Math.min(80_000, Number(p.get("max")) || 30_000));
  return noStore({ symbol, tf: p.get("tf"), truncated, t: bars.map((b) => b.t), o: bars.map((b) => b.o), h: bars.map((b) => b.h), l: bars.map((b) => b.l), c: bars.map((b) => b.c), v: bars.map((b) => b.v) });
}
