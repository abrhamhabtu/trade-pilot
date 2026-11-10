// The day's scheduled news, with exact times: the fixed schedule (FOMC,
// claims) plus the CPI and jobs-report dates from the economic calendar.

import { nyClock, scheduledEvents, type MacroEvent } from "@/lib/pilot/market";
import { ECON_CALENDAR } from "./econ-calendar";

export function dayEvents(date: string): MacroEvent[] {
  const out = scheduledEvents(date).filter((e) => !/payrolls \(usual slot\)/i.test(e.title) || !ECON_CALENDAR.jobs.length);
  if (ECON_CALENDAR.cpi.includes(date)) out.push({ date, time: "08:30", title: "CPI", impact: "high" });
  if (ECON_CALENDAR.jobs.includes(date)) out.push({ date, time: "08:30", title: "Jobs report", impact: "high" });
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/** Unix seconds for a New York date and "HH:MM", daylight saving included. */
export function nyTime(date: string, hhmm: string): number | null {
  const [h, m] = hhmm.split(":").map(Number);
  for (const off of [4, 5]) {
    const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h + off, m) / 1000;
    const c = nyClock(t * 1000);
    if (c.date === date && c.minute === h * 60 + m) return t;
  }
  return null;
}
