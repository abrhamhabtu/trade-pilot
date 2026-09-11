import { NextRequest, NextResponse } from "next/server";
import {
  tradovateTrades,
  TradovateFill,
  TradovatePair,
  TradovateContract,
} from "@/lib/tradovate";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    req.headers.get("origin") !== url.origin ||
    req.headers.get("sec-fetch-site") === "cross-site"
  )
    return json(
      { error: "Connections are available in the local app only." },
      403,
    );
  try {
    const body = await req.json();
    const environment: "demo" | "live" =
      body.environment === "live" ? "live" : "demo";
    const cookie = `tradepilot_tradovate_${environment}`;
    const base = `https://${environment}.tradovateapi.com/v1`;
    const call = async (path: string, token?: string, payload?: unknown) => {
      const res = await fetch(`${base}/${path}`, {
        method: payload ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok)
        throw new Error(
          res.status === 401
            ? "Tradovate session expired or access denied. Connect again with authorized API credentials."
            : `Tradovate returned ${res.status}. Wait before retrying.`,
        );
      const data = await res.json();
      if (data.errorText || data.error || data["p-ticket"])
        throw new Error(
          "Tradovate requires access approval, authentication, or a cooldown. Check your API settings and retry later.",
        );
      return data;
    };
    if (body.action === "disconnect") {
      const res = json({ connected: false });
      res.cookies.set(cookie, "", {
        path: "/api/connections/tradovate",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 0,
      });
      return res;
    }
    if (body.action === "connect") {
      if (
        ![body.name, body.password, body.sec, body.appId].every(
          (v) => typeof v === "string" && v.length > 0 && v.length <= 4096,
        ) ||
        !Number.isSafeInteger(body.cid) ||
        body.cid <= 0
      )
        return json(
          {
            error:
              "Enter your username, password, registered app ID, API CID and API secret.",
          },
          400,
        );
      const auth = await call("auth/accesstokenrequest", undefined, {
        name: body.name,
        password: body.password,
        appId: body.appId,
        appVersion: "1.0",
        cid: body.cid,
        sec: body.sec,
      });
      if (typeof auth.accessToken !== "string" || !auth.accessToken)
        throw new Error(
          "No API session was granted. Your prop login may not permit direct API access.",
        );
      const accounts = await call("account/list", auth.accessToken);
      if (!Array.isArray(accounts))
        throw new Error("Tradovate did not return an account list.");
      const res = json({
        accounts: accounts.map((a: { id: number; name: string }) => ({
          id: a.id,
          name: a.name,
        })),
      });
      res.cookies.set(cookie, auth.accessToken, {
        httpOnly: true,
        sameSite: "strict",
        secure: url.protocol === "https:",
        path: "/api/connections/tradovate",
        maxAge: 3600,
      });
      return res;
    }
    const token = req.cookies.get(cookie)?.value;
    if (!token)
      return json({ error: "Connect Tradovate to start a session." }, 401);
    const accounts = await call("account/list", token);
    if (!Array.isArray(accounts))
      throw new Error("Tradovate did not return an account list.");
    if (body.action === "accounts")
      return json({
        accounts: accounts.map((a: { id: number; name: string }) => ({
          id: a.id,
          name: a.name,
        })),
      });
    if (
      body.action !== "trades" ||
      !Number.isSafeInteger(body.accountId) ||
      !accounts.some((a: { id: number }) => a.id === body.accountId)
    )
      return json(
        { error: "Select an account returned by this connection." },
        400,
      );
    const start = Date.parse(body.start ?? "");
    if (!Number.isFinite(start) || start > Date.now())
      return json({ error: "Choose a valid history start date." }, 400);
    const [positions, allPairs, fills] = await Promise.all([
      call(`position/deps?masterid=${body.accountId}`, token),
      call("fillPair/list", token),
      call("fill/list", token),
    ]);
    if (![positions, allPairs, fills].every(Array.isArray))
      throw new Error("The platform history response is incomplete.");
    const positionIds = new Set(
      positions
        .filter((p: { accountId: number }) => p.accountId === body.accountId)
        .map((p: { id: number }) => p.id),
    );
    const fillLookup = new Map<number, TradovateFill>(
      fills.map((f: TradovateFill) => [f.id, f]),
    );
    const pairs: TradovatePair[] = allPairs.filter((p: TradovatePair) => {
      if (!positionIds.has(p.positionId)) return false;
      const buy = fillLookup.get(p.buyFillId),
        sell = fillLookup.get(p.sellFillId);
      return (
        !p.active ||
        !buy ||
        !sell ||
        Math.max(Date.parse(buy.timestamp), Date.parse(sell.timestamp)) >= start
      );
    });
    const fillIds = new Set(
      pairs.filter((p) => p.active).flatMap((p) => [p.buyFillId, p.sellFillId]),
    );
    const usedFills: TradovateFill[] = fills.filter((f: TradovateFill) =>
      fillIds.has(f.id),
    );
    const contracts = new Map<number, TradovateContract>();
    const currencies = new Map<number, number>();
    for (const id of new Set(usedFills.map((f) => f.contractId))) {
      const contract = await call(`contract/item?id=${id}`, token);
      const maturity = await call(
        `contractMaturity/item?id=${contract.contractMaturityId}`,
        token,
      );
      const product = await call(
        `product/item?id=${maturity.productId}`,
        token,
      );
      const currency = await call(
        `currency/item?id=${product.currencyId}`,
        token,
      );
      if (currency.name !== "USD")
        throw new Error("This importer currently supports USD futures only.");
      contracts.set(id, {
        name: contract.name,
        valuePerPoint: product.valuePerPoint,
      });
      currencies.set(id, product.currencyId);
    }
    const fees = new Map<number, number>();
    const feeFields = [
      ["clearingFee", "clearingCurrencyId"],
      ["exchangeFee", "exchangeCurrencyId"],
      ["nfaFee", "nfaCurrencyId"],
      ["brokerageFee", "brokerageCurrencyId"],
      ["ipFee", "ipCurrencyId"],
      ["commission", "commissionCurrencyId"],
      ["orderRoutingFee", "orderRoutingCurrencyId"],
    ];
    // Bound concurrency and request size. Each dependent response is keyed to its requested fill.
    if (usedFills.length > 400)
      throw new Error(
        "This session exposes more than 400 executions. Use a CSV backfill for now; bulk API reconciliation needs a larger sync job.",
      );
    for (let i = 0; i < usedFills.length; i += 4) {
      await Promise.all(
        usedFills.slice(i, i + 4).map(async (f) => {
          const rows = await call(`fillFee/deps?masterid=${f.id}`, token);
          if (!Array.isArray(rows) || rows.length === 0)
            throw new Error(
              "Fees have not been returned for an execution. Retry after the platform finalizes it.",
            );
          let total = 0;
          for (const row of rows)
            for (const [field, currencyField] of feeFields) {
              const value = row[field] ?? 0;
              if (
                !Number.isFinite(value) ||
                (value !== 0 &&
                  row[currencyField] !== currencies.get(f.contractId))
              )
                throw new Error(
                  "Execution fees have an unsupported currency or value.",
                );
              total += value;
            }
          fees.set(f.id, total);
        }),
      );
    }
    const trades = tradovateTrades(
      pairs,
      usedFills,
      contracts,
      fees,
      body.accountId,
      environment,
      start,
    );
    return json({
      trades,
      voidedIds: pairs
        .filter((p) => !p.active)
        .map((p) => `tradovate-${environment}:${body.accountId}:${p.id}`),
      asOf: new Date().toISOString(),
    });
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && !e.message.includes("fetch")
            ? e.message
            : "Unable to reach Tradovate. Retry later.",
      },
      400,
    );
  }
}
