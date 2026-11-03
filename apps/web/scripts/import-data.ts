// Brings a folder of downloads into the data library and records what is there:
//   npm run data:import -- ~/Downloads/Databento-2026-10-24
// Prices stay in the library folder on this machine. Only the manifest (symbols,
// ranges, bar counts, checksums) goes in the repository, because the bundle's
// licence forbids publishing the data itself and this repository is public.

import { createHash } from "crypto";
import { createReadStream, promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { filePath, getIndex, importFolder } from "../src/lib/server/library/index";

const iso = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const md5 = (file: string) =>
  new Promise<string>((res, rej) => {
    const h = createHash("md5");
    createReadStream(file)
      .on("data", (d) => h.update(d))
      .on("end", () => res(h.digest("hex")))
      .on("error", rej);
  });

const arg = process.argv[2];
if (arg) {
  const dir = path.resolve(arg.replace(/^~(?=$|\/)/, os.homedir()));
  const out = await importFolder(dir, (t) => console.log(t));
  console.log(`Added ${out.added.length}, skipped ${out.skipped.length}${out.skipped.length ? `: ${out.skipped.join(", ")}` : ""}`);
}

const idx = await getIndex();
const manifest = {
  note: "What the local data library should hold. No prices are stored in this repository. Restore with: npm run data:import -- <folder of downloads>",
  series: Object.fromEntries(Object.values(idx.series).filter((s) => s.byYear).map((s) => [s.symbol, { from: iso(s.from), to: iso(s.to), bars: s.bars, joinedWith: s.joinedWith ?? null }])),
  files: await Promise.all(idx.files.filter((f) => f.status === "processed").map(async (f) => ({ name: f.name, size: f.size, md5: await md5(filePath(f)) }))),
};
const target = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../data/library-manifest.json");
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
for (const [k, v] of Object.entries(manifest.series)) console.log(`${k.padEnd(5)} ${v.from} to ${v.to}  ${v.bars.toLocaleString()} bars${v.joinedWith ? `  (with ${v.joinedWith})` : ""}`);
