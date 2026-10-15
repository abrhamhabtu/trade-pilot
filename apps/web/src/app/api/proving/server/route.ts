import { localOnly, noStore } from "@/lib/server/guard";
import { TESTS_FILE, daemonState, type ServerTest } from "@/lib/server/provingDaemon";
import { readJson, writeJson } from "@/lib/server/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The browser mirrors its Proving Ground tests here so the server can run
// them, and send alerts, while no browser is open.

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const { tests } = await readJson<{ tests: ServerTest[] }>(TESTS_FILE, { tests: [] });
  return noStore({ running: !!daemonState.started, started: daemonState.started, lastTick: daemonState.lastTick, error: daemonState.lastError, tests: tests.length, summaries: daemonState.summaries });
}

const isTest = (t: unknown): t is ServerTest => {
  const x = t as ServerTest;
  return !!x && typeof x.id === "string" && typeof x.name === "string" && typeof x.programKey === "string" && typeof x.startDate === "string" && !!x.cfg && typeof x.cfg.strategy === "string";
};

export async function PUT(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as { tests?: unknown[] } | null;
  if (!body || !Array.isArray(body.tests) || body.tests.length > 50 || !body.tests.every(isTest)) return noStore({ error: "Bad test list." }, 400);
  const tests = body.tests.map(({ id, name, cfg, programKey, startDate, state, createdAt }) => ({ id, name, cfg, programKey, startDate, state, createdAt }));
  await writeJson(TESTS_FILE, { tests, syncedAt: Date.now() });
  return noStore({ ok: true, tests: tests.length });
}
