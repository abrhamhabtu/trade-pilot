"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Bell, Bot, CheckCircle2, ExternalLink, Link2, Loader2, MessageCircle, Plug, Power, Radio, Send, ShieldAlert, ShieldCheck, Trash2, Zap } from "lucide-react";
import { useProvingStore } from "@/store/provingStore";
import { INSTRUMENTS, STRATEGIES } from "@/lib/proving/engine";
import { programByKey } from "@/lib/proving/firms";
import type { BotRun, LiveBot, LogEntry } from "@/lib/server/live/bots";
import { FirmMark, Segmented } from "./QuickStart";

type Account = { id: number; name: string; broker: "projectx" | "tradovate"; balance?: number; canTrade?: boolean };

type NotifyView = {
  telegram: { configured: boolean; chatId: string; enabled: boolean };
  discord: { configured: boolean; enabled: boolean };
  events: Record<"trades" | "accounts" | "recap" | "live", boolean>;
};
type LiveView = {
  connected: boolean;
  projectx: { connected: boolean; userName: string | null; base: string; liveData: boolean };
  tradovate: { connected: boolean; userName: string | null; environment: "demo" | "live" };
  loop: { running: boolean; lastTick: number; error: string };
  date: string;
  bots: LiveBot[];
  runs: Record<string, BotRun>;
  log: LogEntry[];
  accounts?: Account[];
  accountsError?: string;
  message?: string;
  error?: string;
};
type ServerView = { running: boolean; lastTick: number; error: string; tests: number; summaries: { id: string; line: string }[]; error_?: string };

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const ago = (t: number) => {
  if (!t) return "not yet";
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
};

async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error || `Request failed (${res.status})`);
  return j as T;
}

export function LivePanel() {
  const [live, setLive] = useState<LiveView | null>(null);
  const [server, setServer] = useState<ServerView | null>(null);
  const [blocked, setBlocked] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);

  const refresh = useCallback(async (withAccounts = false) => {
    try {
      const [l, s] = await Promise.all([api<LiveView>(`/api/live${withAccounts ? "?accounts=1" : ""}`), api<ServerView>("/api/proving/server")]);
      setLive(l);
      setServer(s);
      if (l.accounts) setAccounts(l.accounts);
      setBlocked("");
    } catch (e) {
      setBlocked(e instanceof Error ? e.message : "Unavailable");
    }
  }, []);

  useEffect(() => {
    refresh(true);
    const id = setInterval(() => refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh]);

  if (blocked && !live)
    return (
      <section className="rounded-2xl border border-tp-yellow/25 bg-tp-yellow/[0.06] p-5 text-[14px] text-zinc-300">
        <p className="font-semibold text-tp-yellow">Live controls are off here</p>
        <p className="mt-1">{blocked} Open TradePilot at http://localhost on the machine running it. A Docker build also needs TRADEPILOT_LOCAL_CONTROL=1.</p>
      </section>
    );
  if (!live || !server)
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Connecting to the server…
      </div>
    );

  return (
    <div className="space-y-6">
      <KillSwitch live={live} onDone={setLive} />

      <section className="grid gap-4 lg:grid-cols-3">
        <Status
          icon={Radio}
          title="Always-on runner"
          ok={server.running}
          lines={[
            server.running ? `Running · checked ${ago(server.lastTick)}` : "Not running. Restart the app server.",
            `${server.tests} test${server.tests === 1 ? "" : "s"} mirrored from this browser`,
            server.error ? `Last error: ${server.error}` : "Trades your tests every session, even with this page closed",
          ]}
        />
        <Status
          icon={Plug}
          title="Brokers"
          ok={live.connected}
          lines={[
            `Tradovate: ${live.tradovate.connected ? `connected as ${live.tradovate.userName}` : "not connected"}`,
            `TopstepX: ${live.projectx.connected ? `connected as ${live.projectx.userName}` : "not connected"}`,
            `${accounts.length} account${accounts.length === 1 ? "" : "s"} available to bots`,
          ]}
        />
        <Status
          icon={Bot}
          title="Live bots"
          ok={live.loop.running}
          lines={[
            `${live.bots.length} bot${live.bots.length === 1 ? "" : "s"} · ${live.bots.filter((b) => b.mode === "armed" && b.armedOn === live.date).length} armed today`,
            live.loop.running ? `Loop checked ${ago(live.loop.lastTick)} (every 10s in market hours)` : "Loop not running",
            live.loop.error ? `Last error: ${live.loop.error}` : "Shadow by default: real orders only when you arm a bot",
          ]}
        />
      </section>

      <Brokers live={live} accounts={accounts} onChange={(l) => { setLive(l); if (l.accounts) setAccounts(l.accounts); }} />
      {live.connected && <Bots live={live} accounts={accounts} onChange={setLive} />}
      <Alerts />
      <TradingViewCard />
      <Activity log={live.log} />
    </div>
  );
}

function Status({ icon: Icon, title, ok, lines }: { icon: typeof Radio; title: string; ok: boolean; lines: string[] }) {
  return (
    <div className="rounded-[28px] border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl p-4">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-zinc-100">
        <Icon className="h-4 w-4 text-zinc-400" /> {title}
        <span className={clsx("ml-auto h-2 w-2 rounded-full", ok ? "bg-tp-green shadow-[0_0_10px_rgb(var(--tp-green))]" : "bg-zinc-600")} />
      </p>
      {lines.map((l, i) => (
        <p key={i} className={clsx("mt-1 text-[12.5px]", i === 0 ? "text-zinc-300" : "text-zinc-500")}>
          {l}
        </p>
      ))}
    </div>
  );
}

function KillSwitch({ live, onDone }: { live: LiveView; onDone: (l: LiveView) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const armed = live.bots.filter((b) => b.mode === "armed" && b.armedOn === live.date).length;
  const go = async () => {
    if (!window.confirm("Close every armed bot's position, cancel its orders and disarm all bots?")) return;
    setBusy(true);
    try {
      const l = await api<LiveView>("/api/live", { action: "flatten-all" });
      onDone(l);
      setMsg(l.message ?? "Done.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Kill switch failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={clsx("flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4", armed ? "border-tp-red/40 bg-tp-red/[0.08]" : "border-white/[0.06] bg-tp-card/90")}>
      <div>
        <p className="flex items-center gap-2 text-[15px] font-semibold text-zinc-50">
          <ShieldAlert className={clsx("h-4 w-4", armed ? "text-tp-red" : "text-zinc-400")} />
          {armed ? `${armed} bot${armed === 1 ? "" : "s"} armed with real orders today` : "No bot is armed. Everything runs in shadow."}
        </p>
        <p className="mt-0.5 text-[12.5px] text-zinc-400">{msg || "The kill switch also works from Telegram: send /flatten to your bot."}</p>
      </div>
      <button
        onClick={go}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-tp-red px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgb(var(--tp-red))] hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} Flatten everything
      </button>
    </section>
  );
}

function Alerts() {
  const [s, setS] = useState<NotifyView | null>(null);
  const [token, setToken] = useState("");
  const [webhook, setWebhook] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api<NotifyView>("/api/notify").then(setS).catch(() => setS(null));
  }, []);

  const run = async (label: string, body: Record<string, unknown>, ok: (r: NotifyView & { chatName?: string; sent?: string[] }) => string) => {
    setBusy(label);
    setMsg(null);
    try {
      const r = await api<NotifyView & { chatName?: string; sent?: string[] }>("/api/notify", body);
      if (r.telegram) setS(r);
      setMsg({ ok: true, text: ok(r) });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy("");
    }
  };

  if (!s) return null;
  const toggleEvent = (k: keyof NotifyView["events"]) => run("events", { action: "save", events: { [k]: !s.events[k] } }, () => "Saved.");

  return (
    <section className="rounded-[28px] border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl p-5">
      <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
        <Bell className="h-3.5 w-3.5" /> Alerts to your phone
      </p>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 text-[14px] font-semibold text-zinc-100">
            <Send className="h-4 w-4 text-[#2AABEE]" /> Telegram
            {s.telegram.configured && s.telegram.chatId && <Pill ok={s.telegram.enabled}>{s.telegram.enabled ? "On" : "Paused"}</Pill>}
          </p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[12.5px] text-zinc-400">
            <li>
              In Telegram, message <span className="text-zinc-200">@BotFather</span>, send /newbot and copy the token.
            </li>
            <li>Paste it here and save.</li>
            <li>Send your new bot any message, then press Find my chat.</li>
          </ol>
          <div className="mt-3 flex gap-2">
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder={s.telegram.configured ? "Token saved · paste to replace" : "123456789:AA…"} className={inputCls} type="password" autoComplete="off" />
            <Btn busy={busy === "tg"} onClick={() => run("tg", { action: "save", telegramToken: token }, () => { setToken(""); return "Token saved. Now message your bot and press Find my chat."; })} disabled={!token}>
              Save
            </Btn>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Btn busy={busy === "detect"} onClick={() => run("detect", { action: "detect-chat" }, (r) => `Connected to ${r.chatName}.`)} disabled={!s.telegram.configured}>
              Find my chat
            </Btn>
            {s.telegram.chatId && <span className="font-mono text-[11.5px] text-zinc-500">chat {s.telegram.chatId}</span>}
            {s.telegram.chatId && (
              <button onClick={() => run("tgon", { action: "save", telegramEnabled: !s.telegram.enabled }, () => "Saved.")} className="text-[12.5px] text-tp-blue hover:underline">
                {s.telegram.enabled ? "Pause" : "Resume"}
              </button>
            )}
          </div>
          <p className="mt-2 text-[12px] text-zinc-500">Commands: /status, /live, /flatten, /help.</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-[14px] font-semibold text-zinc-100">
            <MessageCircle className="h-4 w-4 text-[#5865F2]" /> Discord
            {s.discord.configured && <Pill ok={s.discord.enabled}>{s.discord.enabled ? "On" : "Paused"}</Pill>}
          </p>
          <p className="mt-2 text-[12.5px] text-zinc-400">In your server: channel settings → Integrations → Webhooks → New webhook → Copy URL.</p>
          <div className="mt-3 flex gap-2">
            <input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder={s.discord.configured ? "Webhook saved · paste to replace" : "https://discord.com/api/webhooks/…"} className={inputCls} type="password" autoComplete="off" />
            <Btn
              busy={busy === "dc"}
              onClick={() => run("dc", { action: "save", discordWebhook: webhook, discordEnabled: true }, () => { setWebhook(""); return "Discord webhook saved."; })}
              disabled={!webhook}
            >
              Save
            </Btn>
          </div>
          {s.discord.configured && (
            <button onClick={() => run("dcon", { action: "save", discordEnabled: !s.discord.enabled }, () => "Saved.")} className="mt-2 text-[12.5px] text-tp-blue hover:underline">
              {s.discord.enabled ? "Pause" : "Resume"}
            </button>
          )}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-4">
        <span className="mr-1 text-[12.5px] text-zinc-500">Send me:</span>
        {(
          [
            ["trades", "Every test trade"],
            ["accounts", "Passes, blows, payouts"],
            ["recap", "End-of-day recap"],
            ["live", "Live bot orders"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => toggleEvent(k)}
            className={clsx("rounded-lg px-2.5 py-1 text-[12.5px] ring-1 ring-inset transition", s.events[k] ? "bg-tp-green/12 text-tp-green ring-tp-green/30" : "text-zinc-500 ring-white/[0.08] hover:text-zinc-300")}
          >
            {s.events[k] ? "✓ " : ""}
            {label}
          </button>
        ))}
        <span className="flex-1" />
        <Btn busy={busy === "test"} onClick={() => run("test", { action: "test" }, (r) => `Sent to ${(r.sent ?? []).join(" and ")}.`)}>
          Send a test
        </Btn>
      </div>
      {msg && <p className={clsx("mt-3 text-[13px]", msg.ok ? "text-tp-green" : "text-tp-red")}>{msg.text}</p>}
    </section>
  );
}

const TRADOVATE_FIRMS = ["lucid", "tof", "futures-elite", "tradeify", "fundednext", "takeprofittrader"];
const TRADOVATE_NAMES = "Lucid · Top One Futures · Futures Elite · Tradeify · FundedNext · Take Profit Trader";

function Brokers({ live, accounts, onChange }: { live: LiveView; accounts: Account[]; onChange: (l: LiveView) => void }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
      <TradovateCard live={live} accounts={accounts.filter((a) => a.broker === "tradovate")} onChange={onChange} />
      <TopstepCard live={live} accounts={accounts.filter((a) => a.broker === "projectx")} onChange={onChange} />
    </section>
  );
}

function BrokerShell({ logo, title, firms, connected, who, children }: { logo: string; title: string; firms: React.ReactNode; connected: boolean; who?: string | null; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-white ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="h-[74%] w-[74%] object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-white">{title}</p>
          <div className="mt-0.5 text-[12.5px] text-zinc-500">{firms}</div>
        </div>
        <span className={clsx("rounded-full px-2.5 py-1 text-[12px] font-semibold", connected ? "bg-tp-green/15 text-tp-green" : "bg-white/[0.07] text-zinc-400")}>{connected ? `Connected${who ? ` · ${who}` : ""}` : "Not connected"}</span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function AccountList({ accounts, empty }: { accounts: Account[]; empty: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {accounts.map((a) => (
        <div key={`${a.broker}-${a.id}`} className="rounded-2xl bg-black/25 px-3.5 py-2.5 ring-1 ring-inset ring-white/[0.05]">
          <p className="truncate text-[14px] font-semibold text-white">{a.name}</p>
          <p className="text-[12px] text-zinc-500">{a.balance != null ? `${usd(a.balance)} · ` : ""}{a.canTrade === false ? "trading locked" : "ready"}</p>
        </div>
      ))}
      {!accounts.length && <p className="text-[13px] text-zinc-500">{empty}</p>}
    </div>
  );
}

function useAct(onChange: (l: LiveView) => void) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr("");
    try {
      onChange(await api<LiveView>("/api/live?accounts=1", body));
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, act };
}

function TradovateCard({ live, accounts, onChange }: { live: LiveView; accounts: Account[]; onChange: (l: LiveView) => void }) {
  const [f, setF] = useState({ name: "", password: "", appId: "", cid: "", sec: "", environment: "demo" as "demo" | "live" });
  const { busy, err, act } = useAct(onChange);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <BrokerShell
      logo="/logos/tradovate.png"
      title="Tradovate"
      connected={live.tradovate.connected}
      who={live.tradovate.userName}
      firms={
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="flex -space-x-1.5">
            {TRADOVATE_FIRMS.map((id) => (
              <span key={id} className="rounded-[30%] ring-2 ring-[#161618]">
                <FirmMark firmId={id} size={20} />
              </span>
            ))}
          </span>
          {TRADOVATE_NAMES}
        </span>
      }
    >
      {live.tradovate.connected ? (
        <>
          <AccountList accounts={accounts} empty="No active accounts returned." />
          <div className="mt-3 flex items-center justify-between text-[12.5px] text-zinc-500">
            <span>{live.tradovate.environment === "live" ? "Live" : "Demo / sim"} environment · real-time bars from Tradovate market data</span>
            <button onClick={() => act({ action: "disconnect-tradovate" })} className="text-tp-red hover:underline">
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={f.name} onChange={set("name")} placeholder="Tradovate username" className={inputCls} autoComplete="off" />
            <input value={f.password} onChange={set("password")} placeholder="Password" type="password" className={inputCls} autoComplete="off" />
            <input value={f.appId} onChange={set("appId")} placeholder="API app ID" className={inputCls} autoComplete="off" />
            <input value={f.cid} onChange={set("cid")} placeholder="CID" inputMode="numeric" className={inputCls} autoComplete="off" />
            <input value={f.sec} onChange={set("sec")} placeholder="API secret" type="password" className={clsx(inputCls, "sm:col-span-2")} autoComplete="off" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented value={f.environment} options={[{ v: "demo" as const, label: "Demo / prop sim" }, { v: "live" as const, label: "Live" }]} onChange={(v) => setF((x) => ({ ...x, environment: v }))} compact />
            <Btn busy={busy} disabled={!f.name || !f.password || !f.appId || !f.cid || !f.sec} onClick={() => act({ action: "connect-tradovate", ...f, cid: Number(f.cid) })}>
              Connect Tradovate
            </Btn>
          </div>
          <p className="text-[12px] leading-relaxed text-zinc-500">
            Create an API key in Tradovate under Application Settings → API Access (it needs the API add-on). Most prop evaluation and funded accounts are on the demo environment. Your firm has to allow API access on the account; a prop login without it is refused. Credentials stay on this machine (.tradepilot/tradovate-secrets.json).
          </p>
        </div>
      )}
      {err && <p className="mt-2 text-[13px] text-tp-red">{err}</p>}
    </BrokerShell>
  );
}

function TopstepCard({ live, accounts, onChange }: { live: LiveView; accounts: Account[]; onChange: (l: LiveView) => void }) {
  const [user, setUser] = useState("");
  const [key, setKey] = useState("");
  const [base, setBase] = useState(live.projectx.base);
  const [liveData, setLiveData] = useState(false);
  const { busy, err, act } = useAct(onChange);
  return (
    <BrokerShell logo="/logos/topstep.png" title="TopstepX" connected={live.projectx.connected} who={live.projectx.userName} firms="Topstep and other firms on ProjectX">
      {live.projectx.connected ? (
        <>
          <AccountList accounts={accounts} empty="No active accounts returned." />
          <div className="mt-3 flex items-center justify-between text-[12.5px] text-zinc-500">
            <span>{live.projectx.liveData ? "Live" : "Sim"} data · set accounts to Auto OCO Brackets</span>
            <button onClick={() => act({ action: "disconnect-projectx" })} className="text-tp-red hover:underline">
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Username" className={inputCls} autoComplete="off" />
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="API key" type="password" className={inputCls} autoComplete="off" />
            <input value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://api.topstepx.com/api" className={clsx(inputCls, "sm:col-span-2")} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[12.5px] text-zinc-400">
              <input type="checkbox" checked={liveData} onChange={(e) => setLiveData(e.target.checked)} /> Live market data subscription
            </label>
            <Btn busy={busy} disabled={!user || !key} onClick={() => act({ action: "connect", userName: user, apiKey: key, base, liveData })}>
              Connect TopstepX
            </Btn>
          </div>
          <p className="text-[12px] leading-relaxed text-zinc-500">TopstepX keys come from its API access page. Other ProjectX firms use their own gateway address. Stored on this machine only.</p>
        </div>
      )}
      {err && <p className="mt-2 text-[13px] text-tp-red">{err}</p>}
    </BrokerShell>
  );
}

function Bots({ live, accounts, onChange }: { live: LiveView; accounts: Account[]; onChange: (l: LiveView) => void }) {
  const tests = useProvingStore((s) => s.tests).filter((t) => t.cfg.strategy !== "tv-signals");
  const [testId, setTestId] = useState("");
  const [pick, setPick] = useState("");
  const chosen = accounts.find((a) => `${a.broker}:${a.id}` === pick);
  const [maxContracts, setMax] = useState(2);
  const [dailyLossStop, setStop] = useState(500);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const test = tests.find((t) => t.id === testId);
  useEffect(() => {
    if (!test) return;
    setMax(test.cfg.contracts);
    const p = programByKey(test.programKey);
    setStop(Math.round(((p?.dll ?? p?.drawdown ?? 1000) * 0.5) / 50) * 50);
  }, [test]);

  const act = async (label: string, body: Record<string, unknown>) => {
    setBusy(label);
    setErr("");
    try {
      onChange(await api<LiveView>("/api/live", body));
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      return false;
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl p-5">
        <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          <Bot className="h-3.5 w-3.5" /> New bot from a test
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1.4fr_1.2fr_0.7fr_0.8fr_auto]">
          <select value={testId} onChange={(e) => setTestId(e.target.value)} className={inputCls}>
            <option value="">Pick a test…</option>
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {STRATEGIES[t.cfg.strategy].short} · {t.cfg.contracts} {t.cfg.instrument}
              </option>
            ))}
          </select>
          <select value={pick} onChange={(e) => setPick(e.target.value)} className={inputCls}>
            <option value="">Pick an account…</option>
            {accounts.map((a) => (
              <option key={`${a.broker}:${a.id}`} value={`${a.broker}:${a.id}`}>
                {a.name} · {a.broker === "tradovate" ? "Tradovate" : "TopstepX"}
              </option>
            ))}
          </select>
          <label className="relative">
            <input type="number" min={1} max={50} value={maxContracts} onChange={(e) => setMax(Number(e.target.value))} className={inputCls} />
            <span className="pointer-events-none absolute right-3 top-2 text-[11px] text-zinc-500">max qty</span>
          </label>
          <label className="relative">
            <input type="number" min={0} step={50} value={dailyLossStop} onChange={(e) => setStop(Number(e.target.value))} className={inputCls} />
            <span className="pointer-events-none absolute right-3 top-2 text-[11px] text-zinc-500">day stop $</span>
          </label>
          <Btn
            busy={busy === "add"}
            disabled={!test || !chosen}
            onClick={() =>
              test &&
              act("add", { action: "add-bot", name: test.name, cfg: test.cfg, accountId: chosen?.id, accountName: chosen?.name, broker: chosen?.broker, maxContracts, dailyLossStop }).then((ok) => ok && setTestId(""))
            }
          >
            Add in shadow
          </Btn>
        </div>
        <p className="mt-2 text-[12px] text-zinc-500">
          The bot trades the test&apos;s exact rules on ProjectX&apos;s own bars for that contract. It starts in shadow: you&apos;ll see and get alerts for every order it would send, and nothing reaches the broker.
        </p>
        {err && <p className="mt-2 text-[13px] text-tp-red">{err}</p>}
      </div>

      {live.bots.map((b) => (
        <BotCard key={b.id} bot={b} run={live.runs[b.id]} date={live.date} busy={busy} act={act} />
      ))}
    </section>
  );
}

function BotCard({ bot: b, run, date, busy, act }: { bot: LiveBot; run?: BotRun; date: string; busy: string; act: (label: string, body: Record<string, unknown>) => Promise<boolean> }) {
  const armed = b.mode === "armed" && b.armedOn === date && b.firmAllowsAutomation;
  const [arming, setArming] = useState(false);
  const [confirm, setConfirm] = useState("");
  const mode = armed ? "ARMED" : b.mode === "off" ? "OFF" : "SHADOW";
  const trades = run?.trades ?? [];
  const execs = useMemo(() => Object.values(run?.executions ?? {}), [run]);
  return (
    <div className={clsx("rounded-2xl border p-5", armed ? "border-tp-red/40 bg-gradient-to-br from-tp-red/[0.08] to-tp-card/90" : "border-white/[0.06] bg-tp-card/90")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[16px] font-semibold text-zinc-50">
            {b.name}
            <span
              className={clsx(
                "rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-bold tracking-wider",
                armed ? "bg-tp-red text-white" : b.mode === "off" ? "bg-white/[0.06] text-zinc-500" : "bg-[#B18CFF]/15 text-[#CDB6FF]",
              )}
            >
              {mode}
            </span>
          </p>
          <p className="text-[12.5px] text-zinc-500">
            {STRATEGIES[b.cfg.strategy].label} · {b.cfg.timeframe} · {b.contractName ?? INSTRUMENTS[b.cfg.instrument].label} · {b.accountName} on {b.broker === "tradovate" ? "Tradovate" : "TopstepX"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {armed ? (
            <Btn busy={busy === `s${b.id}`} onClick={() => act(`s${b.id}`, { action: "shadow", id: b.id })}>
              Disarm
            </Btn>
          ) : (
            <>
              {b.mode === "off" ? (
                <Btn busy={busy === `s${b.id}`} onClick={() => act(`s${b.id}`, { action: "shadow", id: b.id })}>
                  Run in shadow
                </Btn>
              ) : (
                <Btn busy={busy === `o${b.id}`} onClick={() => act(`o${b.id}`, { action: "off", id: b.id })}>
                  Turn off
                </Btn>
              )}
              <button
                onClick={() => setArming((x) => !x)}
                disabled={!b.firmAllowsAutomation}
                title={b.firmAllowsAutomation ? "" : "Confirm your firm allows automated trading first"}
                className="inline-flex items-center gap-1.5 rounded-xl bg-tp-red/90 px-3 py-2 text-[13px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Zap className="h-3.5 w-3.5" /> Arm for today
              </button>
            </>
          )}
          <button aria-label="Remove bot" onClick={() => window.confirm(`Remove ${b.name}?`) && act(`r${b.id}`, { action: "remove-bot", id: b.id })} className="p-2 text-zinc-500 hover:text-tp-red">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {arming && !armed && (
        <div className="mt-4 rounded-xl border border-tp-red/40 bg-tp-red/[0.08] p-4">
          <p className="text-[13.5px] font-semibold text-zinc-100">Real orders on {b.accountName} for today&apos;s session only</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12.5px] text-zinc-300">
            <li>Market entries on fresh signals only, at most {b.maxContracts} contracts, each with a broker-side stop and target.</li>
            <li>The bot halts and flattens at a {usd(b.dailyLossStop)} day loss and at the strategy&apos;s {b.cfg.flatBy} ET flat time.</li>
            {(b.broker ?? "projectx") === "projectx" ? (
              <li>The account must be set to Auto OCO Brackets in ProjectX risk settings, or the first order is rejected and the bot disarms.</li>
            ) : (
              <li>Tradovate gets the stop and target as an OCO pair attached to the entry, marked as an automated order.</li>
            )}
            <li>Arming ends at the close. Tomorrow it is back in shadow.</li>
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type ARM" className={clsx(inputCls, "w-32")} />
            <button
              disabled={confirm !== "ARM" || busy === `a${b.id}`}
              onClick={() => act(`a${b.id}`, { action: "arm", id: b.id, confirm }).then((ok) => ok && (setArming(false), setConfirm("")))}
              className="rounded-xl bg-tp-red px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40"
            >
              Arm with real orders
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2 text-[13px]">
          <label className="flex items-start gap-2 text-zinc-300">
            <input type="checkbox" className="mt-0.5" checked={b.firmAllowsAutomation} onChange={(e) => act(`f${b.id}`, { action: "update-bot", id: b.id, firmAllowsAutomation: e.target.checked })} />
            <span>
              I checked: my firm allows automated trading on this account.
              <span className="block text-[12px] text-zinc-500">Several firms restrict or ban bots and can close an account for it.</span>
            </span>
          </label>
          <div className="flex flex-wrap gap-3 pt-1">
            <Guard label="Max contracts" value={b.maxContracts} onSave={(v) => act(`m${b.id}`, { action: "update-bot", id: b.id, maxContracts: v })} />
            <Guard label="Day stop $" value={b.dailyLossStop} onSave={(v) => act(`d${b.id}`, { action: "update-bot", id: b.id, dailyLossStop: v })} />
          </div>
          <p className="text-[12px] text-zinc-500">
            {run?.lastCheck ? `Checked ${ago(run.lastCheck)}` : "Checks every 10s from 9:25 to 16:05 ET"}
            {run?.halted ? ` · halted: ${run.halted}` : ""}
            {run?.lastError ? ` · error: ${run.lastError}` : ""}
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-white/[0.05]">
          <p className="flex items-center justify-between text-[12px] text-zinc-500">
            <span>Today on real-time bars</span>
            <span className={clsx("font-mono text-[13px]", (run?.dayPnl ?? 0) >= 0 ? "text-tp-green" : "text-tp-red")}>{signed(run?.dayPnl ?? 0)}</span>
          </p>
          <ul className="mt-2 space-y-1">
            {trades.length ? (
              trades.map((t) => {
                const ex = execs.find((x) => x.tradeId === t.id);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="text-zinc-300">
                      {t.side === "long" ? "Long" : "Short"} {t.qty} @ {t.entryPx}
                      <span className="text-zinc-500"> · {t.exit}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-zinc-500">{ex ? (ex.skipped ? `skipped: ${ex.skipped}` : ex.live ? `order ${ex.orderId ?? ""}` : "shadow") : "—"}</span>
                      <span className={clsx("font-mono", t.pnl >= 0 ? "text-tp-green" : "text-tp-red")}>{signed(t.pnl)}</span>
                    </span>
                  </li>
                );
              })
            ) : (
              <li className="text-[12.5px] text-zinc-500">No trades yet today.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Guard({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-zinc-400">
      {label}
      <input type="number" value={v} onChange={(e) => setV(Number(e.target.value))} onBlur={() => v !== value && onSave(v)} className={clsx(inputCls, "w-24 py-1")} />
    </label>
  );
}

function TradingViewCard() {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl p-5">
      <div>
        <p className="text-[14px] font-semibold text-zinc-100">TradingView</p>
        <p className="mt-0.5 max-w-2xl text-[12.5px] text-zinc-400">
          Your Pilot Signals indicator already posts alerts into TradePilot; a test on &quot;My TradingView signals&quot; trades them. Open the same market on TradingView to watch along with the bots.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["MNQ", "CME_MINI:MNQ1!"],
            ["MES", "CME_MINI:MES1!"],
          ] as const
        ).map(([label, sym]) => (
          <a key={sym} href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2 text-[13px] font-medium text-zinc-200 hover:bg-white/[0.1]">
            {label} chart <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ))}
        <a href="/app/pilot?tab=settings" className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2 text-[13px] font-medium text-zinc-200 hover:bg-white/[0.1]">
          Signal setup
        </a>
      </div>
    </section>
  );
}

function Activity({ log }: { log: LogEntry[] }) {
  return (
    <section className="rounded-[28px] border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl p-5">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Activity · every bot decision and order</p>
      <ol className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
        {log.length ? (
          [...log].reverse().map((l, i) => (
            <li key={i} className="flex gap-3 text-[12.5px]">
              <span className="w-16 shrink-0 font-mono text-[11px] text-zinc-500">{new Date(l.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}</span>
              <span className={clsx(l.level === "error" ? "text-tp-red" : l.level === "order" ? "text-tp-green" : l.level === "warn" ? "text-tp-yellow" : "text-zinc-300")}>{l.text}</span>
            </li>
          ))
        ) : (
          <li className="text-[12.5px] text-zinc-500">Nothing yet. Bots log here from 9:25 ET.</li>
        )}
      </ol>
    </section>
  );
}

const inputCls = "w-full rounded-xl bg-white/[0.04] px-3 py-2 text-[13.5px] text-zinc-100 ring-1 ring-inset ring-white/[0.08] placeholder:text-zinc-600 focus:outline-none focus:ring-white/25";

function Btn({ children, onClick, busy, disabled }: { children: React.ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy || disabled} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white/[0.08] px-3.5 py-2 text-[13px] font-semibold text-zinc-100 hover:bg-white/[0.14] disabled:opacity-40">
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", ok ? "bg-tp-green/15 text-tp-green" : "bg-white/[0.06] text-zinc-400")}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
      {children}
    </span>
  );
}
