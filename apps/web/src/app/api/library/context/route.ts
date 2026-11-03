import { localOnly, noStore } from "@/lib/server/guard";
import { getContext } from "@/lib/server/library";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  return noStore(await getContext());
}
