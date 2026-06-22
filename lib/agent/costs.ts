export type AgentCostEstimate = {
  mode: "mock" | "deployed-estimate";
  openAiModel: string;
  expectedInputTokens: number;
  expectedOutputTokens: number;
  expectedWebSearchCalls: number;
  expectedSmsAlerts: number;
  estimatedOpenAiUsd: number;
  estimatedWebSearchUsd: number;
  estimatedTwilioSmsUsd: number;
  estimatedTotalUsd: number;
  assumptions: string[];
};

const openAiInputPerMillionUsd = 0.75;
const openAiOutputPerMillionUsd = 4.5;
const openAiWebSearchPerThousandCallsUsd = 10;
const twilioUsSmsSegmentUsd = 0.0083;

export function estimateDailyAgentCost(args: {
  selectedCount: number;
  customerAlertCount?: number;
}) {
  const expectedInputTokens = 8500 + args.selectedCount * 350;
  const expectedOutputTokens = 900 + args.selectedCount * 120;
  const expectedWebSearchCalls = 6;
  const expectedSmsAlerts = args.customerAlertCount ?? 1;
  const estimatedOpenAiUsd =
    (expectedInputTokens / 1_000_000) * openAiInputPerMillionUsd +
    (expectedOutputTokens / 1_000_000) * openAiOutputPerMillionUsd;
  const estimatedWebSearchUsd =
    (expectedWebSearchCalls / 1000) * openAiWebSearchPerThousandCallsUsd;
  const estimatedTwilioSmsUsd = expectedSmsAlerts * twilioUsSmsSegmentUsd;

  return {
    mode: "deployed-estimate",
    openAiModel: "GPT-5.4 mini",
    expectedInputTokens,
    expectedOutputTokens,
    expectedWebSearchCalls,
    expectedSmsAlerts,
    estimatedOpenAiUsd: Number(estimatedOpenAiUsd.toFixed(4)),
    estimatedWebSearchUsd: Number(estimatedWebSearchUsd.toFixed(4)),
    estimatedTwilioSmsUsd: Number(estimatedTwilioSmsUsd.toFixed(4)),
    estimatedTotalUsd: Number(
      (estimatedOpenAiUsd + estimatedWebSearchUsd + estimatedTwilioSmsUsd).toFixed(4),
    ),
    assumptions: [
      "Structured market, technical, financial, and government data is fetched in batches and scored without an LLM.",
      "The LLM is reserved for summarizing the final top 30 and explaining trade rationale.",
      "Web search is capped to a small number of broad market/news checks, not one search per stock.",
      "Morning analysis is cached once per market day and reused for all customers.",
      "SMS cost scales per customer alert; long messages may become multiple SMS segments.",
    ],
  } satisfies AgentCostEstimate;
}
