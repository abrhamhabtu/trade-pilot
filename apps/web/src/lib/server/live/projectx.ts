// ProjectX Gateway (TopstepX and the other firms on ProjectX), server side.
// The username and API key stay in live-secrets.json on this machine. Session
// tokens last 24 hours and are refreshed with Auth/validate before they expire.
// Endpoints: https://gateway.docs.projectx.com/docs/api-reference

import type { Bar } from "@/lib/pilot/market";
import { readJson, updateJson } from "../store";

const SECRETS = "live-secrets.json";
export const DEFAULT_BASE = "https://api.topstepx.com/api";
// Only ProjectX gateways: the server sends the API key to whatever base is saved.
const BASE_OK = /^https:\/\/(?:[a-z0-9-]+\.)*(?:projectx\.com|topstepx\.com)\/api$/;

interface Secrets {
  userName?: string;
  apiKey?: string;
  base?: string;
  token?: string;
  tokenAt?: number;
  /** Sim data subscription (false) or live (true) for bars and contracts. */
  liveData?: boolean;
}

export interface PxAccount {
  id: number;
  name: string;
  balance: number;
  canTrade: boolean;
  simulated?: boolean;
}

export interface PxContract {
  id: string;
  name: string;
  tickSize: number;
  tickValue: number;
  activeContract: boolean;
}

export interface PxPosition {
  id: number;
  accountId: number;
  contractId: string;
  type: number;
  size: number;
  averagePrice: number;
}

export class PxError extends Error {
  constructor(message: string, readonly code = 0) {
    super(message);
  }
}

export const validBase = (base: string) => BASE_OK.test(base);

async function raw(base: string, path: string, body: unknown, token?: string) {
  const res = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "text/plain", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401) throw new PxError("Session expired", 401);
  if (!res.ok) throw new PxError(`ProjectX request failed (${res.status})`, res.status);
  const data = (await res.json()) as { success?: boolean; errorCode?: number; errorMessage?: string | null } & Record<string, unknown>;
  if (!data.success) throw new PxError(data.errorMessage || `ProjectX declined the request (code ${data.errorCode ?? "?"})`, data.errorCode ?? -1);
  return data;
}

export async function getSecrets() {
  return readJson<Secrets>(SECRETS, {});
}

export async function connect(userName: string, apiKey: string, base = DEFAULT_BASE, liveData = false) {
  if (!validBase(base)) throw new PxError("That isn't a ProjectX API address.");
  const auth = await raw(base, "Auth/loginKey", { userName, apiKey });
  if (typeof auth.token !== "string") throw new PxError("ProjectX did not return a session.");
  await updateJson<Secrets>(SECRETS, {}, () => ({ userName, apiKey, base, token: auth.token as string, tokenAt: Date.now(), liveData }), { secret: true });
  return accounts();
}

export async function disconnect() {
  await updateJson<Secrets>(SECRETS, {}, () => ({}), { secret: true });
}

async function session(): Promise<{ base: string; token: string; s: Secrets }> {
  const s = await getSecrets();
  if (!s.userName || !s.apiKey || !s.base) throw new PxError("Not connected to ProjectX.");
  if (s.token && s.tokenAt && Date.now() - s.tokenAt < 20 * 3600_000) return { base: s.base, token: s.token, s };
  let token: string | undefined;
  if (s.token) {
    try {
      const v = await raw(s.base, "Auth/validate", {}, s.token);
      if (typeof v.newToken === "string") token = v.newToken;
    } catch {
      /* fall through to a fresh login */
    }
  }
  if (!token) {
    const auth = await raw(s.base, "Auth/loginKey", { userName: s.userName, apiKey: s.apiKey });
    token = auth.token as string;
  }
  await updateJson<Secrets>(SECRETS, {}, (x) => ({ ...x, token, tokenAt: Date.now() }), { secret: true });
  return { base: s.base, token, s };
}

async function call(path: string, body: unknown) {
  const { base, token } = await session();
  try {
    return await raw(base, path, body, token);
  } catch (e) {
    if (!(e instanceof PxError) || e.code !== 401) throw e;
    // The token died early: log in again once.
    await updateJson<Secrets>(SECRETS, {}, (x) => ({ ...x, token: undefined, tokenAt: 0 }), { secret: true });
    const again = await session();
    return raw(again.base, path, body, again.token);
  }
}

export async function accounts(): Promise<PxAccount[]> {
  const d = await call("Account/search", { onlyActiveAccounts: true });
  return ((d.accounts as PxAccount[]) ?? []).map((a) => ({ id: a.id, name: a.name, balance: a.balance, canTrade: a.canTrade, simulated: a.simulated }));
}

/** The front-month contract for a symbol root like MNQ or ES. */
export async function frontContract(root: string): Promise<PxContract> {
  const { s } = await session();
  const d = await call("Contract/search", { searchText: root, live: !!s.liveData });
  const list = ((d.contracts as PxContract[]) ?? []).filter((c) => new RegExp(`^${root}[FGHJKMNQUVXZ]\\d{1,2}$`).test(c.name));
  const pick = list.find((c) => c.activeContract) ?? list[0];
  if (!pick) throw new PxError(`No ${root} contract found on this ProjectX connection.`);
  return pick;
}

/** Minute bars, oldest first, including the bar still forming. */
export async function minuteBars(contractId: string, minutes: number, fromMs: number, toMs = Date.now()): Promise<Bar[]> {
  const { s } = await session();
  const d = await call("History/retrieveBars", {
    contractId,
    live: !!s.liveData,
    startTime: new Date(fromMs).toISOString(),
    endTime: new Date(toMs).toISOString(),
    unit: 2,
    unitNumber: minutes,
    limit: 20_000,
    includePartialBar: true,
  });
  return ((d.bars as { t: string; o: number; h: number; l: number; c: number; v: number }[]) ?? [])
    .map((b) => ({ t: Math.floor(Date.parse(b.t) / 1000), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }))
    .sort((a, b) => a.t - b.t);
}

/**
 * A market order with a stop and a target attached by the broker, so the
 * position is protected even if this machine goes offline. Needs the account's
 * risk setting on Auto OCO Brackets; ProjectX rejects brackets otherwise.
 */
export async function placeBracketMarket(o: { accountId: number; contractId: string; side: "long" | "short"; size: number; stopTicks: number; targetTicks: number; tag: string }) {
  const d = await call("Order/place", {
    accountId: o.accountId,
    contractId: o.contractId,
    type: 2,
    side: o.side === "long" ? 0 : 1,
    size: o.size,
    customTag: o.tag,
    stopLossBracket: { ticks: Math.max(1, Math.round(o.stopTicks)), type: 4 },
    takeProfitBracket: { ticks: Math.max(1, Math.round(o.targetTicks)), type: 1 },
  });
  return d.orderId as number;
}

export async function openPositions(accountId: number): Promise<PxPosition[]> {
  const d = await call("Position/searchOpen", { accountId });
  return (d.positions as PxPosition[]) ?? [];
}

export async function closeContract(accountId: number, contractId: string) {
  await call("Position/closeContract", { accountId, contractId });
}

/** Cancel the working orders on one contract, such as a closed position's leftover brackets. */
export async function cancelOpenOrders(accountId: number, contractId: string) {
  const d = await call("Order/searchOpen", { accountId });
  for (const o of ((d.orders as { id: number; contractId: string }[]) ?? []).filter((x) => x.contractId === contractId)) {
    await call("Order/cancel", { accountId, orderId: o.id }).catch(() => undefined);
  }
}
