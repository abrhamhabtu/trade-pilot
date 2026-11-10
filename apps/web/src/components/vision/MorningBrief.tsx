"use client";

import { useState } from "react";
import { Sunrise, X } from "lucide-react";
import type { MacroEvent } from "@/lib/pilot/market";
import type { Ranked, Scenario } from "@/lib/vision/discover";
import type { GuardAccount } from "@/lib/vision/guard";
import type { DayLevels } from "@/lib/vision/levels";
import { VerdictBadge } from "./DiscoverPanel";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Where the last price sits against a range, in words. */
function against(px: number, hi: number | null, lo: number | null, name: string, fmt: (n: number) => string) {
  if (hi == null || lo == null) return null;
  if (px > hi) return `above ${name} (${fmt(hi)})`;
  if (px < lo) return `below ${name} (${fmt(lo)})`;
  const pos = (px - lo) / Math.max(1e-9, hi - lo);
  return `inside ${name}, ${pos > 0.66 ? "near its high" : pos < 0.33 ? "near its low" : "mid-range"} (${fmt(lo)}–${fmt(hi)})`;
}

/**
 * Before the New York open: the day so far, where price sits against
 * yesterday and the night, what has held up on days like this, the account's
 * room, and the news. Dismissed for the day with the ×.
 */
export function MorningBrief({ symbol, price, fmt, scenario, levels, ranked, account, accountName, events, date }: { symbol: string; price: number | null; fmt: (n: number) => string; scenario: Scenario | null; levels: DayLevels | null; ranked: Ranked[]; account: GuardAccount | null; accountName: string | null; events: MacroEvent[]; date: string }) {
  const key = `tp_brief_${date}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  const where = price != null && levels ? [against(price, levels.pdh, levels.pdl, "yesterday's range", fmt), against(price, levels.onh, levels.onl, "the overnight range", fmt)].filter(Boolean) : [];
  // Only what held up counts as "fits": proven and fitting today. Anything less is said as such.
  const proven = ranked.filter((r) => r.judged?.verdict === "proven" && (r.fit?.fit ?? 0) > 0).slice(0, 3);
  const closest = ranked.filter((r) => r.judged && r.judged.verdict !== "losing").slice(0, 2);
  return (
    <section className="tp-card-in relative overflow-hidden rounded-[24px] border border-[#FF8A3D]/20 bg-gradient-to-br from-[#FF8A3D]/[0.1] via-[#121214]/90 to-[#121214]/90 p-4">
      <button
        aria-label="Hide today's brief"
        onClick={() => {
          try {
            localStorage.setItem(key, "1");
          } catch {
            /* hidden for this visit only */
          }
          setHidden(true);
        }}
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-white/45 hover:bg-white/[0.08] hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#FFB27D]">
        <Sunrise className="h-4 w-4" /> Morning brief · {symbol}
      </p>
      <div className="mt-2 grid gap-3 text-[13px] leading-snug text-white/75 md:grid-cols-2">
        <div className="space-y-1.5">
          {scenario?.text && <p className="text-[14.5px] font-semibold text-white">{scenario.text}</p>}
          {where.length > 0 && <p>Price is {where.join(", and ")}.</p>}
          {events.length > 0 ? (
            <p>
              News today:{" "}
              {events.map((e, k) => (
                <span key={e.title} className={e.impact === "high" ? "font-semibold text-[#FF8D85]" : ""}>
                  {k ? ", " : ""}
                  {e.time} {e.title.replace(/ \(usual slot\)/, "")}
                </span>
              ))}
              .
            </p>
          ) : (
            <p className="text-white/50">No scheduled news today.</p>
          )}
        </div>
        <div className="space-y-1.5">
          {proven.length ? (
            <p>
              Held up on days like this:{" "}
              {proven.map((r) => (
                <span key={r.idea.id} className="mr-1.5 inline-flex items-center gap-1 font-semibold text-white">
                  {r.idea.label} <VerdictBadge v="proven" />
                </span>
              ))}
            </p>
          ) : (
            <p>
              Nothing tested on {symbol} is proven yet.{closest.length ? ` Closest: ${closest.map((r) => `${r.idea.label} (${r.judged!.verdict})`).join(", ")}.` : ""} Trade your plan, not a pattern list.
            </p>
          )}
          {account ? (
            <p>
              {accountName}: {usd(account.balance - account.floor)} of room
              {account.dllLeft != null ? `, ${usd(account.dllLeft)} daily limit` : ""}
              {account.target != null ? `, ${usd(Math.max(0, account.target - account.balance))} to the target` : ""}
              {account.bestDayCapLeft != null ? `, ${usd(Math.max(0, account.bestDayCapLeft))} before the consistency rule bites today` : ""}.
            </p>
          ) : (
            <p className="text-white/50">Pick a practice account under Trading for to see its room here.</p>
          )}
        </div>
      </div>
    </section>
  );
}
