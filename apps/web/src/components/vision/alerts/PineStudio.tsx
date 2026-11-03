"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Check, CheckCircle2, Copy, Download, FlaskConical, Plus, Search, Star, Trash2, Upload, XCircle } from "lucide-react";
import type { PineScript } from "@/lib/server/pine";
import { PINE_STARTERS, addAlerts, alertMessage, analyzePine, orderFillMessage } from "@/lib/vision/pineTools";
import { visionPine } from "@/lib/vision/pine";
import { useVisionStore } from "@/store/visionStore";

const post = (body: unknown) => fetch("/api/pine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Couldn't save that.");
  return j;
});

const STARTERS = [...PINE_STARTERS, { id: "vision-sweep", name: "Vision sweep and reversal", blurb: "The chart reader's liquidity sweep, with the plan drawn.", code: visionPine() }];

/** Your Pine scripts: bring them in, keep them, see what they can alert on, and wire them up. */
export function PineStudio({ webhook }: { webhook: string }) {
  const [list, setList] = useState<PineScript[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [paste, setPaste] = useState(false);
  const [drag, setDrag] = useState(false);
  const refresh = useCallback(async () => {
    const r = await fetch("/api/pine", { cache: "no-store" }).then((x) => x.json()).catch(() => ({ scripts: [] }));
    setList(r.scripts);
    return r.scripts as PineScript[];
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const add = async (code: string, name?: string) => {
    const { script } = await post({ action: "save", script: { code, name } });
    await refresh();
    setOpenId(script.id);
    setPaste(false);
  };
  const files = async (fs: FileList | File[]) => {
    setError("");
    for (const f of [...fs].slice(0, 30)) {
      if (f.size > 400_000) {
        setError(`${f.name} is too large.`);
        continue;
      }
      await add(await f.text(), f.name.replace(/\.(pine|txt|pinescript)$/i, "")).catch((e) => setError(e.message));
    }
  };
  const open = list?.find((s) => s.id === openId) ?? null;
  const shown = useMemo(() => (list ?? []).filter((s) => !q || `${s.name} ${s.tags.join(" ")} ${s.notes}`.toLowerCase().includes(q.toLowerCase())), [list, q]);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid min-h-full md:grid-cols-[280px_minmax(0,1fr)]" onDragOver={(e) => (e.preventDefault(), setDrag(true))} onDragLeave={() => setDrag(false)} onDrop={(e) => {
      e.preventDefault();
      setDrag(false);
      void files(e.dataTransfer.files);
    }}>
      <aside className="border-b border-white/[0.06] p-4 md:border-b-0 md:border-r">
        <div className="flex gap-1.5">
          <button onClick={() => (setPaste(true), setOpenId(null))} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-[13px] font-semibold text-black"><Plus className="h-3.5 w-3.5" /> Paste</button>
          <button onClick={() => input.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.09] px-3 py-2 text-[13px] font-medium text-white"><Upload className="h-3.5 w-3.5" /> Files</button>
          <input ref={input} type="file" multiple accept=".pine,.txt,.pinescript" className="hidden" onChange={(e) => e.target.files && files(e.target.files)} />
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-[11px] bg-white/[0.06] px-2.5 py-1.5"><Search className="h-3.5 w-3.5 text-white/40" /><input aria-label="Search scripts" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/30" /></label>
        <p className="mt-4 text-[12px] font-medium text-white/45">Your scripts</p>
        <div className="mt-1 space-y-0.5">
          {list && !shown.length && <p className="py-2 text-[12.5px] leading-snug text-white/40">{q ? "No matches." : "None yet. Paste one, drop files anywhere here, or start from one below."}</p>}
          {shown.map((s) => (
            <button key={s.id} onClick={() => (setOpenId(s.id), setPaste(false))} aria-current={openId === s.id} className={clsx("flex w-full items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-left text-[13px]", openId === s.id ? "bg-white/[0.11] text-white" : "text-white/70 hover:bg-white/[0.05]")}>
              {s.favorite && <Star className="h-3 w-3 shrink-0 fill-current text-[#FFD60A]" />}<span className="truncate">{s.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[12px] font-medium text-white/45">Ready to use</p>
        <div className="mt-1 space-y-0.5">
          {STARTERS.map((t) => (
            <button key={t.id} onClick={() => add(t.code, t.name).catch((e) => setError(e.message))} className="block w-full rounded-[10px] px-2.5 py-2 text-left hover:bg-white/[0.05]">
              <span className="block text-[13px] text-white/85">{t.name}</span>
              <span className="block text-[11.5px] leading-snug text-white/40">{t.blurb}</span>
            </button>
          ))}
        </div>
      </aside>
      <main className="min-w-0 p-5">
        {error && <p className="mb-3 rounded-[12px] bg-[#FF7A85]/12 px-3 py-2 text-[13px] text-[#FFA3AB]">{error}</p>}
        {drag && <p className="mb-3 rounded-[12px] border border-dashed border-white/30 px-3 py-6 text-center text-[13.5px] text-white/70">Drop your .pine files</p>}
        {paste ? <PasteBox onAdd={(c, n) => add(c, n).catch((e) => setError(e.message))} /> : open ? <Editor key={open.id} s={open} webhook={webhook} onSaved={refresh} onRemoved={async () => (setOpenId(null), await refresh())} /> : (
          <div className="mx-auto max-w-xl py-12 text-center">
            <h2 className="text-[24px] font-semibold tracking-[-0.025em] text-white">Keep every Pine script in one place</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-white/55">Bring in the code you have. The app reads what each script can alert on, warns about common traps, and adds the alert code so it can call your phone. TradingView still runs the script: this app can&apos;t chart or backtest Pine itself.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function PasteBox({ onAdd }: { onAdd: (code: string, name?: string) => void }) {
  const [code, setCode] = useState("");
  const info = useMemo(() => analyzePine(code), [code]);
  return (
    <div>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-white">Paste your script</h2>
      <textarea autoFocus value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} rows={18} placeholder="//@version=6&#10;indicator(&quot;My script&quot;, overlay = true)" className="mt-3 w-full resize-y rounded-[14px] bg-black/40 p-4 font-mono text-[12.5px] leading-relaxed text-white/85 outline-none ring-1 ring-white/[0.07] placeholder:text-white/25 focus:ring-white/30" />
      <div className="mt-2 flex items-center gap-3">
        <button disabled={!code.trim()} onClick={() => onAdd(code)} className="rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-black disabled:opacity-40">Save script</button>
        {code.trim() && <span className="text-[12.5px] text-white/50">{info.title || "No title found"}, {info.conditions.length} thing{info.conditions.length === 1 ? "" : "s"} it can alert on</span>}
      </div>
    </div>
  );
}

function Editor({ s, webhook, onSaved, onRemoved }: { s: PineScript; webhook: string; onSaved: () => Promise<unknown>; onRemoved: () => Promise<unknown> }) {
  const [code, setCode] = useState(s.code);
  const [name, setName] = useState(s.name);
  const [notes, setNotes] = useState(s.notes);
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState("");
  const [sure, setSure] = useState(false);
  const setBt = useVisionStore((x) => x.setBt);
  const set = useVisionStore((x) => x.set);
  const info = useMemo(() => analyzePine(code), [code]);
  const dirty = code !== s.code || name !== s.name || notes !== s.notes;
  const starter = PINE_STARTERS.find((t) => t.name === s.name);
  const save = async (over?: Partial<PineScript>) => {
    await post({ action: "save", script: { id: s.id, code, name, notes, favorite: s.favorite, ...over } });
    await onSaved();
  };
  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(id);
    setTimeout(() => setCopied(""), 1500);
  };
  const addCode = async () => {
    const chosen = info.conditions.filter((c) => picks.has(c.name)).map((c) => ({ expr: c.expr, title: c.title, side: c.side }));
    if (!chosen.length) return;
    const next = addAlerts(code, chosen);
    setCode(next);
    await post({ action: "save", script: { id: s.id, code: next, name, notes } });
    await onSaved();
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Script name" value={name} onChange={(e) => setName(e.target.value)} className="min-w-[180px] flex-1 bg-transparent text-[20px] font-semibold tracking-[-0.02em] text-white outline-none" />
          <button aria-label={s.favorite ? "Remove from favorites" : "Add to favorites"} onClick={() => save({ favorite: !s.favorite })} className="p-1 text-white/50 hover:text-[#FFD60A]"><Star className={clsx("h-4 w-4", s.favorite && "fill-current text-[#FFD60A]")} /></button>
          <button disabled={!dirty} onClick={() => save()} className="rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-black disabled:opacity-30">{dirty ? "Save" : "Saved"}</button>
          <button onClick={() => copy("code", code)} className="flex items-center gap-1.5 rounded-full bg-white/[0.09] px-3.5 py-1.5 text-[13px] font-medium text-white">{copied === "code" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy for TradingView</button>
          <button aria-label="Download" onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
            a.download = `${name.replace(/[^A-Za-z0-9]+/g, "-")}.pine`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          }} className="rounded-full bg-white/[0.09] p-2 text-white"><Download className="h-3.5 w-3.5" /></button>
          {sure ? <button onClick={async () => (await post({ action: "remove", id: s.id }), await onRemoved())} className="rounded-full bg-[#FF7A85] px-3 py-1.5 text-[13px] font-semibold text-black">Delete it</button> : <button aria-label="Delete script" onClick={() => setSure(true)} className="p-1.5 text-white/40 hover:text-white"><Trash2 className="h-4 w-4" /></button>}
        </div>
        <textarea aria-label="Pine code" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} className="mt-3 h-[52vh] w-full resize-y rounded-[14px] bg-black/40 p-4 font-mono text-[12.5px] leading-relaxed text-white/85 outline-none ring-1 ring-white/[0.07] focus:ring-white/30" />
        <textarea aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes: what it's for, what you've noticed" className="mt-2 w-full resize-y rounded-[12px] bg-white/[0.04] px-3 py-2 text-[13px] text-white/80 outline-none placeholder:text-white/30" />
        {s.history.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-white/45">
            Earlier versions:
            {[...s.history].reverse().slice(0, 6).map((h) => <button key={h.at} onClick={() => setCode(h.code)} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-white/65 hover:text-white">{new Date(h.at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</button>)}
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-5">
        <section>
          <p className="text-[14.5px] font-semibold capitalize text-white">{info.kind === "unknown" ? "Script" : info.kind}{info.version ? `, Pine v${info.version}` : ""}</p>
          <p className="text-[12.5px] text-white/45">{info.lines} lines, {info.inputs.length} settings, {info.plots} plots</p>
          <ul className="mt-2 space-y-1">
            {info.checks.map((c) => (
              <li key={c.text} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-white/70">
                {c.tone === "good" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7CE59A]" /> : c.tone === "warn" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFD08A]" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFA3AB]" />} {c.text}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] leading-snug text-white/40">A quick read, not a compile. TradingView has the final word on errors.</p>
        </section>
        <section className="border-t border-white/[0.06] pt-4">
          <h3 className="text-[15px] font-semibold text-white">Make it alert me</h3>
          {info.kind === "strategy" ? (
            <>
              <p className="mt-1 text-[12.5px] leading-snug text-white/55">In Create Alert, pick this strategy and paste this as the Message. You&apos;ll get one on every order fill.</p>
              <button onClick={() => copy("fill", orderFillMessage(name))} className="mt-2 flex items-center gap-1.5 rounded-full bg-white/[0.09] px-3 py-1.5 text-[12.5px] font-medium text-white">{copied === "fill" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy message</button>
            </>
          ) : info.conditions.length ? (
            <>
              <p className="mt-1 text-[12.5px] leading-snug text-white/55">Pick what should alert you. This adds code at the bottom of the script, and adding again replaces it.</p>
              <div className="mt-2 space-y-1">
                {info.conditions.slice(0, 14).map((c) => (
                  <label key={c.name} className="flex cursor-pointer items-start gap-2 text-[12.5px] text-white/80">
                    <input type="checkbox" checked={picks.has(c.name)} onChange={() => setPicks((p) => {
                      const n = new Set(p);
                      if (n.has(c.name)) n.delete(c.name);
                      else n.add(c.name);
                      return n;
                    })} className="mt-0.5 accent-white" />
                    <span className="min-w-0"><span className="block truncate">{c.title}</span><code className="block truncate text-[11px] text-white/40">{c.expr}</code></span>
                  </label>
                ))}
              </div>
              <button disabled={!picks.size} onClick={addCode} className="mt-2.5 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-black disabled:opacity-30">Add alert code</button>
            </>
          ) : info.alertCalls ? <p className="mt-1 text-[12.5px] text-white/55">It already calls alert(), so it&apos;s ready.</p> : <p className="mt-1 text-[12.5px] text-white/55">Nothing to alert on yet. Paste this as a plain alert&apos;s Message:</p>}
          {!info.conditions.length && !info.alertCalls && info.kind !== "strategy" && <button onClick={() => copy("msg", alertMessage(name))} className="mt-2 flex items-center gap-1.5 rounded-full bg-white/[0.09] px-3 py-1.5 text-[12.5px] font-medium text-white">{copied === "msg" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy message</button>}
          <ol className="mt-3 list-decimal space-y-0.5 pl-4 text-[12.5px] leading-snug text-white/55">
            <li>Copy the script into TradingView&apos;s Pine Editor and add it to your chart.</li>
            <li>Create Alert. Condition: this script, then Any alert() function call.</li>
            <li>Tick Webhook URL and paste your private address:</li>
          </ol>
          <button onClick={() => copy("hook", webhook)} className="mt-1.5 flex items-center gap-1.5 rounded-full bg-white/[0.09] px-3 py-1.5 text-[12.5px] font-medium text-white">{copied === "hook" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy webhook address</button>
        </section>
        {starter?.rules && (
          <section className="border-t border-white/[0.06] pt-4">
            <h3 className="text-[15px] font-semibold text-white">Test the idea first</h3>
            <p className="mt-1 text-[12.5px] leading-snug text-white/55">The app can run this same idea over your history.</p>
            <button onClick={() => {
              setBt({ logic: "custom", text: starter.rules!, rules: null });
              set({ mode: "backtest", btTab: "test" });
            }} className="mt-2 flex items-center gap-1.5 rounded-full bg-white/[0.09] px-3 py-1.5 text-[12.5px] font-medium text-white"><FlaskConical className="h-3.5 w-3.5" /> Open in Strategy test</button>
          </section>
        )}
      </div>
    </div>
  );
}
