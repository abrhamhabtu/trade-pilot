// The conversation as Pilot keeps it, independent of which provider answers.
// Assistant turns from Claude carry `raw`: the exact content blocks it returned
// (thinking signatures included). Those go back verbatim on the next request,
// because Claude's reasoning continuity depends on an unedited history.

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export type ChatTurn =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[]; raw?: unknown[]; provider?: string }
  | { role: 'tool'; toolCallId: string; name: string; content: string; isError?: boolean };

/** One line of the NDJSON stream from /api/pilot/chat. */
export type StreamEvent =
  | { t: 'text'; v: string }
  | { t: 'thinking' }
  | { t: 'done'; stop: string; toolCalls: ToolCall[]; raw?: unknown[] }
  | { t: 'error'; v: string };
