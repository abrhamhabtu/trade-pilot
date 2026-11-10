"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { BellRing, Check, Code2, Copy, ListChecks, Phone, RefreshCw, ScrollText, Send, X } from "lucide-react";
import { CHANNELS, DEFAULT_RULES, setupLabel, type AlertRule, type Channel, type WakeUp, type Watch } from "@/lib/vision/alerts";
import { useVisionStore } from "@/store/visionStore";
import { PineStudio } from "./PineStudio";

type Settings = { webhookKey: string; publicUrl: string; tz: string; twilio: { configured: boolean; sid: string; from: string; to: string }; rules: AlertRule[]; watch: Watch; wake: WakeUp };
type Log = { at: number; source: string; title: string; text: string; sent: string[]; errors: string[]; skipped: { rule: string; why: string }[] };
type Notify = { telegram: { configured: boolean; chatId: string; enabled: boolean }; discord: { configured: boolean; enabled: boolean } };
type Tab = "guide" | "rules" | "pine" | "log";

const CH: Record<Channel, string> = { call: "Call", sms: "Text", telegram: "Telegram", discord: "Discord" };
const api = (url: string, body?: unknown) => fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" }).then(async (r) => {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "That didn't work.");
  return j;
});
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (s: string) => Number(s.split(":")[0]) * 60 + Number(s.split(":")[1]);

export function AlertCenter({ start, onClose }: { start: "guide" | "pine"; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(start);
  const [s, setS] = useState<Settings | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(() => api("/api/alerts").then((j) => {
    setS(j.settings);
    setLog(j.log);
    setError("");
  }).catch((e) => setError(e.message)), []);
  useEffect(() => {
    void load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load, onClose]);
  const save = async (patch: Record<string, unknown>) => {
    const j = await api("/api/alerts", { action: "settings", ...patch });
    setS(j.settings);
  };
  const NAV: { v: Tab; l: string; icon: React.ReactNode }[] = [
    { v: "guide", l: "Set up", icon: <ListChecks className="h-4 w-4" /> },
    { v: "rules", l: "What calls me", icon: <BellRing className="h-4 w-4" /> },
    { v: "pine", l: "Pine scripts", icon: <Code2 className="h-4 w-4" /> },
    { v: "log", l: "History", icon: <ScrollText className="h-4 w-4" /> },
  ];
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-[10px] sm:items-center sm:p-5" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Alerts and Pine scripts" onClick={(e) => e.stopPropagation()} className="tp-sheet flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[28px] border border-white/[0.09] bg-[#111114] sm:rounded-[28px]">
        <header className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex flex-1 flex-wrap gap-1">
            {NAV.map((n) => (
              <button key={n.v} onClick={() => setTab(n.v)} aria-pressed={tab === n.v} className={clsx("flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-medium", tab === n.v ? "bg-white text-black" : "text-white/60 hover:text-white")}>{n.icon} {n.l}</button>
            ))}
          </div>
          <button aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.08] text-white/70 hover:bg-white/[0.14]"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <p className="m-5 rounded-[14px] bg-[#FF7A85]/12 px-4 py-2.5 text-[13px] text-[#FFA3AB]">{error}</p>}
          {tab === "guide" && s && <Guide s={s} setS={setS} save={save} />}
          {tab === "rules" && s && <Rules s={s} save={save} reload={load} />}
          {tab === "pine" && <PineStudio webhook={s ? hookUrl(s) : ""} />}
          {tab === "log" && <History log={log} reload={load} />}
        </div>
      </div>
    </div>
  );
}

const hookUrl = (s: Settings) => `${s.publicUrl || "https://YOUR-PUBLIC-ADDRESS"}/api/alerts/tradingview?key=${s.webhookKey}`;

function CopyBox({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="mt-2 flex items-start gap-2 rounded-[12px] bg-black/40 p-2.5">
      <code className="min-w-0 flex-1 break-all text-[12px] leading-relaxed text-white/80">{text}</code>
      <button aria-label={label ?? "Copy"} onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => undefined);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }} className="shrink-0 rounded-full bg-white/[0.1] p-1.5 text-white/75 hover:bg-white/[0.16]">{done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-b border-white/[0.06] px-6 py-5">
      <span className={clsx("grid h-8 w-8 place-items-center rounded-full text-[13.5px] font-semibold", done ? "bg-[#30D158] text-black" : "bg-white/[0.08] text-white")}>{done ? <Check className="h-4 w-4" /> : n}</span>
      <div className="min-w-0">
        <h3 className="pt-1 text-[17px] font-semibold tracking-[-0.01em] text-white">{title}</h3>
        <div className="mt-1.5 space-y-2 text-[13.5px] leading-relaxed text-white/65">{children}</div>
      </div>
    </section>
  );
}

const Field = ({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
  <label className="block min-w-[180px] flex-1">
    <span className="mb-1 block text-[12px] text-white/50">{label}</span>
    <input type={type} value={value} autoComplete="off" onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-[11px] bg-white/[0.07] px-3 py-2 text-[13.5px] text-white outline-none ring-1 ring-inset ring-white/[0.08] placeholder:text-white/25 focus:ring-white/40" />
  </label>
);

function Act({ onClick, children, primary }: { onClick: () => Promise<unknown>; children: React.ReactNode; primary?: boolean }) {
  const [state, setState] = useState<{ busy?: boolean; msg?: string; bad?: boolean }>({});
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button disabled={state.busy} onClick={async () => {
        setState({ busy: true });
        try {
          const msg = await onClick();
          setState({ msg: typeof msg === "string" ? msg : "Done." });
        } catch (e) {
          setState({ msg: e instanceof Error ? e.message : "That didn't work.", bad: true });
        }
      }} className={clsx("rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-50", primary ? "bg-white text-black" : "bg-white/[0.09] text-white hover:bg-white/[0.14]")}>{state.busy ? "Working…" : children}</button>
      {state.msg && <span className={clsx("text-[12.5px]", state.bad ? "text-[#FFA3AB]" : "text-[#7CE59A]")}>{state.msg}</span>}
    </span>
  );
}

function Guide({ s, setS, save }: { s: Settings; setS: (x: Settings) => void; save: (p: Record<string, unknown>) => Promise<void> }) {
  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [from, setFrom] = useState(s.twilio.from);
  const [to, setTo] = useState(s.twilio.to);
  const [tg, setTg] = useState("");
  const [dc, setDc] = useState("");
  const [url, setUrl] = useState(s.publicUrl);
  const [n, setN] = useState<Notify | null>(null);
  useEffect(() => {
    api("/api/notify").then(setN).catch(() => undefined);
  }, []);
  const notify = async (body: unknown) => {
    const j = await api("/api/notify", body);
    if (j.telegram) setN(j);
    return j;
  };
  const example = JSON.stringify({ name: "VWAP touched", side: "", symbol: "{{ticker}}", price: "{{close}}", tf: "{{interval}}" });
  return (
    <div className="mx-auto max-w-3xl">
      <div className="px-6 pb-2 pt-6">
        <h2 className="text-[26px] font-semibold tracking-[-0.025em] text-white">Stop staring at charts</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-white/60">When a setup fires, your phone rings or buzzes and you decide. Alerts only tell you to look: nothing here can place a trade. Do the steps in any order, and test each one as you go.</p>
      </div>

      <Step n={1} title="Your phone: calls and texts" done={s.twilio.configured && !!s.twilio.to}>
        <p>An app can&apos;t call a phone by itself, so this uses Twilio, a phone service you pay for by use. It usually costs a few cents an alert, and your number and login stay on this computer.</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Make an account at <a className="text-white underline" href="https://www.twilio.com/try-twilio" target="_blank" rel="noreferrer">twilio.com</a> and verify your phone number.</li>
          <li>Get a Twilio phone number from the console. That&apos;s the number that will call you.</li>
          <li>Copy your Account SID and Auth Token from the console home page into the boxes below.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Field label={s.twilio.configured ? `Account SID (saved: ${s.twilio.sid})` : "Account SID"} value={sid} onChange={setSid} placeholder="AC…" />
          <Field label={s.twilio.configured ? "Auth Token (saved)" : "Auth Token"} value={token} onChange={setToken} type="password" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Field label="Twilio's number" value={from} onChange={setFrom} placeholder="+14155550123" />
          <Field label="Your phone" value={to} onChange={setTo} placeholder="+14155550199" />
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Act primary onClick={async () => {
            const j = await api("/api/alerts", { action: "phone", sid, token, from, to });
            setS(j.settings);
            setSid("");
            setToken("");
            return "Saved.";
          }}>Save</Act>
          <Act onClick={async () => (await api("/api/alerts", { action: "test-call" }), "Calling you now.")}><Phone className="mr-1 inline h-3.5 w-3.5" />Call me</Act>
          <Act onClick={async () => (await api("/api/alerts", { action: "test-text" }), "Sent.")}>Text me</Act>
        </div>
        <p className="text-[12.5px] text-white/45">Calls are the quick part. A trial account only reaches verified numbers and plays a notice first. Texts to US numbers need Twilio&apos;s sender registration, which can take days, so start with calls and Telegram.</p>
      </Step>

      <Step n={2} title="Telegram and Discord" done={!!(n?.telegram.enabled || n?.discord.enabled)}>
        <p><strong className="font-medium text-white/85">Telegram:</strong> message @BotFather, send /newbot, paste the token here and save. Then send your new bot any message and press Find my chat.</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={n?.telegram.configured ? "Bot token (saved)" : "Bot token"} value={tg} onChange={setTg} type="password" />
          <Act primary onClick={async () => (await notify({ action: "save", telegramToken: tg }), setTg(""), "Saved.")}>Save</Act>
          <Act onClick={async () => `Connected to ${(await notify({ action: "detect-chat" })).chatName}.`}>Find my chat</Act>
        </div>
        <p className="pt-1"><strong className="font-medium text-white/85">Discord:</strong> Server Settings, Integrations, Webhooks, New Webhook, Copy Webhook URL.</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={n?.discord.configured ? "Webhook URL (saved)" : "Webhook URL"} value={dc} onChange={setDc} type="password" />
          <Act primary onClick={async () => (await notify({ action: "save", discordWebhook: dc, discordEnabled: true }), setDc(""), "Saved.")}>Save</Act>
          <Act onClick={async () => `Sent to ${(await notify({ action: "test" })).sent.join(" and ")}.`}>Send a test</Act>
        </div>
      </Step>

      <Step n={3} title="A morning wake-up call" done={s.wake.enabled}>
        <p>A call before the open that says what&apos;s on today, like CPI or the Fed. It skips weekends and, once your calendar data is loaded, market holidays.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="mb-1 block text-[12px] text-white/50">Call me at</span><input type="time" value={s.wake.time} onChange={(e) => e.target.value && save({ wake: { time: e.target.value } })} className="rounded-[11px] bg-white/[0.07] px-3 py-2 text-[14px] text-white [color-scheme:dark]" /></label>
          <label className="block"><span className="mb-1 block text-[12px] text-white/50">Your time zone</span>
            <select value={s.tz} onChange={(e) => save({ tz: e.target.value })} className="rounded-[11px] bg-white/[0.07] px-3 py-2 text-[14px] text-white">
              {["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "Europe/London", "UTC"].map((z) => <option key={z}>{z}</option>)}
            </select>
          </label>
          <button aria-pressed={s.wake.enabled} onClick={() => save({ wake: { enabled: !s.wake.enabled } })} className={clsx("rounded-full px-4 py-2 text-[13px] font-semibold", s.wake.enabled ? "bg-[#30D158] text-black" : "bg-white text-black")}>{s.wake.enabled ? "On" : "Turn on"}</button>
        </div>
        <p className="text-[12.5px] text-white/45">New York opens at 6:30 am Pacific. The app has to be running on this computer at that time.</p>
      </Step>

      <Step n={4} title="Let the app watch the market" done={s.watch.enabled}>
        <p>The easiest start: no TradingView needed. The app checks your setups each minute during the hours you choose, and alerts you using your rules. It uses the free feed, so alerts can be about 10 minutes late. For anything faster, use TradingView in the next steps.</p>
        <button aria-pressed={s.watch.enabled} onClick={() => save({ watch: { enabled: !s.watch.enabled } })} className={clsx("rounded-full px-4 py-2 text-[13px] font-semibold", s.watch.enabled ? "bg-[#30D158] text-black" : "bg-white text-black")}>{s.watch.enabled ? "Watching" : "Start watching"}</button>
        <span className="ml-2 text-[12.5px] text-white/45">Choose markets and setups under What calls me.</span>
      </Step>

      <Step n={5} title="Give TradingView a way to reach this app" done={!!s.publicUrl}>
        <p>TradingView&apos;s servers send alerts over the internet, and they can&apos;t see a computer&apos;s localhost. When you host this app, paste its address below. Until then, a free Cloudflare tunnel works. Install cloudflared and run:</p>
        <CopyBox text="cloudflared tunnel --url http://localhost:4040" />
        <p>It prints an address ending in trycloudflare.com. It changes each time you restart it, so update it here and in TradingView. A tunnel only opens the alert doorway: the rest of the app answers Not found to outsiders.</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Public address" value={url} onChange={setUrl} placeholder="https://something.trycloudflare.com" />
          <Act primary onClick={async () => (await save({ publicUrl: url }), "Saved.")}>Save</Act>
          <Act onClick={async () => (await save({ publicUrl: url }), await api("/api/alerts", { action: "check-url" }), "It reaches this app.")}>Test it</Act>
        </div>
      </Step>

      <Step n={6} title="Create the alert in TradingView" done={false}>
        <ol className="list-decimal space-y-1 pl-5">
          <li>TradingView webhooks need a paid plan and two-step login turned on.</li>
          <li>Add a script to your chart. Ready-made ones are under Pine scripts, including VWAP touch and Double-break VWAP.</li>
          <li>Open Create Alert. For Condition, pick the script, then <strong className="font-medium text-white/85">Any alert() function call</strong>.</li>
          <li>Under Notifications, tick Webhook URL and paste this. It&apos;s private, so treat it like a password:</li>
        </ol>
        <CopyBox text={hookUrl(s)} label="Copy webhook address" />
        <p>For a plain price alert, like price crossing VWAP, paste this as the Message:</p>
        <CopyBox text={example} label="Copy message" />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Act onClick={async () => {
            const j = await api("/api/alerts", { action: "simulate", title: "Double-break VWAP", symbol: "NQ", price: 0 });
            return j.channels.length ? `A Double-break VWAP right now would use: ${j.channels.map((c: Channel) => CH[c]).join(", ")}. Nothing was sent.` : `It wouldn't fire now: ${j.skipped[0]?.why ?? "no rule covers it"}.`;
          }}>Check the rules</Act>
          <Act onClick={async () => {
            const j = await api("/api/alerts", { action: "simulate", title: "Double-break VWAP", symbol: "NQ", price: 0, send: true });
            if (j.errors.length) throw new Error(j.errors.join(" "));
            return j.sent.length ? `Sent by ${j.sent.join(", ")}.` : "Nothing to send yet: finish steps 1 or 2.";
          }}>Send a real test alert</Act>
          <Act onClick={async () => {
            const j = await api("/api/alerts", { action: "rotate-key" });
            setS(j.settings);
            return "New address made. Update it in TradingView.";
          }}><RefreshCw className="mr-1 inline h-3 w-3" />New private address</Act>
        </div>
      </Step>
    </div>
  );
}

function Rules({ s, save, reload }: { s: Settings; save: (p: Record<string, unknown>) => Promise<void>; reload: () => void }) {
  const put = (rules: AlertRule[]) => save({ rules });
  const edit = (id: string, patch: Partial<AlertRule>) => put(s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const pinned = useVisionStore((v) => v.pinned);
  // Pinned ideas from Discover can be watched too; alerts only ever say look at the chart.
  const SETUPS: [Watch["setups"][number], string][] = [["dbvwap", "Double-break VWAP"], ["vwap_touch", "VWAP touched"], ["orb", "Opening range break"], ["sweep", "Liquidity sweep"], ["vwappb", "VWAP pullback"], ["sd", "Supply & demand"], ...pinned.map((id) => [id, `${setupLabel(id)} · pinned`] as [Watch["setups"][number], string])];
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  return (
    <div className="mx-auto max-w-4xl space-y-7 p-6">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-[22px] font-semibold tracking-[-0.02em] text-white">What reaches you, and how</h2>
          <button onClick={() => put([...s.rules, { ...DEFAULT_RULES[1], id: `r${Date.now().toString(36)}`, name: "New rule", match: "", channels: ["telegram"] }])} className="rounded-full bg-white/[0.09] px-3.5 py-2 text-[13px] font-medium text-white">Add a rule</button>
          <button onClick={() => put(DEFAULT_RULES)} className="rounded-full px-3 py-2 text-[13px] font-medium text-white/50 hover:text-white">Reset</button>
        </div>
        <p className="mt-1 text-[13px] text-white/50">Named rules go first. &quot;Words in the alert&quot; matches if any word appears; leave it empty to catch everything else. Hours are your local time, {s.tz.replace("_", " ")}.</p>
        <div className="mt-3 space-y-2">
          {s.rules.map((r) => (
            <article key={r.id} className={clsx("rounded-[18px] bg-white/[0.035] p-4", !r.enabled && "opacity-55")}>
              <div className="flex flex-wrap items-center gap-2">
                <input aria-label="Rule name" value={r.name} onChange={(e) => edit(r.id, { name: e.target.value })} className="min-w-[180px] flex-1 bg-transparent text-[15px] font-semibold text-white outline-none" />
                {CHANNELS.map((c) => (
                  <button key={c} aria-pressed={r.channels.includes(c)} onClick={() => edit(r.id, { channels: toggle(r.channels, c) })} className={clsx("rounded-full px-2.5 py-1 text-[12.5px] font-medium", r.channels.includes(c) ? "bg-white text-black" : "bg-white/[0.06] text-white/50")}>{CH[c]}</button>
                ))}
                <button aria-pressed={r.enabled} onClick={() => edit(r.id, { enabled: !r.enabled })} className="rounded-full px-2 py-1 text-[12.5px] text-white/50 hover:text-white">{r.enabled ? "On" : "Off"}</button>
                <button aria-label={`Delete ${r.name}`} onClick={() => put(s.rules.filter((x) => x.id !== r.id))} className="text-white/35 hover:text-white"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-end gap-3 text-[12.5px] text-white/55">
                <label className="min-w-[220px] flex-1"><span className="mb-1 block">Words in the alert</span><input value={r.match} onChange={(e) => edit(r.id, { match: e.target.value })} placeholder="Every alert" className="w-full rounded-[10px] bg-white/[0.06] px-2.5 py-1.5 text-white outline-none placeholder:text-white/30" /></label>
                <span className="flex items-center gap-1.5">
                  <button onClick={() => edit(r.id, { hours: r.hours ? null : [360, 780] })} className={clsx("rounded-full px-2.5 py-1 font-medium", r.hours ? "bg-white/[0.06]" : "bg-white text-black")}>Any time</button>
                  {r.hours && <><input aria-label="From" type="time" value={hm(r.hours[0])} onChange={(e) => e.target.value && edit(r.id, { hours: [toMin(e.target.value), r.hours![1]] })} className="rounded-[10px] bg-white/[0.06] px-2 py-1 text-white [color-scheme:dark]" /><input aria-label="To" type="time" value={hm(r.hours[1])} onChange={(e) => e.target.value && edit(r.id, { hours: [r.hours![0], toMin(e.target.value)] })} className="rounded-[10px] bg-white/[0.06] px-2 py-1 text-white [color-scheme:dark]" /></>}
                </span>
                <label className="flex items-center gap-1.5">Quiet for <input aria-label="Quiet minutes" type="number" min={0} max={600} value={r.cooldownMin} onChange={(e) => edit(r.id, { cooldownMin: Number(e.target.value) || 0 })} className="w-14 rounded-[10px] bg-white/[0.06] px-2 py-1 text-white" /> min</label>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-white">What the app watches</h2>
        <p className="mt-1 text-[13px] text-white/50">Same readers as the Vision chart, on the free feed, up to about 10 minutes late. Hours are New York time.</p>
        <div className="mt-3 space-y-3 text-[13px] text-white/70">
          <div className="flex flex-wrap items-center gap-1.5"><span className="w-20 text-white/45">Markets</span>{["NQ", "ES", "GC", "CL"].map((m) => <button key={m} aria-pressed={s.watch.symbols.includes(m)} onClick={() => save({ watch: { symbols: toggle(s.watch.symbols, m) } })} className={clsx("rounded-full px-3 py-1.5 font-medium", s.watch.symbols.includes(m) ? "bg-white text-black" : "bg-white/[0.06] text-white/55")}>{m}</button>)}</div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="w-20 text-white/45">Setups</span>{SETUPS.map(([v, l]) => <button key={v} aria-pressed={s.watch.setups.includes(v)} onClick={() => save({ watch: { setups: toggle(s.watch.setups, v) } })} className={clsx("rounded-full px-3 py-1.5 font-medium", s.watch.setups.includes(v) ? "bg-white text-black" : "bg-white/[0.06] text-white/55")}>{l}</button>)}</div>
          <div className="flex flex-wrap items-center gap-2"><span className="w-20 text-white/45">Chart</span>{(["5m", "15m"] as const).map((t) => <button key={t} aria-pressed={s.watch.tf === t} onClick={() => save({ watch: { tf: t } })} className={clsx("rounded-full px-3 py-1.5 font-medium", s.watch.tf === t ? "bg-white text-black" : "bg-white/[0.06] text-white/55")}>{t}</button>)}
            <input aria-label="Watch from" type="time" value={hm(s.watch.hours[0])} onChange={(e) => e.target.value && save({ watch: { hours: [toMin(e.target.value), s.watch.hours[1]] } })} className="ml-2 rounded-[10px] bg-white/[0.06] px-2 py-1 text-white [color-scheme:dark]" />
            <input aria-label="Watch to" type="time" value={hm(s.watch.hours[1])} onChange={(e) => e.target.value && save({ watch: { hours: [s.watch.hours[0], toMin(e.target.value)] } })} className="rounded-[10px] bg-white/[0.06] px-2 py-1 text-white [color-scheme:dark]" />
            <button aria-pressed={s.watch.enabled} onClick={() => save({ watch: { enabled: !s.watch.enabled } }).then(reload)} className={clsx("ml-auto rounded-full px-4 py-1.5 font-semibold", s.watch.enabled ? "bg-[#30D158] text-black" : "bg-white text-black")}>{s.watch.enabled ? "Watching" : "Start watching"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function History({ log, reload }: { log: Log[]; reload: () => void }) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center">
        <h2 className="flex-1 text-[22px] font-semibold tracking-[-0.02em] text-white">What fired</h2>
        <button onClick={reload} className="rounded-full bg-white/[0.09] px-3.5 py-2 text-[13px] font-medium text-white"><Send className="mr-1 inline h-3 w-3" />Refresh</button>
      </div>
      {log.length === 0 ? <p className="py-12 text-center text-[13.5px] text-white/45">Nothing yet. Alerts land here with where each one was sent, and why any was held back.</p> : (
        <ol className="mt-3 divide-y divide-white/[0.05]">
          {log.map((l, i) => (
            <li key={i} className="py-3">
              <p className="flex flex-wrap items-baseline justify-between gap-2 text-[13.5px] text-white">{l.text}<span className="text-[12px] tabular-nums text-white/40">{new Date(l.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></p>
              <p className="text-[12px] text-white/50">{l.source}. {l.sent.length ? `Sent by ${l.sent.join(", ")}.` : "Not sent."} {l.skipped.map((s) => `${s.rule}: ${s.why}.`).join(" ")}</p>
              {l.errors.map((e) => <p key={e} className="text-[12px] text-[#FFA3AB]">{e}</p>)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
