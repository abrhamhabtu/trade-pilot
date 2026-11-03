"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Code2, Columns2, Copy, Download, ScanEye, Square, Volume2, VolumeX, X } from "lucide-react";
import { useVisionStore, type VisionPosition, type VisionTrade, type Venue } from "@/store/visionStore";
import { useSessionFlow } from "@/store/sessionFlowStore";
import { BY_KIND, SYMBOLS, formatPrice, type MarketKind, type VisionSymbolId } from "@/lib/vision/markets";
import { useTickers } from "@/lib/vision/feed";
import { visionPine } from "@/lib/vision/pine";
import { useModelStore, modelReady } from "@/lib/pilot/modelStore";
import { PROVIDERS } from "@/lib/pilot/models";
import { chime } from "@/components/pilot/flow/judge";
import { ChartCard, type ChartState } from "./ChartCard";
import { CopilotPanel } from "./CopilotPanel";

const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dayOf = (ms: number) => new Date(ms).toLocaleDateString("en-CA");
const QTY_DP: Partial<Record<VisionSymbolId, number>> = { BTC: 4, ETH: 3, SOL: 2, XRP: 0 };

export function VisionPage() {
  const s = useVisionStore();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [states, setStates] = useState<(ChartState | null)[]>([null, null]);
  const [pine, setPine] = useState(false);
  const [autoNote, setAutoNote] = useState("");
  const tickers = useTickers(s.kind);
  const arm = useArm();

  const focused = s.charts[Math.min(s.focus, s.charts.length - 1)];
  const sym = SYMBOLS[focused.symbol];
  const state = states[Math.min(s.focus, s.charts.length - 1)];

  // Latest price per symbol: the charts first (tick-live), then the strip.
  const prices = useMemo(() => {
    const out: Partial<Record<VisionSymbolId, number>> = {};
    for (const t of tickers) if (t.price != null) out[t.id] = t.price;
    s.charts.forEach((c, i) => {
      const b = states[i]?.feed.bars;
      if (b?.length) out[c.symbol] = b[b.length - 1].c;
    });
    return out;
  }, [tickers, states, s.charts]);

  const today = dayOf(Date.now());
  const todays = s.trades.filter((t) => dayOf(t.closedAt) === today);
  const positionFor = (id: VisionSymbolId) => s.positions.find((p) => p.symbol === id) ?? null;
  const tradeLabel = `TRADE ${todays.length + s.positions.length + 1} · ${s.autoExecute ? "AUTO" : "MANUAL"}`;

  const ping = useCallback((tone: "go" | "caution" | "wait") => useVisionStore.getState().sound && chime(tone), []);

  // ── Opening a trade ──
  const openFrom = useCallback(
    async (st: ChartState, symbol: VisionSymbolId, auto: boolean) => {
      const v = useVisionStore.getState();
      const setup = st.scan?.setup;
      const bars = st.feed.bars;
      if (st.replaying || !setup || setup.outcome !== "open" || !bars.length || v.positions.some((p) => p.symbol === symbol) || v.handled.includes(setup.id)) return;
      const sm = SYMBOLS[symbol];
      const price = bars[bars.length - 1].c;
      const risk = Math.abs(price - setup.stop);
      // The plan has to still make sense at today's price.
      if ((setup.side === "long" && (price <= setup.stop || price >= setup.target)) || (setup.side === "short" && (price >= setup.stop || price <= setup.target)) || risk <= 0) {
        v.handle(setup.id);
        setAutoNote("Price already moved past the plan; skipped.");
        return;
      }
      const venue: Venue = sm.kind === "futures" && arm.armed ? (arm.armed.venue as Venue) : "paper";
      let qty: number;
      let pointValue: number;
      if (sm.kind === "crypto") {
        const dp = QTY_DP[symbol] ?? 2;
        qty = Math.floor((v.riskDollars / risk) * 10 ** dp) / 10 ** dp;
        pointValue = 1;
      } else {
        qty = Math.max(1, Math.round(v.contracts));
        pointValue = v.micro ? sm.pointValue!.micro : sm.pointValue!.full;
      }
      if (qty <= 0) {
        v.handle(setup.id);
        return;
      }
      if (venue !== "paper") {
        setAutoNote(`Sending to ${venue === "tradovate" ? "Tradovate" : "TopstepX"}…`);
        const r = await fetch("/api/vision/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "order", symbol, micro: v.micro, side: setup.side, qty, refPx: price, stopPts: Math.abs(price - setup.stop), targetPts: Math.abs(setup.target - price) }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          v.handle(setup.id);
          setAutoNote(`Order refused: ${j.error ?? r.status}`);
          ping("wait");
          return;
        }
      }
      v.open({ symbol, side: setup.side, qty, entry: price, stop: setup.stop, target: setup.target, setupId: setup.id, auto, venue, pointValue });
      setAutoNote("");
      ping("go");
    },
    [arm.armed, ping],
  );

  // ── Watching open positions ──
  useEffect(() => {
    const v = useVisionStore.getState();
    for (const p of v.positions) {
      const px = prices[p.symbol];
      if (px == null) continue;
      const stopHit = p.side === "long" ? px <= p.stop : px >= p.stop;
      const targetHit = p.side === "long" ? px >= p.target : px <= p.target;
      if (stopHit || targetHit) {
        const t = v.close(p.id, stopHit ? p.stop : p.target, stopHit ? "stop" : "target");
        if (t) ping(t.pnl >= 0 ? "go" : "wait");
      }
    }
  }, [prices, ping]);

  // ── Auto-execute ──
  useEffect(() => {
    if (!s.autoExecute) return;
    s.charts.forEach((c, i) => {
      const st = states[i];
      const setup = st?.scan?.setup;
      if (!st || st.replaying || !setup || !setup.fresh || !st.phase.done) return;
      if (s.handled.includes(setup.id) || s.positions.some((p) => p.symbol === c.symbol)) return;
      const h = setup.history;
      const passes = h.hitRate !== null && h.hitRate >= s.minHitRate && (!s.requireEdge || (h.expectancyR ?? -1) > 0);
      if (!passes) {
        useVisionStore.getState().handle(setup.id);
        setAutoNote(h.hitRate === null ? "Too little history to rate this one; left it for you." : `History ${Math.round(h.hitRate * 100)}% is under your ${Math.round(s.minHitRate * 100)}% bar; skipped.`);
        return;
      }
      openFrom(st, c.symbol, true);
    });
  }, [states, s.autoExecute, s.charts, s.handled, s.positions, s.minHitRate, s.requireEdge, openFrom]);

  const onState = useCallback((i: number) => (st: ChartState) => setStates((xs) => (xs[i] === st ? xs : Object.assign([...xs], { [i]: st }))), []);
  const stateSetters = useMemo(() => [onState(0), onState(1)], [onState]);

  const switchKind = (kind: MarketKind) => {
    if (kind === s.kind) return;
    const ids = BY_KIND[kind];
    s.set({ kind, charts: s.charts.map((c, i) => ({ ...c, symbol: ids[i] ?? ids[0] })), focus: 0 });
  };
  const toggleLayout = () => {
    if (s.charts.length === 2) s.set({ charts: [s.charts[s.focus] ?? s.charts[0]], focus: 0 });
    else {
      const other = BY_KIND[s.kind].find((id) => id !== s.charts[0].symbol) ?? s.charts[0].symbol;
      s.set({ charts: [s.charts[0], { symbol: other, tf: s.charts[0].tf }] });
    }
  };
  const pickSymbol = (id: VisionSymbolId) => s.setChart(s.focus, { symbol: id });

  if (!hydrated) return null;
  const position = positionFor(focused.symbol);
  const setupId = state?.scan?.setup?.id;
  const lastTrade = s.trades[s.trades.length - 1] ?? null;
  const sizing = sym.kind === "crypto" ? `Risk $${s.riskDollars} · ${state?.scan?.setup ? `${(s.riskDollars / Math.abs((prices[focused.symbol] ?? state.scan.setup.entry) - state.scan.setup.stop)).toFixed(QTY_DP[focused.symbol] ?? 2)} ${sym.id}` : ""}` : `${s.contracts} ${s.micro ? sym.roots!.micro : sym.roots!.full}`;

  return (
    <div className="space-y-5 pb-6">
      <TopBar kind={s.kind} onKind={switchKind} two={s.charts.length === 2} onLayout={toggleLayout} onPine={() => setPine(true)} sound={s.sound} onSound={() => s.set({ sound: !s.sound })} />

      <TickerStrip rows={tickers} active={focused.symbol} onPick={pickSymbol} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          {s.charts.map((c, i) => (
            <ChartCard
              key={`${i}`}
              symbol={c.symbol}
              tf={c.tf}
              focused={s.focus === i}
              compact={s.charts.length === 2}
              position={positionFor(c.symbol)}
              tradeLabel={tradeLabel}
              onFocus={() => s.focus !== i && s.set({ focus: i })}
              onTf={(tf) => s.setChart(i, { tf })}
              onClose={s.charts.length === 2 ? () => s.set({ charts: s.charts.filter((_, k) => k !== i), focus: 0 }) : undefined}
              onState={stateSetters[i]}
            />
          ))}
          <PnlStrip trades={s.trades} positions={s.positions} prices={prices} accountSize={s.accountSize} />
        </div>
        <div className="xl:sticky xl:top-4 xl:self-start">
          <CopilotPanel
            sym={sym}
            state={state ?? null}
            price={prices[focused.symbol] ?? null}
            position={position}
            todays={todays}
            autoExecute={s.autoExecute}
            autoNote={autoNote}
            onAuto={(on) => {
              s.set({ autoExecute: on });
              setAutoNote("");
            }}
            onOpen={() => state && openFrom(state, focused.symbol, false)}
            onSkip={() => setupId && s.handle(setupId)}
            onClosePosition={async () => {
              if (!position) return;
              if (position.venue !== "paper") await fetch("/api/vision/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "flatten", symbol: position.symbol, micro: s.micro }) }).catch(() => undefined);
              const t = s.close(position.id, prices[position.symbol] ?? position.entry, "manual");
              if (t) ping(t.pnl >= 0 ? "go" : "wait");
            }}
            handled={!!setupId && s.handled.includes(setupId) && !position}
            lastTrade={lastTrade}
            sizing={sizing}
            venueSlot={<VenueSlot kind={sym.kind} arm={arm} />}
          />
        </div>
      </div>

      {pine && <PineSheet onClose={() => setPine(false)} />}
    </div>
  );
}

function TopBar({ kind, onKind, two, onLayout, onPine, sound, onSound }: { kind: MarketKind; onKind: (k: MarketKind) => void; two: boolean; onLayout: () => void; onPine: () => void; sound: boolean; onSound: () => void }) {
  const model = useModelStore((s) => s.model);
  const hydrate = useModelStore((s) => s.hydrate);
  useEffect(() => hydrate(), [hydrate]);
  const ready = modelReady(model);
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pt-1">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-[15px] bg-gradient-to-br from-[#FFB27D] to-[#FF7A2D] text-black shadow-[0_14px_34px_-12px_rgba(255,138,61,0.9)]">
          <ScanEye className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-[40px] font-bold leading-none tracking-[-0.04em] text-white">Vision</h1>
          <p className="mt-1 text-[15px] text-white/50">Reads the chart, marks the setup, and shows its odds from real history.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative grid grid-cols-2 rounded-[14px] bg-white/[0.07] p-[3px]">
          <span aria-hidden className="absolute bottom-[3px] left-[3px] top-[3px] w-[calc(50%-3px)] rounded-[11px] bg-white/[0.16] transition-transform duration-500 ease-spring" style={{ transform: kind === "futures" ? "translateX(100%)" : "none" }} />
          {(["crypto", "futures"] as const).map((k) => (
            <button key={k} onClick={() => onKind(k)} className={clsx("relative rounded-[11px] px-4 py-1.5 text-[14px] font-semibold capitalize", kind === k ? "text-white" : "text-white/50 hover:text-white/80")}>
              {k}
            </button>
          ))}
        </div>
        <IconBtn label={two ? "One chart" : "Two charts"} onClick={onLayout}>
          {two ? <Square className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
        </IconBtn>
        <IconBtn label={sound ? "Sound on" : "Sound off"} onClick={onSound}>
          {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </IconBtn>
        <a href="/app/pilot?tab=settings" className="flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-3.5 text-[13px] font-semibold text-white/80 ring-1 ring-white/[0.06] hover:bg-white/[0.11]" title="Change the model in Pilot AI settings">
          <span className={clsx("h-2 w-2 rounded-full", ready ? "bg-[#FF8A3D]" : "bg-white/35")} />
          {ready ? model.model || PROVIDERS[model.provider].label : "Built-in reader"}
        </a>
        <button onClick={onPine} className="flex h-10 items-center gap-2 rounded-full bg-[#FF8A3D] px-4 text-[14px] font-semibold text-black shadow-[0_10px_26px_-10px_rgba(255,138,61,0.9)] hover:brightness-105 active:scale-[0.97]">
          <Code2 className="h-4 w-4" /> Pine Script
        </button>
      </div>
    </header>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] text-white/75 ring-1 ring-white/[0.06] hover:bg-white/[0.11] hover:text-white">
      {children}
    </button>
  );
}

function TickerStrip({ rows, active, onPick }: { rows: ReturnType<typeof useTickers>; active: VisionSymbolId; onPick: (id: VisionSymbolId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {rows.map((r) => {
        const sm = SYMBOLS[r.id];
        const up = (r.changePct ?? 0) >= 0;
        const min = Math.min(...r.spark);
        const max = Math.max(...r.spark);
        const d = r.spark.map((v, i) => `${i ? "L" : "M"}${((i / Math.max(1, r.spark.length - 1)) * 80).toFixed(1)},${(22 - ((v - min) / (max - min || 1)) * 20).toFixed(1)}`).join(" ");
        return (
          <button
            key={r.id}
            onClick={() => onPick(r.id)}
            className={clsx("flex items-center gap-3 rounded-[22px] border px-4 py-3 text-left backdrop-blur-xl transition", r.id === active ? "border-[#FF8A3D]/40 bg-[#FF8A3D]/[0.08]" : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05]")}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold text-black" style={{ background: sm.color }}>
              {sm.id.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-white/50">
                {sm.label}
                {r.delayed && <span className="ml-1 text-white/35">· delayed</span>}
              </span>
              <span className="block truncate text-[17px] font-semibold tabular-nums text-white">{r.price != null ? formatPrice(sm, r.price) : "—"}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <svg width="80" height="24" className="overflow-visible">
                {r.spark.length > 1 && <path d={d} fill="none" stroke={up ? "#FF8A3D" : "rgba(255,255,255,0.45)"} strokeWidth="1.6" strokeLinejoin="round" />}
              </svg>
              <span className={clsx("text-[12px] font-semibold tabular-nums", up ? "text-[#FFB27D]" : "text-white/55")}>{r.changePct != null ? `${up ? "+" : ""}${r.changePct.toFixed(2)}%` : ""}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PnlStrip({ trades, positions, prices, accountSize }: { trades: VisionTrade[]; positions: VisionPosition[]; prices: Partial<Record<VisionSymbolId, number>>; accountSize: number }) {
  const today = dayOf(Date.now());
  const todays = trades.filter((t) => dayOf(t.closedAt) === today);
  const open = positions.reduce((a, p) => {
    const px = prices[p.symbol];
    return px == null ? a : a + (p.side === "long" ? px - p.entry : p.entry - px) * p.qty * p.pointValue;
  }, 0);
  const realized = todays.reduce((a, t) => a + t.pnl, 0);
  const total = realized + open;
  const wins = trades.filter((t) => t.pnl > 0).length;
  // The last 30 days, one bar each.
  const days = Array.from({ length: 30 }, (_, k) => dayOf(Date.now() - (29 - k) * 86_400_000));
  const byDay = days.map((d) => trades.filter((t) => dayOf(t.closedAt) === d).reduce((a, t) => a + t.pnl, 0) + (d === today ? open : 0));
  const maxAbs = Math.max(1, ...byDay.map(Math.abs));
  const active = byDay.filter((v) => v !== 0);
  const avg = active.length ? active.reduce((a, b) => a + b, 0) / active.length : 0;
  const month = byDay.reduce((a, b) => a + b, 0);
  return (
    <section className="grid gap-5 rounded-[28px] border border-white/[0.07] bg-[#121214]/80 p-5 backdrop-blur-2xl md:grid-cols-[0.9fr_1.1fr]">
      <div>
        <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">
          Today&apos;s P&amp;L <span className="rounded-full bg-white/[0.07] px-2 py-0.5 normal-case tracking-normal text-white/60">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          {positions.length > 0 && <span className="flex items-center gap-1 normal-case tracking-normal text-[#FF8A3D]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF8A3D]" /> live</span>}
          <span className="rounded-full bg-white/[0.07] px-2 py-0.5 normal-case tracking-normal text-white/50">paper + live</span>
        </p>
        <p className={clsx("mt-2 bg-clip-text text-[56px] font-bold leading-none tracking-[-0.045em] tabular-nums text-transparent", total >= 0 ? "bg-gradient-to-b from-[#FFC9A3] to-[#FF7A2D]" : "bg-gradient-to-b from-white to-white/60")}>{signed(total)}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px] font-semibold">
          <Chip>{`${total >= 0 ? "+" : ""}${((total / accountSize) * 100).toFixed(2)}% of $${(accountSize / 1000).toFixed(0)}K`}</Chip>
          <Chip>{trades.length ? `${Math.round((wins / trades.length) * 100)}% win rate` : "No trades yet"}</Chip>
          <Chip>{`${todays.length} trade${todays.length === 1 ? "" : "s"} today`}</Chip>
          <Chip>{`30 days ${signed(month)}`}</Chip>
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">Daily P&amp;L · 30 days</p>
        <svg viewBox="0 0 300 90" className="mt-2 h-[110px] w-full" preserveAspectRatio="none">
          <line x1="0" x2="300" y1="45" y2="45" stroke="rgba(255,255,255,0.1)" />
          {avg !== 0 && <line x1="0" x2="300" y1={45 - (avg / maxAbs) * 40} y2={45 - (avg / maxAbs) * 40} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />}
          {byDay.map((v, k) => {
            const hgt = (Math.abs(v) / maxAbs) * 40;
            return <rect key={k} x={k * 10 + 1.5} width="7" y={v >= 0 ? 45 - hgt : 45} height={Math.max(v ? 1.5 : 0, hgt)} rx="1.5" fill={v >= 0 ? (k === 29 ? "#FF8A3D" : "rgba(255,138,61,0.55)") : "rgba(160,166,180,0.45)"} />;
          })}
        </svg>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-white/70">{children}</span>;
}

// ── Real orders: arming a venue for today ──

type ArmState = { venue: string; accountId: number; accountName: string; maxQty: number; date: string } | null;

function useArm() {
  const [armed, setArmed] = useState<ArmState>(null);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [available, setAvailable] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/vision/execute", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setArmed(j.armed);
      setConnected(j.connected);
      setAvailable(true);
    } catch {
      setAvailable(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { armed, connected, available, refresh, setArmed };
}

function VenueSlot({ kind, arm }: { kind: MarketKind; arm: ReturnType<typeof useArm> }) {
  const [open, setOpen] = useState(false);
  const [venue, setVenue] = useState<"tradovate" | "projectx">("tradovate");
  const [accounts, setAccounts] = useState<{ id: number; name: string; broker: string }[]>([]);
  const [accountKey, setAccountKey] = useState("");
  const [maxQty, setMaxQty] = useState(2);
  const [firm, setFirm] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const loaded = useRef(false);
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    fetch("/api/live?accounts=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setAccounts(j.accounts ?? []))
      .catch(() => setAccounts([]));
  }, [open]);

  if (kind === "crypto")
    return <p className="rounded-2xl bg-white/[0.03] px-3 py-2 text-[12px] text-white/45">Crypto trades on paper. Exchange execution plugs into the venue interface when you add API keys.</p>;
  if (!arm.available) return <p className="rounded-2xl bg-white/[0.03] px-3 py-2 text-[12px] text-white/45">Paper trading. Real orders work in the local app only.</p>;
  if (arm.armed)
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-[#FF5A4E]/12 px-3 py-2 ring-1 ring-[#FF5A4E]/40">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF5A4E]" />
        <span className="flex-1 text-[12.5px] text-white/85">
          Real orders: {arm.armed.venue === "tradovate" ? "Tradovate" : "TopstepX"} · {arm.armed.accountName} · max {arm.armed.maxQty}
        </span>
        <button
          onClick={async () => {
            await fetch("/api/vision/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disarm" }) });
            arm.refresh();
          }}
          className="text-[12.5px] font-semibold text-white hover:underline"
        >
          Disarm
        </button>
      </div>
    );
  const anyBroker = arm.connected.tradovate || arm.connected.projectx;
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between rounded-2xl bg-white/[0.03] px-3 py-2 text-left text-[12.5px] text-white/55 hover:bg-white/[0.05]">
        <span>Paper trading{anyBroker ? "" : " · connect a broker in Proving Ground → Live for real orders"}</span>
        {anyBroker && <span className="font-semibold text-[#FFB27D]">Arm real orders</span>}
      </button>
    );
  const list = accounts.filter((a) => a.broker === venue);
  const chosen = list.find((a) => `${a.id}` === accountKey);
  return (
    <div className="space-y-2 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08]">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-white">Real orders for today&apos;s session</p>
        <button aria-label="Cancel" onClick={() => setOpen(false)} className="text-white/45 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.05] p-0.5">
        {(["tradovate", "projectx"] as const).map((v) => (
          <button key={v} disabled={!arm.connected[v]} onClick={() => setVenue(v)} className={clsx("rounded-lg py-1.5 text-[12.5px] font-semibold disabled:opacity-35", venue === v ? "bg-white/[0.14] text-white" : "text-white/55")}>
            {v === "tradovate" ? "Tradovate" : "TopstepX"}
          </button>
        ))}
      </div>
      <select value={accountKey} onChange={(e) => setAccountKey(e.target.value)} className="w-full rounded-xl bg-white/[0.06] px-3 py-2 text-[13px] text-white ring-1 ring-inset ring-white/[0.08]">
        <option value="">Pick an account…</option>
        {list.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <label className="flex items-center justify-between text-[12.5px] text-white/60">
        Max contracts per order
        <input type="number" min={1} max={50} value={maxQty} onChange={(e) => setMaxQty(Number(e.target.value))} className="w-16 rounded-lg bg-white/[0.06] px-2 py-1 text-right text-white" />
      </label>
      <label className="flex items-start gap-2 text-[12px] text-white/60">
        <input type="checkbox" checked={firm} onChange={(e) => setFirm(e.target.checked)} className="mt-0.5" /> My firm allows automated trading on this account.
      </label>
      <div className="flex gap-2">
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type ARM" className="w-24 rounded-xl bg-white/[0.06] px-3 py-2 text-[13px] text-white ring-1 ring-inset ring-white/[0.08]" />
        <button
          disabled={!chosen || !firm || confirm !== "ARM"}
          onClick={async () => {
            setErr("");
            const r = await fetch("/api/vision/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "arm", venue, accountId: chosen!.id, accountName: chosen!.name, maxQty, firmAllows: firm, confirm }) });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) setErr(j.error ?? "Could not arm.");
            else {
              setOpen(false);
              arm.refresh();
            }
          }}
          className="flex-1 rounded-xl bg-[#FF5A4E] py-2 text-[13px] font-bold text-white disabled:opacity-35"
        >
          Arm for today
        </button>
      </div>
      <p className="text-[11.5px] leading-snug text-white/40">Market entries with a broker-held stop and target. Ends at the close. Several firms ban automated trading; check yours first.</p>
      {err && <p className="text-[12px] text-[#FF8D85]">{err}</p>}
    </div>
  );
}

function PineSheet({ onClose }: { onClose: () => void }) {
  const key = useSessionFlow((s) => s.webhookKey);
  const ensureKey = useSessionFlow((s) => s.ensureKey);
  useEffect(() => {
    ensureKey();
  }, [ensureKey]);
  const code = useMemo(() => visionPine({ key }), [key]);
  const [copied, setCopied] = useState(false);
  const hook = typeof window !== "undefined" ? `${window.location.origin}/api/signals/tradingview?key=${key}` : "";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 backdrop-blur-[6px] sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Pine Script" onClick={(e) => e.stopPropagation()} className="tp-sheet flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[30px] border border-white/[0.08] bg-[#161618]/95 backdrop-blur-2xl sm:rounded-[30px]">
        <header className="flex items-start gap-3 px-6 pb-3 pt-5">
          <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#FF8A3D] text-black">
            <Code2 className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-[22px] font-bold tracking-tight text-white">Vision for TradingView</h2>
            <p className="text-[13.5px] text-white/55">The same sweep-and-reversal reader as a Pine v6 indicator, with numbered steps, the plan, and alerts for TradePilot.</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.08] text-white/70 hover:bg-white/[0.14]">
            <X className="h-4 w-4" />
          </button>
        </header>
        <ol className="mx-6 mb-3 list-decimal space-y-1 pl-5 text-[13px] text-white/65">
          <li>TradingView → Pine Editor → paste → Add to chart.</li>
          <li>
            For alerts: Create alert → Condition &quot;TP Vision&quot; → Any alert() function call → Webhook URL: <span className="break-all font-mono text-[12px] text-[#FFB27D]">{hook}</span>
          </li>
          <li>TradingView needs a public URL for webhooks; set one in Pilot AI → Today → Signal setup if this app runs on localhost.</li>
        </ol>
        <pre className="mx-6 flex-1 overflow-auto rounded-2xl bg-black/40 p-4 font-mono text-[12px] leading-relaxed text-white/80 ring-1 ring-white/[0.06]">{code}</pre>
        <footer className="flex gap-2 px-6 py-4">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#FF8A3D] py-3 text-[15px] font-semibold text-black"
          >
            <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy script"}
          </button>
          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
              a.download = "tradepilot-vision.pine";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/[0.08] px-5 py-3 text-[15px] font-semibold text-white"
          >
            <Download className="h-4 w-4" /> .pine
          </button>
        </footer>
      </div>
    </div>
  );
}
