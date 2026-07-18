import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCopilotDailyDigestEmail } from "../lib/copilot/email";
import { getCopilotFeatureConfig } from "../lib/copilot/config";
import { DataFreshnessService } from "../lib/copilot/data-freshness";
import {
  ManualPortfolioReadProvider,
  type ManualPortfolioQuoteService,
  type ManualPortfolioTradeRepository,
  type ManualQuoteResult,
  type ManualTrackedTrade,
} from "../lib/copilot/manual-portfolio-provider";
import { OpenAICopilotNarrator } from "../lib/copilot/openai-narrator";
import { analyzePortfolio } from "../lib/copilot/portfolio-analyzer";
import { buildCopilotUiViewModel } from "../lib/copilot/ui-view-model";
import { createFixedTimeProvider } from "../lib/copilot/time";
import type { PortfolioAnalyzerFinding } from "../lib/copilot/types";

const nowIso = "2026-07-17T13:30:00.000Z";
const clock = createFixedTimeProvider(nowIso);

function trackedTrade(overrides: Partial<ManualTrackedTrade> = {}): ManualTrackedTrade {
  return {
    asset_type: "stock",
    closed_at: null,
    created_at: "2026-07-14T13:30:00.000Z",
    entry_price: 100,
    exit_price: null,
    id: "trade-amzn",
    notes:
      "Planned hold: 10 days.\n\nSwingFi exit plan: Preserve the original target, stop, and review window. Source: latest SwingFi daily analysis.",
    opened_at: "2026-07-14T14:00:00.000Z",
    opportunity_id: "opportunity-amzn",
    quantity: 2,
    realized_gain: null,
    realized_loss: null,
    status: "open",
    stop_loss: 94,
    symbol: "AMZN",
    target_price: 112,
    user_id: "user-1",
    ...overrides,
  };
}

class FixedTradeRepository implements ManualPortfolioTradeRepository {
  constructor(private readonly rows: ManualTrackedTrade[]) {}

  async listActiveTrackedTrades(userId: string) {
    assert.equal(userId, "user-1");
    return this.rows;
  }
}

class FixedQuoteService implements ManualPortfolioQuoteService {
  requestedSymbols: string[][] = [];

  constructor(private readonly quotes: Record<string, ManualQuoteResult>) {}

  async getQuotes(symbols: string[], fetchedAt: string) {
    this.requestedSymbols.push(symbols);

    return new Map(
      symbols.map((symbol) => [
        symbol,
        this.quotes[symbol] ?? {
          dataAsOf: null,
          fetchedAt,
          message: "Fixture quote missing.",
          price: null,
          source: "fixture_quote",
          status: "missing" as const,
        },
      ]),
    );
  }
}

function quote(price: number, dataAsOf = "2026-07-17T13:25:00.000Z"): ManualQuoteResult {
  return {
    dataAsOf,
    fetchedAt: nowIso,
    price,
    source: "fixture_quote",
    status: "fresh",
  };
}

function findingTypes(findings: PortfolioAnalyzerFinding[]) {
  return findings.map((finding) => finding.type);
}

async function syncManualPortfolio(args: {
  quotes: Record<string, ManualQuoteResult>;
  rows: ManualTrackedTrade[];
}) {
  const quoteService = new FixedQuoteService(args.quotes);
  const provider = new ManualPortfolioReadProvider({
    quoteService,
    repository: new FixedTradeRepository(args.rows),
    timeProvider: clock,
  });
  const result = await provider.syncPortfolio("user-1");

  assert.equal(result.ok, true);

  return { quoteService, snapshot: result.snapshot };
}

async function testEndToEndManualSliceWithoutNetwork() {
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error("Copilot deterministic integration test must not call the network.");
  }) as typeof fetch;

  try {
    const { quoteService, snapshot } = await syncManualPortfolio({
      quotes: {
        AMZN: quote(111),
        NTAP: quote(95.5),
      },
      rows: [
        trackedTrade({ id: "trade-amzn", symbol: "AMZN", target_price: 112 }),
        trackedTrade({
          entry_price: 98,
          id: "trade-ntap",
          opportunity_id: "opportunity-ntap",
          quantity: null,
          stop_loss: 94,
          symbol: "NTAP",
          target_price: 125,
        }),
        trackedTrade({ id: "trade-tsla-other-user", symbol: "TSLA", user_id: "user-2" }),
      ],
    });

    assert.equal(fetchCalled, false);
    assert.deepEqual(
      quoteService.requestedSymbols[0].sort(),
      ["AMZN", "NTAP"],
      "quotes should be batched after cross-user rows are removed",
    );
    assert.deepEqual(
      snapshot.positions.map((position) => position.symbol).sort(),
      ["AMZN", "NTAP"],
    );
    assert.equal(snapshot.userId, "user-1");
    assert.equal(snapshot.positions.find((position) => position.symbol === "AMZN")?.originalPlan?.targetPrice, 112);
    assert.equal(snapshot.positions.find((position) => position.symbol === "NTAP")?.quantity, null);
    assert.equal(snapshot.positions.find((position) => position.symbol === "NTAP")?.marketValue, null);

    const sourceHealth = new DataFreshnessService().fromPortfolioSnapshot(snapshot);
    assert.equal(sourceHealth[0].source, "fixture_quote");
    assert.equal(sourceHealth[0].status, "fresh");

    const findings = analyzePortfolio({
      clock,
      snapshot,
    });
    const types = findingTypes(findings);
    assert.ok(types.includes("NEAR_TARGET"), `expected near-target finding; got ${types.join(", ")}`);
    assert.ok(types.includes("NEAR_STOP"), `expected near-stop finding; got ${types.join(", ")}`);

    const viewModel = await buildCopilotUiViewModel({
      findings,
      mode: "manual",
      now: clock.now(),
      snapshot,
      warnings: ["Integration fixture only."],
    });
    assert.equal(viewModel.empty, false);
    assert.equal(viewModel.report.sourceHealth[0].source, "fixture_quote");
    assert.match(viewModel.narrative, /SwingFi Copilot report/i);
    assert.doesNotMatch(viewModel.narrative, /buy now|sell immediately|guaranteed/i);

    const email = buildCopilotDailyDigestEmail({
      copilotUrl: "https://www.swingfi.trade/copilot",
      customerName: "Gavin Boyle",
      viewModel,
    });
    assert.match(email.subject, /SwingFi Copilot digest/i);
    assert.match(email.html, /Needs attention/i);
    assert.doesNotMatch(`${email.html}\n${email.text}`, /buy now|sell now|guaranteed/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEmptyPortfolioAndFeatureFlagOff() {
  const { snapshot } = await syncManualPortfolio({
    quotes: {},
    rows: [],
  });
  const viewModel = await buildCopilotUiViewModel({
    mode: "manual",
    now: clock.now(),
    snapshot,
  });

  assert.equal(viewModel.empty, true);
  assert.equal(viewModel.dataHealth[0].source, "manual_tracker");
  assert.equal(viewModel.dataHealth[0].status, "missing");
  assert.equal(getCopilotFeatureConfig({}).copilotEnabled, false);
  assert.equal(getCopilotFeatureConfig({}).brokerageConnectionsEnabled, false);
  assert.equal(getCopilotFeatureConfig({}).paperTradingEnabled, false);
}

async function testStaleQuoteDegradesGracefully() {
  const { snapshot } = await syncManualPortfolio({
    quotes: {
      AMZN: quote(111, "2026-07-17T12:00:00.000Z"),
    },
    rows: [trackedTrade()],
  });

  assert.equal(snapshot.positions[0].currentPrice, null);
  assert.equal(snapshot.positions[0].quote?.status, "stale");

  const sourceHealth = new DataFreshnessService().fromPortfolioSnapshot(snapshot);
  assert.equal(sourceHealth[0].status, "stale");

  const findings = analyzePortfolio({ clock, snapshot });
  const types = findingTypes(findings);
  assert.ok(types.includes("DATA_STALE"), `expected stale data finding; got ${types.join(", ")}`);
  assert.ok(types.includes("QUOTE_UNAVAILABLE"), `expected unavailable quote finding; got ${types.join(", ")}`);
}

async function testNarratorFallbackAndRoutesStaySafe() {
  const { snapshot } = await syncManualPortfolio({
    quotes: { AMZN: quote(105) },
    rows: [trackedTrade()],
  });
  const viewModel = await buildCopilotUiViewModel({
    mode: "manual",
    now: clock.now(),
    snapshot,
  });
  const narration = await new OpenAICopilotNarrator({
    client: async () => ({
      error: "fixture OpenAI outage",
      mode: "openai",
      text: null,
    }),
    enabled: true,
  }).narrate(viewModel.report);

  assert.equal(narration.metadata.outputStatus, "fallback");
  assert.match(narration.narrative, /SwingFi Copilot report/i);

  const copilotRoute = readFileSync("app/api/copilot/report/route.ts", "utf8");
  assert.match(copilotRoute, /resolveCustomerSession\(request\)/);
  assert.doesNotMatch(copilotRoute, /searchParams\.get\(["']user_id["']\)/);

  const emailPreviewRoute = readFileSync("app/api/admin/copilot/email-preview/route.ts", "utf8");
  assert.match(emailPreviewRoute, /isAdminApiRequest\(request\)/);
  assert.match(emailPreviewRoute, /sent:\s*false/);
  assert.doesNotMatch(emailPreviewRoute, /sendEmail|resend\.emails\.send/);
}

async function main() {
  await testEndToEndManualSliceWithoutNetwork();
  await testEmptyPortfolioAndFeatureFlagOff();
  await testStaleQuoteDegradesGracefully();
  await testNarratorFallbackAndRoutesStaySafe();
  console.log("Copilot manual integration slice tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
