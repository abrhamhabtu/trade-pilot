// ─── Data library ──────────────────────────────────────────────────────────────
// The trader's own market data, kept on this machine:
//
//   files/    every original exactly as it was added, ready to download again
//   series/   1-minute bars per symbol, one binary file per year (t,o,h,l,c,v as
//             Float64), built from Databento OHLCV CSVs or any OHLCV CSV
//   context/  session calendars, FOMC dates and VIX closes for backtests
//
// Zips are read with the system `unzip` (spawned with an argument list, no
// shell). Split zips (name.zip.part01, .part02, …) are joined once every part
// is in the library.
// ───────────────────────────────────────────────────────────────────────────────

import { spawn } from "child_process";
import { createReadStream, createWriteStream, promises as fs } from "fs";
import path from "path";
import readline from "readline";
import type { Readable } from "stream";
import { DATA_DIR, readJson, updateJson, writeJson } from "../store";

export const LIB = path.join(DATA_DIR, "library");
const FILES = path.join(LIB, "files");
const SERIES = path.join(LIB, "series");
const CONTEXT = path.join(LIB, "context");
const INDEX = "library/index.json";

export interface LibFile {
  id: string;
  name: string;
  size: number;
  addedAt: number;
  kind: "zip" | "csv" | "part" | "other";
  status: "stored" | "processing" | "processed" | "incomplete" | "error";
  note: string;
  contents?: { name: string; size: number }[];
  produced?: { series: string[]; datasets: string[] };
}

export interface SeriesInfo {
  symbol: string;
  from: number;
  to: number;
  bars: number;
  years: number[];
  sources: string[];
  /** Bars held per calendar year, to spot holes. */
  byYear?: Record<string, number>;
  /** The micro whose bars fill the years this contract's own file lacks. */
  joinedWith?: string;
}

export interface LibraryIndex {
  files: LibFile[];
  series: Record<string, SeriesInfo>;
  datasets: Record<string, { label: string; from: string; to: string; rows: number; source: string }>;
}

const EMPTY: LibraryIndex = { files: [], series: {}, datasets: {} };
export const jobs = ((globalThis as Record<string, unknown>).__tpLibraryJobs ??= new Map<string, { stage: string; done: number; total: number }>()) as Map<string, { stage: string; done: number; total: number }>;

// A micro and its full-size contract trade the same index or metal at the same
// prices, so one fills the other's gaps: the NQ download stops in May 2019 where
// MNQ takes over. Micros did not exist before 2019, so older years are full-size only.
export const JOINS: Record<string, string> = { NQ: "MNQ", ES: "MES", GC: "MGC" };

/** The stored series, with each full-size contract's range widened by its micro. */
function joined(raw: LibraryIndex): LibraryIndex {
  const series = { ...raw.series };
  for (const [full, micro] of Object.entries(JOINS)) {
    const a = series[full];
    const b = series[micro];
    if (!b) continue;
    if (!a) {
      series[full] = { ...b, symbol: full, joinedWith: micro };
      continue;
    }
    const byYear: Record<string, number> = { ...(b.byYear ?? {}) };
    for (const [y, n] of Object.entries(a.byYear ?? {})) byYear[y] = Math.max(n, byYear[y] ?? 0);
    series[full] = { ...a, from: Math.min(a.from, b.from), to: Math.max(a.to, b.to), bars: Object.values(byYear).reduce((x, y) => x + y, 0) || a.bars, years: [...new Set([...a.years, ...b.years])].sort(), sources: [...new Set([...a.sources, ...b.sources])], byYear, joinedWith: micro };
  }
  return { ...raw, series };
}

export const getIndex = async () => joined(await readJson<LibraryIndex>(INDEX, EMPTY));
const saveIndex = (change: (i: LibraryIndex) => void) =>
  // Writes go to the file as stored; the joined view is only ever computed on the way out.
  updateJson<LibraryIndex>(INDEX, EMPTY, (i) => {
    const next = {
      files: i.files ?? [],
      series: i.series ?? {},
      datasets: i.datasets ?? {},
    };
    change(next);
    return next;
  });

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const filePath = (f: Pick<LibFile, "id" | "name">) => path.join(FILES, `${f.id}-${f.name.replace(/[^A-Za-z0-9._-]/g, "_")}`);
const kindOf = (name: string): LibFile["kind"] => (/\.zip\.part\d+$/i.test(name) ? "part" : /\.zip$/i.test(name) ? "zip" : /\.csv$/i.test(name) ? "csv" : "other");

// ── Adding files ───────────────────────────────────────────────────────────────

export async function addFromStream(name: string, body: Readable) {
  await fs.mkdir(FILES, { recursive: true, mode: 0o700 });
  const f: LibFile = {
    id: uid(),
    name: path.basename(name),
    size: 0,
    addedAt: Date.now(),
    kind: kindOf(name),
    status: "stored",
    note: "",
  };
  const dest = filePath(f);
  await new Promise<void>((resolve, reject) =>
    body
      .pipe(createWriteStream(dest))
      .on("finish", () => resolve())
      .on("error", reject),
  );
  f.size = (await fs.stat(dest)).size;
  await saveIndex((i) => {
    i.files.push(f);
  });
  return f;
}

export async function addFromPath(src: string) {
  const st = await fs.stat(src);
  if (!st.isFile()) throw new Error("That path is not a file.");
  return addFromStream(path.basename(src), createReadStream(src));
}

/**
 * Add everything usable in a folder of downloads: whole zips, CSVs and split
 * zips, whose parts are joined straight into one zip. Anything already in the
 * library (same name and size) is left alone, so running this twice costs nothing.
 */
export async function importFolder(dir: string, onStep: (text: string) => void = () => {}) {
  const names = (await fs.readdir(dir)).sort();
  const groups = new Map<string, string[]>();
  for (const n of names) {
    const part = n.match(/^(.+\.zip)\.part\d+$/i);
    if (part) groups.set(part[1], [...(groups.get(part[1]) ?? []), n]);
    else if (/\.(zip|csv)$/i.test(n)) groups.set(n, [n]);
  }
  await fs.mkdir(FILES, { recursive: true, mode: 0o700 });
  const added: string[] = [];
  const skipped: string[] = [];
  for (const [name, parts] of groups) {
    const paths = parts.map((p) => path.join(dir, p));
    const size = (await Promise.all(paths.map((p) => fs.stat(p)))).reduce((a, st) => a + st.size, 0);
    if ((await getIndex()).files.some((f) => f.name === name && f.size === size && f.status === "processed")) {
      skipped.push(name);
      continue;
    }
    onStep(`Adding ${name}`);
    const f: LibFile = { id: uid(), name, size, addedAt: Date.now(), kind: kindOf(name), status: "stored", note: parts.length > 1 ? `Joined from ${parts.length} parts` : "" };
    const out = createWriteStream(filePath(f));
    for (const p of paths)
      await new Promise<void>((res, rej) =>
        createReadStream(p)
          .on("end", () => res())
          .on("error", rej)
          .pipe(out, { end: false }),
      );
    await new Promise<void>((res) => out.end(res));
    if (f.kind === "zip" && (await zipList(filePath(f))).incomplete) {
      await fs.rm(filePath(f), { force: true });
      skipped.push(`${name} (incomplete, a part is missing)`);
      continue;
    }
    // A newer copy of the same download replaces the old one; bars from both stay merged in the series.
    const stale = (await getIndex()).files.filter((x) => x.name === name);
    await saveIndex((i) => {
      i.files = i.files.filter((x) => x.name !== name);
      i.files.push(f);
    });
    for (const x of stale) await fs.rm(filePath(x), { force: true });
    onStep(`Reading ${name}`);
    await processFile(f.id);
    added.push(name);
  }
  return { added, skipped };
}

export async function removeFile(id: string) {
  const idx = await getIndex();
  const f = idx.files.find((x) => x.id === id);
  if (!f) return;
  await fs.rm(filePath(f), { force: true });
  await saveIndex((i) => {
    i.files = i.files.filter((x) => x.id !== id);
  });
}

// ── Zips ───────────────────────────────────────────────────────────────────────

function run(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code: code ?? 1, out, err }));
    p.on("error", (e) => resolve({ code: 1, out, err: String(e) }));
  });
}

async function zipList(file: string) {
  const r = await run("unzip", ["-l", file]);
  const incomplete = /missing \d+ bytes|bad zipfile offset|End-of-central-directory/i.test(r.err + r.out);
  const rows = r.out
    .split("\n")
    .map((l) => l.match(/^\s*(\d+)\s+\S+\s+\S+\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m && !m[2].endsWith("/") && m[2] !== "Name")
    .map((m) => ({ name: m[2].trim(), size: Number(m[1]) }));
  return { rows, incomplete };
}

const memberStream = (file: string, member: string) => spawn("unzip", ["-p", file, member]).stdout;

const joining = new Set<string>();

/**
 * Join name.zip.part00/01..NN into name.zip once the parts run without a gap and
 * the result reads as a whole zip. A part number added twice uses the newest
 * copy. The parts are dropped once the joined zip checks out; it is the original.
 */
async function joinParts(part: LibFile) {
  const base = part.name.replace(/\.part\d+$/i, "");
  // One join per zip at a time; a part that arrives meanwhile waits and looks again.
  while (joining.has(base)) await new Promise((r) => setTimeout(r, 300));
  joining.add(base);
  try {
    return await joinNow(base, part);
  } finally {
    joining.delete(base);
  }
}

async function joinNow(base: string, part: LibFile) {
  const idx = await getIndex();
  if (!idx.files.some((f) => f.id === part.id)) return null;
  const byNum = new Map<number, LibFile>();
  for (const f of idx.files) {
    if (f.kind !== "part" || f.name.replace(/\.part\d+$/i, "") !== base) continue;
    const n = Number(f.name.match(/\.part(\d+)$/i)![1]);
    const had = byNum.get(n);
    if (!had || had.addedAt < f.addedAt) byNum.set(n, f);
  }
  const nums = [...byNum.keys()].sort((a, b) => a - b);
  if (nums[0] > 1 || !nums.every((n, k) => n === nums[0] + k)) return null;
  const parts = nums.map((n) => byNum.get(n)!);
  {
    const joined: LibFile = {
      id: uid(),
      name: base,
      size: 0,
      addedAt: Date.now(),
      kind: "zip",
      status: "stored",
      note: `Joined from ${parts.length} parts`,
    };
    const dest = filePath(joined);
    const out = createWriteStream(dest);
    for (const p of parts)
      await new Promise<void>((res, rej) =>
        createReadStream(filePath(p))
          .on("end", () => res())
          .on("error", rej)
          .pipe(out, { end: false }),
      );
    await new Promise<void>((res) => out.end(res));
    const listing = await zipList(dest);
    if (listing.incomplete || !listing.rows.length) {
      await fs.rm(dest, { force: true });
      return null;
    }
    joined.size = (await fs.stat(dest)).size;
    const stale = idx.files.filter((f) => f.kind === "part" && f.name.replace(/\.part\d+$/i, "") === base);
    await saveIndex((i) => {
      i.files = i.files.filter((f) => !stale.some((x) => x.id === f.id));
      i.files.push(joined);
    });
    for (const f of stale) await fs.rm(filePath(f), { force: true });
    return joined;
  }
}

// ── Bars ───────────────────────────────────────────────────────────────────────

type Bar = { t: number; o: number; h: number; l: number; c: number; v: number };

/** Unix seconds from ISO strings, "YYYY-MM-DD HH:MM[:SS]" (UTC), or numbers in s, ms, µs or ns. */
function parseTime(raw: string) {
  const s = raw.trim().replace(/^"|"$/g, "");
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 1e17) return Math.floor(n / 1e9);
    if (n > 1e14) return Math.floor(n / 1e6);
    if (n > 1e11) return Math.floor(n / 1e3);
    return Math.floor(n);
  }
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(" ", "T")}Z`;
  const ms = Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
}

const BAR_HEADER = /(^|,)(open|o)(,|$)/i;
// Databento's second-month series (NQ.v.1) shares a root with the front month at a
// different price. Stored together, its thin bars would overwrite the real ones.
const BACK_MONTH = /\.[a-z]\.[1-9]\d*"?$/i;

function headerMap(line: string) {
  const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, "").toLowerCase());
  const at = (...names: string[]) => cols.findIndex((c) => names.includes(c));
  return {
    t: at("ts_event", "ts_utc", "ts_recv", "time", "timestamp", "datetime", "date", "ts"),
    o: at("open", "o"),
    h: at("high", "h"),
    l: at("low", "l"),
    c: at("close", "c", "last"),
    v: at("volume", "vol", "v"),
    sym: at("symbol", "continuous", "ticker", "instrument"),
  };
}

/** Symbol root from a Databento continuous symbol (NQ.v.0), a contract (NQZ6, MNQH7), or the file name. */
export function rootOf(sym: string | undefined, file: string) {
  const s = (sym ?? "").trim().replace(/^"|"$/g, "").toUpperCase();
  if (s.includes(".")) return s.split(".")[0].replace(/[^A-Z]/g, "") || "UNKNOWN";
  const contract = s.match(/^([A-Z]+?)[FGHJKMNQUVXZ]\d{1,2}$/);
  if (contract) return contract[1];
  if (/^[A-Z]{1,5}$/.test(s)) return s;
  const f = path.basename(file).match(/^([a-z]{1,4})[_.-]/i);
  return f ? f[1].toUpperCase() : "UNKNOWN";
}

async function readYear(symbol: string, year: number): Promise<Float64Array> {
  try {
    const buf = await fs.readFile(path.join(SERIES, symbol, `${year}.bin`));
    return new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8);
  } catch {
    return new Float64Array(0);
  }
}

async function writeYear(symbol: string, year: number, bars: Bar[]) {
  await fs.mkdir(path.join(SERIES, symbol), { recursive: true });
  const old = await readYear(symbol, year);
  const map = new Map<number, Bar>();
  for (let k = 0; k < old.length; k += 6)
    map.set(old[k], {
      t: old[k],
      o: old[k + 1],
      h: old[k + 2],
      l: old[k + 3],
      c: old[k + 4],
      v: old[k + 5],
    });
  for (const b of bars) map.set(b.t, b);
  const sorted = [...map.values()].sort((a, b) => a.t - b.t);
  const arr = new Float64Array(sorted.length * 6);
  sorted.forEach((b, k) => arr.set([b.t, b.o, b.h, b.l, b.c, b.v], k * 6));
  await fs.writeFile(path.join(SERIES, symbol, `${year}.bin`), Buffer.from(arr.buffer));
  return sorted;
}

/** Stream a CSV of bars, folding seconds into 1-minute bars, and add them to the series. */
async function ingestBars(lines: AsyncIterable<string>, file: string, source: string, onRows: (n: number) => void) {
  let cols: ReturnType<typeof headerMap> | null = null;
  let scale = 1;
  const minutes = new Map<string, Bar>();
  const buckets = new Map<string, Map<number, Bar[]>>();
  let rows = 0;
  const flush = (root: string, b: Bar) => {
    const year = new Date(b.t * 1000).getUTCFullYear();
    const byYear = buckets.get(root) ?? new Map<number, Bar[]>();
    buckets.set(root, byYear);
    const arr = byYear.get(year) ?? [];
    byYear.set(year, arr);
    arr.push(b);
  };
  for await (const line of lines) {
    if (!cols) {
      if (!BAR_HEADER.test(line)) return null;
      cols = headerMap(line);
      if ([cols.t, cols.o, cols.h, cols.l, cols.c].some((x) => x < 0)) return null;
      continue;
    }
    const p = line.split(",");
    if (cols.sym >= 0 && BACK_MONTH.test((p[cols.sym] ?? "").trim())) continue;
    const t = parseTime(p[cols.t] ?? "");
    let o = Number(p[cols.o]);
    let h = Number(p[cols.h]);
    let l = Number(p[cols.l]);
    let c = Number(p[cols.c]);
    if (!Number.isFinite(t) || ![o, h, l, c].every(Number.isFinite)) continue;
    // Databento's raw prices are fixed-point (1e-9); its "pretty" CSVs are already decimal.
    if (rows === 0 && c > 1e7) scale = 1e-9;
    o *= scale;
    h *= scale;
    l *= scale;
    c *= scale;
    const v = cols.v >= 0 ? Number(p[cols.v]) || 0 : 0;
    const root = rootOf(cols.sym >= 0 ? p[cols.sym] : undefined, file);
    const m = Math.floor(t / 60) * 60;
    const cur = minutes.get(root);
    if (cur && cur.t === m) {
      cur.h = Math.max(cur.h, h);
      cur.l = Math.min(cur.l, l);
      cur.c = c;
      cur.v += v;
    } else {
      if (cur) flush(root, cur);
      minutes.set(root, { t: m, o, h, l, c, v });
    }
    if (++rows % 200_000 === 0) onRows(rows);
  }
  for (const [root, b] of minutes) flush(root, b);
  const touched: string[] = [];
  for (const [root, byYear] of buckets) {
    for (const [year, bars] of byYear) await writeYear(root, year, bars);
    touched.push(root);
    await refreshSeries(root, source);
  }
  onRows(rows);
  return { rows, symbols: touched };
}

async function refreshSeries(symbol: string, source: string) {
  const dir = path.join(SERIES, symbol);
  const years = (await fs.readdir(dir).catch(() => [] as string[]))
    .map((f) => Number(f.replace(".bin", "")))
    .filter(Number.isFinite)
    .sort();
  let bars = 0;
  let from = Infinity;
  let to = -Infinity;
  const byYear: Record<string, number> = {};
  for (const y of years) {
    const a = await readYear(symbol, y);
    if (!a.length) continue;
    byYear[y] = a.length / 6;
    bars += a.length / 6;
    from = Math.min(from, a[0]);
    to = Math.max(to, a[a.length - 6]);
  }
  await saveIndex((i) => {
    const prev = i.series[symbol];
    i.series[symbol] = {
      symbol,
      from,
      to,
      bars,
      years,
      byYear,
      sources: [...new Set([...(prev?.sources ?? []), source])],
    };
  });
}

/** One year of a series, with its micro's bars wherever the contract itself has none. */
async function readJoined(symbol: string, year: number): Promise<Float64Array> {
  const own = await readYear(symbol, year);
  const micro = JOINS[symbol];
  if (!micro) return own;
  const fill = await readYear(micro, year);
  if (!fill.length) return own;
  if (!own.length) return fill;
  const out = new Float64Array(own.length + fill.length);
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < own.length || j < fill.length) {
    const takeOwn = j >= fill.length || (i < own.length && own[i] <= fill[j]);
    if (i < own.length && j < fill.length && own[i] === fill[j]) j += 6;
    const src = takeOwn ? own : fill;
    const at = takeOwn ? i : j;
    for (let c = 0; c < 6; c++) out[k + c] = src[at + c];
    k += 6;
    if (takeOwn) i += 6;
    else j += 6;
  }
  return out.subarray(0, k);
}

/** Bars for a range at any timeframe (seconds), built from the stored 1-minute series. */
export async function queryBars(symbol: string, from: number, to: number, tfSeconds: number, max = 30_000) {
  const y0 = new Date(from * 1000).getUTCFullYear();
  const y1 = new Date(to * 1000).getUTCFullYear();
  const out: Bar[] = [];
  for (let y = y0; y <= y1; y++) {
    const a = await readJoined(symbol, y);
    for (let k = 0; k < a.length; k += 6) {
      const t = a[k];
      if (t < from || t > to) continue;
      const bt = Math.floor(t / tfSeconds) * tfSeconds;
      const last = out[out.length - 1];
      if (last && last.t === bt) {
        last.h = Math.max(last.h, a[k + 2]);
        last.l = Math.min(last.l, a[k + 3]);
        last.c = a[k + 4];
        last.v += a[k + 5];
      } else
        out.push({
          t: bt,
          o: a[k + 1],
          h: a[k + 2],
          l: a[k + 3],
          c: a[k + 4],
          v: a[k + 5],
        });
    }
  }
  return {
    bars: out.length > max ? out.slice(-max) : out,
    truncated: out.length > max,
  };
}

// ── Context ────────────────────────────────────────────────────────────────────

const CONTEXT_FILES: { match: RegExp; key: string; label: string }[] = [
  { match: /fomc_meetings\.csv$/i, key: "fomc", label: "FOMC decision days" },
  { match: /vix_daily\.csv$/i, key: "vix", label: "VIX daily close" },
  {
    match: /cme_equity_holidays_weekday_closed\.csv$/i,
    key: "equity_holidays",
    label: "CME equity holidays",
  },
  {
    match: /cme_equity_early_closes\.csv$/i,
    key: "equity_early",
    label: "CME equity early closes",
  },
  {
    match: /cme_metals_holidays_weekday_closed\.csv$/i,
    key: "metals_holidays",
    label: "CME metals holidays",
  },
  {
    match: /cme_metals_early_closes\.csv$/i,
    key: "metals_early",
    label: "CME metals early closes",
  },
];

async function ingestContext(key: string, label: string, lines: AsyncIterable<string>, source: string) {
  let header: string[] | null = null;
  const rows: string[][] = [];
  for await (const line of lines) {
    if (!line.trim()) continue;
    const p = line.split(",").map((x) => x.trim());
    if (!header) header = p.map((x) => x.toLowerCase());
    else rows.push(p);
  }
  if (!header) return;
  const col = (n: string) => header!.indexOf(n);
  let data: unknown;
  let dates: string[] = [];
  if (key === "fomc") {
    const d = col("decision_date");
    const kind = col("kind");
    const entries = rows.map((r) => ({ date: r[d], kind: r[kind] })).filter((x) => /^\d{4}-\d\d-\d\d$/.test(x.date));
    data = entries;
    dates = entries.map((e) => e.date);
  } else if (key === "vix") {
    const d = col("date");
    const c = col("close");
    const map: Record<string, number> = {};
    for (const r of rows) if (/^\d{4}-\d\d-\d\d$/.test(r[d]) && Number.isFinite(Number(r[c]))) map[r[d]] = Number(r[c]);
    data = map;
    dates = Object.keys(map);
  } else {
    const d = col("session_date") >= 0 ? col("session_date") : col("date");
    const close = col("close_utc");
    const entries = rows.map((r) => ({ date: r[d], close: close >= 0 ? r[close] : undefined })).filter((x) => /^\d{4}-\d\d-\d\d$/.test(x.date));
    data = entries;
    dates = entries.map((e) => e.date);
  }
  await fs.mkdir(CONTEXT, { recursive: true });
  await writeJson(`library/context/${key}.json`, data);
  dates.sort();
  await saveIndex((i) => {
    i.datasets[key] = {
      label,
      from: dates[0] ?? "",
      to: dates[dates.length - 1] ?? "",
      rows: dates.length,
      source,
    };
  });
}

export async function getContext() {
  const [fomc, vix, eqH, eqE, mtH, mtE] = await Promise.all(["fomc", "vix", "equity_holidays", "equity_early", "metals_holidays", "metals_early"].map((k) => readJson<unknown>(`library/context/${k}.json`, null)));
  return {
    fomc: ((fomc as { date: string; kind: string }[] | null) ?? []).filter((x) => x.kind === "meeting" || !x.kind).map((x) => x.date),
    vix: (vix as Record<string, number> | null) ?? {},
    holidays: {
      equity: ((eqH as { date: string }[] | null) ?? []).map((x) => x.date),
      metals: ((mtH as { date: string }[] | null) ?? []).map((x) => x.date),
    },
    earlyCloses: {
      equity: (eqE as { date: string; close?: string }[] | null) ?? [],
      metals: (mtE as { date: string; close?: string }[] | null) ?? [],
    },
  };
}

// ── Processing ─────────────────────────────────────────────────────────────────

const linesOf = (s: Readable) => readline.createInterface({ input: s, crlfDelay: Infinity });

export async function processFile(id: string) {
  const idx = await getIndex();
  const f = idx.files.find((x) => x.id === id);
  if (!f || jobs.has(id)) return;
  const set = (patch: Partial<LibFile>) =>
    saveIndex((i) => {
      const x = i.files.find((y) => y.id === id);
      if (x) Object.assign(x, patch);
    });
  const produced = { series: [] as string[], datasets: [] as string[] };
  try {
    if (f.kind === "part") {
      const listing = await zipList(filePath(f));
      if (!(await getIndex()).files.some((x) => x.id === id)) return;
      await set({ contents: listing.rows });
      const joined = await joinParts(f);
      if (joined) await processFile(joined.id);
      else
        await set({
          status: "incomplete",
          note: "One part of a split zip. Add the other parts (same name, .part00/.part01 onward) and they join automatically.",
        });
      return;
    }
    await set({ status: "processing", note: "" });
    if (f.kind === "zip") {
      const listing = await zipList(filePath(f));
      await set({ contents: listing.rows });
      if (listing.incomplete) {
        await set({
          status: "incomplete",
          note: "This zip is incomplete; its other part is missing.",
        });
        return;
      }
      // A zip of zips or split parts (a Google Drive download, say): unpack each
      // into the library on its own, then drop the wrapper; its contents are the originals.
      const inner = listing.rows.filter((r) => /\.zip(\.part\d+)?$/i.test(r.name));
      if (inner.length && !listing.rows.some((r) => /\.csv$/i.test(r.name))) {
        const added: LibFile[] = [];
        for (const [k, r] of [...inner].sort((a, b) => a.name.localeCompare(b.name)).entries()) {
          jobs.set(id, { stage: `Unpacking ${path.basename(r.name)}`, done: k, total: inner.length });
          added.push(await addFromStream(path.basename(r.name), memberStream(filePath(f), r.name)));
        }
        jobs.delete(id);
        await removeFile(id);
        for (const x of added) await processFile(x.id);
        return;
      }
      const csvs = listing.rows.filter((r) => /\.csv$/i.test(r.name));
      let done = 0;
      for (const r of csvs) {
        jobs.set(id, { stage: r.name, done, total: csvs.length });
        const ctx = CONTEXT_FILES.find((c) => c.match.test(r.name));
        if (ctx) {
          await ingestContext(ctx.key, ctx.label, linesOf(memberStream(filePath(f), r.name)), f.name);
          produced.datasets.push(ctx.label);
        } else if (!/rolls\.csv$/i.test(r.name)) {
          const out = await ingestBars(linesOf(memberStream(filePath(f), r.name)), r.name, f.name, (n) =>
            jobs.set(id, {
              stage: `${r.name} · ${n.toLocaleString()} rows`,
              done,
              total: csvs.length,
            }),
          );
          if (out) produced.series.push(...out.symbols);
        }
        done++;
      }
    } else if (f.kind === "csv") {
      jobs.set(id, { stage: f.name, done: 0, total: 1 });
      const ctx = CONTEXT_FILES.find((c) => c.match.test(f.name));
      if (ctx) {
        await ingestContext(ctx.key, ctx.label, linesOf(createReadStream(filePath(f))), f.name);
        produced.datasets.push(ctx.label);
      } else {
        const out = await ingestBars(linesOf(createReadStream(filePath(f))), f.name, f.name, (n) =>
          jobs.set(id, {
            stage: `${n.toLocaleString()} rows`,
            done: 0,
            total: 1,
          }),
        );
        if (out) produced.series.push(...out.symbols);
      }
    }
    const series = [...new Set(produced.series)];
    await set({
      status: "processed",
      produced: { series, datasets: produced.datasets },
      note: series.length || produced.datasets.length ? "" : "Stored. Nothing in it was bars or a known calendar, so it is kept as a file only.",
    });
  } catch (e) {
    await set({
      status: "error",
      note: e instanceof Error ? e.message : "Processing failed",
    });
  } finally {
    jobs.delete(id);
  }
}
