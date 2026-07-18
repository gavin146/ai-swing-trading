# Codex Handoff: Portfolio Analyzer

Date: 2026-07-17

## Task

Implement a pure deterministic `PortfolioAnalyzer` for SwingFi Copilot.

## Files Changed

- `lib/copilot/portfolio-analyzer.ts`
- `tests/copilot-portfolio-analyzer.test.ts`
- `tests/tsconfig.copilot.json`
- `package.json`
- `docs/copilot/PORTFOLIO_FINDING_RULES.md`
- `docs/codex-handoffs/05-portfolio-analyzer.md`

## Implementation Summary

- Added `PortfolioAnalyzer` and `analyzePortfolio()`.
- Added structured finding types:
  - `DATA_STALE`
  - `QUOTE_UNAVAILABLE`
  - `NO_ACTIVE_SWINGFI_PLAN`
  - `NEAR_STOP`
  - `BELOW_OR_AT_STOP`
  - `NEAR_TARGET`
  - `AT_OR_ABOVE_TARGET`
  - `PROFIT_REVIEW_ZONE`
  - `HOLDING_WINDOW_EXPIRING`
  - `HOLDING_WINDOW_EXPIRED`
  - `POSITION_CONCENTRATION`
  - `SECTOR_CONCENTRATION`
  - `EARNINGS_OR_EVENT_RISK`
  - `FILING_OR_HEADLINE_RISK`
  - `TREND_WEAKENING`
  - `MOMENTUM_IMPROVING`
  - `REMAINING_REWARD_RISK_WEAK`
  - `INSIDE_ORIGINAL_PLAN`
- Added deterministic finding ids and rule version `portfolio-analyzer.v1`.
- Added configurable threshold validation with safe defaults.
- Added injected clock support.
- Added conflict suppression and deterministic sorting.
- Kept all calculations pure and based only on supplied `PortfolioSnapshot` and structured evidence.

## Safety Boundaries

- No OpenAI calls.
- No FMP calls.
- No Supabase calls.
- No brokerage API calls.
- No network calls.
- No brokerage SDKs.
- No order placement or live trading.
- No direct "buy now" or "sell now" language.
- No guaranteed-return language.

## Tests Added

`tests/copilot-portfolio-analyzer.test.ts` covers:

- exactly at stop
- just above stop
- exactly at target
- just below target
- zero/negative/invalid inputs
- unknown quantity/value
- stale versus fresh quote
- missing plan
- expired holding window
- concentration with incomplete totals
- sector concentration with partial sector/value data
- conflicting target and stale-data states
- deterministic ordering
- injected clock behavior
- no banned language in output
- no network/OpenAI/provider dependency

`npm run test:copilot` now runs the core, manual provider, and analyzer test files.

## Policy Decisions

- Price-based target/stop/reward-risk findings do not run when the quote is stale or unavailable.
- Missing values are treated as unavailable, not zero.
- Position concentration requires an explicit known total portfolio value.
- Sector concentration uses only positions with both known sector and known market value.
- `TREND_WEAKENING` takes priority over `MOMENTUM_IMPROVING` when both are implied by supplied evidence.
- The analyzer assumes long swing-trade plans because current SwingFi tracked trades are modeled with one target above entry and one stop below entry.

## Verification

- `npm run test:copilot`
  - Result: passed.
  - Output: `Copilot core contract tests passed.`, `Copilot manual portfolio provider tests passed.`, and `Copilot portfolio analyzer tests passed.`
- `npm run typecheck`
  - Result: passed.
  - Output: `tsc --noEmit`.
- `npm run lint`
  - Result: passed.
  - Output: `eslint .`.
- `npm run verify`
  - Result: passed.
  - Output: `npm run lint && npm run typecheck && npm run build`.
  - Build result: Next.js 15.5.19 compiled successfully and generated 24 static pages.

## Recommended Next PR

Build a server-only Copilot report builder that combines:

- `ManualPortfolioReadProvider`
- `PortfolioAnalyzer`
- existing portfolio digest context
- optional AI narration that explains, but does not calculate, the deterministic findings
