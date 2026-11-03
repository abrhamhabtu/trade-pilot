"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Check, CheckCircle2, Compass, Copy, Download, ExternalLink, FlaskConical, Plus, Search, Star, Trash2, Upload, XCircle } from "lucide-react";
import type { PineScript } from "@/lib/server/pine";
import { PINE_STARTERS, PINE_TOPICS, addAlerts, alertMessage, analyzePine, authorOf, normalizePine, orderFillMessage, pineSearchUrl } from "@/lib/vision/pineTools";
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
  const [panel, setPanel] = useState<"paste" | "discover" | null>(null);
  const [note, setNote] = useState("");
  const [drag, setDrag] = useState(false);
  const refresh = useCallback(async () => {
    const r = await fetch("/api/pine", { cache: "no-store" }).then((x) => x.json()).catch(() => ({ scripts: [] }));
    setList(r.scripts);
    return r.scripts as PineScript[];
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const add = async (code: string, extra: Partial<PineScript> = {}) => {
    const { script } = await post({ action: "save", script: { code, ...extra } });
    await refresh();
    setOpenId(script.id);
    setPanel(null);
    setNote(script.duplicate ? `You already have this one: ${script.name}.` : "");
  };
  // Scripts added before they remembered their source count too, if the name or the code matches.
  const added = (t: (typeof STARTERS)[number]) => (list ?? []).find((s) => s.starter === t.id || s.name === t.name || normalizePine(s.code) === normalizePine(t.code));
  const copies = useMemo(() => {
    const seen = new Set<string>();
    let n = 0;
    for (const s of list ?? []) {
      const k = normalizePine(s.code);
      if (seen.has(k)) n++;
      seen.add(k);
    }
    return n;
  }, [list]);
  const files = async (fs: FileList | File[]) => {
    setError("");
    for (const f of [...fs].slice(0, 30)) {
      if (f.size > 400_000) {
        setError(`${f.name} is too large.`);
        continue;
      }
      await add(await f.text(), { name: f.name.replace(/\.(pine|txt|pinescript)$/i, "") }).catch((e) => setError(e.message));
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
          <button onClick={() => (setPanel("paste"), setOpenId(null), setNote(""))} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-[13px] font-semibold text-black"><Plus className="h-3.5 w-3.5" /> Paste</button>
          <button onClick={() => input.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.09] px-3 py-2 text-[13px] font-medium text-white"><Upload className="h-3.5 w-3.5" /> Files</button>
          <input ref={input} type="file" multiple accept=".pine,.txt,.pinescript" className="hidden" onChange={(e) => e.target.files && files(e.target.files)} />
        </div>
        <button onClick={() => (setPanel("discover"), setOpenId(null), setNote(""))} aria-pressed={panel === "discover"} className={clsx("mt-2 flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium", panel === "discover" ? "bg-white/[0.16] text-white" : "bg-white/[0.06] text-white/80 hover:bg-white/[0.1]")}><Compass className="h-3.5 w-3.5" /> Find more on TradingView</button>
        <label className="mt-3 flex items-center gap-2 rounded-[11px] bg-white/[0.06] px-2.5 py-1.5"><Search className="h-3.5 w-3.5 text-white/40" /><input aria-label="Search scripts" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/30" /></label>
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-white/45">Your scripts</p>
          {copies > 0 && <button onClick={async () => {
            const { removed } = await post({ action: "remove-copies" });
            setOpenId(null);
            await refresh();
            setNote(`Removed ${removed} exact ${removed === 1 ? "copy" : "copies"}. Notes and favorites were kept.`);
          }} className="text-[12px] font-medium text-[#FFD08A] hover:underline">Remove {copies} exact {copies === 1 ? "copy" : "copies"}</button>}
        </div>
        <div className="mt-1 space-y-0.5">
          {list && !shown.length && <p className="py-2 text-[12.5px] leading-snug text-white/40">{q ? "No matches." : "None yet. Paste one, drop files anywhere here, or start from one below."}</p>}
          {shown.map((s) => (
            <button key={s.id} onClick={() => (setOpenId(s.id), setPanel(null), setNote(""))} aria-current={openId === s.id} className={clsx("flex w-full items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-left text-[13px]", openId === s.id ? "bg-white/[0.11] text-white" : "text-white/70 hover:bg-white/[0.05]")}>
              {s.favorite && <Star className="h-3 w-3 shrink-0 fill-current text-[#FFD60A]" />}<span className="truncate">{s.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[12px] font-medium text-white/45">Ready to use</p>
        <div className="mt-1 space-y-0.5">
          {STARTERS.map((t) => {
            const have = added(t);
            return (
              <button key={t.id} onClick={() => (have ? (setOpenId(have.id), setPanel(null), setNote("")) : add(t.code, { name: t.name, starter: t.id }).catch((e) => setError(e.message)))} className="block w-full rounded-[10px] px-2.5 py-2 text-left hover:bg-white/[0.05]">
                <span className="flex items-center justify-between gap-2 text-[13px] text-white/85">{t.name}{have && <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-[#7CE59A]"><Check className="h-3 w-3" /> Added</span>}</span>
                <span className="block text-[11.5px] leading-snug text-white/40">{t.blurb}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <main className="min-w-0 p-5">
        {error && <p className="mb-3 rounded-[12px] bg-[#FF7A85]/12 px-3 py-2 text-[13px] text-[#FFA3AB]">{error}</p>}
        {drag && <p className="mb-3 rounded-[12px] border border-dashed border-white/30 px-3 py-6 text-center text-[13.5px] text-white/70">Drop your .pine files</p>}
        {note && <p className="mb-3 rounded-[12px] bg-white/[0.06] px-3 py-2 text-[13px] text-white/80">{note}</p>}
        {panel === "discover" ? <Discover onPaste={() => setPanel("paste")} /> : panel === "paste" ? <PasteBox onAdd={(c, extra) => add(c, extra).catch((e) => setError(e.message))} /> : open ? <Editor key={open.id} s={open} webhook={webhook} onSaved={refresh} onRemoved={async () => (setOpenId(null), await refresh())} /> : (
          <div className="mx-auto max-w-xl py-12 text-center">
            <h2 className="text-[24px] font-semibold tracking-[-0.025em] text-white">Keep every Pine script in one place</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-white/55">Bring in the code you have. The app reads what each script can alert on, warns about common traps, and adds the alert code so it can call your phone. TradingView still runs the script: this app can&apos;t chart or backtest Pine itself.</p>
          </div>
        )}
      </main>
    </div>
  );
}

/** TradingView's library, opened in the browser. It asks automated tools to stay out, so the app doesn't fetch from it. */
function Discover({ onPaste }: { onPaste: () => void }) {
  const [q, setQ] = useState("");
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-white">Find more on TradingView</h2>
      <p className="mt-1 text-[13.5px] leading-relaxed text-white/60">Pick a topic and TradingView opens in your browser. Look for scripts marked open-source, since those are the ones that show their code.</p>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) window.open(pineSearchUrl(q), "_blank", "noopener,noreferrer");
      }} className="mt-3 flex gap-2">
        <input aria-label="Search TradingView scripts" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search TradingView, like anchored VWAP" className="min-w-0 flex-1 rounded-full bg-white/[0.07] px-4 py-2.5 text-[14px] text-white outline-none ring-1 ring-inset ring-white/[0.08] placeholder:text-white/30 focus:ring-white/40" />
        <button disabled={!q.trim()} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-black disabled:opacity-40">Search <ExternalLink className="h-3.5 w-3.5" /></button>
      </form>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PINE_TOPICS.map((t) => (
          <a key={t.name} href={t.url} target="_blank" rel="noopener noreferrer" className="group rounded-[14px] bg-white/[0.04] p-3 hover:bg-white/[0.08]">
            <span className="flex items-center justify-between gap-2 text-[13.5px] font-medium text-white">{t.name}<ExternalLink className="h-3 w-3 text-white/30 group-hover:text-white/70" /></span>
            <span className="mt-0.5 block text-[12px] leading-snug text-white/45">{t.why}</span>
          </a>
        ))}
      </div>
      <h3 className="mt-6 text-[16px] font-semibold text-white">Bring one back</h3>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13.5px] leading-relaxed text-white/65">
        <li>On the script&apos;s page, open its source code and copy all of it.</li>
        <li>Paste it here, with the page&apos;s address so you can find it again.</li>
        <li>The app checks it for traps, credits the author, and sets up its alerts.</li>
      </ol>
      <button onClick={onPaste} className="mt-3 flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-black"><Plus className="h-3.5 w-3.5" /> Paste a script</button>
      <p className="mt-4 text-[12px] leading-snug text-white/45">Popular doesn&apos;t mean profitable. Many published scripts repaint or look better in hindsight, so read the warnings and test the idea in Strategy test first. Invite-only and protected scripts don&apos;t show their code. Open-source code is free to use, but if you publish a script based on one, TradingView requires you to credit the author.</p>
    </div>
  );
}

function PasteBox({ onAdd }: { onAdd: (code: string, extra: Partial<PineScript>) => void }) {
  const [code, setCode] = useState("");
  const [url, setUrl] = useState("");
  const info = useMemo(() => analyzePine(code), [code]);
  const author = authorOf(code);
  return (
    <div>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-white">Paste your script</h2>
      <textarea autoFocus value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} rows={16} placeholder="//@version=6&#10;indicator(&quot;My script&quot;, overlay = true)" className="mt-3 w-full resize-y rounded-[14px] bg-black/40 p-4 font-mono text-[12.5px] leading-relaxed text-white/85 outline-none ring-1 ring-white/[0.07] placeholder:text-white/25 focus:ring-white/30" />
      <input aria-label="TradingView page address" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="TradingView page address, if it came from there (optional)" className="mt-2 w-full rounded-[11px] bg-white/[0.06] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button disabled={!code.trim()} onClick={() => onAdd(code, url.trim() ? { sourceUrl: url } : {})} className="rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-black disabled:opacity-40">Save script</button>
        {code.trim() && <span className="text-[12.5px] text-white/50">{info.title || "No title found"}{author ? ` by ${author}` : ""}, {info.conditions.length} thing{info.conditions.length === 1 ? "" : "s"} it can alert on</span>}
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
  const starter = PINE_STARTERS.find((t) => t.id === s.starter || t.name === s.name);
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
          {(s.author || s.sourceUrl) && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-white/55">
              {s.author && <span>By {s.author}</span>}
              {s.sourceUrl && <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline hover:text-white">TradingView page <ExternalLink className="h-3 w-3" /></a>}
            </p>
          )}
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
