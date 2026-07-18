import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCopilotUiViewModel,
  createCopilotDemoSnapshot,
} from "../lib/copilot/ui-view-model";
import type { PortfolioSnapshot } from "../lib/copilot/types";
import type { PortfolioAnalyzerFinding } from "../lib/copilot/portfolio-analyzer";

const now = new Date("2026-07-17T13:30:00.000Z");
const asOf = "2026-07-17T13:25:00.000Z";

function snapshot(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    accounts: [],
    completeness: {
      level: "complete",
      missingFields: [],
      warnings: [],
    },
    dataAsOf: asOf,
    fetchedAt: "2026-07-17T13:30:00.000Z",
    id: "snapshot-1",
    positions: [
      {
        assetType: "stock",
        averageEntryPrice: 100,
        costBasis: 200,
        currency: "USD",
        currentPrice: 105,
        dataAsOf: asOf,
        fetchedAt: "2026-07-17T13:30:00.000Z",
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
          dataAsOf: asOf,
          fetchedAt: "2026-07-17T13:30:00.000Z",
          source: "fixture_quote",
          status: "fresh",
        },
        symbol: "AMZN",
        unrealizedGainLoss: 10,
      },
    ],
    providerId: "manual_trade_history",
    source: "swingfi_tracker",
    userId: "user-1",
    ...overrides,
  };
}

function highFinding(): PortfolioAnalyzerFinding {
  return {
    dataCompleteness: "Complete for this rule.",
    evidence: [
      {
        asOf,
        metric: "current_price",
        source: "fixture_quote",
        value: 94,
      },
    ],
    id: "high-risk-line",
    message: "AMZN is at or below the original stop from supplied evidence.",
    positionId: "position-1",
    ruleVersion: "portfolio-analyzer.v1",
    severity: "high",
    symbol: "AMZN",
    title: "Risk line reached",
    type: "BELOW_OR_AT_STOP",
  };
}

async function testEmptyState() {
  const view = await buildCopilotUiViewModel({
    mode: "manual",
    now,
    snapshot: snapshot({
      completeness: {
        level: "empty",
        missingFields: [],
        warnings: ["No positions were returned by this provider."],
      },
      positions: [],
    }),
  });

  assert.equal(view.empty, true);
  assert.equal(view.positions.length, 0);
  assert.equal(view.dataHealth[0].status, "missing");
}

async function testCompleteManualPortfolioFixture() {
  const view = await buildCopilotUiViewModel({
    mode: "manual",
    now,
    snapshot: snapshot(),
  });

  assert.equal(view.empty, false);
  assert.equal(view.mode, "manual");
  assert.equal(view.positions[0].symbol, "AMZN");
  assert.equal(view.positions[0].planStatus, "Inside saved plan");
  assert.equal(view.positions[0].daysHeld, 3);
  assert.equal(view.positions[0].remainingWindowDays, 7);
  assert.equal(view.sourceLabel, "SwingFi tracker");
}

async function testStaleDataState() {
  const view = await buildCopilotUiViewModel({
    mode: "manual",
    now,
    snapshot: snapshot({
      completeness: {
        level: "partial",
        missingFields: ["freshQuote"],
        warnings: ["AMZN quote is stale."],
      },
      positions: [
        {
          ...snapshot().positions[0],
          currentPrice: null,
          quote: {
            dataAsOf: "2026-07-17T12:00:00.000Z",
            fetchedAt: "2026-07-17T13:30:00.000Z",
            message: "Quote was available but too old to use for valuation.",
            source: "fixture_quote",
            status: "stale",
          },
        },
      ],
    }),
  });

  assert.equal(view.positions[0].freshness, "stale");
  assert.ok(view.warnings.some((warning) => warning.includes("stale")));
  assert.ok(view.findings.some((finding) => finding.type === "QUOTE_UNAVAILABLE"));
}

async function testHighSeverityDisplayInput() {
  const view = await buildCopilotUiViewModel({
    findings: [highFinding()],
    mode: "manual",
    now,
    snapshot: snapshot(),
  });

  assert.equal(view.findings[0].severity, "high");
  assert.ok(view.report.outline.sections.some((section) => section.id === "needs_attention"));
}

async function testFixtureModeIsClearlyLabeled() {
  const view = await buildCopilotUiViewModel({
    mode: "fixture",
    now,
    snapshot: createCopilotDemoSnapshot(now),
    warnings: ["Demo fixture only. This is not live account or brokerage data."],
  });

  assert.equal(view.mode, "fixture");
  assert.equal(view.sourceLabel, "Demo fixture");
  assert.ok(view.warnings[0].includes("Demo fixture"));
}

function testFeatureFlagDefaultsOff() {
  assert.equal(process.env.COPILOT_ENABLED === "true", false);

  const pageSource = readFileSync("app/copilot/page.tsx", "utf8");
  assert.ok(pageSource.includes("getCopilotFeatureConfig().copilotEnabled"));
  assert.ok(pageSource.includes("notFound()"));
}

function testAuthRequiredAtApiBoundary() {
  const routeSource = readFileSync("app/api/copilot/report/route.ts", "utf8");

  assert.ok(routeSource.includes("resolveCustomerSession(request)"));
  assert.ok(!routeSource.includes("searchParams.get(\"user_id\")"));
  assert.ok(!routeSource.includes("body.user_id"));
}

function testNoBannedDirectAdviceLanguage() {
  const files = [
    "components/CopilotPanel.tsx",
    "lib/copilot/ui-view-model.ts",
    "app/copilot/page.tsx",
  ];
  const banned = [/buy now/i, /sell immediately/i, /guaranteed\s+profit/i, /guaranteed\s+winner/i, /risk\s*free/i, /cannot\s+lose/i];

  files.forEach((file) => {
    const source = readFileSync(file, "utf8");
    banned.forEach((pattern) => {
      assert.equal(pattern.test(source), false, `${file} contains banned language ${pattern.source}`);
    });
  });
}

async function main() {
  await testEmptyState();
  await testCompleteManualPortfolioFixture();
  await testStaleDataState();
  await testHighSeverityDisplayInput();
  await testFixtureModeIsClearlyLabeled();
  testFeatureFlagDefaultsOff();
  testAuthRequiredAtApiBoundary();
  testNoBannedDirectAdviceLanguage();
}

main()
  .then(() => {
    console.log("copilot ui view-model tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
