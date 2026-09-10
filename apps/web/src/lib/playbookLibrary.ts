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
      return id && /^[\w-]{11}$/.test(id)
        ? {
            provider: "YouTube",
            src: `https://www.youtube-nocookie.com/embed/${id}`,
          }
        : null;
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
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
