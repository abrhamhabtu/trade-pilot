import os from "os";
import path from "path";
import { localOnly, noStore } from "@/lib/server/guard";
import { addFromPath, getIndex, importFolder, jobs, processFile, removeFile } from "@/lib/server/library";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The trader's data library: list, add from a path on this machine, reprocess, remove.

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const idx = await getIndex();
  return noStore({ ...idx, jobs: Object.fromEntries(jobs) });
}

export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (body.action === "import-path") {
      const p = path.resolve(String(body.path ?? "").replace(/^~(?=$|\/)/, os.homedir()));
      // Only files in the trader's home folder, and only data files.
      if (!p.startsWith(os.homedir() + path.sep) || !/\.(zip|csv)(\.part\d+)?$/i.test(p)) return noStore({ error: "Pick a .zip, .csv or .zip.partNN file inside your home folder." }, 400);
      const f = await addFromPath(p);
      void processFile(f.id);
      return noStore({ file: f });
    }
    if (body.action === "import-folder") {
      const p = path.resolve(String(body.path ?? "").replace(/^~(?=$|\/)/, os.homedir()));
      if (!p.startsWith(os.homedir() + path.sep)) return noStore({ error: "Pick a folder inside your home folder." }, 400);
      void importFolder(p).catch(() => undefined);
      return noStore({ ok: true });
    }
    if (body.action === "process") {
      void processFile(String(body.id));
      return noStore({ ok: true });
    }
    if (body.action === "remove") {
      await removeFile(String(body.id));
      return noStore({ ok: true });
    }
    return noStore({ error: "Unknown action." }, 400);
  } catch (e) {
    return noStore({ error: e instanceof Error ? e.message : "Library request failed." }, 500);
  }
}
