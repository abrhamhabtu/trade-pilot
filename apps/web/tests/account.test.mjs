import test from "node:test";
import assert from "node:assert/strict";
import { accountState, newAccount, resetAccount, toDaySims } from "../src/lib/vision/account.ts";
import { FIRM_PROGRAMS } from "../src/lib/proving/firms.ts";

const program = FIRM_PROGRAMS.find((p) => p.model === "eval" && p.size === 50_000 && p.dll == null) ?? FIRM_PROGRAMS.find((p) => p.model === "eval");
const base = () => newAccount({ name: "Test", color: "#fff", program: program.key, symbol: "NQ", tf: "5m", micro: true, sizing: "fixed", contracts: 2, riskPct: 1, mode: "both", startDate: "2024-01-02" });
let day = 0;
const trade = (pnl, opts = {}) => {
  const d = new Date(Date.UTC(2024, 0, 2 + Math.floor(day++ / (opts.perDay ?? 1)))).toISOString().slice(0, 10);
  const t = Date.parse(`${d}T15:00:00Z`) / 1000;
  return { id: `t${day}`, entryT: t, exitT: t + 600, session: d, side: "long", qty: 2, entry: 100, exit: 100 + pnl / 4, stop: 90, target: 120, pnl, r: pnl / 200, worst: Math.min(0, pnl), best: Math.max(0, pnl), reason: "target", source: "manual", ...opts.extra };
};

test("a new account starts at the program's size and floor", () => {
  const s = accountState(base());
  assert.equal(s.balance, program.size);
  assert.equal(s.threshold, program.size - program.drawdown);
  assert.equal(s.status, "active");
  assert.equal(s.daysTraded, 0);
});

test("trades move the balance and group into sessions", () => {
  day = 0;
  const a = { ...base(), trades: [trade(300), trade(-120), trade(250)] };
  const s = accountState(a);
  assert.equal(s.balance, program.size + 430);
  assert.equal(s.daysTraded, 3);
  assert.equal(toDaySims(a.trades).length, 3);
});

test("a loss through the floor blows the account", () => {
  day = 0;
  const a = { ...base(), trades: [trade(-program.drawdown - 50)] };
  assert.equal(accountState(a).status, "blown");
});

test("reaching the target with the minimum days passes it", () => {
  day = 0;
  const per = Math.ceil(program.target / Math.max(1, program.minDays)) + 50;
  // Spread evenly so the consistency rule is met.
  const n = Math.max(program.minDays, Math.ceil(program.target / per), 3);
  const each = Math.ceil((program.target + 100) / n);
  const a = { ...base(), trades: Array.from({ length: n + 2 }, () => trade(each)) };
  const s = accountState(a);
  assert.equal(s.status, "passed", s.headline);
});

test("a reset keeps the attempt in the record and starts over", () => {
  day = 0;
  const a = { ...base(), trades: [trade(-program.drawdown - 10)] };
  const r = resetAccount(a, accountState(a));
  assert.equal(r.trades.length, 0);
  assert.equal(r.resets, 1);
  assert.equal(r.history[0].result, "blown");
  assert.equal(accountState(r).status, "active");
  assert.ok(accountState(r).fees >= program.cost * 2 - 1e-9);
});
