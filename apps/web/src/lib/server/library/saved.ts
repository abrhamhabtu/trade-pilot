// ─── Saved work ────────────────────────────────────────────────────────────────
// Backtest runs and replay sessions the trader keeps, one JSON file each under
// library/saved/, with a small index for the list. Each can be downloaded
// again as JSON or as a trades CSV.
// ───────────────────────────────────────────────────────────────────────────────

import { promises as fs } from "fs";
import path from "path";
import { readJson, updateJson } from "../store";
import { LIB } from "./index";

const DIR = path.join(LIB, "saved");
const INDEX = "library/saved.json";

export interface SavedItem {
  id: string;
  kind: "backtest" | "replay";
  name: string;
  at: number;
  symbol: string;
  tf: string;
  /** A few headline numbers for the list. */
  summary: Record<string, number | string>;
}

export interface SavedPayload {
  item: SavedItem;
  settings: unknown;
  trades: Record<string, unknown>[];
  extra?: unknown;
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const fileOf = (id: string) => path.join(DIR, `${id.replace(/[^a-z0-9]/gi, "")}.json`);

export const listSaved = () => readJson<SavedItem[]>(INDEX, []);

export async function saveItem(p: Omit<SavedPayload, "item"> & { item: Omit<SavedItem, "id" | "at"> }) {
  await fs.mkdir(DIR, { recursive: true, mode: 0o700 });
  const item: SavedItem = { ...p.item, name: p.item.name.slice(0, 120), id: uid(), at: Date.now() };
  await fs.writeFile(fileOf(item.id), JSON.stringify({ ...p, item }));
  await updateJson<SavedItem[]>(INDEX, [], (xs) => [item, ...xs].slice(0, 500));
  return item;
}

export async function getSaved(id: string): Promise<SavedPayload | null> {
  try {
    return JSON.parse(await fs.readFile(fileOf(id), "utf8"));
  } catch {
    return null;
  }
}

export async function removeSaved(id: string) {
  await fs.rm(fileOf(id), { force: true });
  await updateJson<SavedItem[]>(INDEX, [], (xs) => xs.filter((x) => x.id !== id));
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}
