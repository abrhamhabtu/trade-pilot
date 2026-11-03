// The trader's Pine scripts, one JSON file each under library/pine/, with earlier
// versions kept so an edit can be undone.

import { promises as fs } from "fs";
import path from "path";
import { analyzePine, authorOf, cleanSourceUrl, normalizePine } from "@/lib/vision/pineTools";
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
  /** The ready-made script this came from, so editing it doesn't make it look new. */
  starter?: string;
  /** Where it was found, and who wrote it. */
  sourceUrl?: string;
  author?: string;
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

export async function savePine(input: Partial<PineScript> & { code: string }): Promise<PineScript & { duplicate?: boolean }> {
  if (input.code.length > MAX_CODE) throw new Error("That script is too long to store.");
  // Adding something already here opens what's there rather than making a copy.
  if (!input.id) {
    const clean = normalizePine(input.code);
    const same = (await listPine()).find((s) => normalizePine(s.code) === clean || (!!input.starter && s.starter === input.starter));
    if (same) return { ...same, duplicate: true };
  }
  await fs.mkdir(DIR, { recursive: true, mode: 0o700 });
  const now = Date.now();
  const id = input.id ?? `${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const old = await fs.readFile(fileOf(id), "utf8").then((x) => JSON.parse(x) as PineScript, () => null);
  const history = old && old.code !== input.code ? [...old.history, { at: old.updatedAt, code: old.code }].slice(-HISTORY) : (old?.history ?? []);
  const next: PineScript = { id, name: (input.name ?? old?.name ?? analyzePine(input.code).title ?? "").trim().slice(0, 120) || "Untitled script", code: input.code, notes: (input.notes ?? old?.notes ?? "").slice(0, 4000), tags: (input.tags ?? old?.tags ?? []).slice(0, 12), favorite: input.favorite ?? old?.favorite ?? false, createdAt: old?.createdAt ?? now, updatedAt: now, history, starter: input.starter ?? old?.starter, sourceUrl: input.sourceUrl !== undefined ? cleanSourceUrl(input.sourceUrl) : old?.sourceUrl, author: input.author ?? old?.author ?? (authorOf(input.code) || undefined) };
  const tmp = `${fileOf(id)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(next));
  await fs.rename(tmp, fileOf(id));
  return next;
}

/**
 * Removes exact copies. The one kept is the one with the most in it: favorite,
 * notes and versions from the others carry over, so nothing written is lost.
 */
export async function removeCopies() {
  const by = new Map<string, PineScript[]>();
  for (const s of await listPine()) {
    const k = normalizePine(s.code);
    by.set(k, [...(by.get(k) ?? []), s]);
  }
  let removed = 0;
  for (const group of by.values()) {
    if (group.length < 2) continue;
    const [keep, ...rest] = [...group].sort((a, b) => a.createdAt - b.createdAt);
    const notes = [...new Set(group.map((s) => s.notes.trim()).filter(Boolean))].join("\n\n");
    await savePine({ ...keep, notes, favorite: group.some((s) => s.favorite), tags: [...new Set(group.flatMap((s) => s.tags))], history: undefined });
    for (const s of rest) {
      await removePine(s.id);
      removed++;
    }
  }
  return removed;
}

export const removePine = (id: string) => fs.rm(fileOf(id), { force: true });
