// Server-only: Pilot's Claude provider, through the official Anthropic SDK.
// Bring-your-own-key like every other provider: the key arrives with the
// request and is never read from the server's environment.

import Anthropic from '@anthropic-ai/sdk';
import type { ChatTurn, StreamEvent, ToolCall } from '@/lib/pilot/chatTypes';
import type { ToolDef } from '@/lib/pilot/toolDefs';

/** Default when a key can reach it: Anthropic's recommended general model. */
export const CLAUDE_DEFAULT_MODEL = 'claude-opus-5';

export function claudeClient(apiKey: string) {
  // No environment fallback: an empty key must fail, not borrow the server's.
  return new Anthropic({ apiKey, authToken: null, maxRetries: 1, timeout: 170_000 });
}

/**
 * Per-model request options. Adaptive thinking on the models that take it
 * (anything else would 400), and server-side refusal fallbacks on the models
 * whose safety classifiers can decline a request, so a decline is re-run on
 * Anthropic's recommended fallback instead of ending the answer.
 */
export function claudeOptions(model: string) {
  const adaptive = /^claude-(opus-(5|4-[678])|fable|mythos|sonnet-(5|4-6))/.test(model);
  const fallback = /^claude-(opus-5|fable-5)/.test(model);
  return {
    ...(adaptive ? { thinking: { type: 'adaptive' as const } } : {}),
    ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  };
}

/** A trader-readable message for an SDK error. Typed, most specific first. */
export function claudeErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError)
    return 'Anthropic rejected the API key or model access.';
  if (error instanceof Anthropic.NotFoundError) return 'That Claude model ID was not found for this key.';
  if (error instanceof Anthropic.RateLimitError) return 'Anthropic rate limit or credit limit reached. Try again later.';
  if (error instanceof Anthropic.BadRequestError) return 'Anthropic rejected the request. Try another Claude model.';
  if (error instanceof Anthropic.APIConnectionError) return 'Could not reach Anthropic. Check your connection and retry.';
  if (error instanceof Anthropic.APIError) return `Anthropic returned ${error.status ?? 'an error'}. Try again.`;
  return 'The Claude request failed.';
}

export async function listClaudeModels(apiKey: string): Promise<string[]> {
  const ids: string[] = [];
  for await (const m of claudeClient(apiKey).models.list({ limit: 100 })) ids.push(m.id);
  // The recommended default first, so the picker lands on it.
  return ids.sort((a, b) => Number(b === CLAUDE_DEFAULT_MODEL) - Number(a === CLAUDE_DEFAULT_MODEL) || a.localeCompare(b));
}

/** Pilot's conversation, in Messages API shape. Claude's own turns go back exactly as returned. */
export function toClaudeMessages(turns: ChatTurn[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  let results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
  const flush = () => {
    if (results.length) out.push({ role: 'user', content: results });
    results = [];
  };
  for (const turn of turns) {
    if (turn.role === 'tool') {
      results.push({ type: 'tool_result', tool_use_id: turn.toolCallId, content: turn.content, is_error: turn.isError || undefined });
      continue;
    }
    flush();
    if (turn.role === 'user') {
      out.push({ role: 'user', content: turn.content });
    } else if (turn.raw && turn.provider === 'anthropic') {
      out.push({ role: 'assistant', content: turn.raw as Anthropic.Beta.BetaContentBlockParam[] });
    } else {
      const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (turn.content) blocks.push({ type: 'text', text: turn.content });
      for (const c of turn.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.input as Record<string, unknown> });
      if (blocks.length) out.push({ role: 'assistant', content: blocks });
    }
  }
  flush();
  return out;
}

/**
 * One model turn, streamed. Text deltas go out as they arrive; the turn ends
 * with the stop reason, any tool calls for the browser to run, and the raw
 * content to echo back. A tool input that could not be parsed is re-issued
 * once; API errors are not retried here.
 */
export async function streamClaudeTurn(args: {
  apiKey: string;
  model: string;
  stableSystem: string;
  context: string;
  turns: ChatTurn[];
  tools: ToolDef[];
  emit: (e: StreamEvent) => void;
  signal: AbortSignal;
}) {
  const client = claudeClient(args.apiKey);
  const params = {
    model: args.model,
    max_tokens: 64000,
    ...claudeOptions(args.model),
    // Stable instructions first and cached; the per-request fact sheet after.
    system: [
      { type: 'text' as const, text: args.stableSystem, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: args.context },
    ],
    tools: args.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
      eager_input_streaming: true,
    })),
    messages: toClaudeMessages(args.turns),
  };

  for (let attempt = 0; ; attempt++) {
    let sentText = false;
    const stream = client.beta.messages.stream(params, { signal: args.signal });
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_start' && event.content_block.type === 'thinking') args.emit({ t: 'thinking' });
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          sentText = true;
          args.emit({ t: 'text', v: event.delta.text });
        }
      }
      const message = await stream.finalMessage();
      const toolCalls: ToolCall[] = message.content
        .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
        .map((b) => ({ id: b.id, name: b.name, input: b.input }));

      if (message.stop_reason === 'refusal') {
        args.emit({ t: 'error', v: 'Claude declined to answer that. Try rephrasing the question.' });
        return;
      }
      // A tool input cut off at the output limit can still look valid; never run it.
      if (message.stop_reason === 'max_tokens' && toolCalls.length) {
        args.emit({ t: 'error', v: 'The answer ran out of room mid-lookup. Ask a narrower question.' });
        return;
      }
      args.emit({ t: 'done', stop: message.stop_reason ?? 'end_turn', toolCalls, raw: message.content as unknown[] });
      return;
    } catch (error) {
      // With eager input streaming, an unparseable tool input rejects the
      // final message. Re-issue that once, before any text reached the trader.
      const apiError = error instanceof Anthropic.APIError || error instanceof Anthropic.APIUserAbortError;
      if (!apiError && !sentText && attempt < 1 && !args.signal.aborted) continue;
      throw error;
    }
  }
}

/** A single non-streamed-to-the-browser answer, for connection tests and Playbook drafts. */
export async function completeClaude(args: {
  apiKey: string;
  model: string;
  system: string;
  content: string | Anthropic.Beta.BetaContentBlockParam[];
  signal?: AbortSignal;
}): Promise<string> {
  const stream = claudeClient(args.apiKey).beta.messages.stream(
    {
      model: args.model,
      max_tokens: 16000,
      ...claudeOptions(args.model),
      system: args.system,
      messages: [{ role: 'user', content: args.content }],
    },
    { signal: args.signal },
  );
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error('Claude declined to answer that.');
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}
