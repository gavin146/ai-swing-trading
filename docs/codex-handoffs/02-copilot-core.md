# Codex Handoff: Copilot Core Contracts

Date: 2026-07-17

## Task

Implement provider-neutral core contracts and local/test-only provider architecture for SwingFi Copilot.

## Files Changed

- `.env.example`
- `package.json`
- `lib/copilot/types.ts`
- `lib/copilot/time.ts`
- `lib/copilot/config.ts`
- `lib/copilot/server-only.ts`
- `lib/copilot/errors.ts`
- `lib/copilot/validation.ts`
- `lib/copilot/serialization.ts`
- `lib/copilot/provider-registry.ts`
- `lib/copilot/mock-provider.ts`
- `tests/tsconfig.copilot.json`
- `tests/copilot-core.test.ts`
- `docs/copilot/BROKERAGE_PROVIDER_ADAPTER_GUIDE.md`
- `docs/codex-handoffs/02-copilot-core.md`

## Public Contracts Added

- `BrokerageProviderId`
- `BrokerageConnectionStatus`
- `BrokerageCapabilities`
- `BrokerageConnectionSummary`
- `PublicBrokerageConnectionSummary`
- `BrokerageAccount`
- `PortfolioPosition`
- `PortfolioSnapshot`
- `PortfolioSnapshotSource`
- `PortfolioCompleteness`
- `PortfolioSyncResult`
- `PortfolioSyncError`
- `DataFreshness`
- `PortfolioFinding`
- `CopilotReportInput`
- `ConnectionInstructions`
- `BrokerageConnectionHealth`
- `BrokerageReadProvider`
- `BrokerageProviderRegistry`
- `PortfolioSnapshotRepository`
- `TimeProvider`

## Implementation Notes

- `BrokerageReadProvider` is read-only by design.
- `BrokerageCapabilities.canPlaceOrders` is typed as `false`.
- Runtime `normalizeBrokerageCapabilities()` also forces `canPlaceOrders: false`.
- Provider auth details can only be represented as an opaque `ServerCredentialReference`.
- Public serializers omit `serverCredentialRef`.
- `DependencyInjectedBrokerageProviderRegistry` supports provider injection and duplicate detection.
- Registry returns clear errors for unknown and disabled providers.
- `MockBrokerageReadProvider` is local/test-only and throws if constructed in `NODE_ENV=production`.
- Provider modules call `assertServerOnlyModule()` to fail if imported in a browser/client component runtime.
- Feature flags default off:
  - `COPILOT_ENABLED=false`
  - `BROKERAGE_CONNECTIONS_ENABLED=false`
  - `PAPER_TRADING_ENABLED=false`

## Tests Added

Test file:

- `tests/copilot-core.test.ts`

Test command:

- `npm run test:copilot`

Coverage:

- Provider registration and lookup.
- Duplicate registration.
- Disabled provider.
- Unknown provider.
- Mock sync success.
- Partial data and missing optional values.
- Sanitized public serialization.
- Feature flags defaulting off.
- No capability path reporting `canPlaceOrders=true`.

## Assumptions

- No existing test runner was configured, so this task adds a small no-dependency TypeScript compile-and-run script.
- No customer pages, API routes, migrations, brokerage SDKs, or production behavior were changed.
- Future database persistence will be implemented in a later task after schema approval.
- Future real provider adapters require legal/compliance and provider selection before implementation.

## Future Adapter Steps

1. Decide legal/compliance approach for read-only brokerage data.
2. Select a provider only after comparing API coverage, cost, compliance, and user experience.
3. Add provider-specific adapter under `lib/copilot/providers/`.
4. Keep credentials server-only and represented in shared types only as opaque references.
5. Add provider contract tests before UI integration.
6. Add migrations for connections, snapshots, and reports only after schema review.
7. Add customer UI behind feature flags.
8. Add admin health/readiness monitoring.

## Verification

- `npm run test:copilot`
  - Result: passed.
  - Output: `Copilot core contract tests passed.`
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
