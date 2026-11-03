// The trader's Pine scripts, one JSON file each under library/pine/, with earlier
// versions kept so an edit can be undone.

import { promises as fs } from "fs";
import path from "path";
import { analyzePine } from "@/lib/vision/pineTools";
import { LIB } from "./library";

export interface PineScript {
  id: string;
  name: string;
  code: string;
  notes: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  /** Earlier versions, newest last. */
  history: { at: number; code: string }[];
}

const DIR = path.join(LIB, "pine");
const fileOf = (id: string) => path.join(DIR, `${id.replace(/[^a-z0-9]/gi, "")}.json`);
const MAX_CODE = 400_000;
const HISTORY = 25;

export async function listPine(): Promise<PineScript[]> {
  const names = await fs.readdir(DIR).catch(() => [] as string[]);
  const out: PineScript[] = [];
  for (const n of names.filter((x) => x.endsWith(".json"))) {
    try {
      out.push(JSON.parse(await fs.readFile(path.join(DIR, n), "utf8")));
    } catch {
      /* a half-written file is skipped */
    }
  }
  return out.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
}

export async function savePine(input: Partial<PineScript> & { code: string }): Promise<PineScript> {
  if (input.code.length > MAX_CODE) throw new Error("That script is too long to store.");
  await fs.mkdir(DIR, { recursive: true, mode: 0o700 });
  const now = Date.now();
  const id = input.id ?? `${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const old = await fs.readFile(fileOf(id), "utf8").then((x) => JSON.parse(x) as PineScript, () => null);
  const history = old && old.code !== input.code ? [...old.history, { at: old.updatedAt, code: old.code }].slice(-HISTORY) : (old?.history ?? []);
  const next: PineScript = { id, name: (input.name ?? old?.name ?? analyzePine(input.code).title ?? "").trim().slice(0, 120) || "Untitled script", code: input.code, notes: (input.notes ?? old?.notes ?? "").slice(0, 4000), tags: (input.tags ?? old?.tags ?? []).slice(0, 12), favorite: input.favorite ?? old?.favorite ?? false, createdAt: old?.createdAt ?? now, updatedAt: now, history };
  const tmp = `${fileOf(id)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(next));
  await fs.rename(tmp, fileOf(id));
  return next;
}

export const removePine = (id: string) => fs.rm(fileOf(id), { force: true });
