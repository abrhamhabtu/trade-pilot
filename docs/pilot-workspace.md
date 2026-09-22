# Pilot account workspace

Pilot lives at `/app/pilot` in `apps/web`. It reads one selected account at a time, including when the global dashboard is in All Accounts mode. Account preferences and trade reviews are stored with the existing account data in IndexedDB (with the application's persistence fallback). No external database migration is needed.

## Workflow

1. Choose an account. Connect/import from Accounts, or use Log a trade for a closed trade.
2. Set personal limits in Automations & rules. Defaults are starter values, not a firm's verified rules.
3. Enable automatic tag/note drafts for that account. The app-shell listener processes initial history, imports, sync results and manual additions while the app is open. It does not run while the app is closed.
4. Use Review trades to prepare drafts manually, even with automations disabled. Choose a historical session, open a trade, edit setup/tags/notes and save the reviewed trade. Existing journal notes are never changed automatically.
5. Your edge compares recorded setups with sample sizes. Setup quality and emotions are never inferred from fills alone.

Draft signatures include the session's input trades and account rules so late imports refresh affected reviews. Replays are idempotent. Editing rules can mark affected reviews for another look; previously accepted journal notes remain intact.

## Model connections

Built-in analysis is deterministic and makes no network calls. Open-ended chat and model-drafted notes use a bring-your-own-key `POST /api/pilot/chat` adapter. Model choices, base URLs and keys persist in this browser's localStorage until the trader clears them.

Supported providers:

- Anthropic (Claude), through the official `@anthropic-ai/sdk`: streaming, adaptive thinking on models that support it, prompt caching of Pilot's stable instructions, and server-side refusal fallbacks (`fallbacks: "default"`) on Claude Opus 5 / Fable 5. Claude's own turns, thinking blocks included, are echoed back unedited.
- OpenAI-compatible chat/completions: OpenRouter, DeepSeek, Kimi, OpenCode Zen, Ollama (`http://127.0.0.1:11434/v1`) and custom endpoints such as LM Studio. A model that rejects tools is retried without them.

### What the model sees

Every question sends a **fact sheet** built by `src/lib/pilot/facts.ts` from the app's own engines: room left to lose, today's stop status, payout readiness, pass odds, the fee ledger, firm rules and fine print (with sources and upcoming tier-1 releases), performance by hour, weekday, setup and symbol, the Coach's findings, copy-trading groups, and the notes the trader asked Pilot to remember. The prompt tells the model to quote these numbers rather than recompute them. The 40 most recent trades go along as raw rows.

### Lookups

The model can call eight read-only lookups (`src/lib/pilot/toolDefs.ts`): `find_trades`, `session_detail`, `stats_by`, `simulate_pass_odds`, `compare_evaluations`, `payout_status`, `firm_rules`, `ledger_detail`. The journal lives in the browser, so the server relays each call and the browser runs it (`src/lib/pilot/tools.ts`) after validating the input against its schema; invalid calls get an error back. Up to six lookup rounds per question. None of them can write a record, place an order or move a stop.

### Streaming protocol

`{ stream: true }` requests get NDJSON back: `{t:"text"}` deltas, `{t:"thinking"}`, then `{t:"done", stop, toolCalls, raw}` or `{t:"error"}`. Requests without `stream` keep the one-shot JSON response used by connection tests and trade-review drafts.

### Memory

Conversations and "Pilot remembers" notes are saved per account in localStorage (`src/lib/pilot/memoryStore.ts`); the oldest chats are dropped first if storage fills. **Remember** keeps an answer's "Do this next" line; **Make it a rule** adds it to Preflight's rules.

Loopback endpoints work only in local development. Custom HTTPS origins must be explicitly listed in the server's comma-separated `PILOT_ALLOWED_ORIGINS` environment variable. No machine-wide API keys or CLI login credentials are read by the adapter. Calls time out after 170 seconds. Provider error bodies are not returned. Redirects are disabled so credentials cannot follow a redirect.

## Data boundaries

Rule observations use the journal's recorded clock and closed-trade P&L. Entry plus duration estimates the close; overlapping positions do not automatically become revenge trades. Missing timestamps skip timing-dependent conclusions. Dates define sessions; normalize imported timezones before relying on timing checks. Cross-midnight positions need explicit close timestamps for fully accurate multi-session checks.

No broker orders or stops are changed. Use the existing Session Planner for sizing. Unrealized P&L, live intraday trailing drawdown and firm-specific restrictions are not verified by this workflow. Model responses cannot mutate the journal; lookups are read-only.

## Verification

- `npx tsc --noEmit`
- Targeted Next ESLint checks on the new Pilot components, engine and route.
- `node --experimental-strip-types --test tests/pilot*.test.mjs` — 15 passing tests, including actual API-route execution with mocked upstream fetches.
- Browser: desktop and 390px layouts, draft creation, editing/saving a demo review, persistence after reload, per-account settings isolation, model selection and setup comparisons.
- No paid live-provider completion was tested; no API key was supplied and no Ollama server was listening locally.

References: [TradeZella feature reference](https://www.tradezella.com/zella-ai), [OpenRouter API](https://openrouter.ai/docs/quickstart), [DeepSeek API](https://api-docs.deepseek.com/), [Kimi API](https://platform.kimi.ai/docs/overview), [OpenCode Zen endpoints](https://opencode.ai/docs/zen/).
