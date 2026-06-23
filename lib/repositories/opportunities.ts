import type { AssetType, OpportunityRow } from "@/lib/database.types";
import { runFmpDailyRankingAgent } from "@/lib/agent";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type OpportunityDataSource = "supabase" | "agent-preview" | "empty";

export type OpportunityListResult = {
  rows: OpportunityRow[];
  source: OpportunityDataSource;
  reason?: string;
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

const agentPreviewCacheTtlMs = 15 * 60 * 1000;
let latestAgentPreviewCache: AgentPreviewCacheEntry | null = null;
const symbolAgentPreviewCache = new Map<string, AgentPreviewCacheEntry>();

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

    const nextResult: OpportunityListResult = {
      rows: result.opportunities,
      source: "agent-preview",
      reason: `${reasonPrefix} Showing a fresh FMP-backed agent preview instead of saved Supabase picks.`,
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

async function getLatestAgentRunId() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) return null;

  const { data } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("status", "completed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}

export async function listLatestOpportunities(limit = 30): Promise<OpportunityListResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return listLiveAgentPreviewOpportunities(
      limit,
      "Supabase service role is not configured.",
    );
  }

  const latestRunId = await getLatestAgentRunId();

  if (latestRunId) {
    const { data, error } = await supabase
      .from("opportunity_rankings")
      .select(
        "rank, opportunities(id,symbol,asset_type,score,confidence,risk_score,entry_low,entry_high,target_price,stop_loss,expected_gain,expected_loss,holding_period_days,explanation,created_at)",
      )
      .eq("agent_run_id", latestRunId)
      .order("rank", { ascending: true })
      .limit(limit);

    if (!error && data?.length) {
      return {
        rows: data
          .map((item) => item.opportunities)
          .map(normalizeJoinedOpportunity)
          .filter((row): row is OpportunityRow => Boolean(row)),
        source: "supabase",
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

  return {
    ok: !error,
    error: error?.message,
  };
}
