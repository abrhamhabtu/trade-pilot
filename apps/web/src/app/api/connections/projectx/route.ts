import { NextRequest, NextResponse } from "next/server";
import { projectXTrades, ProjectXFill } from "@/lib/projectx";

export const dynamic = "force-dynamic";
const cookieName = "tradepilot_projectx_session";
const base = "https://api.topstepx.com/api";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// This personal connector is local-only until the application has user authentication.
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    origin !== url.origin ||
    req.headers.get("sec-fetch-site") === "cross-site"
  )
    return json(
      { error: "Connections are available in the local app only." },
      403,
    );
  const call = async (path: string, body: unknown, token?: string) => {
    const response = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Session expired. Connect again."
          : `Platform request failed (${response.status}). Try again shortly.`,
      );
    const data = await response.json();
    if (!data.success)
      throw new Error(
        "The platform declined the request. Check your API access and account permissions.",
      );
    return data;
  };
  try {
    const body = await req.json();
    if (body.action === "disconnect") {
      const response = json({ connected: false });
      response.cookies.set(cookieName, "", {
        path: "/api/connections/projectx",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 0,
      });
      return response;
    }
    if (body.action === "connect") {
      if (
        typeof body.userName !== "string" ||
        !body.userName.trim() ||
        typeof body.apiKey !== "string" ||
        !body.apiKey ||
        body.apiKey.length > 4096
      )
        return json(
          { error: "Enter your platform username and API key." },
          400,
        );
      const auth = await call("Auth/loginKey", {
        userName: body.userName.trim(),
        apiKey: body.apiKey,
      });
      if (typeof auth.token !== "string" || !auth.token)
        throw new Error("The platform did not return a session.");
      const data = await call(
        "Account/search",
        { onlyActiveAccounts: false },
        auth.token,
      );
      const response = json({ accounts: data.accounts });
      response.cookies.set(cookieName, auth.token, {
        httpOnly: true,
        sameSite: "strict",
        secure: url.protocol === "https:",
        path: "/api/connections/projectx",
        maxAge: 3600,
      });
      return response;
    }
    const token = req.cookies.get(cookieName)?.value;
    if (!token)
      return json({ error: "Connect TopstepX to start a session." }, 401);
    const data = await call(
      "Account/search",
      { onlyActiveAccounts: false },
      token,
    );
    if (body.action === "accounts") return json({ accounts: data.accounts });
    if (
      body.action !== "trades" ||
      !Number.isSafeInteger(body.accountId) ||
      !data.accounts.some((a: { id: number }) => a.id === body.accountId)
    )
      return json({ error: "Select an account from this connection." }, 400);
    const start = Date.parse(body.start ?? "");
    if (
      !Number.isFinite(start) ||
      start > Date.now() ||
      start < Date.now() - 10 * 365.25 * 86400000
    )
      return json(
        {
          error: "Choose a valid history start date within the last ten years.",
        },
        400,
      );
    const history = await call(
      "Trade/search",
      {
        accountId: body.accountId,
        startTimestamp: new Date(start).toISOString(),
        endTimestamp: new Date().toISOString(),
      },
      token,
    );
    if (!Array.isArray(history.trades))
      throw new Error("The platform returned no trade history.");
    const trades = projectXTrades(
      history.trades as ProjectXFill[],
      body.accountId,
    );
    const voidedIds = history.trades
      .filter((f: ProjectXFill) => f.accountId === body.accountId && f.voided)
      .map((f: ProjectXFill) => `projectx:${body.accountId}:${f.id}`);
    return json({
      trades,
      voidedIds,
      asOf: new Date().toISOString(),
      executions: history.trades.length,
    });
  } catch (error) {
    // Never return upstream bodies, tokens, or credentials.
    return json(
      {
        error:
          error instanceof Error && !error.message.includes("fetch")
            ? error.message
            : "Could not reach TopstepX. Try again shortly.",
      },
      400,
    );
  }
}
