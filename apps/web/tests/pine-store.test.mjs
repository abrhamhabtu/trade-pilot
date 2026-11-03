import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.TRADEPILOT_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "tp-pine-"));
const { listPine, removeCopies, savePine } = await import("../src/lib/server/pine.ts");

const CODE = '//@version=6\nindicator("One")\nplot(close)\n';

test("adding the same script twice opens the first", async () => {
  const a = await savePine({ code: CODE, starter: "one", name: "One" });
  const again = await savePine({ code: `${CODE}  \n`, starter: "one", name: "One" });
  assert.equal(again.id, a.id);
  assert.equal(again.duplicate, true);
  assert.equal((await listPine()).length, 1);
});

test("a ready-made script you edited isn't added again", async () => {
  const a = (await listPine())[0];
  await savePine({ ...a, code: `${CODE}// mine\n` });
  const again = await savePine({ code: CODE, starter: "one", name: "One" });
  assert.equal(again.id, a.id);
  assert.match((await listPine())[0].code, /mine/);
});

test("editing keeps the script and its version history", async () => {
  const a = (await listPine())[0];
  const b = await savePine({ ...a, code: `${a.code}// two\n` });
  assert.equal(b.id, a.id);
  assert.ok(b.history.length >= 1);
  assert.equal((await listPine()).length, 1);
});

test("removing copies only touches exact matches and keeps notes and favorites", async () => {
  const fs = await import("node:fs/promises");
  const dir = path.join(process.env.TRADEPILOT_DATA_DIR, "library/pine");
  const now = Date.now();
  const make = (id, code, o = {}) => fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify({ id, name: id, code, notes: "", tags: [], favorite: false, createdAt: now, updatedAt: now, history: [], ...o }));
  await make("a1", "same\n", { notes: "first note", createdAt: 1 });
  await make("a2", "same", { favorite: true, createdAt: 2 });
  await make("a3", "different");
  const before = (await listPine()).length;
  assert.equal(await removeCopies(), 1);
  const after = await listPine();
  assert.equal(after.length, before - 1);
  const kept = after.find((s) => s.id === "a1");
  assert.equal(kept.notes, "first note");
  assert.equal(kept.favorite, true);
  assert.ok(after.some((s) => s.id === "a3"));
  assert.equal(await removeCopies(), 0);
});

test("a non-TradingView link isn't stored", async () => {
  const s = await savePine({ code: "//@version=6\n// © someone\nplot(open)", sourceUrl: "https://evil.example/x" });
  assert.equal(s.sourceUrl, "");
  assert.equal(s.author, "someone");
});
