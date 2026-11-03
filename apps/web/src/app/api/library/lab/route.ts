import { localOnly, noStore } from "@/lib/server/guard";
import { getStudy, labJob, runCampaign, runStudy, tradePlan } from "@/lib/server/library/lab";
import type { PropAccount } from "@/lib/vision/account";
import type { SizingPlan } from "@/lib/vision/lab";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The prop firm lab: start a study, read it back, put its plan on an account.

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const q = new URL(req.url).searchParams;
  const program = q.get("program") ?? "";
  const symbol = q.get("symbol") ?? "";
  const micro = q.get("micro") === "1";
  return noStore({ study: await getStudy(program, symbol, micro), job: labJob(`${program}|${symbol}|${micro ? 1 : 0}`) });
}

export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => ({}))) as { action?: string; program?: string; symbol?: string; micro?: boolean; account?: PropAccount; variant?: string; plan?: SizingPlan; horizon?: number; maxAttempts?: number };
  try {
    if (b.action === "study") return noStore({ job: await runStudy({ program: String(b.program), symbol: String(b.symbol), micro: !!b.micro }) });
    if (b.action === "trade" && b.account && b.variant && b.plan) return noStore(await tradePlan(b.account, { variant: b.variant, plan: b.plan, horizon: b.horizon }));
    if (b.action === "campaign" && b.account) return noStore(await runCampaign(b.account, { maxAttempts: b.maxAttempts }));
    return noStore({ error: "Unknown action." }, 400);
  } catch (e) {
    return noStore({ error: e instanceof Error ? e.message : "The lab request failed." }, 500);
  }
}
