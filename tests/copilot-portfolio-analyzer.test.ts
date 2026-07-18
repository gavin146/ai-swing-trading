import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePortfolio } from "../lib/copilot/portfolio-analyzer";
import type {
  PortfolioAnalyzerFinding,
  PortfolioPosition,
  PortfolioSnapshot,
} from "../lib/copilot/types";
import { createFixedTimeProvider } from "../lib/copilot/time";

const clock = createFixedTimeProvider("2026-07-17T13:30:00.000Z");
const freshAsOf = "2026-07-17T13:25:00.000Z";

function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  const currentPrice =
    overrides.currentPrice !== undefined ? overrides.currentPrice : 105;
  const quantity = overrides.quantity !== undefined ? overrides.quantity : 2;
  const entry = overrides.averageEntryPrice !== undefined ? overrides.averageEntryPrice : 100;
  const marketValue =
    quantity !== null && currentPrice !== null && currentPrice > 0
      ? Number((quantity * currentPrice).toFixed(2))
      : null;

  return {
    assetType: "stock",
    averageEntryPrice: entry,
    costBasis:
      quantity !== null && entry !== null ? Number((quantity * entry).toFixed(2)) : null,
    currency: "USD",
    currentPrice,
    dataAsOf: freshAsOf,
    fetchedAt: "2026-07-17T13:30:00.000Z",
    id: "position-1",
    marketValue,
    openedAt: "2026-07-10T13:30:00.000Z",
    originalPlan: {
      entryPrice: 100,
      holdingPeriodDays: 10,
      notes: "Fixture plan",
      opportunityId: "opportunity-1",
      planCreatedAt: "2026-07-10T13:30:00.000Z",
      planSource: "swingfi_daily_analysis",
      stopLoss: 95,
      targetPrice: 110,
    },
    providerId: "manual_trade_history",
    quantity,
    quote: {
      dataAsOf: freshAsOf,
      fetchedAt: "2026-07-17T13:30:00.000Z",
      source: "fixture_quote",
      status: "fresh",
    },
    sourceTradeHistoryId: "trade-1",
    symbol: "AMZN",
    unrealizedGainLoss:
      marketValue !== null && quantity !== null && entry !== null
        ? Number((marketValue - quantity * entry).toFixed(2))
        : null,
    ...overrides,
  };
}

function snapshot(positions: PortfolioPosition[]): PortfolioSnapshot {
  return {
    accounts: [],
    completeness: {
      level: positions.length ? "complete" : "empty",
      missingFields: [],
      warnings: [],
    },
    dataAsOf: freshAsOf,
    fetchedAt: "2026-07-17T13:30:00.000Z",
    id: "snapshot-1",
    positions,
    providerId: "manual_trade_history",
    source: "swingfi_tracker",
    userId: "user-1",
  };
}

function findingsFor(positionOverrides: Partial<PortfolioPosition> = {}) {
  return analyzePortfolio({
    clock,
    snapshot: snapshot([position(positionOverrides)]),
  });
}

function types(findings: PortfolioAnalyzerFinding[]) {
  return findings.map((finding) => finding.type);
}

function assertIncludes(findings: PortfolioAnalyzerFinding[], type: string) {
  assert.ok(
    types(findings).includes(type as never),
    `Expected findings to include ${type}; received ${types(findings).join(", ")}`,
  );
}

function assertExcludes(findings: PortfolioAnalyzerFinding[], type: string) {
  assert.ok(
    !types(findings).includes(type as never),
    `Expected findings to exclude ${type}; received ${types(findings).join(", ")}`,
  );
}

function testStopAndTargetBoundaries() {
  const cases: Array<{
    currentPrice: number;
    expected: string;
    label: string;
    notExpected?: string;
  }> = [
    { currentPrice: 95, expected: "BELOW_OR_AT_STOP", label: "exactly at stop", notExpected: "NEAR_STOP" },
    { currentPrice: 97.8, expected: "NEAR_STOP", label: "just above stop", notExpected: "BELOW_OR_AT_STOP" },
    { currentPrice: 110, expected: "AT_OR_ABOVE_TARGET", label: "exactly at target", notExpected: "NEAR_TARGET" },
    { currentPrice: 107, expected: "NEAR_TARGET", label: "just below target", notExpected: "AT_OR_ABOVE_TARGET" },
  ];

  cases.forEach((item) => {
    const result = findingsFor({ currentPrice: item.currentPrice });
    assertIncludes(result, item.expected);
    if (item.notExpected) assertExcludes(result, item.notExpected);
  });
}

function testZeroNegativeInvalidInputs() {
  const result = findingsFor({
    currentPrice: -1,
    originalPlan: {
      entryPrice: 0,
      holdingPeriodDays: null,
      planCreatedAt: "2026-07-10T13:30:00.000Z",
      planSource: "manual_trade_history",
      stopLoss: -5,
      targetPrice: 0,
    },
  });

  assertIncludes(result, "QUOTE_UNAVAILABLE");
  assertIncludes(result, "NO_ACTIVE_SWINGFI_PLAN");
  assertExcludes(result, "REMAINING_REWARD_RISK_WEAK");
}

function testUnknownQuantityValueDoesNotInventConcentration() {
  const result = analyzePortfolio({
    clock,
    knownPortfolioValue: 1000,
    snapshot: snapshot([
      position({
        marketValue: null,
        quantity: null,
      }),
    ]),
  });

  assertExcludes(result, "POSITION_CONCENTRATION");
  assert.ok(result.some((finding) => finding.dataCompleteness.includes("Partial data")));
}

function testStaleVersusFreshQuote() {
  const fresh = findingsFor({ currentPrice: 105 });
  const stale = findingsFor({
    currentPrice: 113,
    quote: {
      dataAsOf: "2026-07-17T12:30:00.000Z",
      fetchedAt: "2026-07-17T13:30:00.000Z",
      source: "fixture_quote",
      status: "fresh",
    },
  });

  assertExcludes(fresh, "DATA_STALE");
  assertIncludes(stale, "DATA_STALE");
  assertExcludes(stale, "AT_OR_ABOVE_TARGET");
}

function testMissingPlan() {
  const result = findingsFor({
    originalPlan: undefined,
  });

  assertIncludes(result, "NO_ACTIVE_SWINGFI_PLAN");
  assertExcludes(result, "INSIDE_ORIGINAL_PLAN");
}

function testExpiredAndExpiringHoldingWindow() {
  const expired = findingsFor({
    openedAt: "2026-07-01T13:30:00.000Z",
    originalPlan: {
      entryPrice: 100,
      holdingPeriodDays: 10,
      planCreatedAt: "2026-07-01T13:30:00.000Z",
      planSource: "swingfi_daily_analysis",
      stopLoss: 95,
      targetPrice: 110,
    },
  });
  const expiring = findingsFor({
    openedAt: "2026-07-09T13:30:00.000Z",
    originalPlan: {
      entryPrice: 100,
      holdingPeriodDays: 10,
      planCreatedAt: "2026-07-09T13:30:00.000Z",
      planSource: "swingfi_daily_analysis",
      stopLoss: 95,
      targetPrice: 110,
    },
  });

  assertIncludes(expired, "HOLDING_WINDOW_EXPIRED");
  assertExcludes(expired, "HOLDING_WINDOW_EXPIRING");
  assertIncludes(expiring, "HOLDING_WINDOW_EXPIRING");
}

function testConcentrationWithIncompleteTotals() {
  const withoutTotal = analyzePortfolio({
    clock,
    snapshot: snapshot([position({ currentPrice: 200, marketValue: 400 })]),
  });
  const withTotal = analyzePortfolio({
    clock,
    knownPortfolioValue: 1000,
    positionEvidence: [{ sector: "Technology", symbol: "AMZN" }],
    snapshot: snapshot([
      position({ currentPrice: 200, id: "position-1", marketValue: 400 }),
      position({
        currentPrice: 120,
        id: "position-2",
        marketValue: 120,
        symbol: "NTAP",
      }),
    ]),
  });

  assertExcludes(withoutTotal, "POSITION_CONCENTRATION");
  assertIncludes(withTotal, "POSITION_CONCENTRATION");
}

function testSectorConcentrationUsesKnownSectorAndValueOnly() {
  const result = analyzePortfolio({
    clock,
    knownPortfolioValue: 1000,
    positionEvidence: [
      { sector: "Technology", symbol: "AMZN" },
      { sector: "Technology", symbol: "NTAP" },
      { sector: "Financials", symbol: "JPM" },
    ],
    snapshot: snapshot([
      position({ currentPrice: 200, id: "position-1", marketValue: 250, symbol: "AMZN" }),
      position({ currentPrice: 120, id: "position-2", marketValue: 220, symbol: "NTAP" }),
      position({ currentPrice: 50, id: "position-3", marketValue: null, symbol: "JPM" }),
    ]),
  });

  assertIncludes(result, "SECTOR_CONCENTRATION");
}

function testEventHeadlineAndTrendFindings() {
  const result = analyzePortfolio({
    clock,
    positionEvidence: [
      {
        eventRisk: [
          {
            description: "Earnings date inside review window",
            eventDate: "2026-07-20T13:30:00.000Z",
            hasRisk: true,
            source: "earnings_calendar",
          },
          {
            description: "SEC filing risk flag",
            hasRisk: true,
            source: "filing",
          },
        ],
        symbol: "AMZN",
        technical: {
          relativeStrengthTrend: "weakening",
          sma20Relationship: "below",
          trendQuality: "weakening",
        },
      },
    ],
    snapshot: snapshot([position()]),
  });

  assertIncludes(result, "EARNINGS_OR_EVENT_RISK");
  assertIncludes(result, "FILING_OR_HEADLINE_RISK");
  assertIncludes(result, "TREND_WEAKENING");
}

function testMomentumImproving() {
  const result = analyzePortfolio({
    clock,
    positionEvidence: [
      {
        symbol: "AMZN",
        technical: {
          relativeStrengthTrend: "improving",
          trendQuality: "improving",
          volumeTrend: "rising",
        },
      },
    ],
    snapshot: snapshot([position()]),
  });

  assertIncludes(result, "MOMENTUM_IMPROVING");
}

function testRemainingRewardRiskWeak() {
  const result = findingsFor({ currentPrice: 106.8 });

  assertIncludes(result, "REMAINING_REWARD_RISK_WEAK");
}

function testConflictingTargetAndStaleDataStates() {
  const result = findingsFor({
    currentPrice: 120,
    quote: {
      dataAsOf: "2026-07-17T12:00:00.000Z",
      fetchedAt: "2026-07-17T13:30:00.000Z",
      source: "fixture_quote",
      status: "stale",
    },
  });

  assertIncludes(result, "DATA_STALE");
  assertExcludes(result, "AT_OR_ABOVE_TARGET");
}

function testDeterministicOrdering() {
  const result = analyzePortfolio({
    clock,
    positionEvidence: [
      {
        eventRisk: [
          {
            eventDate: "2026-07-20T13:30:00.000Z",
            hasRisk: true,
            source: "earnings_calendar",
          },
        ],
        symbol: "AMZN",
      },
    ],
    snapshot: snapshot([position({ currentPrice: 95 })]),
  });

  assert.deepEqual(types(result).slice(0, 2), ["BELOW_OR_AT_STOP", "EARNINGS_OR_EVENT_RISK"]);
  assert.deepEqual(types(result), types(result).slice().sort((a, b) => {
    const order = types(result);
    return order.indexOf(a) - order.indexOf(b);
  }));
}

function testInjectedClockBehavior() {
  const earlyClock = createFixedTimeProvider("2026-07-11T13:30:00.000Z");
  const early = analyzePortfolio({
    clock: earlyClock,
    snapshot: snapshot([position({ openedAt: "2026-07-10T13:30:00.000Z" })]),
  });
  const later = findingsFor({
    openedAt: "2026-07-09T13:30:00.000Z",
  });

  assertExcludes(early, "HOLDING_WINDOW_EXPIRING");
  assertIncludes(later, "HOLDING_WINDOW_EXPIRING");
}

function testNoBannedLanguageInOutput() {
  const result = analyzePortfolio({
    clock,
    knownPortfolioValue: 1000,
    positionEvidence: [
      {
        eventRisk: [{ hasRisk: true, source: "news", description: "negative headline" }],
        symbol: "AMZN",
      },
    ],
    snapshot: snapshot([position({ currentPrice: 95 })]),
  });
  const banned = /\b(buy now|sell now|guaranteed|must buy|must sell|place an order)\b/i;

  result.forEach((finding) => {
    assert.equal(banned.test(finding.message), false, finding.message);
    assert.equal(banned.test(finding.title), false, finding.title);
  });
}

function testNoNetworkOrOpenAiDependency() {
  const source = readFileSync("lib/copilot/portfolio-analyzer.ts", "utf8");

  assert.equal(/openai/i.test(source), false);
  assert.equal(/supabase/i.test(source), false);
  assert.equal(/providers\/fmp/i.test(source), false);
  assert.equal(/\bfetch\s*\(/.test(source), false);
}

async function main() {
  testStopAndTargetBoundaries();
  testZeroNegativeInvalidInputs();
  testUnknownQuantityValueDoesNotInventConcentration();
  testStaleVersusFreshQuote();
  testMissingPlan();
  testExpiredAndExpiringHoldingWindow();
  testConcentrationWithIncompleteTotals();
  testSectorConcentrationUsesKnownSectorAndValueOnly();
  testEventHeadlineAndTrendFindings();
  testMomentumImproving();
  testRemainingRewardRiskWeak();
  testConflictingTargetAndStaleDataStates();
  testDeterministicOrdering();
  testInjectedClockBehavior();
  testNoBannedLanguageInOutput();
  testNoNetworkOrOpenAiDependency();
  console.log("Copilot portfolio analyzer tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
