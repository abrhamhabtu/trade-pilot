"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Copy, MessageSquarePlus, Pause, Play, Settings2, Sparkles, Trash2, Trophy, XOctagon } from "lucide-react";
import { MAX_RUNNING, useProvingStore, type ProvingTest } from "@/store/provingStore";
import { INSTRUMENTS, STRATEGIES, stats, toSessions, type SimTrade } from "@/lib/proving/engine";
import { DD_LABEL, FIRM_PROGRAMS, evaluate, programByKey, type Evaluation } from "@/lib/proving/firms";
import { feedFor, loadFeed } from "@/lib/proving/runner";
import { pilotHref } from "@/lib/pilot/askPilot";
import type { Bar } from "@/lib/pilot/market";
import { EquityChart, SessionChart, sessionBars } from "./charts";
import { NewTest } from "./NewTest";

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const et = (t: number) => new Date(t * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

export function TestDetail({ test, evaluation }: { test: ProvingTest; evaluation: Evaluation }) {
  const { update, retune, remove, add, addNote, removeNote } = useProvingStore();
  const program = programByKey(test.programKey)!;
  const days = useMemo(() => Object.values(test.days).filter((d) => d.date >= test.startDate).sort((a, b) => a.date.localeCompare(b.date)), [test.days, test.startDate]);
  const st = stats(days);
  const e = evaluation;
  const [tuning, setTuning] = useState(false);
  const [note, setNote] = useState("");
  const [noteFor, setNoteFor] = useState<{ date?: string; tradeId?: string } | null>(null);

  const traded = days.filter((d) => d.trades.length);
  const [date, setDate] = useState<string | null>(null);
  const focus = date ?? traded[traded.length - 1]?.date ?? days[days.length - 1]?.date ?? null;
  const [bars, setBars] = useState<Bar[]>([]);
  useEffect(() => {
    const { source, tf } = feedFor(test);
    loadFeed(source, tf).then((f) => setBars(f.bars)).catch(() => setBars([]));
  }, [test, test.lastRun]);
  const focusDay = focus ? test.days[focus] : null;
  const session = useMemo(() => (focus ? sessionBars(bars, focus) : []), [bars, focus]);
  const sessions = useMemo(() => toSessions(bars), [bars]);
  // The levels the strategy knew that morning.
  const ctx = useMemo(() => {
    const c = sessions.find((x) => x.date === focus)?.ctx;
    if (!c) return [];
    return [
      { label: "PDH", px: c.pdh },
      { label: "PDL", px: c.pdl },
      { label: "ONH", px: c.onh },
      { label: "ONL", px: c.onl },
    ].filter((l): l is { label: string; px: number } => l.px != null);
  }, [sessions, focus]);

  const matrix = useMemo(
    () =>
      FIRM_PROGRAMS.filter((p) => p.size === program.size).map((p) => ({
        p,
        e: evaluate(days, p, { contracts: test.cfg.contracts, micro: INSTRUMENTS[test.cfg.instrument].micro }),
      })),
    [days, program.size, test.cfg.contracts, test.cfg.instrument],
  );

  const allTrades = days.flatMap((d) => d.trades).reverse();
  const tone = e.verdict === "passed" ? "green" : e.verdict === "failed" ? "red" : "yellow";
  const summary = `My Proving Ground test "${test.name}": ${STRATEGIES[test.cfg.strategy].label} on ${test.cfg.contracts} ${test.cfg.instrument} (${test.cfg.timeframe}), ${program.firm} ${program.program} ${program.sizeLabel}. Result so far: ${e.headline}. ${e.detail} ${st.trades} trades, ${Math.round(st.winRate)}% win rate, profit factor ${Number.isFinite(st.profitFactor) ? st.profitFactor.toFixed(2) : "n/a"}, net ${signed(st.net)}, worst drawdown ${usd(st.maxDrawdown)}. My notes: ${test.notes.map((n) => n.text).join(" | ") || "none"}. What single rule change is most likely to make this pass, and why?`;

  const saveNote = () => {
    if (!note.trim()) return;
    addNote(test.id, { text: note.trim(), ...(noteFor || {}) });
    setNote("");
    setNoteFor(null);
  };

  return (
    <div className="space-y-6">
      {/* Verdict */}
      <div
        className={clsx(
          "relative overflow-hidden rounded-2xl border p-5",
          tone === "green" ? "border-tp-green/30 bg-gradient-to-r from-tp-green/[0.12] to-transparent" : tone === "red" ? "border-tp-red/30 bg-gradient-to-r from-tp-red/[0.12] to-transparent" : "border-white/[0.08] bg-gradient-to-r from-white/[0.04] to-transparent",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className={clsx("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", tone === "green" ? "bg-tp-green/15 text-tp-green" : tone === "red" ? "bg-tp-red/15 text-tp-red" : "bg-white/[0.06] text-zinc-300")}>
              {e.verdict === "passed" ? <Trophy className="h-6 w-6" /> : e.verdict === "failed" ? <XOctagon className="h-6 w-6" /> : <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: test.color }} />}
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                {program.firm} · {program.program} · {program.sizeLabel}
              </p>
              <h2 className={clsx("mt-0.5 text-xl font-semibold", tone === "green" ? "text-tp-green" : tone === "red" ? "text-tp-red" : "text-zinc-50")}>
                {e.verdict === "passed" ? "PASSED" : e.verdict === "failed" ? "FAILED" : test.state === "paused" ? "PAUSED" : "IN PROGRESS"} · {e.headline}
              </h2>
              <p className="mt-1 max-w-2xl text-[13px] text-zinc-400">{e.detail}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(e.verdict === "active" || e.verdict === "pending") && <Btn
              onClick={() => {
                if (test.state === "paused" && useProvingStore.getState().tests.filter((t) => t.state === "running").length >= MAX_RUNNING)
                  return alert(`${MAX_RUNNING} tests are already running. Pause one first.`);
                update(test.id, { state: test.state === "running" ? "paused" : "running" });
              }}
              icon={test.state === "running" ? Pause : Play}
            >
              {test.state === "running" ? "Pause" : "Resume"}
            </Btn>}
            <Btn onClick={() => setTuning(true)} icon={Settings2}>Tweak rules</Btn>
            <Btn onClick={() => add({ name: `${test.name} (copy)`, cfg: test.cfg, programKey: test.programKey, startDate: test.startDate })} icon={Copy}>Duplicate</Btn>
            <Btn onClick={() => confirm(`Delete "${test.name}"? Its trades and notes go with it.`) && remove(test.id)} icon={Trash2} danger>
              Delete
            </Btn>
          </div>
        </div>
      </div>

      {/* Equity + gauges */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Account balance · as {program.firm} sees it</p>
            <div className="flex gap-3 font-mono text-[10px] text-zinc-500">
              <span className="flex items-center gap-1"><span className="h-0.5 w-3" style={{ background: test.color }} />balance</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-3 border-t border-dashed border-tp-red" />{DD_LABEL[program.ddType].toLowerCase()} drawdown</span>
            </div>
          </div>
          {e.marks.length ? (
            <EquityChart marks={e.marks} start={program.size} target={program.target} color={test.color} verdict={e.verdict} />
          ) : (
            <div className="grid h-[280px] place-items-center rounded-xl border border-dashed border-white/[0.08] text-center text-[13px] text-zinc-500">
              {test.error ? test.error : test.lastRun ? "No sessions yet. The first one trades at the next open." : "Replaying history…"}
            </div>
          )}
        </section>
        <section className="space-y-3 rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Firm rules</p>
          <Gauge label="Profit target" value={Math.max(0, e.profit)} max={program.target} text={`${signed(e.profit)} of ${usd(program.target)}`} tone={e.profit >= program.target ? "green" : "blue"} />
          <Gauge label={`${DD_LABEL[program.ddType]} buffer`} value={Math.max(0, e.buffer)} max={program.drawdown} text={`${usd(e.buffer)} left of ${usd(program.drawdown)}`} tone={e.buffer < program.drawdown * 0.3 ? "red" : e.buffer < program.drawdown * 0.6 ? "yellow" : "green"} />
          <Gauge
            label={`Consistency · ${program.consistencyPct}%`}
            value={e.profit > 0 ? e.bestDay : 0}
            max={Math.max(e.consistencyLimit, 1)}
            text={e.profit > 0 ? `Best day ${usd(e.bestDay)} · limit ${usd(e.consistencyLimit)}` : "Scored once the account is up"}
            tone={e.consistencyOk ? "green" : "red"}
          />
          <Gauge label="Trading days" value={e.daysTraded} max={program.minDays} text={`${e.daysTraded} of ${program.minDays} minimum`} tone={e.daysTraded >= program.minDays ? "green" : "blue"} />
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Stat k="Trades" v={String(st.trades)} />
            <Stat k="Win rate" v={`${Math.round(st.winRate)}%`} />
            <Stat k="PF" v={Number.isFinite(st.profitFactor) ? st.profitFactor.toFixed(2) : "∞"} />
            <Stat k="Avg R" v={st.avgR.toFixed(2)} />
            <Stat k="Net" v={signed(st.net)} tone={st.net >= 0 ? "green" : "red"} />
            <Stat k="Max DD" v={usd(st.maxDrawdown)} />
          </div>
        </section>
      </div>

      {/* Session replay */}
      <section className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            Session replay · {focus ? shortDate(focus) : "—"} {focusDay?.partial && <span className="ml-1 rounded bg-tp-red/15 px-1 text-tp-red">LIVE</span>}
          </p>
          <div className="flex w-full min-w-0 gap-1 overflow-x-auto pb-1 [scrollbar-width:thin] sm:w-auto sm:max-w-[60%]">
            {days.map((d) => (
              <button
                key={d.date}
                onClick={() => setDate(d.date)}
                title={`${shortDate(d.date)} · ${d.trades.length} trades · ${signed(d.pnl)}`}
                className={clsx(
                  "h-7 w-4 shrink-0 rounded-[3px] transition",
                  !d.trades.length ? "bg-white/[0.05]" : d.pnl >= 0 ? "bg-tp-green/60" : "bg-tp-red/60",
                  focus === d.date ? "ring-2 ring-white/70 ring-offset-1 ring-offset-tp-card" : "hover:opacity-80",
                )}
                style={d.trades.length ? { opacity: 0.45 + Math.min(0.55, Math.abs(d.pnl) / 800) } : undefined}
              />
            ))}
          </div>
        </div>
        <SessionChart bars={session} trades={focusDay?.trades ?? []} levels={ctx} />
        {focusDay && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-zinc-400">
            <span className={clsx("font-semibold", focusDay.pnl >= 0 ? "text-tp-green" : "text-tp-red")}>{signed(focusDay.pnl)}</span>
            <span>· {focusDay.trades.length} {focusDay.trades.length === 1 ? "trade" : "trades"}</span>
            {focusDay.halted && <span className="text-tp-yellow">· Stopped for the day: {focusDay.halted}</span>}
            <button onClick={() => setNoteFor({ date: focusDay.date })} className="ml-auto inline-flex items-center gap-1 font-medium text-zinc-300 hover:text-zinc-50">
              <MessageSquarePlus className="h-3.5 w-3.5" /> Note on this session
            </button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Firm matrix */}
        <section className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Same trades, every firm · {program.sizeLabel}</p>
            <span className="text-[11px] text-zinc-500">{matrix.filter((m) => m.e.verdict === "passed").length} pass · {matrix.filter((m) => m.e.verdict === "failed").length} fail</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {matrix
              .sort((a, b) => rank(a.e) - rank(b.e))
              .map(({ p, e: me }) => (
                <div key={p.key} className={clsx("flex items-center gap-3 py-2.5", p.key === test.programKey && "-mx-2 rounded-lg bg-white/[0.03] px-2")}>
                  <VerdictDot v={me.verdict} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-zinc-100">
                      {p.firm} <span className="text-zinc-500">· {p.program}</span>
                    </p>
                    <p className="truncate text-[11.5px] text-zinc-500">
                      {DD_LABEL[p.ddType]} {usd(p.drawdown)} · {p.consistencyPct}% consistency · {me.headline}
                    </p>
                  </div>
                  {p.key !== test.programKey && (
                    <button onClick={() => add({ name: `${STRATEGIES[test.cfg.strategy].short} · ${p.firm.split(" ")[0]} ${p.sizeLabel}`, cfg: test.cfg, programKey: p.key, startDate: test.startDate })} className="shrink-0 text-[11.5px] font-medium text-tp-blue hover:underline">
                      Run here
                    </button>
                  )}
                </div>
              ))}
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Lab notes</p>
          {noteFor && (
            <p className="mb-2 flex items-center gap-2 text-[11.5px] text-tp-blue">
              Note on {noteFor.tradeId ? `trade ${noteFor.tradeId.split("-").pop()} of ` : ""}
              {noteFor.date ? shortDate(noteFor.date) : ""}
              <button onClick={() => setNoteFor(null)} className="text-zinc-500 hover:text-zinc-200">clear</button>
            </p>
          )}
          <textarea
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            onKeyDown={(ev) => ev.key === "Enter" && (ev.metaKey || ev.ctrlKey) && saveNote()}
            rows={3}
            placeholder="What would you change? e.g. Skip longs when price opens below PDL."
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-tp-green/40 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <Link href={pilotHref(summary)} className="inline-flex items-center gap-1 text-[12px] font-medium text-tp-green hover:underline">
              <Sparkles className="h-3.5 w-3.5" /> Ask Pilot how to make it pass
            </Link>
            <button onClick={saveNote} disabled={!note.trim()} className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-zinc-100 hover:bg-white/[0.12] disabled:opacity-40">
              Save note
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {[...test.notes].reverse().map((n) => (
              <li key={n.id} className="group rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5">
                <p className="text-[12.5px] leading-snug text-zinc-200">{n.text}</p>
                <p className="mt-1 flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                  {new Date(n.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {n.date && <button onClick={() => setDate(n.date!)} className="text-tp-blue hover:underline">{shortDate(n.date)}</button>}
                  <button onClick={() => removeNote(test.id, n.id)} className="ml-auto opacity-0 hover:text-zinc-200 group-hover:opacity-100">delete</button>
                </p>
              </li>
            ))}
            {!test.notes.length && <li className="text-[12px] text-zinc-500">Notes stay with the test, so the next version starts from what you learned.</li>}
          </ul>
        </section>
      </div>

      {/* Trades */}
      <section className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Trades · {allTrades.length}</p>
        {allTrades.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-2 font-normal">Session</th>
                  <th className="pb-2 font-normal">Side</th>
                  <th className="pb-2 font-normal">Entry → exit</th>
                  <th className="pb-2 font-normal">Why</th>
                  <th className="pb-2 font-normal">Exit</th>
                  <th className="pb-2 text-right font-normal">R</th>
                  <th className="pb-2 text-right font-normal">P&L</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {allTrades.slice(0, 60).map((t) => (
                  <TradeRow key={t.id} t={t} onOpen={() => setDate(t.date)} onNote={() => setNoteFor({ date: t.date, tradeId: t.id })} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-zinc-500">No trades yet.</p>
        )}
      </section>

      {tuning && (
        <NewTest
          title="Tweak rules"
          cta="Re-run with these rules"
          initial={{ name: test.name, cfg: test.cfg, programKey: test.programKey }}
          onClose={() => setTuning(false)}
          onCreate={(t) => {
            retune(test.id, t.cfg, t.programKey);
            update(test.id, { name: t.name, startDate: t.startDate });
            addNote(test.id, { text: `Re-ran with new rules: ${STRATEGIES[t.cfg.strategy].short}, ${t.cfg.contracts} ${t.cfg.instrument}, ${t.cfg.targetR}R, window to ${t.cfg.lastEntry}.` });
            setTuning(false);
          }}
        />
      )}
    </div>
  );
}

const rank = (e: Evaluation) => (e.verdict === "passed" ? 0 : e.verdict === "active" ? 1 : e.verdict === "pending" ? 2 : 3);

function TradeRow({ t, onOpen, onNote }: { t: SimTrade; onOpen: () => void; onNote: () => void }) {
  return (
    <tr className="group cursor-pointer hover:bg-white/[0.02]" onClick={onOpen}>
      <td className="py-2 text-zinc-300">
        {new Date(`${t.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} <span className="font-mono text-zinc-500">{et(t.entryT)}</span>
      </td>
      <td className={clsx("py-2 font-medium", t.side === "long" ? "text-tp-green" : "text-tp-red")}>{t.side === "long" ? "Long" : "Short"} {t.qty}</td>
      <td className="py-2 font-mono text-zinc-300">{t.entryPx.toLocaleString("en-US")} → {t.exitPx.toLocaleString("en-US")}</td>
      <td className="max-w-[220px] truncate py-2 text-zinc-400">{t.why}</td>
      <td className="py-2">
        <span className={clsx("rounded px-1.5 py-0.5 font-mono text-[10px] uppercase", t.exit === "target" ? "bg-tp-green/10 text-tp-green" : t.exit === "stop" ? "bg-tp-red/10 text-tp-red" : t.exit === "open" ? "bg-tp-blue/10 text-tp-blue" : "bg-white/[0.05] text-zinc-400")}>{t.exit}</span>
      </td>
      <td className={clsx("py-2 text-right font-mono", t.r >= 0 ? "text-tp-green" : "text-tp-red")}>{t.r >= 0 ? "+" : ""}{t.r}</td>
      <td className={clsx("py-2 text-right font-mono font-semibold", t.pnl >= 0 ? "text-tp-green" : "text-tp-red")}>{signed(t.pnl)}</td>
      <td className="py-2 pl-2 text-right">
        <button
          aria-label="Note on this trade"
          onClick={(ev) => {
            ev.stopPropagation();
            onNote();
          }}
          className="text-zinc-600 opacity-0 hover:text-zinc-200 group-hover:opacity-100"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

export function VerdictDot({ v }: { v: Evaluation["verdict"] }) {
  return (
    <span
      className={clsx(
        "grid h-6 w-[58px] shrink-0 place-items-center rounded-md font-mono text-[9.5px] font-semibold uppercase tracking-wider",
        v === "passed" ? "bg-tp-green/15 text-tp-green" : v === "failed" ? "bg-tp-red/15 text-tp-red" : "bg-white/[0.06] text-zinc-400",
      )}
    >
      {v === "passed" ? "Pass" : v === "failed" ? "Fail" : v === "active" ? "Open" : "—"}
    </span>
  );
}

function Btn({ children, onClick, icon: Icon, danger }: { children: React.ReactNode; onClick: () => void; icon: typeof Play; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition",
        danger ? "border-tp-red/20 text-tp-red/90 hover:bg-tp-red/10" : "border-white/[0.08] bg-white/[0.03] text-zinc-200 hover:border-white/[0.16] hover:text-zinc-50",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function Gauge({ label, value, max, text, tone }: { label: string; value: number; max: number; text: string; tone: "green" | "red" | "yellow" | "blue" }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] text-zinc-400">{label}</span>
        <span className="font-mono text-[11px] text-zinc-300">{Math.round(pct)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={clsx("h-full rounded-full transition-[width] duration-700", tone === "green" ? "bg-tp-green" : tone === "red" ? "bg-tp-red" : tone === "yellow" ? "bg-tp-yellow" : "bg-tp-blue")}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">{text}</p>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "green" | "red" }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-center ring-1 ring-inset ring-white/[0.04]">
      <p className={clsx("font-mono text-[13px] font-semibold tabular-nums", tone === "green" ? "text-tp-green" : tone === "red" ? "text-tp-red" : "text-zinc-100")}>{v}</p>
      <p className="text-[10px] text-zinc-500">{k}</p>
    </div>
  );
}
