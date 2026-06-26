import type { AssetType, OpportunityRow } from "@/lib/database.types";
import { runFmpDailyRankingAgent } from "@/lib/agent";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { AgentRunResult } from "@/lib/agent/types";

export type OpportunityDataSource = "supabase" | "agent-preview" | "empty";

export type OpportunityTrustStatus = "live" | "partial" | "mock" | "missing";

export type OpportunityTrustPanel = {
  calibrationStatus: "active" | "checked" | "not_configured";
  calibrationRuleCount: number;
  dataFeeds: Array<{
    label: string;
    status: OpportunityTrustStatus;
    text: string;
  }>;
  lastRunAt: string | null;
  marketRegime: string | null;
  openAiStatus: OpportunityTrustStatus;
  runSource: string;
  summary: string | null;
  universeCount: number;
  marketCoverage: {
    status: "healthy" | "thin" | "blocked" | "unknown";
    requestedUniverseLimit: number | null;
    screenerCount: number | null;
    detailedCandidateTarget: number | null;
    detailedCandidateCount: number | null;
    qualifiedCandidateCount: number | null;
    rankedCandidateCount: number | null;
    minimumScreenerCount: number | null;
    minimumDetailedCandidateCount: number | null;
    warning: string | null;
  };
};

export type OpportunityListResult = {
  rows: OpportunityRow[];
  source: OpportunityDataSource;
  reason?: string;
  trust?: OpportunityTrustPanel;
};

export type OpportunityWriteValues = {
  asset_type: AssetType;
  confidence: number;
  entry_high: number;
  entry_low: number;
  explanation: string;
  risk_score: number;
  score: number;
  stop_loss: number;
  symbol: string;
  target_price: number;
};

type AgentPreviewCacheEntry = {
  expiresAt: number;
  result: OpportunityListResult;
};

type OpportunityListCacheEntry = {
  expiresAt: number;
  result: OpportunityListResult;
};

const agentPreviewCacheTtlMs = 15 * 60 * 1000;
const opportunityListCacheTtlMs = 60 * 1000;
let latestAgentPreviewCache: AgentPreviewCacheEntry | null = null;
const symbolAgentPreviewCache = new Map<string, AgentPreviewCacheEntry>();
const opportunityListCache = new Map<string, OpportunityListCacheEntry>();
const inFlightOpportunityListRequests = new Map<string, Promise<OpportunityListResult>>();

export function invalidateOpportunityListCache() {
  opportunityListCache.clear();
  inFlightOpportunityListRequests.clear();
}

function calculateDerived(values: OpportunityWriteValues) {
  const expectedGain = ((values.target_price - values.entry_low) / values.entry_low) * 100;
  const expectedLoss = ((values.entry_low - values.stop_loss) / values.entry_low) * 100;

  return {
    expected_gain: Number(Math.max(expectedGain, 0).toFixed(1)),
    expected_loss: Number(Math.max(expectedLoss, 0).toFixed(1)),
  };
}

function normalizeOpportunity(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    symbol: String(row.symbol),
    asset_type: row.asset_type as AssetType,
    score: Number(row.score),
    confidence: Number(row.confidence),
    risk_score: Number(row.risk_score),
    entry_low: Number(row.entry_low),
    entry_high: Number(row.entry_high),
    target_price: Number(row.target_price),
    stop_loss: Number(row.stop_loss),
    expected_gain: Number(row.expected_gain),
    expected_loss: Number(row.expected_loss),
    holding_period_days: Number(row.holding_period_days),
    explanation: String(row.explanation),
    created_at: String(row.created_at),
  } satisfies OpportunityRow;
}

function normalizeJoinedOpportunity(row: unknown) {
  const joinedRow = Array.isArray(row) ? row[0] : row;

  if (!joinedRow || typeof joinedRow !== "object") {
    return null;
  }

  return normalizeOpportunity(joinedRow as Record<string, unknown>);
}

function hasFmpKey() {
  return Boolean(process.env.FMP_API_KEY || process.env.FINANCIAL_DATA_API_KEY);
}

function trustStatus(value: unknown): OpportunityTrustStatus {
  if (value === "live" || value === "partial" || value === "mock") return value;
  return "missing";
}

function feedText(status: OpportunityTrustStatus, liveText: string) {
  if (status === "live") return liveText;
  if (status === "partial") return "Partially available for this run.";
  if (status === "mock") return "Using fallback research inputs.";
  return "Not available for this run.";
}

function asCoverageNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseMarketCoverage(
  value: unknown,
  fallbackUniverseCount: number | null | undefined,
): OpportunityTrustPanel["marketCoverage"] {
  const fallbackCount = Number(fallbackUniverseCount ?? 0) || null;

  if (!value || typeof value !== "object") {
    return {
      status: "unknown",
      requestedUniverseLimit: null,
      screenerCount: null,
      detailedCandidateTarget: null,
      detailedCandidateCount: fallbackCount,
      qualifiedCandidateCount: null,
      rankedCandidateCount: fallbackCount,
      minimumScreenerCount: null,
      minimumDetailedCandidateCount: null,
      warning: null,
    };
  }

  const row = value as Record<string, unknown>;
  const status = row.status;

  return {
    status:
      status === "healthy" || status === "thin" || status === "blocked"
        ? status
        : "unknown",
    requestedUniverseLimit: asCoverageNumber(row.requestedUniverseLimit),
    screenerCount: asCoverageNumber(row.screenerCount),
    detailedCandidateTarget: asCoverageNumber(row.detailedCandidateTarget),
    detailedCandidateCount: asCoverageNumber(row.detailedCandidateCount),
    qualifiedCandidateCount: asCoverageNumber(row.qualifiedCandidateCount),
    rankedCandidateCount: asCoverageNumber(row.rankedCandidateCount),
    minimumScreenerCount: asCoverageNumber(row.minimumScreenerCount),
    minimumDetailedCandidateCount: asCoverageNumber(row.minimumDetailedCandidateCount),
    warning: typeof row.warning === "string" && row.warning.trim() ? row.warning : null,
  };
}

function buildTrustPanel(args: {
  calibrationRuleCount?: number;
  completedAt?: string | null;
  dataQuality?: Partial<AgentRunResult["dataQuality"]> | null;
  marketRegime?: string | null;
  selectedCount?: number | null;
  source: string;
  summary?: string | null;
  universeCount?: number | null;
}): OpportunityTrustPanel {
  const quality = args.dataQuality ?? {};
  const priceData = trustStatus(quality.priceData);
  const macroData = trustStatus(quality.macroData);
  const secData = trustStatus(quality.secData);
  const newsData = trustStatus(quality.newsData);
  const eventData = trustStatus(quality.eventData);
  const financialData = trustStatus(quality.financialData);
  const calibrationRuleCount = args.calibrationRuleCount ?? 0;
  const marketCoverage = parseMarketCoverage(
    (quality as { marketCoverage?: unknown }).marketCoverage,
    args.universeCount ?? args.selectedCount,
  );

  return {
    calibrationRuleCount,
    calibrationStatus: calibrationRuleCount > 0 ? "active" : "checked",
    dataFeeds: [
      {
        label: "FMP market data",
        status: priceData,
        text: feedText(priceData, "Live price, volume, technical, and universe data used."),
      },
      {
        label: "Financial statements",
        status: financialData,
        text: feedText(financialData, "Company fundamentals and quality signals checked."),
      },
      {
        label: "FRED macro",
        status: macroData,
        text: feedText(macroData, "Rates, inflation, labor, and market backdrop included."),
      },
      {
        label: "SEC filings",
        status: secData,
        text: feedText(secData, "Recent filing checks included where available."),
      },
      {
        label: "News and events",
        status: newsData === "live" || eventData === "live" ? "live" : newsData,
        text:
          newsData === "live" || eventData === "live"
            ? "Catalysts, headlines, earnings, and event risk checked."
            : feedText(newsData, "News and event context checked."),
      },
    ],
    lastRunAt: args.completedAt ?? null,
    marketRegime: args.marketRegime ?? null,
    openAiStatus: process.env.OPENAI_API_KEY ? "live" : "missing",
    runSource: args.source,
    summary: args.summary ?? null,
    universeCount: Number(args.universeCount ?? args.selectedCount ?? 0),
    marketCoverage,
  };
}

async function getActiveCalibrationRuleCount() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) return 0;

  const { count } = await supabase
    .from("ranking_calibration_rules")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  return count ?? 0;
}

async function listLiveAgentPreviewOpportunities(
  limit: number,
  reasonPrefix: string,
): Promise<OpportunityListResult> {
  const now = Date.now();
  if (
    latestAgentPreviewCache &&
    latestAgentPreviewCache.expiresAt > now &&
    latestAgentPreviewCache.result.rows.length >= limit
  ) {
    return {
      ...latestAgentPreviewCache.result,
      rows: latestAgentPreviewCache.result.rows.slice(0, limit),
      reason: `${reasonPrefix} Showing cached FMP-backed agent preview rankings while Supabase saved picks are unavailable.`,
    };
  }

  if (!hasFmpKey()) {
    return {
      rows: [],
      source: "empty",
      reason: `${reasonPrefix} FMP_API_KEY is not configured for live preview rankings.`,
    };
  }

  try {
    const result = await runFmpDailyRankingAgent({
      detailedLimit: 200,
      limit,
      universeLimit: 500,
    });
    const calibrationRuleCount = result.rankings.filter((item) => item.calibration.length > 0).length;

    const nextResult: OpportunityListResult = {
      rows: result.opportunities,
      source: "agent-preview",
      reason: `${reasonPrefix} Showing a fresh FMP-backed agent preview instead of saved Supabase picks.`,
      trust: buildTrustPanel({
        calibrationRuleCount,
        completedAt: result.asOf,
        dataQuality: result.dataQuality,
        marketRegime: result.marketRegime,
        selectedCount: result.selectedCount,
        source: result.dataSource,
        summary: result.summary,
        universeCount: result.universeCount,
      }),
    };

    latestAgentPreviewCache = {
      expiresAt: now + agentPreviewCacheTtlMs,
      result: nextResult,
    };

    result.opportunities.forEach((row) => {
      symbolAgentPreviewCache.set(row.symbol, {
        expiresAt: now + agentPreviewCacheTtlMs,
        result: {
          rows: [row],
          source: "agent-preview",
          reason: `${reasonPrefix} Showing cached FMP-backed analysis preview while Supabase saved analysis is unavailable.`,
        },
      });
    });

    return nextResult;
  } catch (error) {
    return {
      rows: [],
      source: "empty",
      reason:
        error instanceof Error
          ? `${reasonPrefix} Live agent preview failed: ${error.message}`
          : `${reasonPrefix} Live agent preview failed.`,
    };
  }
}

async function getLatestAgentRun() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) return null;

  const { data } = await supabase
    .from("agent_runs")
    .select("id,source,universe_count,selected_count,market_regime,summary,data_quality,completed_at,started_at")
    .eq("status", "completed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function listLatestOpportunities(limit = 30): Promise<OpportunityListResult> {
  const normalizedLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const cacheKey = `latest:${normalizedLimit}`;
  const now = Date.now();
  const cached = opportunityListCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const inFlight = inFlightOpportunityListRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = listLatestOpportunitiesFresh(normalizedLimit)
    .then((result) => {
      opportunityListCache.set(cacheKey, {
        expiresAt: Date.now() + opportunityListCacheTtlMs,
        result,
      });

      return result;
    })
    .finally(() => {
      inFlightOpportunityListRequests.delete(cacheKey);
    });

  inFlightOpportunityListRequests.set(cacheKey, request);

  return request;
}

async function listLatestOpportunitiesFresh(limit: number): Promise<OpportunityListResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return listLiveAgentPreviewOpportunities(
      limit,
      "Supabase service role is not configured.",
    );
  }

  const latestRun = await getLatestAgentRun();
  const calibrationRuleCount = await getActiveCalibrationRuleCount();
  const trust = latestRun
    ? buildTrustPanel({
        calibrationRuleCount,
        completedAt: latestRun.completed_at ?? latestRun.started_at,
        dataQuality: latestRun.data_quality as Partial<AgentRunResult["dataQuality"]>,
        marketRegime: latestRun.market_regime,
        selectedCount: latestRun.selected_count,
        source: latestRun.source,
        summary: latestRun.summary,
        universeCount: latestRun.universe_count,
      })
    : buildTrustPanel({
        calibrationRuleCount,
        source: "supabase",
      });

  if (latestRun?.id) {
    const { data, error } = await supabase
      .from("opportunity_rankings")
      .select(
        "rank, opportunities(id,symbol,asset_type,score,confidence,risk_score,entry_low,entry_high,target_price,stop_loss,expected_gain,expected_loss,holding_period_days,explanation,created_at)",
      )
      .eq("agent_run_id", latestRun.id)
      .order("rank", { ascending: true })
      .limit(limit);

    if (!error && data?.length) {
      return {
        rows: data
          .map((item) => item.opportunities)
          .map(normalizeJoinedOpportunity)
          .filter((row): row is OpportunityRow => Boolean(row)),
        source: "supabase",
        trust,
      };
    }
  }

  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id,symbol,asset_type,score,confidence,risk_score,entry_low,entry_high,target_price,stop_loss,expected_gain,expected_loss,holding_period_days,explanation,created_at",
    )
    .order("created_at", { ascending: false })
    .order("score", { ascending: false })
    .limit(limit);

  if (error || !data?.length) {
    return listLiveAgentPreviewOpportunities(
      limit,
      error?.message ?? "No Supabase opportunities have been saved yet.",
    );
  }

  return {
    rows: data.map((row) => normalizeOpportunity(row as Record<string, unknown>)),
    source: "supabase",
    trust,
  };
}

export async function getOpportunityBySymbol(
  symbol: string,
): Promise<OpportunityListResult> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return listLiveAgentPreviewOpportunityBySymbol(
      normalizedSymbol,
      "Supabase service role is not configured.",
    );
  }

  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id,symbol,asset_type,score,confidence,risk_score,entry_low,entry_high,target_price,stop_loss,expected_gain,expected_loss,holding_period_days,explanation,created_at",
    )
    .eq("symbol", normalizedSymbol)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return listLiveAgentPreviewOpportunityBySymbol(
      normalizedSymbol,
      error?.message ?? "No Supabase opportunity has been saved for this symbol.",
    );
  }

  return {
    rows: [normalizeOpportunity(data as Record<string, unknown>)],
    source: "supabase",
  };
}

async function listLiveAgentPreviewOpportunityBySymbol(
  symbol: string,
  reasonPrefix: string,
): Promise<OpportunityListResult> {
  const now = Date.now();
  const cachedSymbol = symbolAgentPreviewCache.get(symbol);

  if (cachedSymbol && cachedSymbol.expiresAt > now) {
    return {
      ...cachedSymbol.result,
      reason: `${reasonPrefix} Showing cached FMP-backed analysis preview while Supabase saved analysis is unavailable.`,
    };
  }

  if (latestAgentPreviewCache && latestAgentPreviewCache.expiresAt > now) {
    const cachedRow = latestAgentPreviewCache.result.rows.find((row) => row.symbol === symbol);

    if (cachedRow) {
      return {
        rows: [cachedRow],
        source: "agent-preview",
        reason: `${reasonPrefix} Showing cached FMP-backed analysis preview while Supabase saved analysis is unavailable.`,
      };
    }
  }

  if (!hasFmpKey()) {
    return {
      rows: [],
      source: "empty",
      reason: `${reasonPrefix} FMP_API_KEY is not configured for live preview analysis.`,
    };
  }

  try {
    const result = await runFmpDailyRankingAgent({
      detailedLimit: 1,
      limit: 1,
      symbols: [symbol],
      universeLimit: 1,
    });

    const nextResult: OpportunityListResult = {
      rows: result.opportunities,
      source: "agent-preview",
      reason: `${reasonPrefix} Showing a fresh FMP-backed analysis preview instead of saved Supabase analysis.`,
    };

    if (result.opportunities[0]) {
      symbolAgentPreviewCache.set(symbol, {
        expiresAt: now + agentPreviewCacheTtlMs,
        result: nextResult,
      });
    }

    return nextResult;
  } catch (error) {
    return {
      rows: [],
      source: "empty",
      reason:
        error instanceof Error
          ? `${reasonPrefix} Live analysis preview failed: ${error.message}`
          : `${reasonPrefix} Live analysis preview failed.`,
    };
  }
}

export async function upsertSupabaseOpportunity(values: OpportunityWriteValues, id?: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      ok: false,
      error: "Supabase service role is not configured.",
    };
  }

  const derived = calculateDerived(values);
  const payload = {
    ...values,
    symbol: values.symbol.trim().toUpperCase(),
    explanation: values.explanation.trim(),
    expected_gain: derived.expected_gain,
    expected_loss: derived.expected_loss,
    holding_period_days: 14,
  };
  const query = id
    ? supabase.from("opportunities").update(payload).eq("id", id).select().single()
    : supabase.from("opportunities").insert(payload).select().single();
  const { data, error } = await query;

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Opportunity write failed.",
    };
  }

  invalidateOpportunityListCache();

  return {
    ok: true,
    row: normalizeOpportunity(data as Record<string, unknown>),
  };
}

export async function deleteSupabaseOpportunity(id: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      ok: false,
      error: "Supabase service role is not configured.",
    };
  }

  const { error } = await supabase.from("opportunities").delete().eq("id", id);

  if (!error) {
    invalidateOpportunityListCache();
  }

  return {
    ok: !error,
    error: error?.message,
  };
}
