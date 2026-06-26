import { NextRequest, NextResponse } from "next/server";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SourceRow = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowError(error: { message?: string } | null | undefined) {
  return error?.message ?? null;
}

function parseMarketCoverage(dataQuality: unknown) {
  if (!dataQuality || typeof dataQuality !== "object") {
    return null;
  }

  const coverage = (dataQuality as { marketCoverage?: unknown }).marketCoverage;
  if (!coverage || typeof coverage !== "object") {
    return null;
  }

  const row = coverage as Record<string, unknown>;
  const status = row.status;

  return {
    status:
      status === "healthy" || status === "thin" || status === "blocked"
        ? status
        : "unknown",
    requestedUniverseLimit: nullableNumber(row.requestedUniverseLimit),
    screenerCount: nullableNumber(row.screenerCount),
    detailedCandidateTarget: nullableNumber(row.detailedCandidateTarget),
    detailedCandidateCount: nullableNumber(row.detailedCandidateCount),
    qualifiedCandidateCount: nullableNumber(row.qualifiedCandidateCount),
    rankedCandidateCount: nullableNumber(row.rankedCandidateCount),
    minimumScreenerCount: nullableNumber(row.minimumScreenerCount),
    minimumDetailedCandidateCount: nullableNumber(row.minimumDetailedCandidateCount),
    warning: asString(row.warning),
  };
}

function latestPredictionSummary(rows: SourceRow[]) {
  const latestDate =
    rows
      .map((row) => asString(row.prediction_date))
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const latestRows = latestDate
    ? rows.filter((row) => row.prediction_date === latestDate)
    : rows;
  const evaluated = latestRows.filter((row) =>
    ["target_hit", "stop_hit", "expired", "no_entry", "no_data"].includes(String(row.status)),
  ).length;
  const pending = latestRows.filter((row) => row.status === "pending").length;

  return {
    evaluated,
    latestDate,
    pending,
    total: latestRows.length,
  };
}

export async function GET(request: NextRequest) {
  if (!(await isAdminApiRequest(request))) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({
      error: "Supabase service role is not configured.",
      source: "empty",
    });
  }

  const [
    latestAgentRun,
    latestAlertLog,
    latestPredictionEvent,
    recentFailures,
    predictionRows,
  ] = await Promise.all([
    supabase
      .from("agent_runs")
      .select("id,status,source,selected_count,universe_count,market_regime,summary,data_quality,error_message,started_at,completed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("alert_logs")
      .select("id,channel,status,recipient,error_message,sent_at,created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("app_event_logs")
      .select("id,level,source,message,metadata,created_at")
      .eq("source", "prediction-evaluation-cron")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("app_event_logs")
      .select("id,level,source,message,metadata,created_at")
      .in("level", ["warning", "error"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("prediction_outcomes")
      .select("id,status,prediction_date")
      .order("prediction_date", { ascending: false })
      .order("rank", { ascending: true })
      .limit(300),
  ]);

  const errors = [
    rowError(latestAgentRun.error),
    rowError(latestAlertLog.error),
    rowError(latestPredictionEvent.error),
    rowError(recentFailures.error),
    rowError(predictionRows.error),
  ].filter(Boolean);

  return NextResponse.json({
    errors,
    latestAgentRun: latestAgentRun.data
      ? {
          id: asString(latestAgentRun.data.id),
          status: asString(latestAgentRun.data.status),
          source: asString(latestAgentRun.data.source),
          selectedCount: asNumber(latestAgentRun.data.selected_count),
          universeCount: asNumber(latestAgentRun.data.universe_count),
          marketCoverage: parseMarketCoverage(latestAgentRun.data.data_quality),
          marketRegime: asString(latestAgentRun.data.market_regime),
          summary: asString(latestAgentRun.data.summary),
          errorMessage: asString(latestAgentRun.data.error_message),
          ranAt:
            asString(latestAgentRun.data.completed_at) ??
            asString(latestAgentRun.data.started_at) ??
            asString(latestAgentRun.data.created_at),
        }
      : null,
    latestAlertLog: latestAlertLog.data
      ? {
          id: asString(latestAlertLog.data.id),
          channel: asString(latestAlertLog.data.channel),
          status: asString(latestAlertLog.data.status),
          recipient: asString(latestAlertLog.data.recipient),
          errorMessage: asString(latestAlertLog.data.error_message),
          ranAt: asString(latestAlertLog.data.sent_at) ?? asString(latestAlertLog.data.created_at),
        }
      : null,
    latestPredictionEvaluation: latestPredictionEvent.data
      ? {
          id: asString(latestPredictionEvent.data.id),
          level: asString(latestPredictionEvent.data.level),
          message: asString(latestPredictionEvent.data.message),
          metadata: latestPredictionEvent.data.metadata,
          ranAt: asString(latestPredictionEvent.data.created_at),
        }
      : null,
    predictions: latestPredictionSummary((predictionRows.data ?? []) as SourceRow[]),
    recentFailures: (recentFailures.data ?? []).map((row: SourceRow) => ({
      id: asString(row.id),
      level: asString(row.level),
      source: asString(row.source),
      message: asString(row.message),
      metadata: row.metadata,
      createdAt: asString(row.created_at),
    })),
    source: "supabase",
  });
}
