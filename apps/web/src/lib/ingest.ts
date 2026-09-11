// Server-only: turn a link (YouTube, TikTok, Instagram, X, any web page) into
// text the playbook AI can read. Best effort — every path degrades to
// metadata plus a "paste the transcript" hint rather than failing.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type IngestQuality = "transcript" | "caption" | "page" | "metadata";
export interface IngestedSource {
  kind: "youtube" | "tiktok" | "instagram" | "x" | "web";
  url: string;
  title: string;
  author?: string;
  description?: string;
  transcript?: string;
  durationSec?: number;
  quality: IngestQuality;
  message: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MAX_TEXT = 60000;

// ─── Network safety ──────────────────────────────────────────────────────────

function privateAddress(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:") throw new Error("Only https links are supported.");
  if (url.username || url.password) throw new Error("Links with credentials are not allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateAddress(a.address)))
    throw new Error("That link points to a private address.");
}

/** fetch() that re-checks every redirect hop and caps the body size. */
async function safeFetch(raw: string, init: RequestInit = {}, maxBytes = 4_000_000) {
  let url = new URL(raw);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...(init.headers || {}) },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    return { ok: res.ok, status: res.status, text, url };
  }
  throw new Error("Too many redirects.");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

const meta = (html: string, prop: string) =>
  decodeEntities(
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)`, "i"))?.[1] ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1] ||
      "",
  ).trim();

const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

function youtubeId(u: URL) {
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return u.pathname.slice(1, 12);
  if (host === "youtube.com")
    return u.searchParams.get("v") || u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] || null;
  return null;
}

/** Parse YouTube timedtext XML (format 1 <text> or srv3 <p>) into timestamped lines. */
export function parseTimedText(xml: string) {
  const lines: { t: number; text: string }[] = [];
  for (const m of xml.matchAll(/<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g))
    lines.push({ t: parseFloat(m[1]), text: m[2] });
  if (!lines.length)
    for (const m of xml.matchAll(/<p t="(\d+)"[^>]*>([\s\S]*?)<\/p>/g))
      lines.push({ t: Number(m[1]) / 1000, text: m[2].replace(/<[^>]+>/g, "") });
  // Group into ~30s paragraphs with a [m:ss] marker so the AI can cite timestamps.
  let out = "";
  let bucket = -1;
  for (const l of lines) {
    const text = decodeEntities(decodeEntities(l.text)).replace(/\s+/g, " ").trim();
    if (!text) continue;
    const b = Math.floor(l.t / 30);
    if (b !== bucket) {
      out += `${out ? "\n" : ""}[${clock(l.t)}] `;
      bucket = b;
    }
    out += `${text} `;
  }
  return out.trim();
}

// ─── Providers ───────────────────────────────────────────────────────────────

type Track = { baseUrl: string; languageCode: string; kind?: string };

async function youtube(u: URL, id: string): Promise<IngestedSource> {
  const url = `https://www.youtube.com/watch?v=${id}`;
  const base: IngestedSource = { kind: "youtube", url: u.toString(), title: "YouTube video", quality: "metadata", message: "" };
  const page = await safeFetch(url, { headers: { Cookie: "CONSENT=YES+cb; SOCS=CAI" } });
  const key = page.text.match(/"INNERTUBE_API_KEY":\s*"([\w-]+)"/)?.[1];

  // Innertube player (ANDROID client) returns caption URLs that work without a browser token.
  let player: Record<string, any> | null = null;
  if (key) {
    try {
      const res = await safeFetch(`https://www.youtube.com/youtubei/v1/player?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } }, videoId: id }),
      });
      player = JSON.parse(res.text);
    } catch {
      player = null;
    }
  }
  if (!player) {
    const m = page.text.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});\s*(?:var|<\/script>)/);
    try {
      player = m ? JSON.parse(m[1]) : null;
    } catch {
      player = null;
    }
  }
  const details = player?.videoDetails || {};
  base.title = details.title || meta(page.text, "og:title") || base.title;
  base.author = details.author;
  base.description = (details.shortDescription || meta(page.text, "og:description") || "").slice(0, 5000);
  base.durationSec = Number(details.lengthSeconds) || undefined;

  const tracks: Track[] = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const pick =
    tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode?.startsWith("en")) ||
    tracks[0];
  if (pick?.baseUrl) {
    try {
      const res = await safeFetch(pick.baseUrl.replace(/&fmt=[^&]+/, ""));
      const transcript = parseTimedText(res.text);
      if (transcript.length > 200) {
        return {
          ...base,
          transcript: transcript.slice(0, MAX_TEXT),
          quality: "transcript",
          message: `Transcript pulled (${pick.kind === "asr" ? "auto-captions" : "captions"}, ${pick.languageCode}).`,
        };
      }
    } catch {
      /* fall through */
    }
  }
  return {
    ...base,
    quality: base.description ? "caption" : "metadata",
    message:
      "Couldn't read captions for this video. Paste the transcript (YouTube → ··· → Show transcript) for a much better result.",
  };
}

async function oembed(endpoint: string, kind: IngestedSource["kind"], u: URL): Promise<IngestedSource> {
  const res = await safeFetch(`${endpoint}?url=${encodeURIComponent(u.toString())}`);
  const data = res.ok ? JSON.parse(res.text) : {};
  const text = decodeEntities(String(data.html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return {
    kind,
    url: u.toString(),
    title: data.title || text.slice(0, 120) || `${kind} post`,
    author: data.author_name,
    description: (kind === "x" ? text : data.title || "").slice(0, 5000),
    quality: "caption",
    message: "Got the post caption, but not the spoken audio. Paste what the video says (or key points) for a better playbook.",
  };
}

async function instagram(u: URL): Promise<IngestedSource> {
  const page = await safeFetch(u.toString());
  const title = meta(page.text, "og:title");
  const description = meta(page.text, "og:description");
  return {
    kind: "instagram",
    url: u.toString(),
    title: title || "Instagram post",
    description: description.slice(0, 5000),
    quality: description ? "caption" : "metadata",
    message: description
      ? "Got the caption only — Instagram doesn't expose the spoken audio. Paste what the reel says for a better result."
      : "Instagram blocked the preview. Paste the caption and what the reel says.",
  };
}

async function webPage(u: URL): Promise<IngestedSource> {
  const page = await safeFetch(u.toString());
  if (!page.ok) throw new Error(`The page returned ${page.status}.`);
  const title = meta(page.text, "og:title") || decodeEntities(page.text.match(/<title[^>]*>([^<]*)/i)?.[1] || "").trim();
  const body = page.text
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h\d|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return {
    kind: "web",
    url: u.toString(),
    title: title || u.hostname,
    description: meta(page.text, "og:description"),
    transcript: text.slice(0, MAX_TEXT),
    quality: text.length > 500 ? "page" : "metadata",
    message: text.length > 500 ? "Page text extracted." : "Very little readable text on that page — paste the key parts.",
  };
}

export async function ingestLink(raw: string): Promise<IngestedSource> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("That doesn't look like a link.");
  }
  await assertPublic(u);
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const yt = youtubeId(u);
  if (yt && /^[\w-]{11}$/.test(yt)) return youtube(u, yt);
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return oembed("https://www.tiktok.com/oembed", "tiktok", u);
  if (host === "x.com" || host === "twitter.com") return oembed("https://publish.twitter.com/oembed", "x", u);
  if (host === "instagram.com") return instagram(u);
  return webPage(u);
}
