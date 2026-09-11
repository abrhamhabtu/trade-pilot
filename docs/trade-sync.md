# Personal trade connections

Open Accounts → Set up a connection in the local app on port 4040. Connections are opt-in and do not send orders.

## Topstep

Choose Topstep and use your TopstepX username and firm-issued API key. After authentication, choose a history start before the first opening trade and link the returned account. The importer creates a separate local account so existing CSV data is not counted twice. Enable automatic sync after checking the first import against the platform.

## Lucid and Top One using Tradovate

Choose the firm, then the simulation or live environment matching the account. Supply a registered app ID, API CID and API secret along with the Tradovate login. Direct API authorization must cover that login. TradingView or NinjaTrader access alone does not establish API eligibility. If the API settings are unavailable for a prop login, the next dependency is provider-authorized API access or an approved third-party integration; this app cannot grant that entitlement. Do not use another app's client credentials.

The connector reads account positions, fill pairs, executions, contract/product metadata and execution fees. USD futures only. Available history is determined by the platform's entity endpoints; older history may require CSV backfill. Imports currently stop above 400 executions in the requested window to bound local request volume. Partial exits are individual records. All timestamps are UTC, not an exchange-session date conversion. Reconcile initial totals and grouping before relying on derived statistics.

## Sessions and refresh

- Passwords and API secrets are sent only to the selected provider for authentication, never persisted in account data or backups. Provider session tokens are HTTP-only, SameSite=Strict cookies limited to the connector route and one hour. Tokens may have broader upstream permissions; the implemented connector only calls read endpoints after authentication.
- Automatic refresh runs while the app is visible: TopstepX once a minute, Tradovate once every five minutes. There is no background service after the app closes. Reconnect when a session expires.
- The development server binds to loopback. Connector routes reject other origins and are disabled in production builds until application authentication is implemented. This is a personal local connector, not a hosted multi-user integration.
- Each refresh matches provider record IDs, preserves journal annotations, updates corrections, and removes only explicitly voided records. Omitted older records are retained. A failed response leaves existing history intact.
- API balances are not imported as trading profit. Local balance remains net imported P&L plus the user's recorded adjustments.
- Live login, entitlement, provider retention and full reconciliation still need validation with the user's authorized account. Fixture tests are not evidence of a live connection.

## Sources checked September 8, 2026

- [TopstepX API access](https://help.topstep.com/en/articles/11187768-topstepx-api-access)
- [ProjectX API-key authentication](https://gateway.docs.projectx.com/docs/getting-started/authenticate/authenticate-api-key/)
- [ProjectX trade search and execution schema](https://gateway.docs.projectx.com/docs/api-reference/trade/trade-search/)
- [Tradovate API and schemas](https://api.tradovate.com/)
- [Tradovate official JavaScript access tutorial](https://github.com/tradovate/example-api-js/tree/main/tutorial/Access)
- [Tradovate access requirements](https://tradovate.zendesk.com/hc/en-us/articles/4403105829523-How-Do-I-Get-Access-to-the-Tradovate-API)
- [Lucid supported platforms](https://support.lucidtrading.com/en/articles/11404614-lucid-trading-supported-platforms)
- [Top One Tradovate setup](https://help.toponefutures.com/en/articles/12828004-getting-started-your-first-tradovate-account-with-top-one-futures-and-how-to-log-in-to-the-platform)

## Checks

From `apps/web`, use `npx tsc --noEmit`, `npx next lint`, and `node --experimental-strip-types --test tests/*.test.mjs` (Node 22.22+).

The Patience Planner illustrates expectancy and a fixed-cushion stress sequence; it does not model live trailing drawdown or establish payout eligibility. Its assumptions are editable and separate from actual account balances. Saved firm presets must be confirmed against the current program rules.
