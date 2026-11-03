import { NextResponse, type NextRequest } from "next/server";

// A tunnel exists so TradingView can reach the alert webhook, not so the internet
// can open the app. Requests that arrive through Cloudflare only get the webhooks,
// unless TRADEPILOT_PUBLIC_APP=1 says this deployment is meant to be public.
const OPEN = ["/api/alerts/tradingview", "/api/alerts/ping", "/api/signals/tradingview"];

export function middleware(req: NextRequest) {
  if (process.env.TRADEPILOT_PUBLIC_APP === "1") return NextResponse.next();
  if (!req.headers.get("cf-connecting-ip")) return NextResponse.next();
  if (OPEN.includes(req.nextUrl.pathname)) return NextResponse.next();
  return new NextResponse("Not found", { status: 404 });
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
