import { localOnly, noStore } from "@/lib/server/guard";
import { listAccounts, removeAccount, saveAccount } from "@/lib/server/library/accounts";
import type { PropAccount } from "@/lib/vision/account";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prop backtest accounts: list, save (create or update), remove.

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  return noStore({ accounts: await listAccounts() });
}

export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const text = await req.text();
  if (text.length > 20_000_000) return noStore({ error: "That account is too large to save." }, 413);
  const body = JSON.parse(text || "{}") as { action?: string; id?: string; account?: PropAccount };
  if (body.action === "remove" && body.id) {
    await removeAccount(body.id);
    return noStore({ ok: true });
  }
  const a = body.account;
  if (body.action === "save" && a && typeof a.id === "string" && typeof a.name === "string" && typeof a.program === "string" && Array.isArray(a.trades)) {
    return noStore({ account: await saveAccount({ ...a, name: a.name.slice(0, 80), updatedAt: Date.now() }) });
  }
  return noStore({ error: "Unknown action." }, 400);
}
