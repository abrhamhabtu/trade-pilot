"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Radio, X } from "lucide-react";
import { useAccountStore } from "@/store/accountStore";
import { resolvePlan, useSessionFlow } from "@/store/sessionFlowStore";
import { autoNote, parseSignal, setupLabel, type SignalCheck, type TvSignal } from "@/lib/pilot/session";
import { nyClock } from "@/lib/pilot/market";
import { chime, judge } from "./judge";

const POLL_MS = 4000;

type Ping = { signal: TvSignal; check: SignalCheck; at: number };

/**
 * Mounted once for the whole app. While listening, it picks up TradingView
 * signals from the webhook inbox, checks each against today's plan, writes the
 * auto-captured note, and pings — sound, desktop notification and a card —
 * wherever the trader happens to be in the app.
 */
export function SignalListener() {
  const listening = useSessionFlow((s) => s.listening);
  const key = useSessionFlow((s) => s.webhookKey);
  const [ping, setPing] = useState<Ping | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!listening || !key) return;
    let stopped = false;
    const poll = async () => {
      if (busy.current || stopped) return;
      busy.current = true;
      try {
        const flow = useSessionFlow.getState();
        const res = await fetch(`/api/signals/tradingview?key=${encodeURIComponent(key)}&since=${flow.lastSignalAt}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { signals: { id: string; receivedAt: number; payload: unknown }[] };
        if (!data.signals?.length) return;
        const parsed = data.signals.map((s) => parseSignal(s.payload, s.receivedAt, s.id));
        const fresh = flow.addSignals(parsed, Math.max(...data.signals.map((s) => s.receivedAt)));
        const { accounts, selectedAccountId } = useAccountStore.getState();
        const account = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
        for (const signal of fresh) {
          if (!account) continue;
          const day = nyClock(signal.receivedAt).date;
          const plan = resolvePlan(flow.plans, account.id, day);
          const events = flow.events.date === day ? flow.events.list : [];
          const { check, minute } = judge(signal, account, plan, events);
          flow.addNote({ accountId: account.id, date: day, at: signal.receivedAt, text: autoNote(signal, check, minute), signalId: signal.id, auto: true });
          setPing({ signal, check, at: Date.now() });
          if (!document.hidden || !flow.desktopAlerts) chime(check.verdict);
          if (flow.desktopAlerts && "Notification" in window && Notification.permission === "granted")
            new Notification(`${signal.symbol} · ${setupLabel(signal.setup)}${signal.side ? ` ${signal.side}` : ""}`, {
              body: `${check.verdict === "go" ? "Cleared" : check.verdict === "caution" ? "Caution" : "Wait"}: ${check.headline}`,
              tag: signal.id,
            });
        }
      } catch {
        /* offline or server restarting — try again next tick */
      } finally {
        busy.current = false;
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [listening, key]);

  useEffect(() => {
    if (!ping) return;
    const id = setTimeout(() => setPing(null), 14000);
    return () => clearTimeout(id);
  }, [ping]);

  if (!ping) return null;
  const { signal, check } = ping;
  const tone = check.verdict;
  return (
    <div
      role="status"
      className={clsx(
        "fixed bottom-5 left-1/2 z-[70] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border bg-tp-raised/95 shadow-2xl shadow-black/40 backdrop-blur-md tp-ping-in",
        tone === "go" ? "border-tp-green/40" : tone === "caution" ? "border-tp-yellow/40" : "border-tp-red/40",
      )}
    >
      <div className={clsx("h-0.5 tp-ping-bar", tone === "go" ? "bg-tp-green" : tone === "caution" ? "bg-tp-yellow" : "bg-tp-red")} />
      <div className="flex items-start gap-3 p-4">
        <span className={clsx("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", tone === "go" ? "bg-tp-green/15 text-tp-green" : tone === "caution" ? "bg-tp-yellow/15 text-tp-yellow" : "bg-tp-red/15 text-tp-red")}>
          <Radio className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Pilot ping · {signal.test ? "test signal" : "TradingView"}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-50">
            {signal.symbol} {setupLabel(signal.setup)}
            {signal.side && <span className={signal.side === "long" ? "text-tp-green" : "text-tp-red"}> {signal.side}</span>}
            {signal.price != null && <span className="font-normal text-zinc-400"> @ {signal.price.toLocaleString("en-US")}</span>}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-zinc-300">
            <span className={clsx("font-semibold", tone === "go" ? "text-tp-green" : tone === "caution" ? "text-tp-yellow" : "text-tp-red")}>
              {tone === "go" ? "Cleared." : tone === "caution" ? "Caution." : "Wait."}
            </span>{" "}
            {check.headline}
          </p>
          <Link href="/app/pilot?tab=today" onClick={() => setPing(null)} className="mt-2 inline-block text-xs font-medium text-tp-blue hover:underline">
            Open In flight →
          </Link>
        </div>
        <button aria-label="Dismiss ping" onClick={() => setPing(null)} className="text-zinc-500 hover:text-zinc-200">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
