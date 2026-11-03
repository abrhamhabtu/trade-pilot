import { Readable } from "stream";
import { localOnly, noStore } from "@/lib/server/guard";
import { addFromStream, processFile } from "@/lib/server/library";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A file dropped into the library from the browser, streamed straight to disk.

export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!/^[^/\\]{1,200}\.(zip|csv)(\.part\d+)?$/i.test(name)) return noStore({ error: "Drop a .zip, .csv or .zip.partNN file." }, 400);
  if (!req.body) return noStore({ error: "Empty upload." }, 400);
  const f = await addFromStream(name, Readable.fromWeb(req.body as never));
  void processFile(f.id);
  return noStore({ file: f });
}
