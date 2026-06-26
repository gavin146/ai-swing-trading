import { NextRequest, NextResponse } from "next/server";
import { hydrateRuntimeCalibrationFromSupabase, runFmpDailyRankingAgent } from "@/lib/agent";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import { sendAdminFailureAlert } from "@/lib/email";
import { persistAgentRun, recordAppEvent, summarizeCalibration } from "@/lib/persistence";
import { invalidateOpportunityListCache } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseLimit(value: unknown) {
  const parsed = Number(value ?? 30);

  if (!Number.isFinite(parsed)) return 30;

  return Math.max(1, Math.min(90, Math.round(parsed)));
}

function parseRange(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export async function POST(request: NextRequest) {
  if (!(await isAdminApiRequest(request))) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    detailedLimit?: number;
    limit?: number;
    universeLimit?: number;
  };
  const source = "fmp";

  if (!process.env.FMP_API_KEY && !process.env.FINANCIAL_DATA_API_KEY) {
    return NextResponse.json(
      { error: "FMP_API_KEY is required for live admin ranking runs.", source },
      { status: 503 },
    );
  }

  try {
    const persistedCalibration = await hydrateRuntimeCalibrationFromSupabase();
    const result = await runFmpDailyRankingAgent({
      detailedLimit: parseRange(body.detailedLimit, 350, 30, 500),
      limit: parseLimit(body.limit),
      universeLimit: parseRange(body.universeLimit, 1000, 40, 1500),
    });
    const persistence = await persistAgentRun(result);
    const calibration = summarizeCalibration(result.rankings);

    if (persistence.persisted) {
      invalidateOpportunityListCache();
    }

    if (!persistence.persisted) {
      await recordAppEvent({
        level: "warning",
        source: "admin-run-agent",
        message: "Manual admin ranking run completed but was not persisted.",
        metadata: { reason: persistence.reason, error: persistence.error, runId: result.runId },
      });
      await sendAdminFailureAlert({
        source: "admin-run-agent",
        message: "Manual admin ranking run completed but was not persisted.",
        error: persistence.error ?? persistence.reason,
        metadata: { runId: result.runId },
      });
    }

    return NextResponse.json({
      ...result,
      calibration,
      persisted: persistence.persisted,
      persistence,
      persistedCalibration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await recordAppEvent({
      level: "error",
      source: "admin-run-agent",
      message: "Manual admin ranking run failed.",
      metadata: { error: errorMessage, source },
    });
    await sendAdminFailureAlert({
      source: "admin-run-agent",
      message: "Manual admin ranking run failed.",
      error: errorMessage,
      metadata: { source },
    });

    return NextResponse.json(
      {
        error: errorMessage || "Manual admin ranking run failed.",
        source,
      },
      { status: 503 },
    );
  }
}
