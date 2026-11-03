import { localOnly, noStore } from "@/lib/server/guard";
import { toolStatus } from "@/lib/server/sessionModel";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Which logged-in AI tools this computer has, so connecting one takes a click.
export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  return noStore({ tools: await toolStatus() });
}
