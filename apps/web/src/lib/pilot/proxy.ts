import { PROVIDERS, type Provider } from "@/lib/pilot/models";

/**
 * Server-side validation for the bring-your-own-key model proxy.
 * Resolves { provider, baseUrl, apiKey } to the provider's API base and auth
 * header, without requiring a model ID. Throws with a user-facing message.
 */
export function resolveProviderBase(body: {
  provider?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
}) {
  if (
    typeof body.provider !== "string" ||
    !Object.hasOwn(PROVIDERS, body.provider) ||
    body.provider === "local"
  )
    throw new Error("Choose a model provider.");
  const provider = body.provider as Provider;
  if (typeof body.apiKey !== "string" || body.apiKey.length > 4096)
    throw new Error("Invalid API key.");
  const url = new URL(
    provider === "custom" ? String(body.baseUrl) : PROVIDERS[provider].url,
  );
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const customOrigins = (process.env.PILOT_ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim());
  if (url.username || url.password || url.search || url.hash)
    throw new Error("Use a base URL without credentials, query or fragment.");
  if (loopback) {
    if (process.env.NODE_ENV === "production")
      throw new Error(
        "Local model endpoints are available in local development only.",
      );
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Use an HTTP endpoint.");
  } else if (
    url.protocol !== "https:" ||
    (provider === "custom" && !customOrigins.includes(url.origin))
  ) {
    throw new Error(
      "Enable this HTTPS origin in PILOT_ALLOWED_ORIGINS on the server first.",
    );
  }
  if (!loopback && !body.apiKey.trim())
    throw new Error("Enter your provider API key.");
  return {
    base: url.toString().replace(/\/$/, ""),
    headers: {
      "Content-Type": "application/json",
      ...(body.apiKey ? { Authorization: `Bearer ${body.apiKey}` } : {}),
    } as Record<string, string>,
  };
}

/**
 * The chat/completions endpoint, auth header and model ID for a request body
 * carrying { provider, model, baseUrl, apiKey }.
 */
export function resolveModelEndpoint(body: {
  provider?: unknown;
  model?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
}) {
  if (
    typeof body.model !== "string" ||
    !body.model.trim() ||
    body.model.length > 200
  )
    throw new Error("Enter a valid model ID.");
  const { base, headers } = resolveProviderBase(body);
  return {
    endpoint: `${base}/chat/completions`,
    headers,
    model: body.model.trim(),
  };
}

export function providerErrorMessage(status: number) {
  return status === 401 || status === 403
    ? "Provider rejected the API key or model access."
    : status === 429
      ? "Provider rate limit or credit limit reached. Try again later."
      : `Provider returned ${status}. Check the model ID and endpoint compatibility.`;
}

/**
 * True when the request comes from this app's own pages.
 *
 * Compares the Origin header against the host the request actually arrived on.
 * `request.url` is not usable here: the Next dev server reports it as
 * `localhost` whatever host header the browser sent, so an app opened on
 * 127.0.0.1 would reject its own requests.
 */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
