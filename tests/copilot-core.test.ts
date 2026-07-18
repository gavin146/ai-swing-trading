import assert from "node:assert/strict";
import { getCopilotFeatureConfig } from "../lib/copilot/config";
import {
  DisabledBrokerageProviderError,
  DuplicateBrokerageProviderError,
  UnknownBrokerageProviderError,
} from "../lib/copilot/errors";
import { MockBrokerageReadProvider } from "../lib/copilot/mock-provider";
import { createBrokerageProviderRegistry } from "../lib/copilot/provider-registry";
import { toPublicBrokerageConnectionSummary } from "../lib/copilot/serialization";
import type { BrokerageConnectionSummary } from "../lib/copilot/types";
import { createFixedTimeProvider } from "../lib/copilot/time";
import { normalizeBrokerageCapabilities } from "../lib/copilot/validation";

const enabledConfig = {
  brokerageConnectionsEnabled: true,
  copilotEnabled: true,
  paperTradingEnabled: false,
};
const fixedTime = createFixedTimeProvider("2026-07-17T13:30:00.000Z");

function createProvider(options: ConstructorParameters<typeof MockBrokerageReadProvider>[0] = {}) {
  return new MockBrokerageReadProvider({
    config: enabledConfig,
    timeProvider: fixedTime,
    ...options,
  });
}

async function testProviderRegistrationAndLookup() {
  const provider = createProvider();
  const registry = createBrokerageProviderRegistry({
    config: enabledConfig,
    providers: [provider],
  });

  assert.equal(registry.getProvider("mock_local"), provider);
  assert.equal(registry.listProviders().length, 1);
  assert.equal(registry.listProviders()[0].capabilities.canPlaceOrders, false);
}

function testDuplicateRegistration() {
  assert.throws(
    () =>
      createBrokerageProviderRegistry({
        config: enabledConfig,
        providers: [createProvider(), createProvider()],
      }),
    DuplicateBrokerageProviderError,
  );
}

function testDisabledProvider() {
  const registry = createBrokerageProviderRegistry({
    config: enabledConfig,
    providers: [createProvider({ enabled: false })],
  });

  assert.throws(() => registry.getProvider("mock_local"), DisabledBrokerageProviderError);
  assert.equal(registry.listProviders().length, 0);
  assert.equal(registry.listProviders({ includeDisabled: true })[0].status, "disabled");
}

function testUnknownProvider() {
  const registry = createBrokerageProviderRegistry({ config: enabledConfig });

  assert.throws(() => registry.getProvider("mock_local"), UnknownBrokerageProviderError);
}

async function testMockSyncSuccess() {
  const result = await createProvider().syncPortfolio("user-1");

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected sync success.");

  assert.equal(result.snapshot.userId, "user-1");
  assert.equal(result.snapshot.providerId, "mock_local");
  assert.equal(result.snapshot.positions[0].symbol, "AMZN");
  assert.equal(result.snapshot.positions[0].marketValue, 564.75);
  assert.equal(result.snapshot.completeness.level, "complete");
  assert.equal(result.snapshot.fetchedAt, "2026-07-17T13:30:00.000Z");
  assert.equal(result.snapshot.dataAsOf, "2026-07-17T13:30:00.000Z");
}

async function testPartialDataAndMissingOptionalValues() {
  const result = await createProvider({
    positions: [
      {
        currentPrice: null,
        quantity: null,
        symbol: "NTAP",
      },
    ],
  }).syncPortfolio("user-2");

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected sync success.");

  assert.equal(result.snapshot.completeness.level, "partial");
  assert.deepEqual(result.snapshot.completeness.missingFields, [
    "averageEntryPrice",
    "currentPrice",
    "marketValue",
    "quantity",
  ]);
  assert.equal(result.snapshot.positions[0].averageEntryPrice, null);
}

function testSanitizedPublicSerialization() {
  const summary: BrokerageConnectionSummary = {
    capabilities: normalizeBrokerageCapabilities({
      canDisconnect: true,
      canPlaceOrders: true as never,
      canReadAccounts: true,
      canReadHoldings: true,
    }),
    displayName: "Mock",
    providerId: "mock_local",
    serverCredentialRef: {
      id: "credential_ref_123",
      kind: "server_credential_reference",
      providerId: "mock_local",
    },
    status: "connected",
  };
  const serialized = toPublicBrokerageConnectionSummary(summary);

  assert.equal("serverCredentialRef" in serialized, false);
  assert.equal(serialized.capabilities.canPlaceOrders, false);
}

function testFeatureFlagsDefaultOff() {
  assert.deepEqual(getCopilotFeatureConfig({}), {
    brokerageConnectionsEnabled: false,
    copilotEnabled: false,
    paperTradingEnabled: false,
  });
}

function testNoCapabilityPathReportsCanPlaceOrdersTrue() {
  const capabilities = normalizeBrokerageCapabilities({
    canPlaceOrders: true as never,
    canReadHoldings: true,
  });

  assert.equal(capabilities.canPlaceOrders, false);
}

async function main() {
  await testProviderRegistrationAndLookup();
  testDuplicateRegistration();
  testDisabledProvider();
  testUnknownProvider();
  await testMockSyncSuccess();
  await testPartialDataAndMissingOptionalValues();
  testSanitizedPublicSerialization();
  testFeatureFlagsDefaultOff();
  testNoCapabilityPathReportsCanPlaceOrdersTrue();
  console.log("Copilot core contract tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
