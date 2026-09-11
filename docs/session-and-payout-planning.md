# Session and payout planning

## Everyday flow

1. In **Accounts → Account health**, enter the remaining platform cushion, your personal daily loss limit, the lower of the firm/personal remaining daily allowances, a reserve, a contract cap for the instrument, and the next payout requirement. Confirm the evaluation/funded stage.
2. In **Session Plan**, choose accounts, setup, stop distance, risk budget, costs, trade limit and finish time. The smallest selected account budget governs every copied account. Unknown/stale limits, inactive accounts and zero affordable contracts return wait/skip.
3. After a completed trade, log it once (not once per partial fill). Refresh snapshots before another sizing decision. Snapshots expire after 30 minutes. The session date and finish time use the device's local calendar, not the exchange trading-day boundary.
4. In **Payout → Build your plan**, compare whole-contract sizes and combined copied exposure. Instruments remember their own stop and size. All controls are saved on this device. The combined income goal is separate from the advanced Account Scaling tool's per-account pull target.
5. **Pressure test** walks through a fixed sequence of wins/losses and a no-trade step. A breached account does not recover in the illustration.
6. **Review a payout** is a manual checklist and cushion-minus-debit estimate. It does not determine firm eligibility or send a withdrawal. Check qualifying days, caps, splits and how withdrawing changes the threshold with the firm itself.

## Important limits

The app is read-only; it does not submit orders, enforce stops, or lock a broker account. Trade sync does not provide live equity, trailing-drawdown limits, open-position exposure or verified payout eligibility. A current manual snapshot is still not live data. Recheck limits in the platform after trades and when changing instruments.

The main payout illustration includes entered per-contract round-trip fees and slippage ticks. Win rate, average reward, frequency, split and cushion are assumptions. It does not model trailing drawdown, survival probability, firm payout caps/eligibility, account/reset/subscription fees or taxes. Its 20-session amount and sessions toward a goal are arithmetic expectancy—not forecasts. Advanced legacy charts are explicitly before-fees models with the configured program drawdown.

## Contract specifications

MNQ $2/point, MES $5/point, MGC $10/point, MYM $0.50/point, M2K $5/point, and MBT $0.10/point. MBT means **CME Micro Bitcoin (0.1 BTC per contract)**, not spot Bitcoin, Coinbase contracts, or standard CME BTC futures. Its minimum price increment is 5 points ($0.50 per contract). Firm support must be checked independently.

Sources checked September 8, 2026: [CME equity micro specifications](https://www.cmegroup.com/articles/faqs/micro-e-mini-equity-index-futures-frequently-asked-questions.html), [CME Micro Gold](https://www.cmegroup.com/education/lessons/micro-gold-and-micro-silver-futures-product-overview), [CME Micro Bitcoin](https://www.cmegroup.com/education/lessons/micro-bitcoin-futures-product-overview).

## Verification

Run `npx tsc --noEmit`, `npx next lint`, and `node --experimental-strip-types --test tests/*.test.mjs` from `apps/web`. Browser checks cover snapshot persistence, sizing, post-trade refresh, withdrawal warnings, account switching, instrument settings, and narrow layouts. No live brokerage access is required for these tests.

For a local machine short on disk, `TRADEPILOT_LOW_DISK=1 npm run dev` disables development webpack caching. Generated `.next` files can be rebuilt; account data lives in browser storage, not that directory.
