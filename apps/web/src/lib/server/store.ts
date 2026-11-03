// Server-side state for the always-on parts of TradePilot: tests mirrored from
// the browser, alert settings, live bots and their logs. Plain JSON files in
// one folder, written atomically. Secrets live in their own file, readable by
// the owner only, and are never sent back to a browser.

import { existsSync, promises as fs, renameSync } from "fs";
import os from "os";
import path from "path";

// One folder per person, not per checkout: a fresh clone, a worktree or a
// `git clean` must never cost anyone their market data, accounts or alert
// settings. TRADEPILOT_DATA_DIR points it elsewhere (a Docker volume, a synced drive).
export const DATA_DIR = process.env.TRADEPILOT_DATA_DIR || path.join(os.homedir(), ".tradepilot");

// Earlier versions kept this folder inside the checkout; bring it along once.
if (!process.env.TRADEPILOT_DATA_DIR) {
  const legacy = path.join(process.cwd(), ".tradepilot");
  if (existsSync(legacy) && !existsSync(DATA_DIR)) {
    try {
      renameSync(legacy, DATA_DIR);
    } catch {
      /* another volume: the old folder stays where it is and nothing is lost */
    }
  }
}

const locks = new Map<string, Promise<unknown>>();

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(name: string, value: unknown, opts: { secret?: boolean } = {}) {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  const file = path.join(DATA_DIR, name);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), { mode: opts.secret ? 0o600 : 0o644 });
  await fs.rename(tmp, file);
}

/** Read, change and write one file without two writers interleaving. */
export async function updateJson<T>(name: string, fallback: T, change: (value: T) => T | void, opts: { secret?: boolean } = {}): Promise<T> {
  const prev = locks.get(name) ?? Promise.resolve();
  const next = prev.then(async () => {
    const value = await readJson<T>(name, fallback);
    const out = (change(value) ?? value) as T;
    await writeJson(name, out, opts);
    return out;
  });
  locks.set(name, next.catch(() => undefined));
  return next;
}

export async function appendLine(name: string, entry: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  await fs.appendFile(path.join(DATA_DIR, name), `${JSON.stringify(entry)}\n`);
}

export async function tailLines<T>(name: string, n: number): Promise<T[]> {
  try {
    const lines = (await fs.readFile(path.join(DATA_DIR, name), "utf8")).trim().split("\n");
    return lines.slice(-n).filter(Boolean).map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}
