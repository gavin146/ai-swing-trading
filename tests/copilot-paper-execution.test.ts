import assert from "node:assert/strict";
import {
  InMemoryPaperExecutionProvider,
  RiskPolicyEngine,
  createDefaultRiskPolicyConfig,
  createOrderIntent,
  createPaperAccountState,
  type CreateOrderIntentInput,
  type OrderIntent,
  type PaperAccountState,
  type PaperAssetType,
} from "../lib/copilot/paper-execution";
import { createFixedTimeProvider } from "../lib/copilot/time";

const nowIso = "2026-07-17T13:30:00.000Z";
const clock = createFixedTimeProvider(nowIso);
const enabledConfig = createDefaultRiskPolicyConfig({
  maxOrderNotional: 10_000,
  maxPortfolioExposurePct: 100,
  maxPositionNotional: 15_000,
  maxSectorExposurePct: 80,
  paperTradingEnabled: true,
});

function baseIntent(overrides: Partial<CreateOrderIntentInput> = {}): OrderIntent {
  return createOrderIntent({
    assetType: "stock",
    createdAt: nowIso,
    explanationEvidence: ["SwingFi opportunity score and source quote were supplied."],
    mode: "paper",
    orderType: "market",
    quantity: 10,
    side: "buy",
    signalRef: {
      id: "opportunity-amzn-2026-07-17",
      type: "opportunity",
    },
    sourceQuote: {
      dataAsOf: nowIso,
      fetchedAt: nowIso,
      maxAgeSeconds: 900,
      price: 100,
      source: "test_quote",
      symbol: "AMZN",
    },
    strategy: {
      id: "swingfi-daily-paper",
      version: "v1",
    },
    symbol: "AMZN",
    tradePlan: {
      entryHigh: 102,
      entryLow: 98,
      expiresAt: "2026-07-27T13:30:00.000Z",
      holdingPeriodDays: 10,
      stopLoss: 92,
      targetPrice: 112,
    },
    ...overrides,
  });
}

function account(overrides: Partial<PaperAccountState> = {}) {
  return createPaperAccountState({
    cash: 25_000,
    ...overrides,
  });
}

function decisionFor(intent: OrderIntent, overrides: Partial<PaperAccountState> = {}) {
  return new RiskPolicyEngine().evaluate({
    account: account(overrides),
    config: enabledConfig,
    intent,
    marketRegime: "balanced",
    now: clock.now(),
  });
}

function testFeatureFlagOff() {
  const decision = new RiskPolicyEngine().evaluate({
    account: account(),
    config: { paperTradingEnabled: false },
    intent: baseIntent(),
    now: clock.now(),
  });

  assert.equal(decision.ok, false);
  if (decision.ok) throw new Error("Expected rejection.");
  assert.equal(decision.reasonCode, "paper_trading_disabled");
  assert.equal(decision.llmOverrideAllowed, false);
}

function testLiveModeRejected() {
  const decision = decisionFor(baseIntent({ mode: "live" }));

  assert.equal(decision.ok, false);
  if (decision.ok) throw new Error("Expected rejection.");
  assert.equal(decision.reasonCode, "live_mode_rejected");
}

function testStaleQuoteRejected() {
  const decision = decisionFor(
    baseIntent({
      sourceQuote: {
        dataAsOf: "2026-07-17T12:30:00.000Z",
        fetchedAt: "2026-07-17T12:30:00.000Z",
        maxAgeSeconds: 900,
        price: 100,
        source: "test_quote",
        symbol: "AMZN",
      },
    }),
  );

  assert.equal(decision.ok, false);
  if (decision.ok) throw new Error("Expected rejection.");
  assert.equal(decision.reasonCode, "price_stale");
}

async function testDuplicateOrderRejected() {
  const provider = new InMemoryPaperExecutionProvider({
    clock,
    config: enabledConfig,
  });
  const intent = baseIntent();
  const first = await provider.submitOrder(intent);
  const second = await provider.submitOrder(intent);

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  if (second.ok) throw new Error("Expected duplicate rejection.");
  assert.equal(second.decision.reasonCode, "duplicate_order");
}

function testMaximumOrderPositionAndExposureRejected() {
  const engine = new RiskPolicyEngine();
  const largeOrder = engine.evaluate({
    account: account(),
    config: createDefaultRiskPolicyConfig({
      maxOrderNotional: 500,
      paperTradingEnabled: true,
    }),
    intent: baseIntent(),
    now: clock.now(),
  });
  const largePosition = engine.evaluate({
    account: account({
      positions: [
        {
          assetType: "stock",
          averageEntryPrice: 100,
          marketValue: 950,
          openedAt: nowIso,
          quantity: 9.5,
          sector: "Consumer Discretionary",
          symbol: "AMZN",
          updatedAt: nowIso,
        },
      ],
    }),
    config: createDefaultRiskPolicyConfig({
      maxPositionNotional: 1_000,
      paperTradingEnabled: true,
    }),
    intent: baseIntent(),
    now: clock.now(),
  });
  const exposure = engine.evaluate({
    account: account({
      cash: 500,
      positions: [
        {
          assetType: "stock",
          averageEntryPrice: 100,
          marketValue: 500,
          openedAt: nowIso,
          quantity: 5,
          sector: "Technology",
          symbol: "MSFT",
          updatedAt: nowIso,
        },
      ],
    }),
    config: createDefaultRiskPolicyConfig({
      maxPortfolioExposurePct: 50,
      paperTradingEnabled: true,
    }),
    intent: baseIntent(),
    now: clock.now(),
  });

  assert.equal(largeOrder.ok, false);
  assert.equal(largePosition.ok, false);
  assert.equal(exposure.ok, false);
}

function testUnsupportedAssetRejected() {
  const decision = decisionFor(
    baseIntent({
      assetType: "crypto" as PaperAssetType,
      unsupportedFeatures: { cryptoExecution: true },
    }),
  );

  assert.equal(decision.ok, false);
  if (decision.ok) throw new Error("Expected rejection.");
  assert.equal(decision.reasonCode, "unsupported_asset");
}

function testInvalidStopTargetRejected() {
  const targetDecision = decisionFor(
    baseIntent({
      tradePlan: {
        entryHigh: 102,
        entryLow: 98,
        expiresAt: "2026-07-27T13:30:00.000Z",
        holdingPeriodDays: 10,
        stopLoss: 92,
        targetPrice: 99,
      },
    }),
  );
  const stopDecision = decisionFor(
    baseIntent({
      tradePlan: {
        entryHigh: 102,
        entryLow: 98,
        expiresAt: "2026-07-27T13:30:00.000Z",
        holdingPeriodDays: 10,
        stopLoss: 101,
        targetPrice: 112,
      },
    }),
  );

  assert.equal(targetDecision.ok, false);
  assert.equal(stopDecision.ok, false);
}

function testEntryOutsidePlanRejected() {
  const decision = decisionFor(
    baseIntent({
      sourceQuote: {
        dataAsOf: nowIso,
        fetchedAt: nowIso,
        maxAgeSeconds: 900,
        price: 110,
        source: "test_quote",
        symbol: "AMZN",
      },
    }),
  );

  assert.equal(decision.ok, false);
  if (decision.ok) throw new Error("Expected rejection.");
  assert.equal(decision.reasonCode, "entry_outside_plan");
}

function testDefensiveRegimeGate() {
  const decision = new RiskPolicyEngine().evaluate({
    account: account(),
    config: enabledConfig,
    intent: baseIntent(),
    marketRegime: "defensive",
    now: clock.now(),
  });

  assert.equal(decision.ok, false);
  if (decision.ok) throw new Error("Expected rejection.");
  assert.equal(decision.reasonCode, "defensive_regime");
}

function testEarningsBlackout() {
  const decision = decisionFor(baseIntent({ upcomingEarningsAt: "2026-07-19T13:30:00.000Z" }));

  assert.equal(decision.ok, false);
  if (decision.ok) throw new Error("Expected rejection.");
  assert.equal(decision.reasonCode, "earnings_blackout");
}

async function testDeterministicFillAndReconciliation() {
  const provider = new InMemoryPaperExecutionProvider({
    clock,
    config: enabledConfig,
  });
  const result = await provider.submitOrder(baseIntent());

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected paper order fill.");
  assert.equal(result.fills.length, 1);
  assert.equal(result.order.status, "filled");
  assert.equal(result.account.cash, 24_000);
  assert.equal(result.account.positions[0].symbol, "AMZN");
  assert.equal(result.account.positions[0].quantity, 10);
  assert.equal(result.account.positions[0].marketValue, 1_000);
  assert.equal(result.account.ledger.some((event) => event.type === "order_filled"), true);
}

async function testCancellation() {
  const provider = new InMemoryPaperExecutionProvider({
    clock,
    config: enabledConfig,
  });
  const accepted = await provider.submitOrder(
    baseIntent({
      limitPrice: 99,
      orderType: "limit",
    }),
  );

  assert.equal(accepted.ok, true);
  if (!accepted.ok) throw new Error("Expected accepted limit order.");
  assert.equal(accepted.order.status, "accepted");

  const cancelled = await provider.cancelOrder(accepted.order.id);

  assert.equal(cancelled.ok, true);
  if (!cancelled.ok) throw new Error("Expected cancellation.");
  assert.equal(cancelled.order.status, "cancelled");
}

async function testNoNetworkCalls() {
  let called = false;
  const originalFetch = (globalThis as { fetch?: unknown }).fetch;

  (globalThis as { fetch?: unknown }).fetch = () => {
    called = true;
    throw new Error("Network access should not be used.");
  };

  try {
    const provider = new InMemoryPaperExecutionProvider({
      clock,
      config: enabledConfig,
    });

    await provider.submitOrder(baseIntent());
    assert.equal(called, false);
  } finally {
    (globalThis as { fetch?: unknown }).fetch = originalFetch;
  }
}

function testLlmCannotBypassRiskPolicy() {
  const decision = decisionFor(
    baseIntent({
      allowLlmOverride: true,
      tradePlan: {
        entryHigh: 102,
        entryLow: 98,
        expiresAt: "2026-07-27T13:30:00.000Z",
        holdingPeriodDays: 10,
        stopLoss: 101,
        targetPrice: 112,
      },
    }),
  );

  assert.equal(decision.ok, false);
  assert.equal(decision.llmOverrideAllowed, false);
}

async function main() {
  testFeatureFlagOff();
  testLiveModeRejected();
  testStaleQuoteRejected();
  await testDuplicateOrderRejected();
  testMaximumOrderPositionAndExposureRejected();
  testUnsupportedAssetRejected();
  testInvalidStopTargetRejected();
  testEntryOutsidePlanRejected();
  testDefensiveRegimeGate();
  testEarningsBlackout();
  await testDeterministicFillAndReconciliation();
  await testCancellation();
  await testNoNetworkCalls();
  testLlmCannotBypassRiskPolicy();
  console.log("Copilot paper execution tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
