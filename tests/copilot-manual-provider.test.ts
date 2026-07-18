import assert from "node:assert/strict";
import {
  ManualPortfolioReadProvider,
  type ManualPortfolioQuoteService,
  type ManualPortfolioTradeRepository,
  type ManualQuoteResult,
  type ManualTrackedTrade,
} from "../lib/copilot/manual-portfolio-provider";
import { createFixedTimeProvider } from "../lib/copilot/time";

const fixedTime = createFixedTimeProvider("2026-07-17T13:30:00.000Z");

function trade(overrides: Partial<ManualTrackedTrade> = {}): ManualTrackedTrade {
  return {
    asset_type: "stock",
    closed_at: null,
    created_at: "2026-07-15T13:30:00.000Z",
    entry_price: 100,
    exit_price: null,
    id: "trade-1",
    notes:
      "Planned hold: 10 days.\n\nSwingFi exit plan: Hold while plan stays valid. Source: latest SwingFi daily analysis.",
    opened_at: "2026-07-15T14:00:00.000Z",
    opportunity_id: "opportunity-1",
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
  requestedUserIds: string[] = [];

  constructor(private readonly rows: ManualTrackedTrade[]) {}

  async listActiveTrackedTrades(userId: string) {
    this.requestedUserIds.push(userId);
    return this.rows;
  }
}

class FixedQuoteService implements ManualPortfolioQuoteService {
  requestedSymbols: string[][] = [];

  constructor(private readonly quotes: Record<string, ManualQuoteResult> = {}) {}

  async getQuotes(symbols: string[], fetchedAt: string) {
    this.requestedSymbols.push(symbols);
    return new Map(
      symbols.map((symbol) => [
        symbol,
        this.quotes[symbol] ?? {
          dataAsOf: fetchedAt,
          fetchedAt,
          message: "Fixture quote missing.",
          price: null,
          source: "fixture",
          status: "missing" as const,
        },
      ]),
    );
  }
}

class ThrowingQuoteService implements ManualPortfolioQuoteService {
  async getQuotes(
    _symbols: string[],
    _fetchedAt: string,
  ): Promise<Map<string, ManualQuoteResult>> {
    throw new Error("fixture quote outage");
  }
}

function freshQuote(price = 110): ManualQuoteResult {
  return {
    dataAsOf: "2026-07-17T13:29:00.000Z",
    fetchedAt: "2026-07-17T13:30:00.000Z",
    price,
    source: "fixture_quote",
    status: "fresh",
  };
}

async function sync(
  rows: ManualTrackedTrade[],
  quotes: ManualPortfolioQuoteService = new FixedQuoteService({ AMZN: freshQuote() }),
) {
  const provider = new ManualPortfolioReadProvider({
    quoteService: quotes,
    repository: new FixedTradeRepository(rows),
    timeProvider: fixedTime,
  });
  const result = await provider.syncPortfolio("user-1");

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected manual provider sync to succeed.");

  return result;
}

async function testNoTrackedTrades() {
  const result = await sync([], new FixedQuoteService());

  assert.equal(result.snapshot.positions.length, 0);
  assert.equal(result.snapshot.source, "swingfi_tracker");
  assert.equal(result.snapshot.completeness.level, "empty");
  assert.equal(result.snapshot.dataAsOf, "2026-07-17T13:30:00.000Z");
}

async function testOneCompleteTrackedTrade() {
  const result = await sync([trade()]);
  const position = result.snapshot.positions[0];

  assert.equal(position.symbol, "AMZN");
  assert.equal(position.quantity, 2);
  assert.equal(position.averageEntryPrice, 100);
  assert.equal(position.currentPrice, 110);
  assert.equal(position.costBasis, 200);
  assert.equal(position.marketValue, 220);
  assert.equal(position.unrealizedGainLoss, 20);
  assert.equal(position.originalPlan?.targetPrice, 112);
  assert.equal(position.originalPlan?.stopLoss, 94);
  assert.equal(position.originalPlan?.holdingPeriodDays, 10);
  assert.equal(position.originalPlan?.planSource, "swingfi_daily_analysis");
  assert.equal(result.snapshot.completeness.level, "complete");
}

async function testMissingQuantityOrCostBasis() {
  const result = await sync([trade({ entry_price: null, quantity: null })]);
  const position = result.snapshot.positions[0];

  assert.equal(position.quantity, null);
  assert.equal(position.averageEntryPrice, null);
  assert.equal(position.costBasis, null);
  assert.equal(position.marketValue, null);
  assert.equal(result.snapshot.completeness.level, "partial");
  assert.ok(result.snapshot.completeness.missingFields.includes("quantity"));
  assert.ok(result.snapshot.completeness.missingFields.includes("averageEntryPrice"));
}

async function testMissingCurrentQuote() {
  const result = await sync(
    [trade()],
    new FixedQuoteService({
      AMZN: {
        dataAsOf: null,
        fetchedAt: "2026-07-17T13:30:00.000Z",
        message: "No quote.",
        price: null,
        source: "fixture_quote",
        status: "missing",
      },
    }),
  );
  const position = result.snapshot.positions[0];

  assert.equal(position.currentPrice, null);
  assert.equal(position.marketValue, null);
  assert.equal(position.quote?.status, "missing");
  assert.equal(result.snapshot.completeness.level, "partial");
}

async function testStaleQuote() {
  const result = await sync(
    [trade()],
    new FixedQuoteService({
      AMZN: {
        dataAsOf: "2026-07-17T12:00:00.000Z",
        fetchedAt: "2026-07-17T13:30:00.000Z",
        price: 111,
        source: "fixture_quote",
        status: "fresh",
      },
    }),
  );
  const position = result.snapshot.positions[0];

  assert.equal(position.currentPrice, null);
  assert.equal(position.marketValue, null);
  assert.equal(position.quote?.status, "stale");
  assert.match(position.quote?.message ?? "", /too old/i);
}

async function testClosedTradeExclusion() {
  const result = await sync([
    trade({ id: "open-trade", status: "open" }),
    trade({ id: "closed-trade", status: "closed" }),
    trade({ id: "cancelled-trade", status: "cancelled" }),
  ]);

  assert.equal(result.snapshot.positions.length, 1);
  assert.equal(result.snapshot.positions[0].sourceTradeHistoryId, "open-trade");
}

async function testMultipleSymbols() {
  const quoteService = new FixedQuoteService({
    AMZN: freshQuote(110),
    NTAP: freshQuote(125),
  });
  const result = await sync(
    [
      trade({ id: "trade-amzn", symbol: "AMZN" }),
      trade({ id: "trade-ntap", symbol: "NTAP", target_price: 135 }),
    ],
    quoteService,
  );

  assert.deepEqual(
    result.snapshot.positions.map((position) => position.symbol).sort(),
    ["AMZN", "NTAP"],
  );
  assert.deepEqual(quoteService.requestedSymbols[0].sort(), ["AMZN", "NTAP"]);
}

async function testDuplicateSymbolBehavior() {
  const quoteService = new FixedQuoteService({ AMZN: freshQuote(110) });
  const result = await sync(
    [
      trade({ id: "trade-amzn-1", symbol: "AMZN", quantity: 1 }),
      trade({ id: "trade-amzn-2", symbol: "AMZN", quantity: 3, target_price: 118 }),
    ],
    quoteService,
  );

  assert.equal(result.snapshot.positions.length, 2);
  assert.deepEqual(
    result.snapshot.positions.map((position) => position.sourceTradeHistoryId).sort(),
    ["trade-amzn-1", "trade-amzn-2"],
  );
  assert.deepEqual(quoteService.requestedSymbols[0], ["AMZN"]);
}

async function testOriginalPlanPreservation() {
  const result = await sync([
    trade({
      notes:
        "Planned hold: 21 days.\n\nSwingFi exit plan: Protect capital first. Source: market-structure estimate.",
      opportunity_id: null,
      stop_loss: 88,
      target_price: 130,
    }),
  ]);
  const plan = result.snapshot.positions[0].originalPlan;

  assert.equal(plan?.targetPrice, 130);
  assert.equal(plan?.stopLoss, 88);
  assert.equal(plan?.holdingPeriodDays, 21);
  assert.equal(plan?.planSource, "market_structure_estimate");
}

async function testCrossUserAccessPreventionAtServiceBoundary() {
  const result = await sync([
    trade({ id: "user-1-trade", user_id: "user-1" }),
    trade({ id: "user-2-trade", user_id: "user-2" }),
  ]);

  assert.equal(result.snapshot.positions.length, 1);
  assert.equal(result.snapshot.positions[0].sourceTradeHistoryId, "user-1-trade");
  assert.ok(
    result.warnings.some((warning) => warning.includes("outside the requested user scope")),
  );
}

async function testPartialProviderFailureReturnsDegradedSnapshot() {
  const result = await sync([trade()], new ThrowingQuoteService());
  const position = result.snapshot.positions[0];

  assert.equal(position.currentPrice, null);
  assert.equal(position.marketValue, null);
  assert.equal(position.quote?.status, "missing");
  assert.equal(result.snapshot.completeness.level, "partial");
  assert.ok(result.warnings.some((warning) => warning.includes("Quote service failed")));
}

async function main() {
  await testNoTrackedTrades();
  await testOneCompleteTrackedTrade();
  await testMissingQuantityOrCostBasis();
  await testMissingCurrentQuote();
  await testStaleQuote();
  await testClosedTradeExclusion();
  await testMultipleSymbols();
  await testDuplicateSymbolBehavior();
  await testOriginalPlanPreservation();
  await testCrossUserAccessPreventionAtServiceBoundary();
  await testPartialProviderFailureReturnsDegradedSnapshot();
  console.log("Copilot manual portfolio provider tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
