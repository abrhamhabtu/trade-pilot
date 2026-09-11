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

Built-in analysis is deterministic and makes no network calls. Open-ended chat and model-drafted notes use a bring-your-own-key `POST /api/pilot/chat` adapter. Model choices and base URLs persist in localStorage; API keys stay in React memory and disappear on reload. Messages remain in memory. Changing accounts resets the conversation.

Supported chat/completions endpoints:

- OpenRouter: `https://openrouter.ai/api/v1`
- DeepSeek: `https://api.deepseek.com`
- Kimi: `https://api.moonshot.ai/v1`
- OpenCode Zen: `https://opencode.ai/zen/v1` (choose a chat/completions model; Zen's Responses/Messages-only models are not handled by this adapter)
- Ollama: `http://127.0.0.1:11434/v1`
- Custom: an OpenAI-compatible base URL; for example LM Studio at `http://127.0.0.1:1234/v1`

Use an exact model ID available to your provider account and Test connection. The test sends only a connection prompt. Coaching sends at most the most recent 100 trades from the selected account, recorded notes, and configured rules. Calls time out after 60 seconds; errors appear in the UI. Provider error bodies are not returned. Redirects are disabled so credentials cannot follow a redirect.

Loopback endpoints work only in local development. Custom HTTPS origins must be explicitly listed in the server's comma-separated `PILOT_ALLOWED_ORIGINS` environment variable. No machine-wide API keys or CLI login credentials are read by the adapter. Native Codex/ChatGPT OAuth and the OpenCode agent server are not integrated; OpenCode Zen API access is distinct from an OpenCode CLI login.

## Data boundaries

Rule observations use the journal's recorded clock and closed-trade P&L. Entry plus duration estimates the close; overlapping positions do not automatically become revenge trades. Missing timestamps skip timing-dependent conclusions. Dates define sessions; normalize imported timezones before relying on timing checks. Cross-midnight positions need explicit close timestamps for fully accurate multi-session checks.

No broker orders or stops are changed. Use the existing Session Planner for sizing. Unrealized P&L, live intraday trailing drawdown and firm-specific restrictions are not verified by this workflow. Model responses are plain text and cannot mutate the journal or execute tools.

## Verification

- `npx tsc --noEmit`
- Targeted Next ESLint checks on the new Pilot components, engine and route.
- `node --experimental-strip-types --test tests/pilot*.test.mjs` — 15 passing tests, including actual API-route execution with mocked upstream fetches.
- Browser: desktop and 390px layouts, draft creation, editing/saving a demo review, persistence after reload, per-account settings isolation, model selection and setup comparisons.
- No paid live-provider completion was tested; no API key was supplied and no Ollama server was listening locally.

References: [TradeZella feature reference](https://www.tradezella.com/zella-ai), [OpenRouter API](https://openrouter.ai/docs/quickstart), [DeepSeek API](https://api-docs.deepseek.com/), [Kimi API](https://platform.kimi.ai/docs/overview), [OpenCode Zen endpoints](https://opencode.ai/docs/zen/).
