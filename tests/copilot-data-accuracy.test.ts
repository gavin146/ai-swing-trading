import assert from "node:assert/strict";
import { buildCopilotDailyDigestEmail } from "../lib/copilot/email";
import { formatCopilotMoney } from "../lib/copilot/formatting";
import { DataFreshnessService } from "../lib/copilot/data-freshness";
import { buildFmpManualQuoteResult } from "../lib/copilot/manual-portfolio-provider";
import { analyzePortfolio } from "../lib/copilot/portfolio-analyzer";
import { buildCopilotUiViewModel } from "../lib/copilot/ui-view-model";
import { createFixedTimeProvider } from "../lib/copilot/time";
import type { PortfolioPosition, PortfolioSnapshot } from "../lib/copilot/types";

const now = new Date("2026-07-17T13:30:00.000Z");
const clock = createFixedTimeProvider(now.toISOString());
const freshAsOf = "2026-07-17T13:25:00.000Z";

function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    assetType: "stock",
    averageEntryPrice: 100,
    costBasis: 200,
    currency: "USD",
    currentPrice: 105,
    dataAsOf: freshAsOf,
    fetchedAt: now.toISOString(),
    id: "position-1",
    marketValue: 210,
    openedAt: "2026-07-14T13:30:00.000Z",
    originalPlan: {
      entryPrice: 100,
      holdingPeriodDays: 10,
      notes: "Fixture plan.",
      opportunityId: "opportunity-1",
      planCreatedAt: "2026-07-14T13:30:00.000Z",
      planSource: "swingfi_daily_analysis",
      stopLoss: 95,
      targetPrice: 110,
    },
    providerId: "manual_trade_history",
    quantity: 2,
    quote: {
      dataAsOf: freshAsOf,
      fetchedAt: now.toISOString(),
      source: "fixture_quote",
      status: "fresh",
    },
    sourceTradeHistoryId: "trade-1",
    symbol: "AMZN",
    unrealizedGainLoss: 10,
    ...overrides,
  };
}

function snapshot(positions: PortfolioPosition[], overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    accounts: [],
    completeness: {
      level: positions.length ? "partial" : "empty",
      missingFields: [],
      warnings: [],
    },
    dataAsOf: freshAsOf,
    fetchedAt: now.toISOString(),
    id: "snapshot-accuracy",
    positions,
    providerId: "manual_trade_history",
    source: "swingfi_tracker",
    userId: "user-1",
    ...overrides,
  };
}

function findingTypes(positions: PortfolioPosition[], knownPortfolioValue?: number | null) {
  return analyzePortfolio({
    clock,
    knownPortfolioValue,
    snapshot: snapshot(positions),
  }).map((finding) => finding.type);
}

function testMoneyFormattingDoesNotCoerceMissingValuesToZero() {
  assert.equal(formatCopilotMoney(null), "Unknown");
  assert.equal(formatCopilotMoney(undefined), "Unknown");
  assert.equal(formatCopilotMoney(Number.NaN), "Unknown");
  assert.equal(formatCopilotMoney(""), "Unknown");
  assert.match(formatCopilotMoney(0), /^\$0\.00$/);
}

async function testMissingMoneyDoesNotRenderAsZeroInUiReportOrEmail() {
  const missing = snapshot([
    position({
      averageEntryPrice: null,
      costBasis: null,
      currentPrice: null,
      marketValue: null,
      originalPlan: {
        entryPrice: null,
        holdingPeriodDays: 10,
        planCreatedAt: "2026-07-14T13:30:00.000Z",
        planSource: "manual_trade_history",
        stopLoss: null,
        targetPrice: null,
      },
      quote: {
        dataAsOf: null,
        fetchedAt: now.toISOString(),
        message: "No quote in fixture.",
        source: "fixture_quote",
        status: "missing",
      },
      unrealizedGainLoss: null,
    }),
  ]);
  const viewModel = await buildCopilotUiViewModel({
    mode: "manual",
    now,
    snapshot: missing,
  });
  const email = buildCopilotDailyDigestEmail({
    copilotUrl: "https://www.swingfi.trade/copilot",
    viewModel,
  });
  const combined = `${viewModel.narrative}\n${email.text}\n${email.html}`;

  assert.equal(viewModel.positions[0].currentPrice, null);
  assert.equal(viewModel.positions[0].entryPrice, null);
  assert.equal(viewModel.positions[0].targetPrice, null);
  assert.equal(viewModel.positions[0].stopLoss, null);
  assert.doesNotMatch(combined, /\$0\.00/);
  assert.match(combined, /Unknown|unknown/);
}

async function testStaleQuoteCannotCreatePlanStatusOrPlanFindings() {
  const stalePosition = position({
    currentPrice: 120,
    quote: {
      dataAsOf: "2026-07-17T12:30:00.000Z",
      fetchedAt: now.toISOString(),
      message: "Fixture quote is stale.",
      source: "fixture_quote",
      status: "stale",
    },
  });
  const viewModel = await buildCopilotUiViewModel({
    mode: "manual",
    now,
    snapshot: snapshot([stalePosition]),
  });
  const types = findingTypes([stalePosition]);

  assert.equal(viewModel.positions[0].planStatus, "Price needs refresh");
  assert.ok(types.includes("DATA_STALE"));
  ["INSIDE_ORIGINAL_PLAN", "NEAR_TARGET", "NEAR_STOP", "AT_OR_ABOVE_TARGET", "BELOW_OR_AT_STOP"].forEach((type) => {
    assert.equal(types.includes(type as never), false, `${type} should not be produced from stale data.`);
  });
}

function testDataFreshnessAggregationIsWorstAndOrderIndependent() {
  const rows = [
    position({
      id: "fresh",
      quote: { dataAsOf: "2026-07-17T13:25:00.000Z", fetchedAt: now.toISOString(), message: "fresh", source: "same_source", status: "fresh" },
    }),
    position({
      id: "stale",
      quote: { dataAsOf: "2026-07-17T12:30:00.000Z", fetchedAt: now.toISOString(), message: "stale", source: "same_source", status: "stale" },
    }),
    position({
      id: "missing",
      quote: { dataAsOf: null, fetchedAt: now.toISOString(), message: "missing", source: "same_source", status: "missing" },
    }),
    position({
      id: "error",
      quote: { dataAsOf: null, fetchedAt: now.toISOString(), message: "error", source: "same_source", status: "error" },
    }),
  ];
  const service = new DataFreshnessService();
  const forward = service.fromPortfolioSnapshot(snapshot(rows))[0];
  const reverse = service.fromPortfolioSnapshot(snapshot([...rows].reverse()))[0];

  assert.equal(forward.status, "error");
  assert.equal(forward.message, "error");
  assert.deepEqual(forward, reverse);

  const withoutError = service.fromPortfolioSnapshot(snapshot(rows.filter((item) => item.id !== "error")))[0];
  assert.equal(withoutError.status, "missing");
  assert.equal(withoutError.dataAsOf, null);
}

function testFmpProfileQuoteTimestampIsNotInvented() {
  const withPrice = buildFmpManualQuoteResult({ price: 123.45 }, now.toISOString());
  const withoutPrice = buildFmpManualQuoteResult({ price: null }, now.toISOString());

  assert.equal(withPrice.price, 123.45);
  assert.equal(withPrice.fetchedAt, now.toISOString());
  assert.equal(withPrice.dataAsOf, null);
  assert.equal(withPrice.status, "stale");
  assert.match(withPrice.message ?? "", /did not provide a market quote timestamp/i);
  assert.equal(withoutPrice.status, "missing");
}

function testSectorConcentrationFindingsHaveDistinctIds() {
  const findings = analyzePortfolio({
    clock,
    knownPortfolioValue: 1000,
    positionEvidence: [
      { sector: "Technology", symbol: "AMZN" },
      { sector: "Healthcare", symbol: "UNH" },
    ],
    snapshot: snapshot([
      position({ id: "position-tech", marketValue: 500, symbol: "AMZN" }),
      position({ id: "position-health", marketValue: 500, symbol: "UNH" }),
    ]),
    thresholds: { sectorConcentrationPct: 40 },
  }).filter((finding) => finding.type === "SECTOR_CONCENTRATION");

  assert.equal(findings.length, 2);
  assert.equal(new Set(findings.map((finding) => finding.id)).size, 2);
}

function testTradeSpecificEvidenceDoesNotLeakToSameSymbolPosition() {
  const positions = [
    position({ id: "position-1", marketValue: 500, sourceTradeHistoryId: "trade-1", symbol: "AMZN" }),
    position({ id: "position-2", marketValue: 500, sourceTradeHistoryId: "trade-2", symbol: "AMZN" }),
  ];
  const tradeScoped = analyzePortfolio({
    clock,
    knownPortfolioValue: 1000,
    positionEvidence: [{ sector: "Technology", sourceTradeHistoryId: "trade-1", symbol: "AMZN" }],
    snapshot: snapshot(positions),
    thresholds: { sectorConcentrationPct: 75 },
  });
  const symbolScoped = analyzePortfolio({
    clock,
    knownPortfolioValue: 1000,
    positionEvidence: [{ sector: "Technology", symbol: "AMZN" }],
    snapshot: snapshot(positions),
    thresholds: { sectorConcentrationPct: 75 },
  });

  assert.equal(tradeScoped.some((finding) => finding.type === "SECTOR_CONCENTRATION"), false);
  assert.equal(symbolScoped.some((finding) => finding.type === "SECTOR_CONCENTRATION"), true);
}

function testInvalidLongOnlyPlanBlocksTargetStopRewardRiskConclusions() {
  const invalid = position({
    currentPrice: 120,
    originalPlan: {
      entryPrice: 100,
      holdingPeriodDays: 10,
      planCreatedAt: "2026-07-14T13:30:00.000Z",
      planSource: "manual_trade_history",
      stopLoss: 105,
      targetPrice: 98,
    },
  });
  const types = findingTypes([invalid]);

  assert.ok(types.includes("NO_ACTIVE_SWINGFI_PLAN"));
  ["INSIDE_ORIGINAL_PLAN", "NEAR_TARGET", "NEAR_STOP", "AT_OR_ABOVE_TARGET", "BELOW_OR_AT_STOP", "REMAINING_REWARD_RISK_WEAK"].forEach((type) => {
    assert.equal(types.includes(type as never), false, `${type} should not be produced from an invalid plan.`);
  });
}

async function main() {
  testMoneyFormattingDoesNotCoerceMissingValuesToZero();
  await testMissingMoneyDoesNotRenderAsZeroInUiReportOrEmail();
  await testStaleQuoteCannotCreatePlanStatusOrPlanFindings();
  testDataFreshnessAggregationIsWorstAndOrderIndependent();
  testFmpProfileQuoteTimestampIsNotInvented();
  testSectorConcentrationFindingsHaveDistinctIds();
  testTradeSpecificEvidenceDoesNotLeakToSameSymbolPosition();
  testInvalidLongOnlyPlanBlocksTargetStopRewardRiskConclusions();
  console.log("Copilot data accuracy tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
