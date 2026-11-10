import test from "node:test";
import assert from "node:assert/strict";
import { dayEvents, nyTime } from "../src/lib/vision/events.ts";
import { ECON_CALENDAR } from "../src/lib/vision/econ-calendar.ts";

test("a CPI day lists CPI at 8:30 New York, and the clock handles daylight saving", () => {
  const cpi = ECON_CALENDAR.cpi.find((d) => d.startsWith("2025-01"));
  const ev = dayEvents(cpi);
  assert.ok(ev.some((e) => e.title === "CPI" && e.time === "08:30" && e.impact === "high"));
  // Winter: 8:30 New York is 13:30 UTC; summer: 12:30 UTC.
  assert.equal(nyTime("2025-01-15", "08:30"), Date.UTC(2025, 0, 15, 13, 30) / 1000);
  assert.equal(nyTime("2025-07-15", "08:30"), Date.UTC(2025, 6, 15, 12, 30) / 1000);
});

test("the jobs report comes from the calendar, not the first-Friday guess", () => {
  const jobs = ECON_CALENDAR.jobs.find((d) => d.startsWith("2025-03"));
  const ev = dayEvents(jobs);
  assert.ok(ev.some((e) => e.title === "Jobs report"));
  assert.ok(!ev.some((e) => /usual slot/.test(e.title)));
});
