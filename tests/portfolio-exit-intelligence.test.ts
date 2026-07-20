import assert from "node:assert/strict";
import { buildExitReview, type ExitIntelligenceCandle } from "../lib/portfolio/exit-intelligence";

const baseCandles: ExitIntelligenceCandle[] = [
  { date: "2026-07-01", high: 101, low: 98, close: 100 },
  { date: "2026-07-02", high: 104, low: 100, close: 103 },
  { date: "2026-07-03", high: 107, low: 102, close: 106 },
  { date: "2026-07-06", high: 110, low: 105, close: 109 },
];

function review(overrides = {}) {
  return buildExitReview({
    candles: baseCandles,
    currentPrice: 106,
    daysHeld: 5,
    entryPrice: 100,
    openedAt: "2026-07-01T09:45:00.000Z",
    plannedHoldingDays: 10,
    stopLoss: 94,
    symbol: "AMZN",
    targetPrice: 112,
    ...overrides,
  });
}

function testTargetReached() {
  const result = review({ currentPrice: 113 });

  assert.equal(result.status, "target_reached");
  assert.equal(result.priority, 98);
  assert.equal(result.profitTrigger?.level, "target_reached");
  assert.equal(result.profitTrigger?.thresholdPct, 100);
  assert.match(result.beginnerMeaning, /planned for profit/i);
}

function testPeakFadeBeforeTarget() {
  const result = review({
    candles: [
      ...baseCandles,
      { date: "2026-07-07", high: 111, low: 107, close: 110 },
      { date: "2026-07-08", high: 110, low: 105, close: 106 },
    ],
    currentPrice: 106,
  });

  assert.equal(result.status, "peak_fading");
  assert.equal(result.metrics.maxGainPct, 11);
  assert.equal(result.metrics.fadeFromPeakPct, 4.5);
  assert.equal(result.profitTrigger?.level, "mostly_complete");
  assert.equal(result.profitTrigger?.thresholdPct, 85);
  assert.match(result.nextReview, /protecting gains/i);
}

function testProfitReviewTriggerAtSeventyPercent() {
  const result = review({
    candles: baseCandles,
    currentPrice: 109,
  });

  assert.equal(result.status, "profit_protection");
  assert.equal(result.metrics.progressToTargetPct, 75);
  assert.equal(result.profitTrigger?.level, "review_zone");
  assert.equal(result.profitTrigger?.thresholdPct, 70);
  assert.equal(result.profitTrigger?.triggerPrice, 108.4);
  assert.match(result.beginnerMeaning, /prepare the profit plan/i);
}

function testMostlyCompleteTriggerAtEightyFivePercent() {
  const result = review({
    candles: baseCandles,
    currentPrice: 110.5,
  });

  assert.equal(result.status, "profit_protection");
  assert.equal(result.metrics.progressToTargetPct, 87.5);
  assert.equal(result.profitTrigger?.level, "mostly_complete");
  assert.equal(result.profitTrigger?.thresholdPct, 85);
  assert.equal(result.profitTrigger?.triggerPrice, 110.2);
  assert.match(result.beginnerMeaning, /most of the planned upside/i);
}

function testNearStopUsesPositiveRisk() {
  const result = review({
    currentPrice: 96.5,
  });

  assert.equal(result.status, "near_stop");
  assert.equal(result.metrics.riskToStopPct, 2.6);
}

function testBelowStop() {
  const result = review({
    currentPrice: 93.75,
  });

  assert.equal(result.status, "below_stop");
  assert.match(result.nextReview, /reducing risk/i);
}

function testExpiredWindow() {
  const result = review({
    candles: [{ date: "2026-07-01", high: 103, low: 98, close: 101 }],
    currentPrice: 103,
    daysHeld: 11,
  });

  assert.equal(result.status, "time_window_expired");
}

function testInvalidLongPlan() {
  const result = review({
    stopLoss: 101,
  });

  assert.equal(result.status, "needs_manual_review");
  assert.match(result.beginnerMeaning, /valid long swing setup/i);
}

function testNoBannedLanguage() {
  const outputs = [
    review({ currentPrice: 113 }),
    review({ currentPrice: 93 }),
    review({ currentPrice: 109 }),
    review({ currentPrice: 106 }),
  ];
  const text = outputs
    .flatMap((item) => [item.actionLabel, item.beginnerMeaning, item.headline, item.nextReview, ...item.evidence])
    .join("\n");

  assert.doesNotMatch(text, /guaranteed|risk free|cannot lose|buy now|sell now/i);
}

testTargetReached();
testPeakFadeBeforeTarget();
testProfitReviewTriggerAtSeventyPercent();
testMostlyCompleteTriggerAtEightyFivePercent();
testNearStopUsesPositiveRisk();
testBelowStop();
testExpiredWindow();
testInvalidLongPlan();
testNoBannedLanguage();

console.log("Portfolio exit intelligence tests passed.");
