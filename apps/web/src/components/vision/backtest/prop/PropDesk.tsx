"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Bot, Building2, CheckCircle2, ChevronDown, CircleDashed, Copy, Download, Hand, Loader2, Pencil, Play, Plus, RotateCcw, Trash2, Trophy, XCircle } from "lucide-react";
import { READERS, READER_ORDER, type ReaderChoice } from "@/lib/vision/analyze";
import { accountCsv, accountState, resetAccount, uid, type AccountState, type PropAccount } from "@/lib/vision/account";
import { SYMBOLS, isSymbol } from "@/lib/vision/markets";
import { SESSION_WINDOWS, type SessionKey } from "@/lib/vision/custom";
import { DD_LABEL } from "@/lib/proving/firms";
import { useVisionStore } from "@/store/visionStore";
import { Num, Seg } from "../ui";
import { download, money, timeOf, type Library } from "../data";
import { DayLedger } from "./DayLedger";
import { EdgeLab } from "./EdgeLab";
import { NewAccount } from "./NewAccount";

const VIOLET = "#BF5AF2";
const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const sdate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export type AutoRunRequest = { strategy: { logic: "vision"; reader: ReaderChoice } | { logic: "custom" }; session: SessionKey; horizon: "pass" | number };
export type AutoRunResult = { added: number; pnl: number; text: string } | { error: string };

export function PropDesk({ accounts, lib, error, onSave, onRemove, onReplay, onAutoRun }: { accounts: PropAccount[] | null; lib: Library | null; error: string; onSave: (a: PropAccount) => Promise<PropAccount>; onRemove: (id: string) => void; onReplay: (a: PropAccount) => void; onAutoRun: (a: PropAccount, r: AutoRunRequest) => Promise<AutoRunResult> }) {
  const openId = useVisionStore((s) => s.propAccount);
  const set = useVisionStore((s) => s.set);
  const [wizard, setWizard] = useState<Partial<PropAccount> | null>(null);
  const list = useMemo(() => accounts ?? [], [accounts]);
  const states = useMemo(() => new Map(list.map((a) => [a.id, accountState(a)])), [list]);
  const open = list.find((a) => a.id === openId) ?? null;

  const create = async (a: PropAccount) => {
    setWizard(null);
    await onSave(a);
    set({ propAccount: a.id });
  };

  return (
    <div className="space-y-5">
      {open ? (
        <Detail a={open} s={states.get(open.id) ?? null} hasData={!!lib?.series[open.symbol]} dataTo={lib?.series[open.symbol]?.to} onBack={() => set({ propAccount: null })} onSave={onSave} onRemove={(id) => (onRemove(id), set({ propAccount: null }))} onReplay={onReplay} onAutoRun={onAutoRun} onDuplicate={(a) => setWizard({ ...a })} onFunded={async (a, s) => {
          const f: PropAccount = { ...a, id: uid(), name: `${a.name} · Funded`, phase: "funded", parentId: a.id, createdAt: Date.now(), updatedAt: Date.now(), trades: [], history: [], resets: 0, startDate: s.lastDay ?? a.startDate, cursorT: a.cursorT, events: [{ at: Date.now(), kind: "funded", text: `Funded after passing ${a.name}` }] };
          await onSave({ ...a, events: [...a.events, { at: Date.now(), kind: "funded", text: "Continued as a funded account" }] });
          await onSave(f);
          set({ propAccount: f.id });
        }} />
      ) : (
        <Gallery accounts={list} states={states} loading={accounts == null} error={error} onOpen={(id) => set({ propAccount: id })} onNew={() => setWizard({})} />
      )}
      {wizard && <NewAccount lib={lib} existing={list} start={wizard} onCancel={() => setWizard(null)} onCreate={create} />}
    </div>
  );
}

// ── All accounts ──

function Gallery({ accounts, states, loading, error, onOpen, onNew }: { accounts: PropAccount[]; states: Map<string, AccountState | null>; loading: boolean; error: string; onOpen: (id: string) => void; onNew: () => void }) {
  const all = accounts.map((a) => ({ a, s: states.get(a.id) ?? null }));
  const evals = all.filter((x) => x.a.phase === "eval");
  const passed = evals.filter((x) => x.s?.status === "passed").length + all.reduce((n, x) => n + x.a.history.filter((h) => h.result === "passed").length, 0);
  const blown = evals.filter((x) => x.s?.status === "blown").length + all.reduce((n, x) => n + x.a.history.filter((h) => h.result === "blown").length, 0);
  const fees = all.reduce((n, x) => n + (x.s?.fees ?? 0), 0);
  const decided = passed + blown;
  return (
    <>
      <section className="overflow-hidden rounded-[28px] border border-[#BF5AF2]/30 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(191,90,242,0.2),rgba(18,18,20,0.9)_55%)] p-6 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] text-white">Beat the firm before you pay it.</h2>
            <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-white/60">Open a practice account at any firm, start it on any day in your history, and fill it with trades by hand in replay, with your strategies, or both. Every account keeps its balance, trailing floor and record, graded on the firm&apos;s own rules.</p>
          </div>
          <button onClick={onNew} className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-black active:scale-[0.98]">
            <Plus className="h-4 w-4" /> New account
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-5">
          <Rec k="Accounts" v={String(accounts.length)} />
          <Rec k="Passed" v={String(passed)} tone="pos" />
          <Rec k="Blown" v={String(blown)} tone="neg" />
          <Rec k="Your pass rate" v={decided ? `${Math.round((passed / decided) * 100)}%` : "—"} />
          <Rec k="Fees paid" v={usd(fees)} />
        </div>
      </section>

      {error && <p className="rounded-2xl bg-[#FF7A85]/12 px-4 py-2.5 text-[13px] text-[#FFA3AB]">{error}</p>}
      {loading ? (
        <p className="py-10 text-center text-[13px] text-white/40">Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["1", "Pick the firm and account", "Lucid, Tradeify, Topstep, Apex and the rest, every size, with the rules shown before you commit."],
            ["2", "Start it on any day", "A date you choose, a famous week, or a random day so memory can't help you."],
            ["3", "Trade it until it passes or blows", "Replay by hand, run a strategy forward, or both. It saves as you go and picks up where you left off."],
          ].map(([n, t, d]) => (
            <button key={n} onClick={onNew} className="rounded-[22px] bg-[#121214]/80 p-5 text-left ring-1 ring-white/[0.07] hover:bg-white/[0.05]">
              <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-white text-[13px] font-bold text-black">{n}</span>
              <p className="mt-3 text-[15px] font-bold text-white">{t}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-white/50">{d}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {all.map(({ a, s }) => (
            <AccountCard key={a.id} a={a} s={s} onOpen={() => onOpen(a.id)} />
          ))}
          <button onClick={onNew} className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-white/[0.1] text-white/50 hover:border-[#BF5AF2]/50 hover:text-white">
            <Plus className="h-6 w-6" />
            <span className="text-[14px] font-semibold">New account</span>
          </button>
        </div>
      )}
    </>
  );
}

function Rec({ k, v, tone }: { k: string; v: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-[18px] bg-black/25 px-4 py-3 ring-1 ring-inset ring-white/[0.06]">
      <p className="text-[12px] font-medium text-white/50">{k}</p>
      <p className={clsx("mt-1 text-[26px] font-bold tabular-nums tracking-tight", tone === "pos" ? "text-[#7CE59A]" : tone === "neg" ? "text-[#FFA3AB]" : "text-white")}>{v}</p>
    </div>
  );
}

function StatusPill({ a, s }: { a: PropAccount; s: AccountState | null }) {
  const st = s?.status ?? "active";
  return (
    <span className={clsx("flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold", st === "passed" ? "bg-[#30D158]/15 text-[#7CE59A]" : st === "blown" ? "bg-[#FF7A85]/15 text-[#FFA3AB]" : a.phase === "funded" ? "bg-[#FFD60A]/12 text-[#FFE27A]" : "bg-white/[0.08] text-white/70")}>
      {st === "passed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : st === "blown" ? <XCircle className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
      {st === "passed" ? "Passed" : st === "blown" ? "Blown" : a.phase === "funded" ? (s?.payoutReady ? "Payout-ready" : "Funded") : a.trades.length ? "In evaluation" : "New"}
    </span>
  );
}

function AccountCard({ a, s, onOpen }: { a: PropAccount; s: AccountState | null; onOpen: () => void }) {
  const p = s?.program;
  return (
    <button onClick={onOpen} className="group relative overflow-hidden rounded-[24px] p-5 text-left ring-1 ring-white/[0.08] transition hover:-translate-y-0.5 hover:ring-white/20" style={{ background: `linear-gradient(155deg, ${a.color}26, rgba(18,18,20,0.92) 55%)` }}>
      <div className="flex items-start gap-3">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: a.color, boxShadow: `0 0 16px ${a.color}` }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold tracking-tight text-white">{a.name}</p>
          <p className="truncate text-[12px] text-white/50">
            {p ? `${p.firm} ${p.sizeLabel} · ${p.program}` : a.program} · {a.symbol} {a.tf}
          </p>
        </div>
        <StatusPill a={a} s={s} />
      </div>
      {s && p && (
        <>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-semibold text-white/45">Balance</p>
              <p className="text-[26px] font-bold tabular-nums tracking-tight text-white">${Math.round(s.balance).toLocaleString("en-US")}</p>
            </div>
            <Spark curve={s.curve} start={p.size} color={a.color} />
          </div>
          <div className="mt-3 space-y-2">
            {a.phase === "eval" && <Bar label="Target" v={s.profit} max={p.target} color="#30D158" text={`${money(s.profit)} / ${usd(p.target)}`} />}
            <Bar label="Drawdown left" v={s.buffer} max={p.drawdown} color={VIOLET} text={usd(s.buffer)} />
          </div>
          <p className="mt-3 flex items-center justify-between text-[11.5px] text-white/45">
            <span>
              {a.trades.length} trades · {s.daysTraded} days{a.resets ? ` · ${a.resets} reset${a.resets > 1 ? "s" : ""}` : ""}
            </span>
            <span>{a.cursorT ? `At ${timeOf(a.cursorT)}` : `Starts ${sdate(a.startDate)}`}</span>
          </p>
        </>
      )}
    </button>
  );
}

function Spark({ curve, start, color }: { curve: AccountState["curve"]; start: number; color: string }) {
  if (curve.length < 2) return <span className="text-[11px] text-white/30">No days yet</span>;
  const vals = [start, ...curve.map((c) => c.balance)];
  const lo = Math.min(...vals, ...curve.map((c) => c.floor));
  const hi = Math.max(...vals);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${((i / (vals.length - 1)) * 110).toFixed(1)},${(34 - ((v - lo) / (hi - lo || 1)) * 30).toFixed(1)}`).join("");
  return (
    <svg width="110" height="36" className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function Bar({ label, v, max, color, text }: { label: string; v: number; max: number; color: string; text: string }) {
  const f = Math.max(0, Math.min(1, v / (max || 1)));
  return (
    <div>
      <p className="mb-1 flex justify-between text-[11.5px]">
        <span className="font-semibold text-white/50">{label}</span>
        <span className="tabular-nums text-white/75">{text}</span>
      </p>
      <div className="h-1.5 rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${f * 100}%`, background: color }} />
      </div>
    </div>
  );
}

// ── One account ──

function Detail({ a, s, hasData, dataTo, onBack, onSave, onRemove, onReplay, onAutoRun, onDuplicate, onFunded }: { a: PropAccount; s: AccountState | null; hasData: boolean; dataTo?: number; onBack: () => void; onSave: (a: PropAccount) => Promise<PropAccount>; onRemove: (id: string) => void; onReplay: (a: PropAccount) => void; onAutoRun: (a: PropAccount, r: AutoRunRequest) => Promise<AutoRunResult>; onDuplicate: (a: PropAccount) => void; onFunded: (a: PropAccount, s: AccountState) => void }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(a.name);
  const [confirm, setConfirm] = useState<"reset" | "delete" | null>(null);
  const [menu, setMenu] = useState(false);
  if (!s) return <p className="text-white/50">This account&apos;s firm program is no longer in the list.</p>;
  const p = s.program;
  const done = s.status !== "active";
  const auto = a.mode !== "manual";
  const manual = a.mode !== "auto";
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-semibold text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All accounts
      </button>

      <section className="overflow-hidden rounded-[28px] ring-1 ring-white/[0.08]" style={{ background: `radial-gradient(120% 140% at 0% 0%, ${a.color}33, rgba(18,18,20,0.92) 55%)` }}>
        <header className="flex flex-wrap items-start gap-3 px-6 pt-5">
          <span className="mt-2 h-3.5 w-3.5 rounded-full" style={{ background: a.color, boxShadow: `0 0 18px ${a.color}` }} />
          <div className="min-w-0 flex-1">
            {renaming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) onSave({ ...a, name: name.trim() });
                  setRenaming(false);
                }}
              >
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus onBlur={() => setRenaming(false)} className="w-full rounded-xl bg-white/[0.08] px-3 py-1.5 text-[24px] font-bold text-white outline-none ring-1 ring-[#BF5AF2]/60" />
              </form>
            ) : (
              <button onClick={() => (setName(a.name), setRenaming(true))} className="group flex items-center gap-2 text-left">
                <h2 className="text-[28px] font-bold tracking-[-0.02em] text-white">{a.name}</h2>
                <Pencil className="h-4 w-4 text-white/30 group-hover:text-white/70" />
              </button>
            )}
            <p className="text-[13px] text-white/55">
              {p.firm} {p.sizeLabel}, {p.program}. {a.phase === "funded" ? "Funded" : "Evaluation"} on {a.symbol} {a.tf}.
            </p>
          </div>
          <StatusPill a={a} s={s} />
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="flex items-center gap-1 rounded-full bg-white/[0.08] px-3 py-1.5 text-[12.5px] font-semibold text-white/80 hover:bg-white/[0.12]">
              More <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {menu && (
              <div className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-[16px] bg-[#1C1C1F] p-1 ring-1 ring-white/10" onMouseLeave={() => setMenu(false)}>
                <MenuItem icon={<Copy className="h-4 w-4" />} onClick={() => (setMenu(false), onDuplicate({ ...a, startDate: a.startDate }))}>
                  New account like this
                </MenuItem>
                <MenuItem icon={<Download className="h-4 w-4" />} onClick={() => (setMenu(false), download(`${a.name.replace(/[^A-Za-z0-9]+/g, "-")}.csv`, accountCsv(a)))}>
                  Download trades (CSV)
                </MenuItem>
                <MenuItem icon={<Download className="h-4 w-4" />} onClick={() => (setMenu(false), download(`${a.name.replace(/[^A-Za-z0-9]+/g, "-")}.json`, JSON.stringify(a, null, 2), "application/json"))}>
                  Download account (JSON)
                </MenuItem>
                <MenuItem icon={<RotateCcw className="h-4 w-4" />} onClick={() => (setMenu(false), setConfirm("reset"))}>
                  Reset account
                </MenuItem>
                <MenuItem icon={<Trash2 className="h-4 w-4" />} danger onClick={() => (setMenu(false), setConfirm("delete"))}>
                  Delete account
                </MenuItem>
              </div>
            )}
          </div>
        </header>
        {confirm && (
          <div className="mx-6 mt-3 flex flex-wrap items-center gap-3 rounded-[16px] bg-[#FF7A85]/10 px-4 py-3 ring-1 ring-[#FF7A85]/30">
            <p className="flex-1 text-[13px] text-white/80">{confirm === "reset" ? `Reset like a firm reset: this attempt (${a.trades.length} trades) goes into the record, the balance returns to ${usd(p.size)}, and a ${usd(p.cost)} fee is counted.` : "Delete this account and its trades? This can't be undone."}</p>
            <button onClick={() => setConfirm(null)} className="rounded-full bg-white/[0.08] px-3 py-1.5 text-[12.5px] font-semibold text-white">
              Cancel
            </button>
            <button
              onClick={() => {
                if (confirm === "reset") onSave(resetAccount(a, s));
                else onRemove(a.id);
                setConfirm(null);
              }}
              className="rounded-full bg-[#FF7A85] px-3 py-1.5 text-[12.5px] font-bold text-black"
            >
              {confirm === "reset" ? "Reset" : "Delete"}
            </button>
          </div>
        )}

        <div className="grid gap-5 p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[13px] font-medium text-white/50">Balance</p>
            <p className="mt-1 text-[48px] font-bold leading-none tracking-[-0.04em] tabular-nums text-white">${Math.round(s.balance).toLocaleString("en-US")}</p>
            <p className={clsx("mt-2 text-[15px] font-semibold tabular-nums", s.profit >= 0 ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>
              {money(s.profit, 2)} · {a.trades.length} trades · {a.trades.length ? `${Math.round((s.wins / a.trades.length) * 100)}% win · ${s.netR >= 0 ? "+" : ""}${s.netR.toFixed(1)}R` : "no trades yet"}
            </p>
            <div className={clsx("mt-4 rounded-[18px] px-4 py-3 ring-1", s.status === "passed" ? "bg-[#30D158]/10 ring-[#30D158]/30" : s.status === "blown" ? "bg-[#FF7A85]/10 ring-[#FF7A85]/30" : "bg-black/25 ring-white/[0.06]")}>
              <p className="text-[14px] font-semibold text-white">{s.headline}</p>
              <p className="mt-0.5 text-[12.5px] text-white/55">{s.detail}</p>
            </div>
            {!done && <TradeSize a={a} s={s} onSave={onSave} />}
            <div className="mt-4 flex flex-wrap gap-2">
              {!done && manual && (
                <button onClick={() => onReplay(a)} className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[14.5px] font-bold text-black active:scale-[0.98]">
                  <Hand className="h-4 w-4" /> {a.cursorT ? `Continue replay · ${timeOf(a.cursorT)}` : `Start replay · ${sdate(a.startDate)}`}
                </button>
              )}
              {s.status === "passed" && a.phase === "eval" && (
                <button onClick={() => onFunded(a, s)} className="flex items-center gap-2 rounded-full bg-[#30D158] px-5 py-3 text-[14.5px] font-bold text-black">
                  <Trophy className="h-4 w-4" /> Continue as funded
                </button>
              )}
              {done && (
                <button onClick={() => setConfirm("reset")} className="flex items-center gap-2 rounded-full bg-white/[0.1] px-5 py-3 text-[14.5px] font-semibold text-white">
                  <RotateCcw className="h-4 w-4" /> Reset and try again
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 content-start gap-2.5">
            {a.phase === "eval" ? <Meter k="Profit target" v={s.profit} max={p.target} color="#30D158" text={`${money(s.profit)} of ${usd(p.target)}`} /> : <Meter k="Payout" v={s.profit} max={500} color="#30D158" text={s.payoutReady ? "Eligible" : `${money(s.profit)} · $500 minimum`} />}
            <Meter k="Drawdown left" v={s.buffer} max={p.drawdown} color={VIOLET} text={`${usd(s.buffer)} · floor ${usd(s.threshold)}`} />
            <Meter k="Trading days" v={s.daysTraded} max={Math.max(1, p.minDays)} color="#5AC8FA" text={`${s.daysTraded} of ${p.minDays} minimum`} />
            {s.consistency.applies ? <Meter k="Consistency" v={s.consistency.ok ? 1 : 0.35} max={1} color={s.consistency.ok ? "#30D158" : "#FFD60A"} text={`Best day ${usd(s.bestDay)} · limit ${usd(s.consistency.limit)}`} /> : <Meter k="Consistency" v={1} max={1} color="#30D158" text="No rule on this account" />}
          </div>
        </div>
      </section>

      <EdgeLab a={a} s={s} hasData={hasData} dataTo={dataTo} onSave={onSave} />

      {auto && !done && <AutoRun a={a} onAutoRun={onAutoRun} />}

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Curve s={s} color={a.color} />
        <Calendar s={s} />
      </div>

      <DayLedger days={s.days} program={p} name={a.name} />

      <Rules a={a} s={s} />

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <Ledger a={a} />
        <Timeline a={a} />
      </div>
    </div>
  );
}

/** Size is a decision made at the moment of trading, so it lives next to the buttons that trade. */
function TradeSize({ a, s, onSave }: { a: PropAccount; s: AccountState; onSave: (a: PropAccount) => Promise<PropAccount> }) {
  const p = s.program;
  const roots = isSymbol(a.symbol) ? SYMBOLS[a.symbol].roots : undefined;
  const cap = a.micro ? p.maxMicros : p.maxMinis;
  const pv = isSymbol(a.symbol) ? SYMBOLS[a.symbol].pointValue : undefined;
  const perPoint = pv ? (a.micro ? pv.micro : pv.full) * a.contracts : 0;
  return (
    <div className="mt-4 rounded-[18px] bg-black/25 p-3.5 ring-1 ring-inset ring-white/[0.06]">
      <div className="flex flex-wrap items-center gap-2">
        <Seg size="sm" label="Contract" value={a.micro ? 1 : 0} onChange={(v) => onSave({ ...a, micro: v === 1, contracts: Math.min(a.contracts, v === 1 ? p.maxMicros : p.maxMinis) })} options={[{ v: 1, l: roots?.micro ?? "Micro" }, { v: 0, l: roots?.full ?? "Full" }]} />
        <Seg size="sm" label="Sizing" value={a.sizing} onChange={(v) => onSave({ ...a, sizing: v })} options={[{ v: "fixed" as const, l: "Contracts" }, { v: "risk" as const, l: "% risk" }]} />
        {a.sizing === "fixed" ? <Num value={a.contracts} onChange={(c) => onSave({ ...a, contracts: Math.max(1, Math.min(cap, Math.round(c))) })} min={1} max={cap} width="w-20" /> : <Num value={a.riskPct} onChange={(r) => onSave({ ...a, riskPct: r })} min={0.1} max={5} step={0.1} suffix="%" width="w-24" />}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-white/50">
        {a.sizing === "fixed" ? `${perPoint ? `$${perPoint.toLocaleString("en-US")} a point. ` : ""}A 20-point stop risks $${(perPoint * 20).toLocaleString("en-US")}, ${Math.round(((perPoint * 20) / Math.max(1, s.buffer)) * 100)}% of the room you have left. ` : `Each trade risks about $${Math.round((p.size * a.riskPct) / 100).toLocaleString("en-US")}, ${Math.round(((p.size * a.riskPct) / 100 / Math.max(1, s.buffer)) * 100)}% of the room you have left. `}
        The firm allows {cap}.
      </p>
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={clsx("flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-left text-[13px] font-semibold hover:bg-white/[0.07]", danger ? "text-[#FFA3AB]" : "text-white/80")}>
      {icon} {children}
    </button>
  );
}

function Meter({ k, v, max, color, text }: { k: string; v: number; max: number; color: string; text: string }) {
  const f = Math.max(0, Math.min(1, v / (max || 1)));
  return (
    <div className="rounded-[18px] bg-black/25 px-4 py-3 ring-1 ring-inset ring-white/[0.06]">
      <p className="text-[11.5px] font-semibold text-white/50">{k}</p>
      <div className="mt-2 h-2 rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${f * 100}%`, background: color }} />
      </div>
      <p className="mt-1.5 truncate text-[12.5px] tabular-nums text-white/80">{text}</p>
    </div>
  );
}

// ── Run a strategy forward on the account ──

function AutoRun({ a, onAutoRun }: { a: PropAccount; onAutoRun: (a: PropAccount, r: AutoRunRequest) => Promise<AutoRunResult> }) {
  const bt = useVisionStore((s) => s.bt);
  const [choice, setChoice] = useState<ReaderChoice | "custom">(bt.logic === "custom" && bt.rules ? "custom" : bt.reader);
  const [session, setSession] = useState<SessionKey>(bt.session ?? "ny");
  const [horizon, setHorizon] = useState<"pass" | number>("pass");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<AutoRunResult | null>(null);
  const run = async () => {
    setBusy(true);
    setOut(null);
    const r = await onAutoRun(a, { strategy: choice === "custom" ? { logic: "custom" } : { logic: "vision", reader: choice }, session, horizon });
    setOut(r);
    setBusy(false);
  };
  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-[#121214]/80 p-5 backdrop-blur-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#5AC8FA]/14 text-[#9BE1FF]">
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-white">Run a strategy on this account</p>
          <p className="text-[12.5px] text-white/50">Your pick at the size above, from {a.cursorT ? timeOf(a.cursorT) : sdate(a.startDate)}, on the firm&apos;s rules. Adds to the same balance.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-white/55">Strategy</span>
          <select value={choice} onChange={(e) => setChoice(e.target.value as ReaderChoice | "custom")} className="w-full rounded-xl bg-white/[0.07] px-3 py-2.5 text-[13.5px] text-white ring-1 ring-inset ring-white/[0.08]">
            <option value="auto">Every Vision strategy</option>
            {READER_ORDER.map((r) => (
              <option key={r} value={r}>
                {READERS[r].label}
              </option>
            ))}
            <option value="custom" disabled={!bt.rules}>
              Your rules (from Strategy test){bt.rules ? "" : " — write them there first"}
            </option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-white/55">Session</span>
          <select value={session} onChange={(e) => setSession(e.target.value as SessionKey)} className="w-full rounded-xl bg-white/[0.07] px-3 py-2.5 text-[13.5px] text-white ring-1 ring-inset ring-white/[0.08]">
            {(Object.keys(SESSION_WINDOWS) as SessionKey[]).map((k) => (
              <option key={k} value={k}>
                {SESSION_WINDOWS[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-white/55">How far</span>
          <select value={String(horizon)} onChange={(e) => setHorizon(e.target.value === "pass" ? "pass" : Number(e.target.value))} className="w-full rounded-xl bg-white/[0.07] px-3 py-2.5 text-[13.5px] text-white ring-1 ring-inset ring-white/[0.08]">
            <option value="pass">{a.phase === "eval" ? "Until it passes or blows" : "Until it blows (a year at most)"}</option>
            <option value="5">Next 5 trading days</option>
            <option value="20">Next 20 trading days</option>
            <option value="60">Next 60 trading days</option>
          </select>
        </label>
        <button onClick={run} disabled={busy} className="flex items-center justify-center gap-2 rounded-[14px] bg-gradient-to-b from-[#8EE3FF] to-[#3AB4F2] px-5 py-2.5 text-[14px] font-bold text-black disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />} {busy ? "Trading…" : "Run"}
        </button>
      </div>
      {out && <p className={clsx("mt-3 rounded-2xl px-4 py-2.5 text-[13px]", "error" in out ? "bg-[#FF7A85]/12 text-[#FFA3AB]" : "bg-[#5AC8FA]/10 text-white/85")}>{"error" in out ? out.error : out.text}</p>}
    </section>
  );
}

// ── Balance against the floor ──

function Curve({ s, color }: { s: AccountState; color: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<SVGSVGElement>(null);
  const p = s.program;
  const pts = [{ date: "start", balance: p.size, floor: p.size - p.drawdown, pnl: 0 }, ...s.curve];
  const W = 1000;
  const H = 240;
  const target = p.model === "instant" ? null : p.size + p.target;
  const vals = pts.flatMap((x) => [x.balance, x.floor]).concat(target ? [target] : []);
  const lo = Math.min(...vals) - p.drawdown * 0.08;
  const hi = Math.max(...vals) + p.drawdown * 0.08;
  const x = (i: number) => (i / Math.max(1, pts.length - 1)) * W;
  const y = (v: number) => 10 + (1 - (v - lo) / (hi - lo || 1)) * (H - 20);
  const bal = pts.map((q, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(q.balance).toFixed(1)}`).join("");
  const floor = pts.map((q, i) => `${i ? `L${x(i).toFixed(1)},${y(pts[i - 1].floor).toFixed(1)}L` : "M"}${x(i).toFixed(1)},${y(q.floor).toFixed(1)}`).join("");
  const h = hover != null ? pts[Math.min(hover, pts.length - 1)] : null;
  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-[#121214]/80 p-5 backdrop-blur-2xl">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">Balance vs. the floor</h3>
        <span className="text-[12px] text-white/55">{h ? `${h.date === "start" ? "Start" : sdate(h.date)}: $${Math.round(h.balance).toLocaleString("en-US")} · floor $${Math.round(h.floor).toLocaleString("en-US")}` : `${DD_LABEL[p.ddType]} drawdown`}</span>
      </header>
      {pts.length < 2 ? (
        <p className="py-16 text-center text-[13px] text-white/40">The curve draws itself as the account trades.</p>
      ) : (
        <svg
          ref={box}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-[240px] w-full touch-none"
          onPointerMove={(e) => {
            const r = box.current?.getBoundingClientRect();
            if (r) setHover(Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="acct-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.3" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {target && <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="#30D158" strokeOpacity="0.6" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
          <line x1="0" x2={W} y1={y(p.size)} y2={y(p.size)} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d={`${bal} L${W},${H} L0,${H} Z`} fill="url(#acct-fill)" />
          <path d={floor} fill="none" stroke="#FF7A85" strokeWidth="2" strokeOpacity="0.85" vectorEffect="non-scaling-stroke" />
          <path d={bal} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {hover != null && <line x1={x(Math.min(hover, pts.length - 1))} x2={x(Math.min(hover, pts.length - 1))} y1="0" y2={H} stroke="rgba(255,255,255,0.3)" vectorEffect="non-scaling-stroke" />}
        </svg>
      )}
      <p className="mt-2 flex flex-wrap gap-4 text-[11.5px] text-white/50">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: color }} /> Balance</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#FF7A85]" /> Drawdown floor</span>
        {target && <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed border-[#30D158]" /> Target</span>}
      </p>
    </section>
  );
}

// ── Daily P&L calendar ──

function Calendar({ s }: { s: AccountState }) {
  const byDay = new Map(s.curve.map((c) => [c.date, c.pnl]));
  const months = [...new Set(s.curve.map((c) => c.date.slice(0, 7)))];
  const [k, setK] = useState(months.length - 1);
  const m = months[Math.max(0, Math.min(k, months.length - 1))];
  const max = Math.max(1, ...s.curve.map((c) => Math.abs(c.pnl)));
  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-[#121214]/80 p-5 backdrop-blur-2xl">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">Calendar</h3>
        {m && (
          <span className="flex items-center gap-1">
            <button disabled={k <= 0} onClick={() => setK(k - 1)} className="rounded-full px-2 py-0.5 text-white/60 hover:bg-white/[0.08] disabled:opacity-30" aria-label="Previous month">
              ‹
            </button>
            <span className="text-[13px] font-semibold text-white">{new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
            <button disabled={k >= months.length - 1} onClick={() => setK(k + 1)} className="rounded-full px-2 py-0.5 text-white/60 hover:bg-white/[0.08] disabled:opacity-30" aria-label="Next month">
              ›
            </button>
          </span>
        )}
      </header>
      {!m ? (
        <p className="py-16 text-center text-[13px] text-white/40">Trading days show up here, green and red.</p>
      ) : (
        (() => {
          const [y, mo] = m.split("-").map(Number);
          const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
          const n = new Date(Date.UTC(y, mo, 0)).getUTCDate();
          const cells = [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
          const total = [...byDay.entries()].filter(([d]) => d.startsWith(m)).reduce((a, [, v]) => a + v, 0);
          return (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-semibold text-white/35">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                  if (d == null) return <span key={i} />;
                  const key = `${m}-${String(d).padStart(2, "0")}`;
                  const v = byDay.get(key);
                  const a = v == null ? 0 : 0.25 + (Math.abs(v) / max) * 0.65;
                  return (
                    <span key={i} title={v != null ? `${sdate(key)}: ${money(v, 2)}` : undefined} className="flex aspect-square flex-col items-center justify-center rounded-[8px] text-[11px] ring-1 ring-inset ring-white/[0.04]" style={{ background: v == null ? "rgba(255,255,255,0.02)" : v >= 0 ? `rgba(48,209,88,${a})` : `rgba(255,122,133,${a})` }}>
                      <span className={clsx("font-semibold", v == null ? "text-white/30" : "text-white")}>{d}</span>
                      {v != null && <span className="text-[9px] tabular-nums text-white/85">{Math.abs(v) >= 1000 ? `${v < 0 ? "-" : ""}${(Math.abs(v) / 1000).toFixed(1)}k` : Math.round(v)}</span>}
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-right text-[12px] text-white/55">
                Month: <span className={clsx("font-semibold", total >= 0 ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{money(total, 2)}</span>
              </p>
            </>
          );
        })()
      )}
    </section>
  );
}

// ── The rules, checked ──

function Rules({ a, s }: { a: PropAccount; s: AccountState }) {
  const p = s.program;
  const cap = a.micro ? p.maxMicros : p.maxMinis;
  const maxQty = a.trades.reduce((m, t) => Math.max(m, t.qty), 0);
  const worstDay = s.curve.reduce((m, c) => Math.min(m, c.pnl), 0);
  const rows: { ok: boolean | null; t: string; d: string }[] = [
    ...(a.phase === "eval" ? [{ ok: s.profit >= p.target ? true : null, t: `Reach ${usd(p.target)} profit`, d: `${money(s.profit)} so far` }] : []),
    { ok: s.status !== "blown", t: `Stay above the ${DD_LABEL[p.ddType].toLowerCase()} floor`, d: `Floor ${usd(s.threshold)} · ${usd(s.buffer)} of room${p.lock != null ? ` · stops trailing at ${usd(p.size + p.lock)}` : ""}` },
    { ok: p.dll == null ? true : worstDay > -p.dll, t: p.dll ? `Lose less than ${usd(p.dll)} in a day` : "No daily loss limit", d: `Worst day ${money(worstDay)}` },
    { ok: s.consistency.applies ? (s.profit > 0 ? s.consistency.ok : null) : true, t: s.consistency.applies ? `Best day under ${p.consistencyPct}% of ${p.consistencyBasis === "profitTarget" ? "the target" : "profit"}` : "No consistency rule", d: `Best day ${usd(s.bestDay)}${s.consistency.applies ? ` · limit ${usd(s.consistency.limit)}` : ""}` },
    { ok: s.daysTraded >= p.minDays ? true : null, t: `Trade at least ${p.minDays} day${p.minDays === 1 ? "" : "s"}`, d: `${s.daysTraded} traded` },
    { ok: maxQty <= cap, t: `At most ${cap} ${a.micro ? "micros" : "minis"} at once`, d: maxQty ? `Largest trade ${maxQty}` : "No trades yet" },
  ];
  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-[#121214]/80 p-5 backdrop-blur-2xl">
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">
        {p.firm} rules · {p.sizeLabel}
      </h3>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <div key={r.t} className="flex items-start gap-2.5 rounded-[16px] bg-white/[0.03] px-3 py-2.5">
            {r.ok === true ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7CE59A]" /> : r.ok === false ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FFA3AB]" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white">{r.t}</p>
              <p className="truncate text-[11.5px] text-white/45">{r.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Ledger({ a }: { a: PropAccount }) {
  const [shown, setShown] = useState(80);
  const trades = [...a.trades].sort((x, y) => y.entryT - x.entryT);
  return (
    <section className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#121214]/80 backdrop-blur-2xl">
      <header className="flex items-center justify-between px-5 pt-4">
        <h3 className="text-[16px] font-bold text-white">Trades · {a.trades.length}</h3>
        <span className="flex gap-1.5 text-[11.5px]">
          <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-white/60"><Hand className="h-3 w-3" /> {a.trades.filter((t) => t.source === "manual").length} by hand</span>
          <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-white/60"><Bot className="h-3 w-3" /> {a.trades.filter((t) => t.source === "auto").length} automated</span>
        </span>
      </header>
      <div className="mt-3 grid grid-cols-[90px_44px_1fr_80px_64px] gap-2 bg-white/[0.03] px-5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        <span>Day</span>
        <span>Side</span>
        <span>How</span>
        <span className="text-right">P&amp;L</span>
        <span className="text-right">R</span>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {trades.length === 0 && <p className="py-10 text-center text-[12.5px] text-white/40">No trades yet.</p>}
        {trades.slice(0, shown).map((t) => (
          <div key={t.id} className="grid grid-cols-[90px_44px_1fr_80px_64px] items-center gap-2 border-t border-white/[0.04] px-5 py-2 text-[12.5px] tabular-nums">
            <span className="text-white/70">{sdate(t.session).replace(/, \d{4}$/, "")}</span>
            <span className={clsx("font-semibold", t.side === "long" ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{t.side === "long" ? "Long" : "Short"}</span>
            <span className="flex min-w-0 items-center gap-1.5 truncate text-white/55">
              {t.source === "manual" ? <Hand className="h-3 w-3 shrink-0" /> : <Bot className="h-3 w-3 shrink-0" />}
              {t.strategy ?? "By hand"} · {t.reason}
            </span>
            <span className={clsx("text-right font-semibold", t.pnl >= 0 ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{money(t.pnl)}</span>
            <span className="text-right text-white/55">
              {t.r >= 0 ? "+" : ""}
              {t.r.toFixed(2)}
            </span>
          </div>
        ))}
        {trades.length > shown && (
          <button onClick={() => setShown(shown + 200)} className="w-full border-t border-white/[0.04] py-2.5 text-[12.5px] font-semibold text-white/60 hover:bg-white/[0.04]">
            Show more ({trades.length - shown} left)
          </button>
        )}
      </div>
    </section>
  );
}

function Timeline({ a }: { a: PropAccount }) {
  const ev = [...a.events].reverse();
  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-[#121214]/80 p-5 backdrop-blur-2xl">
      <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">
        <Building2 className="h-3.5 w-3.5" /> Account history
      </h3>
      {a.history.length > 0 && (
        <div className="mb-3 space-y-1">
          {a.history.map((h, i) => (
            <p key={i} className="flex justify-between rounded-xl bg-white/[0.03] px-3 py-1.5 text-[12px]">
              <span className="text-white/65">Attempt {i + 1} · {h.trades} trades</span>
              <span className={clsx("font-semibold", h.result === "passed" ? "text-[#7CE59A]" : h.result === "blown" ? "text-[#FFA3AB]" : "text-white/60")}>
                {h.result} · {money(h.pnl)}
              </span>
            </p>
          ))}
        </div>
      )}
      <ol className="max-h-[340px] space-y-2.5 overflow-y-auto">
        {ev.map((e, i) => (
          <li key={i} className="flex gap-2.5">
            <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", e.kind === "passed" || e.kind === "funded" ? "bg-[#30D158]" : e.kind === "blown" ? "bg-[#FF7A85]" : e.kind === "run" ? "bg-[#5AC8FA]" : e.kind === "session" ? "bg-[#BF5AF2]" : "bg-white/35")} />
            <div>
              <p className="text-[12.5px] leading-snug text-white/80">{e.text}</p>
              <p className="text-[11px] text-white/35">{new Date(e.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
