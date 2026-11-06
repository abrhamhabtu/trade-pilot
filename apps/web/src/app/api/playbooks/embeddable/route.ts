import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Some YouTube creators turn off playback on other sites, and the player then
// only shows "Video unavailable". YouTube's oEmbed answers 401 for exactly those
// videos, so ask it once per video and let the page show a proper card instead.

const cache = ((globalThis as Record<string, unknown>).__tpEmbeddable ??= new Map<string, boolean>()) as Map<string, boolean>;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("youtube") ?? "";
  if (!/^[\w-]{11}$/.test(id)) return NextResponse.json({ error: "Not a YouTube video id." }, { status: 400 });
  const hit = cache.get(id);
  if (hit !== undefined) return NextResponse.json({ embeddable: hit });
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    await res.body?.cancel();
    // 401: embedding off. 404/400: private or removed, which won't play either.
    const embeddable = res.ok || res.status >= 500;
    if (res.status < 500) cache.set(id, embeddable);
    return NextResponse.json({ embeddable });
  } catch {
    // Can't reach YouTube from here: try the player rather than hide a video that may work.
    return NextResponse.json({ embeddable: true });
  }
}
