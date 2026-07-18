import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MemoryCopilotNarrationCache,
  OpenAICopilotNarrator,
} from "../lib/copilot/openai-narrator";
import {
  buildDailyCopilotReport,
  type CopilotReportBuilderInput,
  RuleBasedCopilotNarrator,
  validateCopilotNarrative,
} from "../lib/copilot/reporting";
import type { PortfolioAnalyzerFinding } from "../lib/copilot/types";

const asOf = "2026-07-17T13:30:00.000Z";

function finding(overrides: Partial<PortfolioAnalyzerFinding> = {}): PortfolioAnalyzerFinding {
  return {
    dataCompleteness: "Complete for this rule.",
    evidence: [
      {
        asOf,
        metric: "current_price",
        source: "fixture",
        value: 105,
      },
    ],
    id: "finding-1",
    message: "AMZN is still between the original target and stop from supplied evidence.",
    positionId: "position-1",
    ruleVersion: "portfolio-analyzer.v1",
    severity: "info",
    symbol: "AMZN",
    title: "Inside original plan",
    type: "INSIDE_ORIGINAL_PLAN",
    ...overrides,
  };
}

function reportInput(overrides: Partial<CopilotReportBuilderInput> = {}) {
  return {
    accountSummary: {
      currency: "USD",
      knownPortfolioValue: 1000,
      openPlanCount: 1,
      positionCount: 1,
    },
    findings: [finding()],
    marketRegime: "balanced" as const,
    portfolioDataAsOf: asOf,
    positions: [
      {
        currentPrice: 105,
        dataAsOf: asOf,
        name: "Amazon",
        planStatus: "Inside plan",
        stopLoss: 95,
        symbol: "AMZN",
        targetPrice: 110,
      },
    ],
    reportDate: "2026-07-17",
    researchOpportunities: [
      {
        companyName: "Amazon",
        confidence: 78,
        riskScore: 42,
        score: 82,
        summary: "Ranked from supplied SwingFi research evidence.",
        symbol: "AMZN",
      },
    ],
    sourceHealth: [
      {
        dataAsOf: asOf,
        fetchedAt: asOf,
        source: "fmp_quotes",
        status: "fresh" as const,
      },
    ],
    ...overrides,
  };
}

function buildReport(overrides: Partial<CopilotReportBuilderInput> = {}) {
  return buildDailyCopilotReport(reportInput(overrides));
}

async function testDeterministicReportOrdering() {
  const highFinding = finding({
    id: "finding-2",
    message: "NTAP is at or below the original stop from supplied evidence.",
    severity: "high",
    symbol: "NTAP",
    title: "At or below original stop",
    type: "BELOW_OR_AT_STOP",
  });
  const first = buildReport({
    findings: [finding(), highFinding],
    positions: [
      { currentPrice: 40, dataAsOf: asOf, planStatus: "Needs review", symbol: "NTAP" },
      { currentPrice: 105, dataAsOf: asOf, planStatus: "Inside plan", symbol: "AMZN" },
    ],
    researchOpportunities: [
      { score: 80, symbol: "NTAP" },
      { score: 82, symbol: "AMZN" },
    ],
  });
  const second = buildReport({
    findings: [highFinding, finding()],
    positions: [
      { currentPrice: 105, dataAsOf: asOf, planStatus: "Inside plan", symbol: "AMZN" },
      { currentPrice: 40, dataAsOf: asOf, planStatus: "Needs review", symbol: "NTAP" },
    ],
    researchOpportunities: [
      { score: 82, symbol: "AMZN" },
      { score: 80, symbol: "NTAP" },
    ],
  });

  assert.equal(first.inputHash, second.inputHash);
  assert.equal(first.findings[0].severity, "high");
  assert.equal(first.positions[0].symbol, "AMZN");
  assert.equal(first.researchOpportunities[0].symbol, "AMZN");
}

async function testEmptyPortfolio() {
  const report = buildReport({
    accountSummary: {
      currency: "USD",
      knownPortfolioValue: null,
      openPlanCount: 0,
      positionCount: 0,
    },
    findings: [],
    positions: [],
    researchOpportunities: [],
  });

  assert.equal(report.outline.summary, "0 positions reviewed for 2026-07-17.");
  assert.ok(
    report.outline.sections
      .find((section) => section.id === "portfolio_snapshot")
      ?.items[0].includes("0 tracked positions"),
  );
}

async function testMissingStaleDataDisclosure() {
  const report = buildReport({
    findings: [
      finding({
        id: "stale",
        message: "AMZN has stale price data.",
        severity: "attention",
        title: "Price data is stale",
        type: "DATA_STALE",
      }),
    ],
    sourceHealth: [
      {
        dataAsOf: null,
        fetchedAt: null,
        label: "SEC filings",
        message: "Direct filing lookup did not return fresh data.",
        source: "sec_filings",
        status: "missing",
      },
    ],
  });

  assert.ok(report.dataLimitations.some((item) => item.includes("stale price")));
  assert.ok(report.dataLimitations.some((item) => item.includes("SEC filings is missing")));
}

async function testRuleBasedNarration() {
  const report = buildReport();
  const result = await new RuleBasedCopilotNarrator().narrate(report);

  assert.equal(result.metadata.inputHash, report.inputHash);
  assert.equal(result.metadata.outputStatus, "success");
  assert.ok(result.narrative.includes("Portfolio Snapshot"));
  assert.ok(result.narrative.includes("SwingFi does not place trades"));
}

async function testMockedOpenAiSuccessAndCache() {
  let calls = 0;
  const report = buildReport();
  const cache = new MemoryCopilotNarrationCache();
  const narrator = new OpenAICopilotNarrator({
    cache,
    client: async () => {
      calls += 1;
      return {
        error: null,
        mode: "openai",
        text: JSON.stringify({
          narrative:
            "AMZN remains a research item from the supplied report. Review the original plan and data limitations.",
        }),
      };
    },
    enabled: true,
    model: "test-model",
    promptVersion: "test-prompt.v1",
  });

  const first = await narrator.narrate(report);
  const second = await narrator.narrate(report);

  assert.equal(first.metadata.outputStatus, "success");
  assert.equal(first.metadata.model, "test-model");
  assert.equal(first.metadata.promptVersion, "test-prompt.v1");
  assert.equal(second.metadata.outputStatus, "cached");
  assert.equal(calls, 1);
}

async function testOpenAiTimeoutAndErrorFallback() {
  const report = buildReport();
  const timeout = await new OpenAICopilotNarrator({
    client: () => new Promise((resolve) => setTimeout(() => resolve({ error: null, mode: "openai", text: "{}" }), 50)),
    enabled: true,
    timeoutMs: 1,
  }).narrate(report);
  const error = await new OpenAICopilotNarrator({
    client: async () => ({ error: "provider failed", mode: "openai", text: null }),
    enabled: true,
  }).narrate(report);

  assert.equal(timeout.metadata.outputStatus, "fallback");
  assert.equal(error.metadata.outputStatus, "fallback");
  assert.equal(timeout.metadata.fallbackNarratorId, "rule_based_copilot");
}

async function testNarrativeValidationRejectsUnsupportedContent() {
  const report = buildReport();

  assert.equal(validateCopilotNarrative("TSLA is also strong.", report).ok, false);
  assert.equal(validateCopilotNarrative("AMZN can reach 999.", report).ok, false);
  assert.equal(validateCopilotNarrative("AMZN is a guaranteed winner.", report).ok, false);
}

async function testOpenAiPolicyFallbacks() {
  const report = buildReport();
  const unsupportedNumber = await new OpenAICopilotNarrator({
    client: async () => ({
      error: null,
      mode: "openai",
      text: JSON.stringify({ narrative: "AMZN has 999 reasons to review." }),
    }),
    enabled: true,
  }).narrate(report);
  const banned = await new OpenAICopilotNarrator({
    client: async () => ({
      error: null,
      mode: "openai",
      text: JSON.stringify({ narrative: "AMZN is a guaranteed profit." }),
    }),
    enabled: true,
  }).narrate(report);

  assert.equal(unsupportedNumber.metadata.outputStatus, "fallback");
  assert.equal(banned.metadata.outputStatus, "fallback");
}

async function testInputHashStabilityAndPromptVersion() {
  const report = buildReport();
  const narrator = new RuleBasedCopilotNarrator();
  const first = await narrator.narrate(report);
  const second = await narrator.narrate(report);

  assert.equal(report.inputHash.length, 64);
  assert.equal(first.metadata.inputHash, second.metadata.inputHash);
  assert.ok(first.metadata.promptVersion.includes("rule-based"));
}

async function testNoLiveApiCallsWhenDisabled() {
  let called = false;
  const result = await new OpenAICopilotNarrator({
    client: async () => {
      called = true;
      throw new Error("Network should not be called.");
    },
    enabled: false,
  }).narrate(buildReport());

  assert.equal(called, false);
  assert.equal(result.metadata.outputStatus, "fallback");
}

function testDocsAvoidBannedLanguage() {
  const source = readFileSync("lib/copilot/reporting.ts", "utf8");
  const bannedImperatives = ["buy now", "sell immediately", "guaranteed winner"];

  bannedImperatives.forEach((phrase) => {
    assert.ok(
      !source.toLowerCase().includes(`return "${phrase}`),
      `Reporting source should not generate banned phrase: ${phrase}`,
    );
  });
}

async function main() {
  await testDeterministicReportOrdering();
  await testEmptyPortfolio();
  await testMissingStaleDataDisclosure();
  await testRuleBasedNarration();
  await testMockedOpenAiSuccessAndCache();
  await testOpenAiTimeoutAndErrorFallback();
  await testNarrativeValidationRejectsUnsupportedContent();
  await testOpenAiPolicyFallbacks();
  await testInputHashStabilityAndPromptVersion();
  await testNoLiveApiCallsWhenDisabled();
  testDocsAvoidBannedLanguage();
}

main()
  .then(() => {
    console.log("copilot reporting tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
