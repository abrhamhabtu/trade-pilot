// Server-only: one streamed turn against an OpenAI-compatible chat/completions
// endpoint (OpenRouter, DeepSeek, Kimi, OpenCode Zen, Ollama, custom).

import type { ChatTurn, StreamEvent, ToolCall } from '@/lib/pilot/chatTypes';
import type { ToolDef } from '@/lib/pilot/toolDefs';
import { providerErrorMessage } from '@/lib/pilot/proxy';

export function toOpenAIMessages(system: string, turns: ChatTurn[]) {
  return [
    { role: 'system', content: system },
    ...turns.map((t) =>
      t.role === 'tool'
        ? { role: 'tool', tool_call_id: t.toolCallId, content: t.content }
        : t.role === 'assistant'
          ? {
              role: 'assistant',
              content: t.content || null,
              ...(t.toolCalls?.length
                ? {
                    tool_calls: t.toolCalls.map((c) => ({
                      id: c.id,
                      type: 'function',
                      function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) },
                    })),
                  }
                : {}),
            }
          : { role: 'user', content: t.content },
    ),
  ];
}

/** Parses one SSE `data:` payload's delta into text and tool-call fragments. */
export function readDelta(
  payload: unknown,
  calls: Map<number, { id: string; name: string; args: string }>,
): { text: string; thinking: boolean; finish: string | null } {
  const choice = (payload as { choices?: { delta?: Record<string, unknown>; finish_reason?: string | null }[] })?.choices?.[0];
  const delta = choice?.delta ?? {};
  const text = typeof delta.content === 'string' ? delta.content : '';
  const thinking = typeof delta.reasoning_content === 'string' || typeof delta.reasoning === 'string';
  for (const tc of (delta.tool_calls as { index?: number; id?: string; function?: { name?: string; arguments?: string } }[]) ?? []) {
    const i = tc.index ?? 0;
    const cur = calls.get(i) ?? { id: '', name: '', args: '' };
    if (tc.id) cur.id = tc.id;
    if (tc.function?.name) cur.name += tc.function.name;
    if (tc.function?.arguments) cur.args += tc.function.arguments;
    calls.set(i, cur);
  }
  return { text, thinking, finish: choice?.finish_reason ?? null };
}

export async function streamOpenAITurn(args: {
  endpoint: string;
  headers: Record<string, string>;
  model: string;
  system: string;
  turns: ChatTurn[];
  tools: ToolDef[];
  emit: (e: StreamEvent) => void;
  signal: AbortSignal;
}) {
  const send = (withTools: boolean) =>
    fetch(args.endpoint, {
      method: 'POST',
      headers: args.headers,
      body: JSON.stringify({
        model: args.model,
        messages: toOpenAIMessages(args.system, args.turns),
        stream: true,
        ...(withTools
          ? { tools: args.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) }
          : {}),
      }),
      signal: args.signal,
      redirect: 'error',
      cache: 'no-store',
    });

  // Some models reject tools outright; answer without lookups rather than fail.
  let response = await send(true);
  if (response.status === 400 || response.status === 422) response = await send(false);
  if (!response.ok || !response.body) {
    args.emit({ t: 'error', v: providerErrorMessage(response.status) });
    return;
  }

  const calls = new Map<number, { id: string; name: string; args: string }>();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finish = 'stop';
  let saidThinking = false;
  let wroteText = false;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, '');
      if (!line.trim().startsWith('data:') || !data || data === '[DONE]') continue;
      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }
      const d = readDelta(payload, calls);
      if (d.thinking && !saidThinking && !wroteText) {
        saidThinking = true;
        args.emit({ t: 'thinking' });
      }
      if (d.text) {
        wroteText = true;
        args.emit({ t: 'text', v: d.text });
      }
      if (d.finish) finish = d.finish;
    }
  }

  const toolCalls: ToolCall[] = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, c]) => c.name)
    .map(([i, c]) => {
      let input: unknown;
      try {
        input = c.args ? JSON.parse(c.args) : {};
      } catch {
        // Kept as-is so the browser's validation answers it with an error the model can fix.
        input = { unparseable_arguments: c.args.slice(0, 500) };
      }
      return { id: c.id || `call_${i}`, name: c.name, input };
    });

  if (finish === 'length' && toolCalls.length) {
    args.emit({ t: 'error', v: 'The answer ran out of room mid-lookup. Ask a narrower question.' });
    return;
  }
  if (!wroteText && !toolCalls.length) {
    args.emit({
      t: 'error',
      v: saidThinking
        ? 'The model reasoned but never wrote an answer. Pick a non-thinking chat model, or lower its reasoning effort.'
        : 'The provider returned no text. Try another chat model.',
    });
    return;
  }
  args.emit({ t: 'done', stop: toolCalls.length ? 'tool_use' : finish, toolCalls });
}
