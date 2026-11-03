import { noStore } from "@/lib/server/guard";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lets the setup guide check that a public address really reaches this app.
export const GET = () => noStore({ ok: true, app: "TradePilot" });
