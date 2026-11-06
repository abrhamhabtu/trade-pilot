import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/pilot/proxy";
import { isShortVideoLink } from "@/lib/playbookLibrary";

export const runtime = "nodejs";

// A TikTok share link only says which video it is once followed. This follows it,
// only ever on TikTok's own hosts, and returns the full @creator/video address.

const TIKTOK = /^(?:www\.|vm\.|vt\.|m\.)?tiktok\.com$/;
const FULL = /^\/@[\w.-]+\/video\/\d+\/?$/;
const cache = ((globalThis as Record<string, unknown>).__tpVideoLinks ??= new Map<string, string>()) as Map<string, string>;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Same-origin requests only." }, { status: 403 });
  const { url } = (await request.json().catch(() => ({}))) as { url?: unknown };
  if (typeof url !== "string" || url.length > 300 || !isShortVideoLink(url)) return NextResponse.json({ error: "That isn't a TikTok share link." }, { status: 400 });
  const hit = cache.get(url);
  if (hit) return NextResponse.json({ url: hit });
  try {
    let next = new URL(url);
    for (let hop = 0; hop < 5; hop++) {
      if (next.protocol !== "https:" || !TIKTOK.test(next.hostname)) break;
      if (FULL.test(next.pathname)) {
        const full = `https://www.tiktok.com${next.pathname.replace(/\/$/, "")}`;
        cache.set(url, full);
        return NextResponse.json({ url: full });
      }
      const res = await fetch(next, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" } });
      await res.body?.cancel();
      const loc = res.headers.get("location");
      if (!loc) break;
      next = new URL(loc, next);
    }
  } catch {
    /* reported below */
  }
  return NextResponse.json({ error: "TikTok didn't say which video that is." }, { status: 404 });
}
