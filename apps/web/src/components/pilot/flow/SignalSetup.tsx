"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Bell, BellOff, Check, ChevronDown, Copy, KeyRound, Radio, RefreshCw, Send, Zap } from "lucide-react";
import { useSessionFlow } from "@/store/sessionFlowStore";
import { alertTemplate, pineScript } from "@/lib/pilot/pine";
import type { MarketRead } from "@/lib/pilot/market";
import type { DayPlan } from "@/lib/pilot/session";
import { Card, Chip, Eyebrow } from "./ui";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800);
    } catch {
      /* clipboard blocked: the text is on screen to select by hand */
    }
  };
  return { copied, copy };
}

/** A believable double-break around VWAP, so the test ping draws like the real thing. */
function syntheticBreak(price: number, vwap: number | null, side: "long" | "short") {
  const v = vwap ?? price;
  const step = Math.max(price * 0.0004, 0.25);
  const dir = side === "long" ? 1 : -1;
  const closes: number[] = [];
  const vwaps: number[] = [];
  const path = [-3, -2.4, -2, -1.2, -0.4, 0.6, 1.4, 1.8, 1.2, 0.5, -0.3, -0.9, -1.1, -0.6, 0.2, 0.9, 1.6, 2.2];
  let w = v - dir * step * 1.5;
  for (let i = 0; i < 40; i++) {
    const k = path[Math.max(0, i - (40 - path.length))];
    const c = v + dir * step * (i < 40 - path.length ? -3 - Math.sin(i / 3) * 0.6 : k) + Math.sin(i * 1.7) * step * 0.25;
    w = w + (c - w) * 0.08;
    closes.push(Math.round(c * 4) / 4);
    vwaps.push(Math.round(w * 4) / 4);
  }
  return { closes, vwaps };
}

export function SignalSetup({ plan, primary, compact }: { plan: DayPlan; primary: MarketRead | null; compact?: boolean }) {
  const { webhookKey, ensureKey, rotateKey, publicUrl, setPublicUrl, listening, setListening, desktopAlerts, setDesktopAlerts, lastSignalAt } =
    useSessionFlow();
  const [open, setOpen] = useState(!compact);
  const [showTemplate, setShowTemplate] = useState(false);
  const [sending, setSending] = useState(false);
  const [origin, setOrigin] = useState("");
  const { copied, copy } = useCopy();

  useEffect(() => {
    ensureKey();
    setOrigin(window.location.origin);
  }, [ensureKey]);
  useEffect(() => setOpen(!compact), [compact]);

  const isLocal = /localhost|127\.0\.0\.1|\[::1\]/.test(origin);
  const base = publicUrl || (!isLocal ? origin : "");
  const webhook = base && webhookKey ? `${base}/api/signals/tradingview?key=${webhookKey}` : "";
  const script = useMemo(
    () => (webhookKey ? pineScript({ key: webhookKey, levels: plan.levels.filter((l) => l.source === "manual"), waitMinutes: plan.waitMinutes }) : ""),
    [webhookKey, plan.levels, plan.waitMinutes],
  );
  const connected = lastSignalAt > 0;

  const test = async () => {
    if (!webhookKey) return;
    setSending(true);
    setListening(true);
    const side = plan.bias === "short" ? "short" : "long";
    const price = primary?.price ?? 21450;
    const bars = syntheticBreak(price, primary?.vwap ?? null, side);
    try {
      await fetch(`/api/signals/tradingview?key=${webhookKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setup: "double-break-vwap",
          side,
          symbol: primary ? `${primary.symbol}1!` : "MNQ1!",
          tf: "5",
          price: bars.closes.at(-1),
          vwap: bars.vwaps.at(-1),
          closes: bars.closes,
          vwaps: bars.vwaps,
          test: true,
        }),
      });
    } finally {
      setTimeout(() => setSending(false), 600);
    }
  };

  const toggleDesktop = async () => {
    if (desktopAlerts) return setDesktopAlerts(false);
    if (!("Notification" in window)) return;
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setDesktopAlerts(perm === "granted");
  };

  return (
    <Card
      title={
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-tp-blue/10 text-tp-blue ring-1 ring-inset ring-tp-blue/20">
            <Zap className="h-3.5 w-3.5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-zinc-100">TradingView signals</span>
            <span className="block text-[11px] text-zinc-500">
              {connected ? "Receiving. Last signal " + new Date(lastSignalAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET" : "Your indicator pings Pilot the moment a setup prints"}
            </span>
          </span>
          <ChevronDown className={clsx("h-4 w-4 text-zinc-500 transition", open && "rotate-180")} />
        </button>
      }
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setListening(!listening)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ring-1 ring-inset transition",
              listening ? "bg-tp-green/10 text-tp-green ring-tp-green/30" : "bg-white/[0.03] text-zinc-400 ring-white/[0.08] hover:text-zinc-100",
            )}
          >
            <Radio className={clsx("h-3.5 w-3.5", listening && "animate-pulse")} />
            {listening ? "Listening" : "Paused"}
          </button>
        </div>
      }
    >
      {open && (
        <div className="space-y-4">
          <Step n={1} title="Give TradingView a way in">
            <p>
              TradingView sends alerts from its own servers, so it needs a public HTTPS address. Running TradePilot on this computer? Open a free tunnel in a terminal and paste the address it prints:
            </p>
            <CodeLine text={`cloudflared tunnel --url ${origin || "http://localhost:4040"}`} id="tunnel" copied={copied} copy={copy} />
            <input
              value={publicUrl}
              onChange={(e) => setPublicUrl(e.target.value)}
              placeholder={isLocal ? "https://your-tunnel.trycloudflare.com" : origin}
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-tp-blue/40 focus:outline-none"
            />
          </Step>

          <Step n={2} title="Your webhook">
            {webhook ? (
              <CodeLine text={webhook} id="webhook" copied={copied} copy={copy} />
            ) : (
              <p className="text-zinc-500">Add the public address above and your webhook URL appears here.</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <KeyRound className="h-3 w-3" /> The key in this URL is the only password. Keep it private.
              </span>
              <button onClick={rotateKey} className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-100">
                <RefreshCw className="h-3 w-3" /> New key
              </button>
            </div>
          </Step>

          <Step n={3} title="Add the Pilot Signals indicator">
            <p>
              Built for your setups: <b className="text-zinc-200">double-break VWAP</b>, <b className="text-zinc-200">S/R breaks</b> and <b className="text-zinc-200">retest &amp; hold</b> on prior-day, overnight and your own levels. It skips the first {plan.waitMinutes} minutes, the same as your plan, and sends the last 40 bars so Pilot can draw each signal.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => copy("pine", script)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-tp-blue px-3 py-1.5 text-[12.5px] font-semibold text-[#0D1628] hover:brightness-110"
              >
                {copied === "pine" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "pine" ? "Copied Pine script" : "Copy Pine script"}
              </button>
              <span className="text-[11px] text-zinc-500">TradingView → Pine Editor → paste → Add to chart</span>
            </div>
          </Step>

          <Step n={4} title="Create one alert">
            <p>
              On the chart: <span className="text-zinc-200">Alert → Condition: “TradePilot Pilot Signals” → “Any alert() function call”</span>. Under Notifications, tick <span className="text-zinc-200">Webhook URL</span> and paste yours. One alert covers every setup. (TradingView only sends webhooks on paid plans with two-factor sign-in turned on.)
            </p>
            <button onClick={() => setShowTemplate((s) => !s)} className="mt-2 text-[12px] font-medium text-tp-blue hover:underline">
              {showTemplate ? "Hide" : "Prefer your own alerts? Use this message instead"}
            </button>
            {showTemplate && webhookKey && <CodeLine text={alertTemplate(webhookKey)} id="tpl" copied={copied} copy={copy} wrap />}
          </Step>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
            <button
              onClick={test}
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[12.5px] font-semibold text-zinc-100 hover:border-white/[0.2] disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send a test signal"}
            </button>
            <button
              onClick={toggleDesktop}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium ring-1 ring-inset",
                desktopAlerts ? "bg-tp-green/10 text-tp-green ring-tp-green/30" : "text-zinc-400 ring-white/[0.08] hover:text-zinc-100",
              )}
            >
              {desktopAlerts ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              Desktop alerts {desktopAlerts ? "on" : "off"}
            </button>
            {connected && <Chip tone="green">Connected</Chip>}
          </div>
        </div>
      )}
    </Card>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-[10px] text-zinc-300">{n}</span>
      <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-zinc-400">
        <Eyebrow className="mb-1 text-zinc-300">{title}</Eyebrow>
        {children}
      </div>
    </div>
  );
}

function CodeLine({ text, id, copied, copy, wrap }: { text: string; id: string; copied: string | null; copy: (id: string, t: string) => void; wrap?: boolean }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-[#0b1322] px-3 py-2">
      <code className={clsx("min-w-0 flex-1 font-mono text-[11.5px] text-zinc-200", wrap ? "break-all" : "truncate")}>{text}</code>
      <button onClick={() => copy(id, text)} aria-label="Copy" className="shrink-0 text-zinc-500 hover:text-zinc-100">
        {copied === id ? <Check className="h-3.5 w-3.5 text-tp-green" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
