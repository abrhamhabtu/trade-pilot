"use client";

import { Fragment, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronRight, Download } from "lucide-react";
import type { DaySim } from "@/lib/proving/engine";
import type { FirmProgram } from "@/lib/proving/firms";
import { dayLedger, ledgerCsv } from "@/lib/vision/lab";
import { Seg } from "../ui";
import { download, money } from "../data";

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const nice = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const et = (t: number) => new Date(t * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const PAGE = 60;

type Show = "all" | "green" | "red" | "flagged";

/**
 * Every trading day and every number on it. With a firm program, each day is also
 * read against the rules: floor, room, daily limit used and progress to the target.
 */
export function DayLedger({ days, program, firm = true, name, context }: { days: DaySim[]; program: FirmProgram; firm?: boolean; name: string; context?: { fomc?: string[]; vix?: Record<string, number> } }) {
  const { rows, summary: s } = useMemo(() => dayLedger(days, program, context), [days, program, context]);
  const [show, setShow] = useState<Show>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const list = useMemo(() => [...rows].reverse().filter((r) => (show === "green" ? r.pnl > 0 : show === "red" ? r.pnl < 0 : show === "flagged" ? r.flags.length > 0 : true)), [rows, show]);
  const col = firm ? "grid-cols-[20px_124px_52px_84px_60px_92px_84px_72px_minmax(90px,1fr)]" : "grid-cols-[20px_124px_52px_84px_60px_84px_84px_minmax(90px,1fr)]";
  const best = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)));
  if (!rows.length) return <section className="rounded-[26px] border border-white/[0.07] bg-[#121214]/80 p-5"><h3 className="text-[16px] font-semibold text-white">Day by day</h3><p className="py-8 text-center text-[13px] text-white/40">Each trading day lands here with its numbers once there are trades.</p></section>;
  return (
    <section className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#121214]/80 backdrop-blur-2xl">
      <header className="flex flex-wrap items-center gap-3 px-5 pt-4">
        <h3 className="text-[16px] font-semibold text-white">Day by day</h3>
        <span className="text-[12.5px] text-white/45">{s.days} trading days</span>
        <span className="flex-1" />
        <Seg size="sm" value={show} onChange={(v) => (setShow(v), setLimit(PAGE))} label="Which days" options={[{ v: "all" as const, l: "All" }, { v: "green" as const, l: "Green" }, { v: "red" as const, l: "Red" }, { v: "flagged" as const, l: "Flagged" }]} />
        <button onClick={() => download(`${name.replace(/[^A-Za-z0-9]+/g, "-")}-days.csv`, ledgerCsv(rows))} className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[12.5px] font-medium text-white/80 hover:bg-white/[0.12]">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 px-5 pb-4 sm:grid-cols-4 xl:grid-cols-8">
        <Fact k="Green days" v={`${s.green} of ${s.days}`} sub={`${Math.round((s.green / Math.max(1, s.days)) * 100)}%`} />
        <Fact k="Average green" v={money(s.avgGreen)} tone="pos" />
        <Fact k="Average red" v={money(s.avgRed)} tone="neg" />
        <Fact k="Best day" v={money(s.bestDay)} tone="pos" />
        <Fact k="Worst day" v={money(s.worstDay)} tone="neg" />
        <Fact k="Streaks" v={`${s.longestGreen} up, ${s.longestRed} down`} />
        <Fact k="Trades a day" v={s.tradesPerDay.toFixed(1)} />
        {firm ? <Fact k="Tightest room" v={usd(Math.max(0, s.tightest))} sub={s.dllDays ? `${s.dllDays} daily limit hit${s.dllDays === 1 ? "" : "s"}` : undefined} /> : <Fact k="Weekday to skip" v={[...s.byWeekday].filter((w) => w.days).sort((a, b) => a.pnl - b.pnl)[0]?.key ?? "None"} />}
      </dl>

      <div className="flex gap-1 px-5 pb-4" role="img" aria-label="P&L by weekday">
        {s.byWeekday.map((w) => (
          <div key={w.key} className="flex-1 rounded-[12px] bg-white/[0.03] px-3 py-2">
            <p className="flex justify-between text-[11.5px] text-white/45">
              <span>{w.key}</span>
              <span className="tabular-nums">{w.days ? `${Math.round((w.green / w.days) * 100)}%` : ""}</span>
            </p>
            <p className={clsx("text-[13.5px] font-semibold tabular-nums", w.pnl >= 0 ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{money(w.pnl)}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className={clsx("grid gap-2 bg-white/[0.03] px-5 py-2 text-[11.5px] font-medium text-white/45", col)}>
            <span />
            <span>Day</span>
            <span className="text-right">Trades</span>
            <span className="text-right">P&amp;L</span>
            <span className="text-right">R</span>
            <span className="text-right">Balance</span>
            {firm ? <span className="text-right">Room left</span> : <span className="text-right">Low</span>}
            {firm && <span className="text-right">To target</span>}
            <span className="pl-2">Notes</span>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {list.slice(0, limit).map((r) => (
              <Fragment key={r.date}>
                <button onClick={() => setOpen(open === r.date ? null : r.date)} aria-expanded={open === r.date} className={clsx("relative grid w-full items-center gap-2 border-t border-white/[0.04] px-5 py-2 text-left text-[12.5px] tabular-nums hover:bg-white/[0.03]", col)}>
                  <span className="absolute inset-y-0 left-0" style={{ width: `${(Math.abs(r.pnl) / best) * 28}%`, background: r.pnl >= 0 ? "rgba(48,209,88,0.07)" : "rgba(255,122,133,0.08)" }} />
                  <ChevronRight className={clsx("relative h-3.5 w-3.5 text-white/30 transition-transform", open === r.date && "rotate-90")} />
                  <span className="relative text-white/80">
                    <span className="mr-1.5 text-white/40">{r.weekday}</span>
                    {nice(r.date)}
                  </span>
                  <span className="relative text-right text-white/60">
                    {r.wins}/{r.trades}
                  </span>
                  <span className={clsx("relative text-right font-semibold", r.pnl >= 0 ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{money(r.pnl)}</span>
                  <span className="relative text-right text-white/55">{r.r >= 0 ? "+" : ""}{r.r.toFixed(1)}</span>
                  <span className="relative text-right text-white/80">${Math.round(r.balance).toLocaleString("en-US")}</span>
                  {firm ? <span className={clsx("relative text-right", r.tightest < program.drawdown * 0.25 ? "text-[#FFA3AB]" : "text-white/70")}>{usd(Math.max(0, r.room))}</span> : <span className="relative text-right text-white/55">${Math.round(r.low).toLocaleString("en-US")}</span>}
                  {firm && <span className="relative text-right text-white/60">{Math.round(r.progress * 100)}%</span>}
                  <span className="relative flex min-w-0 gap-1 pl-2">
                    {firm !== undefined && whoOf(r.items) && <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-medium text-white/70">{whoOf(r.items)}</span>}
                    {r.flags.map((f) => (
                      <span key={f} className={clsx("truncate rounded-full px-2 py-0.5 text-[11px] font-medium", /floor|limit/i.test(f) ? "bg-[#FF7A85]/15 text-[#FFA3AB]" : "bg-white/[0.07] text-white/65")}>
                        {f}
                      </span>
                    ))}
                  </span>
                </button>
                {open === r.date && (
                  <div className="border-t border-white/[0.04] bg-black/25 px-5 py-3">
                    <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-white/55">
                      <span>Intraday low ${Math.round(r.low).toLocaleString("en-US")}</span>
                      <span>High ${Math.round(r.high).toLocaleString("en-US")}</span>
                      <span>Best trade {money(r.best)}</span>
                      <span>Worst trade {money(r.worst)}</span>
                      {firm && <span>Floor ${Math.round(r.floor).toLocaleString("en-US")}</span>}
                      {firm && <span>Closest to the floor {usd(Math.max(0, r.tightest))}</span>}
                      {r.dllUsed != null && <span>{Math.round(r.dllUsed * 100)}% of the daily limit used</span>}
                      {r.bestDayShare != null && r.pnl > 0 && <span>{Math.round(r.bestDayShare * 100)}% of the best-day limit</span>}
                    </div>
                    <div className="space-y-0.5">
                      {r.items.map((t, k) => (
                        <p key={k} className="grid grid-cols-[64px_44px_34px_minmax(0,1fr)_72px_52px] gap-2 text-[12px] tabular-nums text-white/70">
                          <span>{et(t.entryT)}</span>
                          <span className={t.side === "long" ? "text-[#9BE1FF]" : "text-[#FFA3AB]"}>{t.side === "long" ? "Long" : "Short"}</span>
                          <span className="text-right">{t.qty}×</span>
                          <span className="truncate text-white/50">
                            {(t as unknown as { who?: string }).who === "manual" ? "You. " : (t as unknown as { who?: string }).who === "auto" ? "Auto. " : ""}{t.entryPx} to {t.exitPx}{t.why ? `, ${t.why}` : ""}
                          </span>
                          <span className={clsx("text-right font-medium", t.pnl >= 0 ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{money(t.pnl)}</span>
                          <span className="text-right text-white/50">{t.r >= 0 ? "+" : ""}{t.r.toFixed(2)}R</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </Fragment>
            ))}
            {list.length > limit && (
              <button onClick={() => setLimit(limit + PAGE * 3)} className="w-full border-t border-white/[0.04] py-2.5 text-[12.5px] font-medium text-white/60 hover:bg-white/[0.04]">
                Show more ({list.length - limit} left)
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Who placed a day's trades, when the trades say. */
function whoOf(items: DaySim["trades"]) {
  const who = new Set(items.map((t) => (t as unknown as { who?: string }).who).filter(Boolean));
  return who.size === 2 ? "You and auto" : who.has("manual") ? "You" : who.has("auto") ? "Auto" : "";
}

function Fact({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-white/45">{k}</dt>
      <dd className={clsx("truncate text-[15px] font-semibold tabular-nums tracking-tight", tone === "pos" ? "text-[#7CE59A]" : tone === "neg" ? "text-[#FFA3AB]" : "text-white")}>{v}</dd>
      {sub && <dd className="text-[11px] text-white/40">{sub}</dd>}
    </div>
  );
}
