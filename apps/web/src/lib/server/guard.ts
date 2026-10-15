import { NextResponse } from "next/server";

// Alerts, the always-on runner and live trading control a person's money and
// messaging accounts, and TradePilot has no user accounts yet. These routes
// answer only same-origin requests to a loopback address. A production build
// (Docker) also needs TRADEPILOT_LOCAL_CONTROL=1, set by someone who has kept
// the port off the public internet.

const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];

export function localOnly(req: Request): NextResponse | null {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  const sameOrigin = req.method === "GET" ? !origin || origin === url.origin : origin === url.origin;
  const allowed =
    (process.env.NODE_ENV !== "production" || process.env.TRADEPILOT_LOCAL_CONTROL === "1") &&
    LOOPBACK.includes(url.hostname) &&
    sameOrigin &&
    req.headers.get("sec-fetch-site") !== "cross-site";
  return allowed ? null : NextResponse.json({ error: "This control works only in the local app." }, { status: 403 });
}

export const noStore = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
