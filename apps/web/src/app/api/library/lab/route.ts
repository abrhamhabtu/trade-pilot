import { localOnly, noStore } from "@/lib/server/guard";
import { getLimits, getLiveStudy, getPortfolio, getScout, getStudy, labJob, runCampaign, runLiveStudy, runPortfolio, runScout, runStudy, saveLimits, setApproved, tradePlan, versus } from "@/lib/server/library/lab";
import { firmRuleCheck } from "@/lib/vision/scout";
import { limitsKey, type RiskLimits } from "@/lib/vision/limits";
import type { PropAccount } from "@/lib/vision/account";
import type { SizingPlan } from "@/lib/vision/lab";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The prop firm lab: start a study, read it back, put its plan on an account.

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const q = new URL(req.url).searchParams;
  const view = q.get("view");
  if (view === "limits") return noStore({ limits: await getLimits(), firms: firmRuleCheck(Date.now()) });
  if (view === "scout") return noStore({ ...(await getScout()), job: labJob("scout") });
  if (view === "portfolio") return noStore({ study: await getPortfolio(q.get("program") ?? ""), job: labJob(`book|${q.get("program") ?? ""}`) });
  if (view === "live") return noStore({ study: await getLiveStudy(q.get("symbol") ?? "", q.get("micro") === "1"), job: labJob(`live|${q.get("symbol") ?? ""}|${q.get("micro") === "1" ? 1 : 0}`) });
  const program = q.get("program") ?? "";
  const symbol = q.get("symbol") ?? "";
  const micro = q.get("micro") === "1";
  return noStore({ study: await getStudy(program, symbol, micro), job: labJob(`${program}|${symbol}|${micro ? 1 : 0}`), limitsKey: limitsKey(await getLimits()) });
}

export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => ({}))) as { action?: string; program?: string; symbol?: string; micro?: boolean; account?: PropAccount; variant?: string; plan?: SizingPlan; horizon?: number; maxAttempts?: number; limits?: RiskLimits; id?: string; on?: boolean };
  try {
    if (b.action === "study") return noStore({ job: await runStudy({ program: String(b.program), symbol: String(b.symbol), micro: !!b.micro }) });
    if (b.action === "limits" && b.limits) return noStore({ limits: await saveLimits(b.limits) });
    if (b.action === "live-study") return noStore({ job: await runLiveStudy({ symbol: String(b.symbol), micro: !!b.micro }) });
    if (b.action === "portfolio") return noStore({ job: await runPortfolio({ program: String(b.program) }) });
    if (b.action === "scout") return noStore({ job: await runScout() });
    if (b.action === "approve" && b.id) return noStore({ approved: await setApproved(b.id, !!b.on) });
    if (b.action === "versus" && b.account) return noStore({ report: await versus(b.account) });
    if (b.action === "trade" && b.account && b.variant && b.plan) return noStore(await tradePlan(b.account, { variant: b.variant, plan: b.plan, horizon: b.horizon }));
    if (b.action === "campaign" && b.account) return noStore(await runCampaign(b.account, { maxAttempts: b.maxAttempts }));
    return noStore({ error: "Unknown action." }, 400);
  } catch (e) {
    return noStore({ error: e instanceof Error ? e.message : "The lab request failed." }, 500);
  }
}
