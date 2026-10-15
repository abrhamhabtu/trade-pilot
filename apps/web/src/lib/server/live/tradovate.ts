// Tradovate (Lucid, Top One Futures, Tradeify, Futures Elite, FundedNext and
// other firms on Tradovate), server side. Credentials stay in
// tradovate-secrets.json on this machine.
//
// REST: https://{demo|live}.tradovateapi.com/v1 — auth/accesstokenrequest,
// auth/renewaccesstoken, account/list, contract/suggest, order/placeoso,
// order/liquidateposition, position/list.
// Bars: the market-data WebSocket (wss://md.tradovateapi.com/v1/websocket),
// md/getChart with MinuteBar elements, kept open and updated in real time.
// Docs: https://docs.ninjatrader.com/api

import type { Bar } from "@/lib/pilot/market";
import { readJson, updateJson } from "../store";

const SECRETS = "tradovate-secrets.json";

interface Secrets {
  name?: string;
  password?: string;
  appId?: string;
  cid?: number;
  sec?: string;
  environment?: "demo" | "live";
  accessToken?: string;
  mdAccessToken?: string;
  /** ms epoch the access token expires. */
  expires?: number;
}

export interface TvAccount {
  id: number;
  name: string;
  active?: boolean;
}

export interface TvContract {
  id: number;
  name: string;
}

export class TvError extends Error {}

const base = (env: "demo" | "live") => `https://${env}.tradovateapi.com/v1`;

async function rest(env: "demo" | "live", path: string, token?: string, body?: unknown) {
  const res = await fetch(`${base(env)}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401) throw new TvError("Tradovate session expired or API access was refused.");
  if (!res.ok) throw new TvError(`Tradovate returned ${res.status}.`);
  const data = await res.json();
  // A p-ticket means Tradovate wants a pause before the next login attempt.
  if (data && typeof data === "object" && !Array.isArray(data) && (data["p-ticket"] || data.errorText))
    throw new TvError(data.errorText || "Tradovate asked to wait before logging in again. Try in a minute.");
  return data;
}

export const getSecrets = () => readJson<Secrets>(SECRETS, {});

async function login(s: Secrets) {
  const auth = await rest(s.environment ?? "demo", "auth/accesstokenrequest", undefined, {
    name: s.name,
    password: s.password,
    appId: s.appId,
    appVersion: "1.0",
    cid: s.cid,
    sec: s.sec,
  });
  if (typeof auth.accessToken !== "string") throw new TvError("No API session was granted. Your login may not include API access.");
  return { accessToken: auth.accessToken as string, mdAccessToken: (auth.mdAccessToken as string) ?? auth.accessToken, expires: Date.parse(auth.expirationTime) || Date.now() + 75 * 60_000 };
}

export async function connect(input: { name: string; password: string; appId: string; cid: number; sec: string; environment: "demo" | "live" }) {
  const tokens = await login(input);
  await updateJson<Secrets>(SECRETS, {}, () => ({ ...input, ...tokens }), { secret: true });
  md.reset();
  return accounts();
}

export async function disconnect() {
  md.reset();
  await updateJson<Secrets>(SECRETS, {}, () => ({}), { secret: true });
}

/** A live session, renewed ten minutes before it expires; a fresh login only if renewal fails. */
async function session() {
  const s = await getSecrets();
  if (!s.name || !s.password || !s.sec) throw new TvError("Not connected to Tradovate.");
  const env = s.environment ?? "demo";
  if (s.accessToken && s.expires && s.expires - Date.now() > 10 * 60_000) return { env, token: s.accessToken, md: s.mdAccessToken ?? s.accessToken };
  let next: { accessToken: string; mdAccessToken: string; expires: number } | null = null;
  if (s.accessToken && s.expires && s.expires > Date.now()) {
    try {
      const r = await rest(env, "auth/renewaccesstoken", s.accessToken);
      if (typeof r.accessToken === "string") next = { accessToken: r.accessToken, mdAccessToken: (r.mdAccessToken as string) ?? s.mdAccessToken ?? r.accessToken, expires: Date.parse(r.expirationTime) || Date.now() + 75 * 60_000 };
    } catch {
      /* fall through to a login */
    }
  }
  next ??= await login(s);
  await updateJson<Secrets>(SECRETS, {}, (x) => ({ ...x, ...next }), { secret: true });
  return { env, token: next.accessToken, md: next.mdAccessToken };
}

export async function accounts(): Promise<TvAccount[]> {
  const { env, token } = await session();
  const list = (await rest(env, "account/list", token)) as TvAccount[];
  return (Array.isArray(list) ? list : []).filter((a) => a.active !== false).map((a) => ({ id: a.id, name: a.name }));
}

/** The front-month contract for a root like MNQ: the first listed month that matches. */
export async function frontContract(root: string): Promise<TvContract> {
  const { env, token } = await session();
  const list = (await rest(env, `contract/suggest?t=${encodeURIComponent(root)}&l=10`, token)) as TvContract[];
  const re = new RegExp(`^${root}[FGHJKMNQUVXZ]\\d{1,2}$`);
  const pick = (Array.isArray(list) ? list : []).find((c) => re.test(c.name));
  if (!pick) throw new TvError(`No ${root} contract found on this Tradovate login.`);
  return { id: pick.id, name: pick.name };
}

/**
 * Market entry with a stop and a target attached as an OCO pair at the
 * broker, so the position stays protected if this machine goes offline.
 * Bracket prices are set from the last price, the same distance the strategy
 * would use from its fill.
 */
export async function placeBracketMarket(o: { accountId: number; accountName: string; symbol: string; side: "long" | "short"; size: number; refPx: number; stopPts: number; targetPts: number; tick: number; tag: string }) {
  const { env, token } = await session();
  const round = (px: number) => Math.round(px / o.tick) * o.tick;
  const exit = o.side === "long" ? "Sell" : "Buy";
  const dir = o.side === "long" ? 1 : -1;
  const r = await rest(env, "order/placeoso", token, {
    accountSpec: o.accountName,
    accountId: o.accountId,
    action: o.side === "long" ? "Buy" : "Sell",
    symbol: o.symbol,
    orderQty: o.size,
    orderType: "Market",
    isAutomated: true,
    text: o.tag.slice(0, 50),
    bracket1: { action: exit, orderType: "Stop", stopPrice: round(o.refPx - dir * o.stopPts) },
    bracket2: { action: exit, orderType: "Limit", price: round(o.refPx + dir * o.targetPts) },
  });
  if (r.failureReason && r.failureReason !== "Success") throw new TvError(`${r.failureReason}${r.failureText ? `: ${r.failureText}` : ""}`);
  return r.orderId as number;
}

/** Cancel the contract's working orders and flatten its position in one call. */
export async function liquidate(accountId: number, contractId: number) {
  const { env, token } = await session();
  const r = await rest(env, "order/liquidateposition", token, { accountId, contractId, admin: false, isAutomated: true });
  if (r.failureReason && r.failureReason !== "Success") throw new TvError(`${r.failureReason}${r.failureText ? `: ${r.failureText}` : ""}`);
}

// ─── Market data ───────────────────────────────────────────────────────────────
// One WebSocket for the process. Each subscribed chart keeps its bars in
// memory; real-time chart events replace the bar that is still forming.

type Chart = { minutes: number; bars: Map<number, Bar>; requested: number; ready: boolean; error?: string };

class MdClient {
  private ws: WebSocket | null = null;
  private seq = 10;
  private lastSend = 0;
  private authed = false;
  private authId = -1;
  private charts = new Map<string, Chart>();
  private byRequest = new Map<number, string>();
  private bySubscription = new Map<number, string>();
  private beat: ReturnType<typeof setInterval> | null = null;

  reset() {
    this.ws?.close();
    this.ws = null;
    this.authed = false;
    this.charts.clear();
    this.byRequest.clear();
    this.bySubscription.clear();
    if (this.beat) clearInterval(this.beat);
    this.beat = null;
  }

  private send(endpoint: string, body: string | object = "") {
    const id = ++this.seq;
    this.ws?.send(`${endpoint}\n${id}\n\n${typeof body === "string" ? body : JSON.stringify(body)}`);
    this.lastSend = Date.now();
    return id;
  }

  private async open() {
    if (this.ws && this.ws.readyState <= 1) return;
    if (typeof WebSocket === "undefined") throw new TvError("This server's Node.js has no WebSocket support. Use Node 22 or newer.");
    const { md: token } = await session();
    this.authed = false;
    const ws = new WebSocket("wss://md.tradovateapi.com/v1/websocket");
    this.ws = ws;
    ws.onmessage = (ev) => this.onFrame(String(ev.data), token);
    ws.onclose = () => {
      if (this.ws === ws) {
        this.ws = null;
        this.authed = false;
        // Charts resubscribe on the next request.
        for (const c of this.charts.values()) c.ready = false;
      }
    };
    this.beat ??= setInterval(() => {
      if (this.ws?.readyState === 1 && Date.now() - this.lastSend > 2_400) {
        this.ws.send("[]");
        this.lastSend = Date.now();
      }
    }, 1_000);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new TvError("Tradovate market data did not answer.")), 15_000);
      const check = setInterval(() => {
        if (this.authed) {
          clearTimeout(t);
          clearInterval(check);
          resolve();
        }
        if (this.ws !== ws) {
          clearTimeout(t);
          clearInterval(check);
          reject(new TvError("Tradovate market data closed the connection."));
        }
      }, 100);
    });
  }

  private onFrame(frame: string, token: string) {
    const type = frame[0];
    if (type === "o") {
      this.authId = this.send("authorize", token);
      return;
    }
    if (type !== "a") return;
    let msgs: { i?: number; s?: number; d?: unknown; e?: string }[] = [];
    try {
      msgs = JSON.parse(frame.slice(1));
    } catch {
      return;
    }
    for (const m of msgs) {
      if (m.i != null && m.s != null) {
        if (m.i === this.authId) {
          if (m.s === 200) this.authed = true;
          else this.ws?.close();
        }
        const key = this.byRequest.get(m.i);
        if (key) {
          const chart = this.charts.get(key);
          const d = m.d as { historicalId?: number; realtimeId?: number } | string;
          if (m.s !== 200 && chart) chart.error = typeof d === "string" ? d : "Chart request refused";
          if (typeof d === "object" && d) {
            if (d.historicalId) this.bySubscription.set(d.historicalId, key);
            if (d.realtimeId) this.bySubscription.set(d.realtimeId, key);
          }
        }
      }
      if (m.e === "chart") {
        const d = m.d as { charts?: { id: number; eoh?: boolean; bars?: { timestamp: string; open: number; high: number; low: number; close: number; upVolume?: number; downVolume?: number }[] }[] };
        for (const c of d.charts ?? []) {
          const key = this.bySubscription.get(c.id);
          const chart = key ? this.charts.get(key) : undefined;
          if (!chart) continue;
          for (const b of c.bars ?? []) {
            const t = Math.floor(Date.parse(b.timestamp) / 1000);
            chart.bars.set(t, { t, o: b.open, h: b.high, l: b.low, c: b.close, v: (b.upVolume ?? 0) + (b.downVolume ?? 0) });
          }
          if (c.eoh) chart.ready = true;
        }
      }
    }
  }

  /** Bars for a contract, oldest first: four days of history, then live. */
  async bars(symbol: string, minutes: number): Promise<Bar[]> {
    await this.open();
    const key = `${symbol}:${minutes}`;
    let chart = this.charts.get(key);
    if (!chart || (!chart.ready && Date.now() - chart.requested > 20_000)) {
      chart = chart ?? { minutes, bars: new Map(), requested: 0, ready: false };
      chart.requested = Date.now();
      chart.error = undefined;
      this.charts.set(key, chart);
      const id = this.send("md/getChart", {
        symbol,
        chartDescription: { underlyingType: "MinuteBar", elementSize: minutes, elementSizeUnit: "UnderlyingUnits", withHistogram: false },
        timeRange: { asMuchAsElements: Math.ceil((4 * 24 * 60) / minutes) },
      });
      this.byRequest.set(id, key);
    }
    const until = Date.now() + 12_000;
    while (!chart.ready && !chart.error && Date.now() < until) await new Promise((r) => setTimeout(r, 200));
    if (chart.error) throw new TvError(`Tradovate chart: ${chart.error}`);
    return [...chart.bars.values()].sort((a, b) => a.t - b.t);
  }
}

const md: MdClient = ((globalThis as Record<string, unknown>).__tpTradovateMd ??= new MdClient()) as MdClient;

export const minuteBars = (symbol: string, minutes: number) => md.bars(symbol, minutes);
