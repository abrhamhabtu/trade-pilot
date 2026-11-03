import { localOnly, noStore } from "@/lib/server/guard";
import { listPine, removeCopies, removePine, savePine, type PineScript } from "@/lib/server/pine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  return noStore({ scripts: await listPine() });
}

export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => ({}))) as { action?: string; script?: Partial<PineScript> & { code: string }; id?: string };
  try {
    if (b.action === "save" && typeof b.script?.code === "string") return noStore({ script: await savePine(b.script) });
    if (b.action === "remove" && b.id) {
      await removePine(b.id);
      return noStore({ ok: true });
    }
    if (b.action === "remove-copies") return noStore({ removed: await removeCopies() });
    return noStore({ error: "Unknown action." }, 400);
  } catch (e) {
    return noStore({ error: e instanceof Error ? e.message : "Pine request failed." }, 500);
  }
}
