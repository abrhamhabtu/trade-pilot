import { createReadStream } from "fs";
import { Readable } from "stream";
import { localOnly } from "@/lib/server/guard";
import { filePath, getIndex } from "@/lib/server/library";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Download an original exactly as it was added.

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const id = new URL(req.url).searchParams.get("id");
  const f = (await getIndex()).files.find((x) => x.id === id);
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(Readable.toWeb(createReadStream(filePath(f))) as ReadableStream, {
    headers: { "Content-Type": "application/octet-stream", "Content-Length": String(f.size), "Content-Disposition": `attachment; filename="${f.name.replace(/"/g, "")}"` },
  });
}
