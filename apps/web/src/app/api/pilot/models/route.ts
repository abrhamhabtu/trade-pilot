import { NextResponse } from "next/server";
import {
  providerErrorMessage,
  resolveProviderBase,
  sameOrigin,
} from "@/lib/pilot/proxy";
export const runtime = "nodejs";

/**
 * Lists the chat models the supplied key can reach, so the trader picks from a
 * menu instead of transcribing a model ID. Bring-your-own-key, like the chat
 * proxy: the key is taken from the request and never read from the server.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Same-origin requests only." },
      { status: 403 },
    );
  try {
    const body = JSON.parse(await request.text());
    const { base, headers } = resolveProviderBase(body);
    const response = await fetch(`${base}/models`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok)
      return NextResponse.json(
        { error: providerErrorMessage(response.status) },
        { status: 502 },
      );
    const data = await response.json();
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : [];
    const models = [
      ...new Set(
        list
          .map((m: { id?: unknown; name?: unknown }) =>
            typeof m?.id === "string"
              ? m.id
              : typeof m?.name === "string"
                ? m.name
                : "",
          )
          .filter((id: string) => id && id.length <= 200),
      ),
    ]
      .sort((a, b) => (a as string).localeCompare(b as string))
      .slice(0, 400);
    if (!models.length)
      return NextResponse.json(
        { error: "The provider listed no models. Enter a model ID instead." },
        { status: 502 },
      );
    return NextResponse.json(
      { models },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SyntaxError)
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 },
      );
    if (
      error instanceof TypeError ||
      (error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name))
    )
      return NextResponse.json(
        { error: "Could not reach the provider. Check the endpoint or retry." },
        { status: 502 },
      );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
}
