export type Revision = {
  id: string;
  title: string;
  code: string;
  notes: string;
  status: "Draft" | "Testing" | "Ready";
  createdAt: string;
};
export type Evidence = {
  id: string;
  title: string;
  source: string;
  notes: string;
  image: string;
  versionId: string;
};
export type VideoReference = {
  id: string;
  title: string;
  url: string;
  notes: string;
};
export type Library = {
  seededVideoIds?: string[];
  guideImageId?: string;
  revisions: Revision[];
  screenshots: Evidence[];
  videos: VideoReference[];
  preferred: string | null;
};
export const emptyLibrary = (): Library => ({
  revisions: [],
  screenshots: [],
  videos: [],
  preferred: null,
});

// Remember supplied references so a later visit does not undo their removal.
export function mergeSeedVideos(
  library: Library,
  videos: VideoReference[],
): Library {
  const seen = new Set(library.seededVideoIds || []);
  const existing = new Set(library.videos.map((video) => video.id));
  const added: VideoReference[] = [];
  for (const video of videos) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    if (!existing.has(video.id)) {
      added.push(video);
      existing.add(video.id);
    }
  }
  if (seen.size === (library.seededVideoIds?.length || 0)) return library;
  return {
    ...library,
    videos: [...library.videos, ...added],
    seededVideoIds: Array.from(seen),
  };
}

/** TikTok share links (tiktok.com/t/…, vm.tiktok.com/…) hide the video ID the player needs until followed. */
export function isShortVideoLink(raw: string) {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");
    return u.protocol === "https:" && ((host === "tiktok.com" && /^\/t\/[\w-]+\/?$/.test(u.pathname)) || ((host === "vm.tiktok.com" || host === "vt.tiktok.com") && /^\/[\w-]+\/?$/.test(u.pathname)));
  } catch {
    return false;
  }
}

/** The full link behind a short one, or the link itself. Runs on this app's server, which follows TikTok's redirect. */
export async function resolveVideoUrl(raw: string): Promise<string> {
  if (!isShortVideoLink(raw)) return raw;
  try {
    const r = await fetch("/api/playbooks/resolve-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: raw }) });
    const j = (await r.json()) as { url?: string };
    return r.ok && j.url ? j.url : raw;
  } catch {
    return raw;
  }
}

/** Swaps any short links in a library for the full ones, so they play. Unchanged libraries come back as they were. */
export async function withPlayableVideos(library: Library): Promise<Library> {
  if (!library.videos.some((v) => isShortVideoLink(v.url))) return library;
  const videos = await Promise.all(library.videos.map(async (v) => (isShortVideoLink(v.url) ? { ...v, url: await resolveVideoUrl(v.url) } : v)));
  return videos.every((v, i) => v.url === library.videos[i].url) ? library : { ...library, videos };
}

/** Who made a video, from its link or its title. */
export function videoCreator(v: Pick<VideoReference, "url" | "title">) {
  const handle = v.url.match(/tiktok\.com\/@([\w.-]+)/)?.[1] ?? v.url.match(/youtube\.com\/@([\w.-]+)/)?.[1];
  if (handle) return handle;
  return v.title.match(/[—-]\s*([\w.]+)\s*\(/)?.[1] ?? v.title.match(/^([\w.]+)\s+[—-]/)?.[1] ?? "";
}

/** Splits a video's notes into a line about the video itself and its takeaways. */
export function readNotes(notes: string) {
  const parts = notes
    .split(/(?<=[.!?])\s+(?=[A-Z0-9$"'“(])/)
    .map((s) => s.trim())
    .filter(Boolean);
  const first = parts[0] ?? "";
  const isMeta = /^(TikTok|Instagram|YouTube|Reel|Video|Post|Carousel)\b.{0,40}\b(by|from)\b/i.test(first);
  const meta = isMeta ? (first.match(/\(([^)]+)\)/)?.[1] ?? "").split(/,\s+/).filter(Boolean).slice(0, 4) : [];
  return { meta, points: isMeta ? parts.slice(1) : parts };
}

export const LIBRARY_EVENT = "tp-playbook-library";

export function videoSource(
  raw: string,
): { provider: string; src: string; native?: boolean } | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const host = u.hostname.replace(/^www\./, "");
    if (host === "tiktok.com") {
      const match = u.pathname.match(/^\/@[\w.-]+\/video\/(\d+)\/?$/);
      return match
        ? {
            provider: "TikTok",
            src: `https://www.tiktok.com/player/v1/${match[1]}?controls=1`,
          }
        : null;
    }
    if (host === "instagram.com") {
      const m = u.pathname.match(/^\/(?:p|reel|reels|tv)\/([\w-]+)\/?$/);
      return m
        ? {
            provider: "Instagram",
            src: `https://www.instagram.com/p/${m[1]}/embed/`,
          }
        : null;
    }
    if (
      host === "youtube.com" ||
      host === "youtu.be" ||
      host === "m.youtube.com"
    ) {
      const id =
        host === "youtu.be"
          ? u.pathname.slice(1)
          : u.searchParams.get("v") ||
            u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1];
      if (!id || !/^[\w-]{11}$/.test(id)) return null;
      const start = youtubeStartSeconds(u);
      return {
        provider: "YouTube",
        src: start
          ? `https://www.youtube-nocookie.com/embed/${id}?start=${start}`
          : `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
    if (host === "vimeo.com" && /^\/\d+\/?$/.test(u.pathname))
      return {
        provider: "Vimeo",
        src: `https://player.vimeo.com/video/${u.pathname.split("/")[1]}`,
      };
    if (/\.(mp4|webm)$/i.test(u.pathname))
      return { provider: "Video", src: u.href, native: true };
    return null;
  } catch {
    return null;
  }
}

function youtubeStartSeconds(u: URL): number | null {
  const raw =
    u.searchParams.get("start") ||
    u.searchParams.get("t") ||
    u.hash.match(/[?&]?t=([^&]+)/)?.[1] ||
    null;
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw) || null;
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}
export function moveItem<T extends { id: string }>(
  items: T[],
  id: string,
  target: number,
): T[] {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0 || target < 0 || target >= items.length) return items;
  const result = [...items];
  result.splice(target, 0, ...result.splice(from, 1));
  return result;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("tradepilot-playbook-library", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("libraries");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readLibrary(id: string): Promise<Library> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("libraries").objectStore("libraries").get(id);
      req.onsuccess = () => resolve(req.result || emptyLibrary());
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function writeLibrary(
  id: string,
  library: Library,
): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("libraries", "readwrite");
      tx.objectStore("libraries").put(library, id);
      tx.oncomplete = () => {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(LIBRARY_EVENT, { detail: id }));
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
