# Copilot Owner Preview Access Repair

Date: 2026-07-19
Branch: `codex/copilot-stabilization`

## Scope

Completed repair prompt 12 from `repairprompts#3.md`.

This change keeps SwingFi Copilot behind the existing `COPILOT_ENABLED` feature gate and adds a stricter server-side owner preview gate before the report route loads manual portfolio rows, quote data, or latest research opportunities.

## Files Changed

- `app/api/copilot/report/route.ts`
- `components/AppShell.tsx`
- `components/CopilotPanel.tsx`
- `lib/copilot/manual-portfolio-provider.ts`
- `lib/copilot/preview-access.ts`
- `tests/copilot-manual-provider.test.ts`
- `tests/copilot-preview-access.test.ts`
- `tests/tsconfig.copilot.json`
- `package.json`

## Behavior

- `COPILOT_PREVIEW_EMAILS` is now the canonical server-side allowlist for the Copilot preview.
- If `COPILOT_PREVIEW_EMAILS` is unset, only `gavin@onefear.co` is allowed.
- The preview allowlist uses only the authenticated Supabase session email.
- The API route does not trust client-supplied email values from query params, request body, cookies, or public flags.
- `NEXT_PUBLIC_COPILOT_ENABLED` can hide or reveal local navigation only; it cannot authorize API access.
- Unauthorized preview users receive a generic unavailable response before any portfolio, quote, or opportunity loading.
- Account-specific Copilot API responses now include `Cache-Control: private, no-store`.
- Raw provider/database/FMP errors are logged server-side with redaction and are not returned to the browser.
- Manual preview loading is bounded to 50 active tracked positions.
- FMP quote lookup concurrency for the manual preview route is bounded to 5.
- The client Copilot page now shows a clean private-preview unavailable state for 403/404 responses.

## Tests Run

- `npm run test:copilot` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test:security` passed.

## Security Notes

- No brokerage SDKs were added.
- No live trading, paper trading route, or order-placement path was added.
- No production migrations were applied.
- No deployment was performed.
- Feature flags remain off by default.

## Follow-Up

Prompt 13 should repair and verify the additive Copilot SQL/RLS migration without applying it to production.
