import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCopilotDailyDigestEmail } from "../lib/copilot/email";
import {
  buildCopilotUiViewModel,
  createCopilotDemoSnapshot,
} from "../lib/copilot/ui-view-model";
import type { PortfolioSnapshot } from "../lib/copilot/types";

const now = new Date("2026-07-17T13:30:00.000Z");
const asOf = "2026-07-17T13:25:00.000Z";

function completeSnapshot(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    accounts: [],
    completeness: {
      level: "complete",
      missingFields: [],
      warnings: [],
    },
    dataAsOf: asOf,
    fetchedAt: "2026-07-17T13:30:00.000Z",
    id: "snapshot-email-test",
    positions: [
      {
        assetType: "stock",
        averageEntryPrice: 100,
        costBasis: 200,
        currency: "USD",
        currentPrice: 105,
        dataAsOf: asOf,
        fetchedAt: "2026-07-17T13:30:00.000Z",
        id: "position-email-test",
        marketValue: 210,
        openedAt: "2026-07-14T13:30:00.000Z",
        originalPlan: {
          entryPrice: 100,
          holdingPeriodDays: 10,
          notes: "Email fixture plan.",
          opportunityId: "opportunity-email-test",
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

async function render(snapshot: PortfolioSnapshot = completeSnapshot()) {
  const viewModel = await buildCopilotUiViewModel({
    mode: "manual",
    now,
    opportunities: [
      {
        asset_type: "stock",
        confidence: 78,
        created_at: now.toISOString(),
        entry_high: 112,
        entry_low: 106,
        expected_gain: 8.7,
        expected_loss: 5.2,
        explanation: "Supplied fixture research summary for email rendering.",
        holding_period_days: 10,
        id: "opportunity-email-test",
        risk_score: 42,
        score: 82,
        stop_loss: 100.5,
        symbol: "AMZN",
        target_price: 116,
      },
    ],
    snapshot,
  });

  return buildCopilotDailyDigestEmail({
    copilotUrl: "https://www.swingfi.trade/copilot",
    customerName: "Gavin Boyle",
    unsubscribeUrl: "https://www.swingfi.trade/unsubscribe",
    viewModel,
  });
}

async function testCompleteReport() {
  const email = await render();

  assert.ok(email.subject.includes("SwingFi Copilot digest"));
  assert.ok(email.html.includes("Portfolio snapshot"));
  assert.ok(email.html.includes("Needs attention"));
  assert.ok(email.html.includes("Still inside plan"));
  assert.ok(email.html.includes("Research opportunities to review"));
  assert.ok(email.html.includes("https://www.swingfi.trade/copilot"));
  assert.ok(email.text.includes("Open Copilot"));
}

async function testEmptyPortfolio() {
  const email = await render(
    completeSnapshot({
      completeness: {
        level: "empty",
        missingFields: [],
        warnings: ["No positions were returned by this provider."],
      },
      positions: [],
    }),
  );

  assert.ok(email.html.includes("No tracked SwingFi positions were supplied"));
  assert.ok(email.text.includes("Tracked positions: 0"));
}

async function testStaleDataWarning() {
  const stale = completeSnapshot({
    completeness: {
      level: "partial",
      missingFields: ["freshQuote"],
      warnings: ["AMZN stale quote."],
    },
    positions: [
      {
        ...completeSnapshot().positions[0],
        currentPrice: null,
        marketValue: null,
        quote: {
          dataAsOf: "2026-07-17T12:30:00.000Z",
          fetchedAt: "2026-07-17T13:30:00.000Z",
          message: "Quote was stale in the supplied fixture.",
          source: "fixture_quote",
          status: "stale",
        },
      },
    ],
  });
  const email = await render(stale);

  assert.ok(email.html.toLowerCase().includes("stale"));
  assert.ok(email.text.toLowerCase().includes("stale"));
  assert.ok(email.html.includes("Clearly identifies missing or stale information") === false);
}

async function testLongSymbolAndCompanyNames() {
  const viewModel = await buildCopilotUiViewModel({
    mode: "fixture",
    now,
    opportunities: [
      {
        asset_type: "stock",
        confidence: 72,
        created_at: now.toISOString(),
        entry_high: 77,
        entry_low: 72,
        expected_gain: 7.8,
        expected_loss: 4.6,
        explanation:
          "Long company-name fixture used to verify the email preview still wraps inside mobile-friendly containers.",
        holding_period_days: 9,
        id: "fixture-long-company-name",
        risk_score: 48,
        score: 76,
        stop_loss: 68.5,
        symbol: "VERYLONG",
        target_price: 82,
      },
    ],
    snapshot: createCopilotDemoSnapshot(now),
  });
  viewModel.researchOpportunities = viewModel.researchOpportunities.map((item) => ({
    ...item,
    companyName:
      "Very Long Company Name Incorporated For Email Wrapping And Layout Preview",
  }));
  const email = buildCopilotDailyDigestEmail({
    copilotUrl: "https://www.swingfi.trade/copilot",
    viewModel,
  });

  assert.ok(email.html.includes("VERYLONG"));
  assert.ok(email.html.includes("Very Long Company Name"));
  assert.ok(email.html.includes("word-break:break-word"));
}

async function testMobileFriendlyRendering() {
  const email = await render();

  assert.ok(email.html.includes('name="viewport"'));
  assert.ok(email.html.includes("max-width:640px"));
  assert.ok(email.html.includes("overflow-x:auto"));
  assert.ok(email.html.includes("color-scheme:light only"));
}

function testAdminAuthorizationAndPreviewOnly() {
  const route = readFileSync("app/api/admin/copilot/email-preview/route.ts", "utf8");

  assert.ok(route.includes("isAdminApiRequest(request)"));
  assert.ok(route.includes("getAdminUnauthorizedResponse()"));
  assert.equal(route.includes("sendEmail"), false);
  assert.equal(route.includes("RESEND_API_KEY"), false);
  assert.equal(route.includes("fetch(\"https://api.resend.com"), false);
  assert.ok(route.includes("sent: false"));
}

async function testNoBannedLanguage() {
  const email = await render();
  const combined = `${email.subject}\n${email.text}\n${email.html}`;
  const banned = [/buy\s+now/i, /sell\s+now/i, /guaranteed/i, /high\s+yield/i, /cannot\s+lose/i];

  banned.forEach((pattern) => {
    assert.equal(pattern.test(combined), false, `Email contains banned language ${pattern.source}`);
  });
}

async function main() {
  await testCompleteReport();
  await testEmptyPortfolio();
  await testStaleDataWarning();
  await testLongSymbolAndCompanyNames();
  await testMobileFriendlyRendering();
  testAdminAuthorizationAndPreviewOnly();
  await testNoBannedLanguage();
}

main()
  .then(() => {
    console.log("copilot email tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
