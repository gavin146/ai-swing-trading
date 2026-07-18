import type { OpportunityRow } from "../database.types";
import type {
  DailyCopilotReportInput,
  CopilotResearchOpportunity,
  CopilotSourceHealth,
} from "./reporting";
import {
  buildDailyCopilotReport,
  RuleBasedCopilotNarrator,
} from "./reporting";
import type { PortfolioAnalyzerFinding } from "./portfolio-analyzer";
import { analyzePortfolio } from "./portfolio-analyzer";
import type { PortfolioPosition, PortfolioSnapshot } from "./types";

export type CopilotSeverity = "info" | "attention" | "high";

export type CopilotPositionCard = {
  currentPrice: number | null;
  dataAsOf: string | null;
  daysHeld: number | null;
  entryPrice: number | null;
  freshness: "fresh" | "stale" | "missing" | "error";
  id: string;
  planStatus: string;
  remainingWindowDays: number | null;
  source: string;
  stopLoss: number | null;
  symbol: string;
  targetPrice: number | null;
};

export type CopilotUiViewModel = {
  brokeragePlaceholder: {
    body: string;
    title: string;
  };
  dataHealth: CopilotSourceHealth[];
  empty: boolean;
  findings: PortfolioAnalyzerFinding[];
  mode: "manual" | "fixture";
  narrative: string;
  positions: CopilotPositionCard[];
  report: DailyCopilotReportInput;
  researchOpportunities: CopilotResearchOpportunity[];
  snapshotSource: string;
  sourceLabel: string;
  warnings: string[];
};

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeSymbol(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function daysBetween(start: string | undefined, now: Date) {
  if (!start) return null;
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 86_400_000));
}

function toIso(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function positionStatus(position: PortfolioPosition) {
  const current = positiveNumber(position.currentPrice);
  const target = positiveNumber(position.originalPlan?.targetPrice);
  const stop = positiveNumber(position.originalPlan?.stopLoss);

  if (!current) return "Needs fresh price";
  if (stop && current <= stop) return "Risk line reached";
  if (target && current >= target) return "Target area reached";
  if (position.quote?.status === "stale") return "Price needs refresh";
  if (target && (target - current) / current <= 0.03) return "Close to target";
  if (stop && (current - stop) / current <= 0.03) return "Close to risk line";
  return "Inside saved plan";
}

function positionCard(position: PortfolioPosition, now: Date): CopilotPositionCard {
  const daysHeld = daysBetween(position.openedAt, now);
  const holdingDays = positiveNumber(position.originalPlan?.holdingPeriodDays);

  return {
    currentPrice: positiveNumber(position.currentPrice),
    dataAsOf: toIso(position.quote?.dataAsOf ?? position.dataAsOf),
    daysHeld,
    entryPrice: positiveNumber(position.originalPlan?.entryPrice ?? position.averageEntryPrice),
    freshness: position.quote?.status ?? "missing",
    id: position.id,
    planStatus: positionStatus(position),
    remainingWindowDays:
      daysHeld !== null && holdingDays !== null ? Math.max(0, holdingDays - daysHeld) : null,
    source: position.originalPlan?.planSource ?? position.providerId,
    stopLoss: positiveNumber(position.originalPlan?.stopLoss),
    symbol: normalizeSymbol(position.symbol),
    targetPrice: positiveNumber(position.originalPlan?.targetPrice),
  };
}

function sourceHealthFromSnapshot(snapshot: PortfolioSnapshot): CopilotSourceHealth[] {
  const quoteStatuses = new Map<string, CopilotSourceHealth>();

  snapshot.positions.forEach((position) => {
    const source = position.quote?.source ?? "manual_tracker";
    const existing = quoteStatuses.get(source);
    const status = position.quote?.status ?? "missing";
    const nextStatus =
      status === "error" ||
      existing?.status === "error"
        ? "error"
        : status === "missing" || existing?.status === "missing"
          ? "missing"
          : status === "stale" || existing?.status === "stale"
            ? "stale"
            : "fresh";

    quoteStatuses.set(source, {
      dataAsOf: position.quote?.dataAsOf ?? position.dataAsOf,
      fetchedAt: position.quote?.fetchedAt ?? position.fetchedAt,
      label: source === "fmp_profile" ? "FMP prices" : source.replace(/_/g, " "),
      message: position.quote?.message,
      source,
      status: nextStatus,
    });
  });

  if (!quoteStatuses.size) {
    quoteStatuses.set("manual_tracker", {
      dataAsOf: snapshot.dataAsOf,
      fetchedAt: snapshot.fetchedAt,
      label: "SwingFi tracker",
      message: "No tracked positions were found for this report.",
      source: "manual_tracker",
      status: "missing",
    });
  }

  return Array.from(quoteStatuses.values()).sort((a, b) => a.source.localeCompare(b.source));
}

function accountValue(snapshot: PortfolioSnapshot) {
  const values = snapshot.positions.map((position) => positiveNumber(position.marketValue));

  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + Number(value), 0);
}

function opportunitiesToResearch(rows: OpportunityRow[]): CopilotResearchOpportunity[] {
  return rows.slice(0, 8).map((row) => ({
    confidence: row.confidence,
    entryHigh: row.entry_high,
    entryLow: row.entry_low,
    riskScore: row.risk_score,
    score: row.score,
    stopLoss: row.stop_loss,
    summary: row.explanation.slice(0, 180),
    symbol: row.symbol,
    targetPrice: row.target_price,
  }));
}

export async function buildCopilotUiViewModel(args: {
  findings?: PortfolioAnalyzerFinding[];
  mode: "manual" | "fixture";
  now?: Date;
  opportunities?: OpportunityRow[];
  snapshot: PortfolioSnapshot;
  warnings?: string[];
}): Promise<CopilotUiViewModel> {
  const now = args.now ?? new Date();
  const positions = args.snapshot.positions.map((position) => positionCard(position, now));
  const findings =
    args.findings ??
    analyzePortfolio({
      knownPortfolioValue: accountValue(args.snapshot),
      snapshot: args.snapshot,
    });
  const sourceHealth = sourceHealthFromSnapshot(args.snapshot);
  const researchOpportunities = opportunitiesToResearch(args.opportunities ?? []);
  const report = buildDailyCopilotReport({
    accountSummary: {
      currency: "USD",
      knownPortfolioValue: accountValue(args.snapshot),
      openPlanCount: positions.filter((position) => position.source).length,
      positionCount: positions.length,
    },
    findings,
    marketRegime: "unknown",
    portfolioDataAsOf: args.snapshot.dataAsOf,
    positions: positions.map((position) => ({
      currentPrice: position.currentPrice,
      dataAsOf: position.dataAsOf,
      openedAt: null,
      planStatus: position.planStatus,
      stopLoss: position.stopLoss,
      symbol: position.symbol,
      targetPrice: position.targetPrice,
    })),
    reportDate: now.toISOString().slice(0, 10),
    researchOpportunities,
    sourceHealth,
  });
  const narrative = await new RuleBasedCopilotNarrator().narrate(report);

  return {
    brokeragePlaceholder: {
      body:
        "SwingFi is still research-only. A secure read-only brokerage provider has not been selected, so Copilot uses your SwingFi tracked positions and never asks for brokerage credentials.",
      title: "Brokerage connections are not enabled",
    },
    dataHealth: sourceHealth,
    empty: positions.length === 0,
    findings,
    mode: args.mode,
    narrative: narrative.narrative,
    positions,
    report,
    researchOpportunities,
    snapshotSource: args.snapshot.source,
    sourceLabel: args.mode === "fixture" ? "Demo fixture" : "SwingFi tracker",
    warnings: args.warnings ?? args.snapshot.completeness.warnings,
  };
}

export function createCopilotDemoSnapshot(now = new Date()): PortfolioSnapshot {
  const fetchedAt = now.toISOString();
  const staleAsOf = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  return {
    accounts: [],
    completeness: {
      level: "partial",
      missingFields: ["freshQuote"],
      warnings: ["Demo fixture: one quote is intentionally stale for UI testing."],
    },
    dataAsOf: fetchedAt,
    fetchedAt,
    id: `fixture:copilot:${fetchedAt}`,
    positions: [
      {
        assetType: "stock",
        averageEntryPrice: 105,
        costBasis: 210,
        currency: "USD",
        currentPrice: 111,
        dataAsOf: fetchedAt,
        fetchedAt,
        id: "fixture-amzn",
        marketValue: 222,
        openedAt: new Date(now.getTime() - 4 * 86_400_000).toISOString(),
        originalPlan: {
          entryPrice: 105,
          holdingPeriodDays: 10,
          notes: "Demo SwingFi plan.",
          opportunityId: "fixture-opportunity-amzn",
          planCreatedAt: new Date(now.getTime() - 4 * 86_400_000).toISOString(),
          planSource: "swingfi_daily_analysis",
          stopLoss: 99,
          targetPrice: 116,
        },
        providerId: "manual_trade_history",
        quantity: 2,
        quote: {
          dataAsOf: fetchedAt,
          fetchedAt,
          message: "Demo quote for local UI preview.",
          source: "demo_fixture",
          status: "fresh",
        },
        symbol: "AMZN",
        unrealizedGainLoss: 12,
      },
      {
        assetType: "stock",
        averageEntryPrice: 70,
        costBasis: 70,
        currency: "USD",
        currentPrice: null,
        dataAsOf: staleAsOf,
        fetchedAt,
        id: "fixture-ntap",
        marketValue: null,
        openedAt: new Date(now.getTime() - 8 * 86_400_000).toISOString(),
        originalPlan: {
          entryPrice: 70,
          holdingPeriodDays: 9,
          notes: "Demo SwingFi plan with stale quote.",
          opportunityId: "fixture-opportunity-ntap",
          planCreatedAt: new Date(now.getTime() - 8 * 86_400_000).toISOString(),
          planSource: "swingfi_daily_analysis",
          stopLoss: 66,
          targetPrice: 76,
        },
        providerId: "manual_trade_history",
        quantity: 1,
        quote: {
          dataAsOf: staleAsOf,
          fetchedAt,
          message: "Demo stale quote state.",
          source: "demo_fixture",
          status: "stale",
        },
        symbol: "NTAP",
        unrealizedGainLoss: null,
      },
    ],
    providerId: "manual_trade_history",
    source: "swingfi_tracker",
    userId: "demo-user",
  };
}

export async function createDemoCopilotUiViewModel(now = new Date()) {
  return buildCopilotUiViewModel({
    mode: "fixture",
    now,
    snapshot: createCopilotDemoSnapshot(now),
    warnings: ["Demo fixture only. This is not live account or brokerage data."],
  });
}
