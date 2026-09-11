import { NextResponse } from "next/server";
import { ingestLink } from "@/lib/ingest";
import { sameOrigin } from "@/lib/pilot/proxy";

export const runtime = "nodejs";

/** POST { url } → the link's title, caption and transcript (best effort). */
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Same-origin requests only." }, { status: 403 });
  try {
    const { url } = await request.json();
    if (typeof url !== "string" || url.length > 2000) throw new Error("Paste a link.");
    const source = await ingestLink(url);
    return NextResponse.json({ source }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message =
      error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
        ? "That site took too long to respond."
        : error instanceof Error
          ? error.message
          : "Couldn't read that link.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
