// ─── Prop backtest accounts ────────────────────────────────────────────────────
// The trader's named practice accounts, one JSON file each under
// library/accounts/, so they are there in any browser on this machine.
// ───────────────────────────────────────────────────────────────────────────────

import { promises as fs } from "fs";
import path from "path";
import type { PropAccount } from "@/lib/vision/account";
import { LIB } from "./index";

const DIR = path.join(LIB, "accounts");
const fileOf = (id: string) => path.join(DIR, `${id.replace(/[^a-z0-9]/gi, "")}.json`);

export async function listAccounts(): Promise<PropAccount[]> {
  const names = await fs.readdir(DIR).catch(() => [] as string[]);
  const out: PropAccount[] = [];
  for (const n of names.filter((x) => x.endsWith(".json"))) {
    try {
      out.push(JSON.parse(await fs.readFile(path.join(DIR, n), "utf8")));
    } catch {
      /* a half-written file is skipped */
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveAccount(a: PropAccount) {
  await fs.mkdir(DIR, { recursive: true, mode: 0o700 });
  const tmp = `${fileOf(a.id)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(a));
  await fs.rename(tmp, fileOf(a.id));
  return a;
}

export const removeAccount = (id: string) => fs.rm(fileOf(id), { force: true });
