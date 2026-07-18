import { createHash } from "node:crypto";
import type {
  PortfolioAnalyzerFinding,
  PortfolioFindingSeverity,
  DataFreshness,
  PortfolioSnapshot,
} from "./types";

export type CopilotMarketRegime = "risk_on" | "balanced" | "defensive" | "unknown";

export type CopilotAccountSummary = {
  cashValue?: number | null;
  currency: string;
  investedValue?: number | null;
  knownPortfolioValue?: number | null;
  openPlanCount: number;
  positionCount: number;
};

export type CopilotPositionSummary = {
  accountId?: string;
  averageEntryPrice?: number | null;
  currentPrice?: number | null;
  dataAsOf: string | null;
  marketValue?: number | null;
  name?: string;
  openedAt?: string | null;
  planStatus?: string;
  remainingDownsidePct?: number | null;
  remainingUpsidePct?: number | null;
  stopLoss?: number | null;
  symbol: string;
  targetPrice?: number | null;
};

export type CopilotResearchOpportunity = {
  companyName?: string | null;
  confidence?: number | null;
  entryHigh?: number | null;
  entryLow?: number | null;
  riskScore?: number | null;
  score?: number | null;
  stopLoss?: number | null;
  summary?: string | null;
  symbol: string;
  targetPrice?: number | null;
};

export type CopilotSourceHealth = DataFreshness & {
  label?: string;
};

export type CopilotReportBuilderInput = {
  accountSummary: CopilotAccountSummary;
  findings: PortfolioAnalyzerFinding[];
  marketRegime: CopilotMarketRegime;
  portfolioDataAsOf: string | null;
  positions: CopilotPositionSummary[];
  reportDate: string;
  researchOpportunities: CopilotResearchOpportunity[];
  snapshot?: PortfolioSnapshot;
  sourceHealth: CopilotSourceHealth[];
};

export type DailyCopilotReportSectionId =
  | "portfolio_snapshot"
  | "needs_attention"
  | "still_inside_plan"
  | "data_limitations"
  | "research_watchlist"
  | "next_review_checklist";

export type DailyCopilotReportSection = {
  id: DailyCopilotReportSectionId;
  items: string[];
  priority: number;
  title: string;
};

export type DailyCopilotReportOutline = {
  sections: DailyCopilotReportSection[];
  summary: string;
};

export type DailyCopilotReportInput = {
  accountSummary: CopilotAccountSummary;
  dataLimitations: string[];
  findings: PortfolioAnalyzerFinding[];
  inputHash: string;
  marketRegime: CopilotMarketRegime;
  outline: DailyCopilotReportOutline;
  portfolioDataAsOf: string | null;
  positions: CopilotPositionSummary[];
  reportDate: string;
  researchOpportunities: CopilotResearchOpportunity[];
  sourceHealth: CopilotSourceHealth[];
  version: "daily-copilot-report.v1";
};

export type CopilotNarrationMetadata = {
  fallbackNarratorId?: string;
  inputHash: string;
  model: string;
  narratorId: string;
  outputStatus: "success" | "fallback" | "cached";
  promptVersion: string;
  sanitizedError?: string;
};

export type CopilotNarrationResult = {
  metadata: CopilotNarrationMetadata;
  narrative: string;
};

export type CopilotNarrator = {
  narrate(input: DailyCopilotReportInput): Promise<CopilotNarrationResult>;
};

export type CopilotNarrativeValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

const reportVersion = "daily-copilot-report.v1";
const ruleNarratorVersion = "rule-based-copilot-narrator.v1";

const severityPriority: Record<PortfolioFindingSeverity, number> = {
  high: 0,
  attention: 1,
  info: 2,
};

const bannedPhrasePatterns = [
  /guaranteed\s+profit/i,
  /guaranteed\s+winner/i,
  /guaranteed\s+return/i,
  /buy\s+now/i,
  /sell\s+immediately/i,
  /risk\s*free/i,
  /cannot\s+lose/i,
];

const allowedUppercaseWords = new Set([
  "AI",
  "API",
  "APR",
  "CPI",
  "ETF",
  "FMP",
  "FOMC",
  "LLC",
  "NYSE",
  "NASDAQ",
  "QQQ",
  "SEC",
  "SMA",
  "SPY",
  "USD",
]);

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function formatMaybeMoney(value: number | null | undefined, currency = "USD") {
  if (!Number.isFinite(Number(value))) return "unknown";
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: Number(value) >= 1000 ? 0 : 2,
    style: "currency",
  }).format(Number(value));
}

function cleanText(value: unknown, fallback = "Not available") {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text || fallback;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

export function stableReportInputHash(input: Omit<DailyCopilotReportInput, "inputHash">) {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

function sortFindings(findings: PortfolioAnalyzerFinding[]) {
  const byId = new Map<string, PortfolioAnalyzerFinding>();

  findings.forEach((finding) => {
    const existing = byId.get(finding.id);
    if (!existing || severityPriority[finding.severity] < severityPriority[existing.severity]) {
      byId.set(finding.id, finding);
    }
  });

  return Array.from(byId.values()).sort((a, b) => {
    const severityDiff = severityPriority[a.severity] - severityPriority[b.severity];
    if (severityDiff) return severityDiff;
    const symbolDiff = String(a.symbol ?? "").localeCompare(String(b.symbol ?? ""));
    if (symbolDiff) return symbolDiff;
    return a.id.localeCompare(b.id);
  });
}

function sortResearch(items: CopilotResearchOpportunity[]) {
  return [...items]
    .map((item) => ({ ...item, symbol: normalizeSymbol(item.symbol) }))
    .filter((item) => item.symbol)
    .sort((a, b) => {
      const scoreDiff = Number(b.score ?? -1) - Number(a.score ?? -1);
      if (scoreDiff) return scoreDiff;
      return a.symbol.localeCompare(b.symbol);
    });
}

function sourceDataLimitations(sourceHealth: CopilotSourceHealth[]) {
  return sourceHealth
    .filter((source) => source.status !== "fresh")
    .sort((a, b) => a.source.localeCompare(b.source))
    .map((source) => {
      const label = cleanText(source.label ?? source.source, source.source);
      const message = source.message ? ` ${source.message}` : "";
      return `${label} is ${source.status}.${message}`.trim();
    });
}

function findingDataLimitations(findings: PortfolioAnalyzerFinding[]) {
  const limitationTypes = new Set([
    "DATA_STALE",
    "QUOTE_UNAVAILABLE",
    "NO_ACTIVE_SWINGFI_PLAN",
  ]);

  return findings
    .filter((finding) => limitationTypes.has(finding.type))
    .map((finding) => `${finding.symbol ? `${finding.symbol}: ` : ""}${finding.message}`);
}

function buildSections(args: {
  accountSummary: CopilotAccountSummary;
  dataLimitations: string[];
  findings: PortfolioAnalyzerFinding[];
  marketRegime: CopilotMarketRegime;
  positions: CopilotPositionSummary[];
  researchOpportunities: CopilotResearchOpportunity[];
}) {
  const needsAttention = args.findings
    .filter((finding) => finding.severity === "high" || finding.severity === "attention")
    .map((finding) => `${finding.symbol ? `${finding.symbol}: ` : ""}${finding.title}. ${finding.message}`);

  const insidePlan = args.findings
    .filter((finding) => finding.type === "INSIDE_ORIGINAL_PLAN")
    .map((finding) => `${finding.symbol ? `${finding.symbol}: ` : ""}${finding.message}`);

  const snapshotItems = [
    `${args.accountSummary.positionCount} tracked position${args.accountSummary.positionCount === 1 ? "" : "s"} with ${args.accountSummary.openPlanCount} active SwingFi plan${args.accountSummary.openPlanCount === 1 ? "" : "s"}.`,
  ];

  if (args.accountSummary.knownPortfolioValue !== null && args.accountSummary.knownPortfolioValue !== undefined) {
    snapshotItems.push(
      `Known portfolio value is ${formatMaybeMoney(args.accountSummary.knownPortfolioValue, args.accountSummary.currency)}.`,
    );
  }

  args.positions.slice(0, 6).forEach((position) => {
    snapshotItems.push(
      `${normalizeSymbol(position.symbol)} is marked ${cleanText(position.planStatus, "tracked")} with current price ${formatMaybeMoney(position.currentPrice, args.accountSummary.currency)}, target ${formatMaybeMoney(position.targetPrice, args.accountSummary.currency)}, and stop ${formatMaybeMoney(position.stopLoss, args.accountSummary.currency)}.`,
    );
  });

  const researchItems = args.researchOpportunities.slice(0, 8).map((item) => {
    const parts = [
      `${item.symbol}${item.companyName ? ` (${cleanText(item.companyName)})` : ""}`,
      item.score !== null && item.score !== undefined ? `score ${item.score}` : null,
      item.confidence !== null && item.confidence !== undefined ? `confidence ${item.confidence}` : null,
      item.riskScore !== null && item.riskScore !== undefined ? `risk ${item.riskScore}` : null,
      item.summary ? cleanText(item.summary) : null,
    ].filter(Boolean);

    return parts.join(": ");
  });

  const checklist = [
    `Review high-severity items first while the market regime is ${args.marketRegime.replace(/_/g, "-")}.`,
    "Compare each tracked position with its original target, stop, and holding window.",
    "Treat stale or missing data as a reason to verify the source before relying on the report.",
  ];

  return [
    {
      id: "portfolio_snapshot" as const,
      items: snapshotItems,
      priority: 10,
      title: "Portfolio Snapshot",
    },
    {
      id: "needs_attention" as const,
      items: needsAttention.length ? needsAttention : ["No high-priority Copilot findings were supplied."],
      priority: 20,
      title: "Needs Attention",
    },
    {
      id: "still_inside_plan" as const,
      items: insidePlan.length ? insidePlan : ["No positions were confirmed as fully inside their original plan from supplied evidence."],
      priority: 30,
      title: "Still Inside Plan",
    },
    {
      id: "data_limitations" as const,
      items: args.dataLimitations.length ? args.dataLimitations : ["No major data limitations were supplied."],
      priority: 40,
      title: "Data Limitations",
    },
    {
      id: "research_watchlist" as const,
      items: researchItems.length ? researchItems : ["No selected SwingFi research opportunities were supplied."],
      priority: 50,
      title: "Research Watchlist",
    },
    {
      id: "next_review_checklist" as const,
      items: checklist,
      priority: 60,
      title: "Next Review Checklist",
    },
  ];
}

export class CopilotReportBuilder {
  build(input: CopilotReportBuilderInput): DailyCopilotReportInput {
    const findings = sortFindings(input.findings);
    const researchOpportunities = sortResearch(input.researchOpportunities);
    const positions = [...input.positions]
      .map((position) => ({ ...position, symbol: normalizeSymbol(position.symbol) }))
      .filter((position) => position.symbol)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    const dataLimitations = [
      ...findingDataLimitations(findings),
      ...sourceDataLimitations(input.sourceHealth),
    ].filter((item, index, list) => list.indexOf(item) === index);
    const outline = {
      sections: buildSections({
        accountSummary: input.accountSummary,
        dataLimitations,
        findings,
        marketRegime: input.marketRegime,
        positions,
        researchOpportunities,
      }),
      summary: `${input.accountSummary.positionCount} position${input.accountSummary.positionCount === 1 ? "" : "s"} reviewed for ${input.reportDate}.`,
    };
    const withoutHash: Omit<DailyCopilotReportInput, "inputHash"> = {
      accountSummary: input.accountSummary,
      dataLimitations,
      findings,
      marketRegime: input.marketRegime,
      outline,
      portfolioDataAsOf: input.portfolioDataAsOf,
      positions,
      reportDate: input.reportDate,
      researchOpportunities,
      sourceHealth: [...input.sourceHealth].sort((a, b) => a.source.localeCompare(b.source)),
      version: reportVersion,
    };

    return {
      ...withoutHash,
      inputHash: stableReportInputHash(withoutHash),
    };
  }
}

export function buildDailyCopilotReport(input: CopilotReportBuilderInput) {
  return new CopilotReportBuilder().build(input);
}

function allowedSymbols(input: DailyCopilotReportInput) {
  const symbols = new Set<string>(["SPY", "QQQ"]);

  input.positions.forEach((position) => symbols.add(normalizeSymbol(position.symbol)));
  input.researchOpportunities.forEach((item) => symbols.add(normalizeSymbol(item.symbol)));
  input.findings.forEach((finding) => {
    if (finding.symbol) symbols.add(normalizeSymbol(finding.symbol));
  });

  return symbols;
}

function extractTickerLikeTokens(text: string) {
  return Array.from(new Set(text.match(/\b[A-Z]{2,5}(?:\.[A-Z])?\b/g) ?? []));
}

function normalizeNumberToken(value: string) {
  return value.replace(/[$,%]/g, "").replace(/,/g, "");
}

function extractNumberTokens(text: string) {
  return Array.from(
    new Set(
      text
        .match(/[$]?\b\d{1,4}(?:,\d{3})*(?:\.\d+)?%?/g)
        ?.map(normalizeNumberToken) ?? [],
    ),
  );
}

function allowedNumberTokens(input: DailyCopilotReportInput) {
  return new Set(extractNumberTokens(stableStringify(input)));
}

export function validateCopilotNarrative(
  narrative: string,
  input: DailyCopilotReportInput,
): CopilotNarrativeValidationResult {
  const text = cleanText(narrative, "");

  if (!text) return { ok: false, reason: "Narrative is empty." };

  const banned = bannedPhrasePatterns.find((pattern) => pattern.test(text));
  if (banned) return { ok: false, reason: `Narrative contains banned phrase: ${banned.source}.` };

  const symbols = allowedSymbols(input);
  const unsupportedTicker = extractTickerLikeTokens(text).find(
    (token) => !symbols.has(token) && !allowedUppercaseWords.has(token),
  );

  if (unsupportedTicker) {
    return { ok: false, reason: `Narrative introduced unsupported ticker or code: ${unsupportedTicker}.` };
  }

  const numbers = allowedNumberTokens(input);
  const unsupportedNumber = extractNumberTokens(text).find((token) => !numbers.has(token));

  if (unsupportedNumber) {
    return { ok: false, reason: `Narrative introduced unsupported number: ${unsupportedNumber}.` };
  }

  return { ok: true };
}

export class RuleBasedCopilotNarrator implements CopilotNarrator {
  async narrate(input: DailyCopilotReportInput): Promise<CopilotNarrationResult> {
    const sectionText = input.outline.sections
      .sort((a, b) => a.priority - b.priority)
      .map((section) => {
        const items = section.items.map((item) => `- ${item}`).join("\n");
        return `${section.title}\n${items}`;
      })
      .join("\n\n");
    const narrative = [
      `SwingFi Copilot report for ${input.reportDate}.`,
      `Market regime: ${input.marketRegime.replace(/_/g, "-")}.`,
      sectionText,
      "Use this as research to review. SwingFi does not place trades or provide personalized financial advice.",
    ].join("\n\n");

    return {
      metadata: {
        inputHash: input.inputHash,
        model: "deterministic",
        narratorId: "rule_based_copilot",
        outputStatus: "success",
        promptVersion: ruleNarratorVersion,
      },
      narrative,
    };
  }
}

export function buildCopilotNarrationPrompt(input: DailyCopilotReportInput) {
  return {
    instructions:
      "Rewrite the supplied SwingFi Copilot report into clearer plain English. Use only supplied evidence. Do not calculate values, returns, position sizes, targets, stops, reward/risk, or severity. Do not introduce any ticker, number, date, price, percentage, target, stop, or factual claim absent from the JSON. Do not use buy now, sell immediately, guaranteed, risk free, cannot lose, or direct trade commands. Output strict JSON with one string field named narrative.",
    report: input,
  };
}

export function getRuleBasedCopilotNarratorVersion() {
  return ruleNarratorVersion;
}

export function formatCopilotEvidenceValue(value: unknown) {
  if (typeof value === "number") return Number(value.toFixed(4)).toString();
  return cleanText(value, "unknown");
}
