"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { CalendarDays, ChevronDown, Download, FileArchive, FileSpreadsheet, FlaskConical, History, Loader2, Puzzle, RefreshCw, Trash2, Upload } from "lucide-react";
import { isSymbol } from "@/lib/vision/markets";
import { useVisionStore } from "@/store/visionStore";
import { dateOf, sizeOf, type LibFile, type Library as Lib, type SavedItem } from "./data";
import { Card, Pill } from "./ui";

const post = (body: unknown) => fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));

export function Library({ lib, error, refresh, saved, onRemoveSaved, onOpenRun }: { lib: Lib | null; error: string; refresh: () => void; saved: SavedItem[] | null; onRemoveSaved: (id: string) => void; onOpenRun: (s: SavedItem) => void }) {
  const setBt = useVisionStore((s) => s.setBt);
  const set = useVisionStore((s) => s.set);
  if (error && !lib)
    return (
      <Card>
        <p className="text-[16px] font-semibold text-white">The library lives in the local app</p>
        <p className="mt-1 text-[13.5px] text-white/55">Files are kept on this computer, so the Library works when TradePilot runs locally. {error}</p>
      </Card>
    );
  const series = lib ? Object.values(lib.series).filter((s) => isSymbol(s.symbol)) : [];
  const datasets = lib ? Object.entries(lib.datasets) : [];
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <Drop onDone={refresh} />
        <Card
          title={`Files · ${lib?.files.length ?? 0}`}
          aside={
            <button onClick={refresh} aria-label="Refresh" className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/60 hover:text-white">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          }
        >
          {!lib ? (
            <p className="py-6 text-center text-[13px] text-white/40">Loading…</p>
          ) : lib.files.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-white/40">Nothing here yet. Drop a Databento zip or any OHLCV CSV above.</p>
          ) : (
            <div className="space-y-1.5">
              {[...lib.files]
                .sort((a, b) => b.addedAt - a.addedAt)
                .map((f) => (
                  <FileRow key={f.id} f={f} job={lib.jobs[f.id]} refresh={refresh} />
                ))}
            </div>
          )}
        </Card>
        <Card title={`Saved work · ${saved?.length ?? 0}`}>
          {!saved?.length ? (
            <p className="py-4 text-center text-[13px] text-white/40">Backtests and replay sessions you save land here, ready to download.</p>
          ) : (
            <div className="space-y-1.5">
              {saved.map((s) => (
                <SavedRow key={s.id} s={s} onRemove={() => onRemoveSaved(s.id)} onOpen={() => onOpenRun(s)} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
        <Card title="Market data">
          {series.length === 0 ? (
            <p className="text-[13px] text-white/45">No bar data yet. Futures history from your files appears here, ready to backtest.</p>
          ) : (
            <div className="space-y-2">
              {series.map((s) => (
                <div key={s.symbol} className="rounded-[16px] bg-white/[0.04] p-3 ring-1 ring-inset ring-white/[0.05]">
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] font-bold text-white">{s.symbol}</span>
                    <button
                      onClick={() => {
                        setBt({ symbol: s.symbol, source: "library", days: 365 });
                        set({ btTab: "test" });
                      }}
                      className="flex items-center gap-1.5 rounded-full bg-[#5AC8FA] px-3 py-1 text-[12.5px] font-bold text-black"
                    >
                      <FlaskConical className="h-3.5 w-3.5" /> Backtest
                    </button>
                  </div>
                  <p className="mt-1 text-[12.5px] text-white/60">
                    {dateOf(s.from)} – {dateOf(s.to)}
                  </p>
                  <p className="text-[12px] text-white/40">
                    {Math.round(s.bars).toLocaleString()} one-minute bars · {s.years.length} years
                  </p>
                  <Coverage years={s.years} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Calendars & context">
          {datasets.length === 0 ? (
            <p className="text-[13px] text-white/45">FOMC days, early closes and VIX turn on the backtest filters. They come in the free-data pack.</p>
          ) : (
            <div className="space-y-1.5">
              {datasets.map(([k, d]) => (
                <div key={k} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-[#9BE1FF]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-white">{d.label}</span>
                    <span className="block text-[11.5px] text-white/40">
                      {d.rows.toLocaleString()} rows · {d.from} – {d.to}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <p className="px-1 text-[11.5px] leading-snug text-white/38">Everything stays on this computer in TradePilot&apos;s data folder. Originals download exactly as you added them. Databento data is for your own use under its licence.</p>
      </div>
    </div>
  );
}

function Coverage({ years }: { years: number[] }) {
  if (!years.length) return null;
  const a = years[0];
  const b = years[years.length - 1];
  const all = Array.from({ length: b - a + 1 }, (_, k) => a + k);
  return (
    <div className="mt-2">
      <div className="flex gap-[2px]">
        {all.map((y) => (
          <span key={y} title={`${y}${years.includes(y) ? "" : " · missing"}`} className={clsx("h-2 flex-1 rounded-[2px]", years.includes(y) ? "bg-[#5AC8FA]/75" : "bg-white/[0.08]")} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] tabular-nums text-white/35">
        <span>{a}</span>
        {all.length > years.length && <span>gaps are years not in your files</span>}
        <span>{b}</span>
      </div>
    </div>
  );
}

function FileRow({ f, job, refresh }: { f: LibFile; job?: { stage: string; done: number; total: number }; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const Icon = f.kind === "part" ? Puzzle : f.kind === "csv" ? FileSpreadsheet : FileArchive;
  const busy = f.status === "processing" || !!job;
  return (
    <div className="rounded-[16px] bg-white/[0.035] ring-1 ring-inset ring-white/[0.05]">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white/[0.06] text-white/70">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold text-white">{f.name}</span>
            {f.contents?.length ? <ChevronDown className={clsx("h-3.5 w-3.5 shrink-0 text-white/40 transition", open && "rotate-180")} /> : null}
          </span>
          <span className="block truncate text-[11.5px] text-white/45">
            {sizeOf(f.size)} · added {new Date(f.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {f.produced?.series.length ? ` · bars for ${f.produced.series.join(", ")}` : ""}
            {f.produced?.datasets.length ? ` · ${f.produced.datasets.length} calendars` : ""}
          </span>
        </button>
        {busy ? (
          <Pill tone="cyan">
            <Loader2 className="h-3 w-3 animate-spin" /> {job ? `${job.done}/${job.total}` : "Working"}
          </Pill>
        ) : f.status === "processed" ? (
          <Pill tone="cyan">Ready</Pill>
        ) : f.status === "incomplete" ? (
          <Pill tone="warn">Needs other parts</Pill>
        ) : f.status === "error" ? (
          <Pill tone="neg">Error</Pill>
        ) : (
          <Pill>Stored</Pill>
        )}
        <a href={`/api/library/file?id=${f.id}`} aria-label={`Download ${f.name}`} title="Download original" className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white">
          <Download className="h-3.5 w-3.5" />
        </a>
        {confirm ? (
          <button
            onClick={async () => {
              await post({ action: "remove", id: f.id });
              refresh();
            }}
            className="rounded-full bg-[#FF7A85] px-2.5 py-1 text-[12px] font-bold text-black"
          >
            Remove
          </button>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            onBlur={() => setTimeout(() => setConfirm(false), 200)}
            aria-label={`Remove ${f.name}`}
            title="Remove from library"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/50 hover:bg-white/[0.12] hover:text-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {(job || f.note) && <p className={clsx("px-3 pb-2.5 text-[12px]", f.status === "error" ? "text-[#FFA3AB]" : "text-white/50")}>{job ? `Reading ${job.stage}` : f.note}</p>}
      {open && f.contents && (
        <div className="mx-3 mb-3 max-h-[220px] overflow-y-auto rounded-xl bg-black/25 p-2">
          {f.contents.map((c) => (
            <p key={c.name} className="flex justify-between gap-3 px-1 py-0.5 font-mono text-[11.5px] text-white/60">
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 text-white/35">{sizeOf(c.size)}</span>
            </p>
          ))}
          {f.status !== "processing" && (
            <button
              onClick={async () => {
                await post({ action: "process", id: f.id });
                setTimeout(refresh, 400);
              }}
              className="mt-1 px-1 text-[11.5px] font-semibold text-[#9BE1FF] hover:underline"
            >
              Read it again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SavedRow({ s, onRemove, onOpen }: { s: SavedItem; onRemove: () => void; onOpen: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const pnl = Number(s.summary.pnl ?? 0);
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-white/[0.035] px-3 py-2.5 ring-1 ring-inset ring-white/[0.05]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#5AC8FA]/12 text-[#9BE1FF]">{s.kind === "backtest" ? <FlaskConical className="h-[18px] w-[18px]" /> : <History className="h-[18px] w-[18px]" />}</span>
      <button onClick={onOpen} disabled={s.kind !== "backtest"} className="min-w-0 flex-1 text-left disabled:cursor-default" title={s.kind === "backtest" ? "Load these settings and run again" : undefined}>
        <span className="block truncate text-[13.5px] font-semibold text-white">{s.name}</span>
        <span className="block truncate text-[11.5px] text-white/45">
          {new Date(s.at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {s.summary.trades ?? 0} trades
          {s.summary.winRate != null ? ` · ${Math.round(Number(s.summary.winRate) * 100)}% win` : ""} ·{" "}
          <span className={pnl >= 0 ? "text-[#9BE1FF]" : "text-[#FFA3AB]"}>
            {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </span>
      </button>
      <a href={`/api/library/saved?id=${s.id}&format=csv`} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-semibold text-white/75 hover:bg-white/[0.12]">
        CSV
      </a>
      <a href={`/api/library/saved?id=${s.id}&format=json`} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-semibold text-white/75 hover:bg-white/[0.12]">
        JSON
      </a>
      {confirm ? (
        <button onClick={onRemove} className="rounded-full bg-[#FF7A85] px-2.5 py-1 text-[12px] font-bold text-black">
          Remove
        </button>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          onBlur={() => setTimeout(() => setConfirm(false), 200)}
          aria-label={`Remove ${s.name}`}
          className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/50 hover:bg-white/[0.12] hover:text-white"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Adding files: drop, pick, or a path on this computer ──

function Drop({ onDone }: { onDone: () => void }) {
  const [over, setOver] = useState(false);
  const [uploads, setUploads] = useState<{ name: string; p: number; err?: string }[]>([]);
  const [path, setPath] = useState("");
  const [pathMsg, setPathMsg] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const ok = (n: string) => /\.(zip|csv)(\.part\d+)?$/i.test(n);

  const send = (file: File) =>
    new Promise<void>((resolve) => {
      if (!ok(file.name)) {
        setUploads((u) => [...u, { name: file.name, p: 0, err: "Only .zip, .csv or .zip.partNN" }]);
        return resolve();
      }
      setUploads((u) => [...u.filter((x) => x.name !== file.name), { name: file.name, p: 0 }]);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/library/upload?name=${encodeURIComponent(file.name)}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, p: e.loaded / e.total } : x)));
      xhr.onload = () => {
        setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, p: 1, err: xhr.status >= 400 ? JSON.parse(xhr.responseText || "{}").error || "Upload failed" : undefined } : x)));
        onDone();
        resolve();
      };
      xhr.onerror = () => {
        setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, err: "Upload failed" } : x)));
        resolve();
      };
      xhr.send(file);
    });
  const sendAll = async (files: FileList | File[]) => {
    // Parts in order, so a split zip joins as soon as its last part lands.
    for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name))) await send(f);
  };

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        sendAll(e.dataTransfer.files);
      }}
      className={clsx("rounded-[26px] border-2 border-dashed p-6 text-center transition", over ? "border-[#5AC8FA] bg-[#5AC8FA]/[0.08]" : "border-white/[0.1] bg-white/[0.02]")}
    >
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-[15px] bg-[#5AC8FA]/14 text-[#9BE1FF]">
        <Upload className="h-6 w-6" />
      </span>
      <p className="mt-3 text-[17px] font-semibold text-white">Drop data files here</p>
      <p className="mt-1 text-[13px] text-white/50">Databento zips (split parts join on their own), any OHLCV CSV, or the free-data pack. Up to a few GB.</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button onClick={() => input.current?.click()} className="rounded-full bg-[#5AC8FA] px-4 py-2 text-[13.5px] font-bold text-black">
          Choose files
        </button>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!path.trim()) return;
            setPathMsg("Adding…");
            const r = await post({ action: "import-path", path: path.trim() });
            setPathMsg(r.ok ? `Added ${r.j.file?.name ?? ""}` : r.j.error || "Could not add that file");
            if (r.ok) setPath("");
            onDone();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="or a path, e.g. ~/Downloads/data.zip"
            className="w-[260px] rounded-full bg-white/[0.06] px-3.5 py-2 text-[13px] text-white placeholder:text-white/30 ring-1 ring-inset ring-white/[0.08]"
          />
          <button className="rounded-full bg-white/[0.1] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-white/[0.14]">Add</button>
        </form>
      </div>
      {pathMsg && <p className="mt-2 text-[12px] text-white/50">{pathMsg}</p>}
      <input ref={input} type="file" multiple accept=".zip,.csv,.part00,.part01,.part02,.part03,.part04,.part05,.part06,.part07,.part08,.part09" className="hidden" onChange={(e) => e.target.files && sendAll(e.target.files)} />
      {uploads.length > 0 && (
        <div className="mx-auto mt-4 max-w-md space-y-1.5 text-left">
          {uploads.map((u) => (
            <div key={u.name} className="rounded-xl bg-white/[0.04] px-3 py-2">
              <p className="flex justify-between text-[12.5px]">
                <span className="truncate text-white/75">{u.name}</span>
                <span className={u.err ? "text-[#FFA3AB]" : "text-white/45"}>{u.err ?? (u.p >= 1 ? "Added" : `${Math.round(u.p * 100)}%`)}</span>
              </p>
              {!u.err && u.p < 1 && (
                <div className="mt-1 h-1 rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-[#5AC8FA]" style={{ width: `${u.p * 100}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
