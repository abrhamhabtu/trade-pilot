import { NextResponse } from "next/server";
import {
  providerErrorMessage,
  resolveModelEndpoint,
  resolveProviderBase,
  sameOrigin,
} from "@/lib/pilot/proxy";
import { PILOT_SYSTEM, contextBlock } from "@/lib/pilot/prompt";
import { PILOT_TOOLS } from "@/lib/pilot/toolDefs";
import type { ChatTurn, StreamEvent } from "@/lib/pilot/chatTypes";
import { streamOpenAITurn } from "@/lib/pilot/openaiStream";
export const runtime = "nodejs";

const MAX_BODY = 600000;

/**
 * Validates a tool-calling conversation. Assistant turns may carry tool calls
 * (and, from Claude, the raw blocks to echo back); tool turns carry results.
 */
function validTurns(turns: unknown): turns is ChatTurn[] {
  if (!Array.isArray(turns) || turns.length < 1 || turns.length > 120) return false;
  const tools = new Set(PILOT_TOOLS.map((t) => t.name));
  return turns.every((t: Record<string, unknown>) => {
    if (t?.role === "user") return typeof t.content === "string" && t.content.length <= 6000;
    if (t?.role === "tool")
      return typeof t.toolCallId === "string" && t.toolCallId.length <= 200 && typeof t.content === "string" && t.content.length <= 14000;
    if (t?.role === "assistant")
      return (
        typeof t.content === "string" &&
        t.content.length <= 30000 &&
        (t.toolCalls === undefined ||
          (Array.isArray(t.toolCalls) &&
            t.toolCalls.length <= 8 &&
            t.toolCalls.every((c: Record<string, unknown>) => typeof c?.id === "string" && tools.has(String(c?.name))))) &&
        (t.raw === undefined || Array.isArray(t.raw))
      );
    return false;
  });
}

/** Streams one model turn to the browser as NDJSON events. */
async function streamTurn(body: Record<string, unknown>, request: Request) {
  if (!validTurns(body.messages)) throw new Error("Invalid conversation.");
  const turns = body.messages;
  const context = contextBlock(body.context);
  const provider = String(body.provider);
  // Validate provider, key and endpoint before opening the stream.
  const openai = provider === "anthropic" ? null : resolveModelEndpoint(body);
  if (provider === "anthropic") {
    resolveProviderBase(body);
    if (typeof body.model !== "string" || !body.model.trim() || body.model.length > 200) throw new Error("Enter a valid model ID.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: StreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(170000)]);
      try {
        if (provider === "anthropic") {
          const { streamClaudeTurn, claudeErrorMessage } = await import("@/lib/pilot/claude");
          try {
            await streamClaudeTurn({
              apiKey: String(body.apiKey),
              model: String(body.model).trim(),
              stableSystem: PILOT_SYSTEM,
              context,
              turns,
              tools: PILOT_TOOLS,
              emit,
              signal,
            });
          } catch (error) {
            if (!signal.aborted) emit({ t: "error", v: claudeErrorMessage(error) });
          }
        } else {
          await streamOpenAITurn({
            endpoint: openai!.endpoint,
            headers: openai!.headers,
            model: openai!.model,
            system: `${PILOT_SYSTEM}\n${context}`,
            turns,
            tools: PILOT_TOOLS,
            emit,
            signal,
          });
        }
      } catch (error) {
        if (!signal.aborted)
          emit({
            t: "error",
            v:
              error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
                ? "The model took too long. Retry, or pick a faster model."
                : "Could not reach the model. Check the endpoint or retry.",
          });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}


/**
 * The assistant text from one completion choice. Providers disagree on shape:
 * a plain string, or an array of content parts. `reasoning_content` is
 * deliberately not read here — it is the model's private scratchpad, and
 * showing it to a trader as coaching would be worse than showing nothing.
 */
function completionText(choice: unknown): string {
  const message = (choice as { message?: Record<string, unknown> })?.message;
  const content = message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((part) =>
              typeof part === "string"
                ? part
                : typeof (part as { text?: unknown })?.text === "string"
                  ? (part as { text: string }).text
                  : "",
            )
            .join("")
        : "";
  return text.trim();
}

/** True when the model produced only its private scratchpad and no answer. */
function reasonedWithoutAnswering(choice: unknown): boolean {
  const message = (choice as { message?: Record<string, unknown> })?.message;
  const reasoning = message?.reasoning_content ?? message?.reasoning;
  return typeof reasoning === "string" && !!reasoning.trim();
}

/** The plain user/assistant transcript the one-shot path accepts. */
function validPlainMessages(messages: unknown): messages is { role: "user" | "assistant"; content: string }[] {
  return (
    Array.isArray(messages) &&
    messages.length >= 1 &&
    messages.length <= 16 &&
    messages.every(
      (m: { role?: string; content?: string }) =>
        ["user", "assistant"].includes(m?.role || "") && typeof m.content === "string" && m.content.length <= 6000,
    )
  );
}

/** One-shot answer from Claude, for connection tests and older callers. */
async function claudeOnce(body: Record<string, unknown>) {
  resolveProviderBase(body);
  if (typeof body.model !== "string" || !body.model.trim() || body.model.length > 200) throw new Error("Enter a valid model ID.");
  if (!validPlainMessages(body.messages)) throw new Error("Invalid conversation.");
  const { completeClaude, claudeErrorMessage } = await import("@/lib/pilot/claude");
  const last = body.messages.at(-1)!;
  try {
    const text = await completeClaude({
      apiKey: String(body.apiKey),
      model: body.model.trim(),
      system: `${PILOT_SYSTEM}\n${contextBlock(body.context)}`,
      content: last.content,
      signal: AbortSignal.timeout(170000),
    });
    if (!text) return NextResponse.json({ error: "Claude returned no text. Try again." }, { status: 502 });
    return NextResponse.json({ text: text.slice(0, 20000) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message.startsWith("Claude declined") ? error.message : claudeErrorMessage(error) }, { status: 502 });
  }
}

export async function POST(request: Request) {
  // This is a bring-your-own-key proxy. Never borrow machine credentials.
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Same-origin requests only." },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY)
      return NextResponse.json(
        { error: "This conversation is too long. Start a new chat." },
        { status: 413 },
      );
    const body = JSON.parse(raw);
    if (body.stream === true) return await streamTurn(body, request);
    if (body.provider === "anthropic") return await claudeOnce(body);
    const { endpoint, headers, model } = resolveModelEndpoint(body);
    if (!validPlainMessages(body.messages)) throw new Error("Invalid conversation.");
    const system = `${PILOT_SYSTEM}\n${contextBlock(body.context)}`;
    const response = await fetch(
      endpoint,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, ...body.messages],
          stream: false,
          // No max_tokens: thinking models spend the budget reasoning before
          // they write anything, so any cap we invent here truncates them into
          // returning an empty answer. Provider defaults size this correctly
          // (DeepSeek: 8K not thinking, 64K thinking). The reply is capped by
          // character count below instead.
        }),
        signal: AbortSignal.timeout(120000),
        redirect: "error",
        cache: "no-store",
      },
    );
    if (!response.ok)
      return NextResponse.json(
        {
          error: providerErrorMessage(response.status),
        },
        { status: 502 },
      );
    const data = await response.json();
    const text = completionText(data?.choices?.[0]);
    if (!text)
      return NextResponse.json(
        {
          error: reasonedWithoutAnswering(data?.choices?.[0])
            ? "The model reasoned but never wrote an answer. Pick a non-thinking chat model, or lower this model's reasoning effort."
            : data?.choices?.[0]?.finish_reason === "length"
              ? "The model used its whole output budget before answering. Ask a narrower question, or pick a non-reasoning chat model."
              : "The provider returned no text. Try another chat model.",
        },
        { status: 502 },
      );
    return NextResponse.json(
      { text: text.slice(0, 20000) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
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
        { error: "Could not reach the model. Check the endpoint or retry." },
        { status: 502 },
      );
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
