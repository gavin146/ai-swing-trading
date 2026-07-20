# Copilot Data Accuracy Repair

Date: 2026-07-19
Branch: `codex/copilot-stabilization`

## Scope

Completed repair prompt 14 from `repairprompts#3.md`.

This task tightened deterministic Copilot data handling so missing values, stale quotes, incomplete plans, and same-symbol evidence cannot produce misleading customer-facing conclusions.

## Files Changed

- `components/CopilotPanel.tsx`
- `lib/copilot/formatting.ts`
- `lib/copilot/email.ts`
- `lib/copilot/reporting.ts`
- `lib/copilot/ui-view-model.ts`
- `lib/copilot/manual-portfolio-provider.ts`
- `lib/copilot/data-freshness.ts`
- `lib/copilot/portfolio-analyzer.ts`
- `tests/copilot-data-accuracy.test.ts`
- `tests/copilot-manual-provider.test.ts`
- `tests/tsconfig.copilot.json`
- `package.json`
- `docs/codex-handoffs/15-copilot-data-accuracy-repair.md`

## Repairs

- Added `formatCopilotMoney()` so `null`, `undefined`, empty strings, and non-finite values render as `Unknown` or `unknown`, not `$0.00`.
- Updated Copilot web UI, email digest, and deterministic report narration to use the safe formatter.
- Updated position status logic so stale, missing, or errored quotes show refresh-needed states before price/target/stop comparisons.
- Updated analyzer logic so price-plan conclusions require a fresh quote with a real `dataAsOf` timestamp.
- Added long-only plan validation: entry, target, and stop must be positive and finite; stop must be below entry; entry must be below target.
- Invalid plans now produce `NO_ACTIVE_SWINGFI_PLAN` and cannot produce target, stop, inside-plan, or reward/risk conclusions.
- Fixed `DataFreshnessService` to keep the worst source status and matching timestamp/message deterministically, independent of position order.
- Updated the FMP manual quote adapter so profile prices without a market timestamp are marked stale, with `fetchedAt` kept separate from `dataAsOf`.
- Fixed sector concentration IDs so multiple concentrated sectors produce distinct stable findings.
- Fixed position-evidence matching so `positionId` or `sourceTradeHistoryId` evidence cannot leak onto another same-symbol position. Symbol-only fallback applies only when no trade/position scope is supplied.

## Regression Tests Added

- Missing money values do not format as `$0.00`.
- Missing current price, entry, target, stop, market value, and account value remain unavailable in UI/report/email output.
- Stale quotes cannot create target/stop/inside-plan findings or card statuses.
- Fresh quotes without market timestamps are not used for valuation.
- Data freshness aggregation is worst-status and order independent.
- FMP profile quote timestamps are not invented.
- Multiple sector concentration findings keep distinct IDs.
- Trade-specific evidence does not attach to another same-symbol position.
- Invalid long-only saved plans block target/stop/reward-risk conclusions.

## Verification

- `npm run test:copilot` passed during development.

Full serial verification should be run before commit:

- `npm run test:copilot`
- `npm run test:security`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Safety Notes

- No SwingFi ranking/scoring algorithm was changed.
- No OpenAI narration was enabled.
- No brokerage SDK, account connection, order execution, or trading route was added.
- No deployment was performed.
