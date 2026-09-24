import { NextResponse } from "next/server";
export const runtime = "nodejs";

// TradingView → TradePilot. TradingView's servers POST here when an alert
// fires; the open app polls with the same key and picks the signal up.
//
// The key is the only credential, so it is required on both sides and a signal
// is only ever returned to the key it was sent with. Signals live in memory:
// this is a doorbell, not a database. The browser keeps its own copy.

const KEY = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_BODY = 32_000;
const PER_KEY = 50;
const MAX_KEYS = 100;
const TTL = 24 * 60 * 60_000;

export interface StoredSignal {
  id: string;
  receivedAt: number;
  payload: unknown;
}

type Inbox = Map<string, StoredSignal[]>;
const inbox: Inbox = ((globalThis as Record<string, unknown>).__tpSignalInbox ??= new Map()) as Inbox;

function keyFrom(request: Request, payload?: unknown) {
  const fromQuery = new URL(request.url).searchParams.get("key");
  const fromBody =
    payload && typeof payload === "object" ? (payload as { key?: unknown }).key : undefined;
  const key = fromQuery || (typeof fromBody === "string" ? fromBody : "");
  return KEY.test(key) ? key : null;
}

function prune(now: number) {
  for (const [k, list] of inbox) {
    const kept = list.filter((s) => now - s.receivedAt < TTL);
    if (kept.length) inbox.set(k, kept);
    else inbox.delete(k);
  }
  while (inbox.size > MAX_KEYS) inbox.delete(inbox.keys().next().value as string);
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY)
    return NextResponse.json({ error: "Alert body is too large." }, { status: 413 });
  let payload: unknown = raw;
  try {
    payload = JSON.parse(raw);
  } catch {
    /* plain-text alert messages are fine */
  }
  const key = keyFrom(request, payload);
  if (!key) return NextResponse.json({ error: "Missing or invalid key." }, { status: 401 });
  if (payload && typeof payload === "object") {
    // The key has done its job; never hand it back out.
    const { key: _k, ...rest } = payload as Record<string, unknown>;
    void _k;
    payload = rest;
  }
  const now = Date.now();
  prune(now);
  const list = inbox.get(key) || [];
  const signal = { id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, receivedAt: now, payload };
  // Re-insert so the most recently used key is last to be evicted.
  inbox.delete(key);
  inbox.set(key, [...list, signal].slice(-PER_KEY));
  return NextResponse.json({ ok: true, id: signal.id });
}

export async function GET(request: Request) {
  const key = keyFrom(request);
  if (!key) return NextResponse.json({ error: "Missing or invalid key." }, { status: 401 });
  const since = Number(new URL(request.url).searchParams.get("since")) || 0;
  const signals = (inbox.get(key) || []).filter((s) => s.receivedAt > since);
  return NextResponse.json({ signals, now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
