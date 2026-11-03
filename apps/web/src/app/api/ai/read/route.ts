import { localOnly, noStore } from "@/lib/server/guard";
import { askSession, isSessionTool } from "@/lib/server/sessionModel";
import { gradeRead, parseRead, readPrompt, type ChartTruth } from "@/lib/vision/read";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE = 6_000_000;

// One screenshot to the trader's own logged-in AI, and its answer graded against the real bars.
export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => ({}))) as { tool?: unknown; image?: string; market?: string; tf?: string; facts?: unknown; truth?: ChartTruth };
  if (!isSessionTool(b.tool)) return noStore({ error: "Connect Claude Code or Codex first." }, 400);
  const png = /^data:image\/png;base64,/.test(b.image ?? "") ? Buffer.from(b.image!.split(",")[1], "base64") : null;
  if (!png || png.length < 200 || png.length > MAX_IMAGE) return noStore({ error: "The chart screenshot didn't come through." }, 400);
  if (!b.truth || !Number.isFinite(b.truth.high)) return noStore({ error: "No chart to check against." }, 400);
  try {
    const prompt = readPrompt({ market: String(b.market ?? "").slice(0, 20), tf: String(b.tf ?? "").slice(0, 8), facts: b.facts ?? {} });
    const text = await askSession(b.tool, prompt, { imagePng: png, signal: req.signal });
    const read = parseRead(text);
    if (!read) return noStore({ error: "The answer didn't come back in a form the app can check, so it isn't shown. Try again." }, 502);
    return noStore({ ...gradeRead(read, b.truth), prompt });
  } catch (e) {
    return noStore({ error: e instanceof Error ? e.message : "The AI didn't answer." }, 502);
  }
}
