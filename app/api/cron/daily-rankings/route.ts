import { NextRequest, NextResponse } from "next/server";
import { hydrateRuntimeCalibrationFromSupabase, runFmpDailyRankingAgent } from "@/lib/agent";
import { sendAdminFailureAlert } from "@/lib/email";
import { persistAgentRun, recordAppEvent, summarizeCalibration } from "@/lib/persistence";
import { invalidateOpportunityListCache } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function runCron(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = "fmp";

  if (!process.env.FMP_API_KEY && !process.env.FINANCIAL_DATA_API_KEY) {
    await recordAppEvent({
      level: "error",
      source: "daily-rankings-cron",
      message: "Daily ranking cron blocked because FMP market data is not configured.",
      metadata: { source },
    });
    await sendAdminFailureAlert({
      source: "daily-rankings-cron",
      message: "Daily ranking cron blocked because FMP market data is not configured.",
      error: "FMP_API_KEY is required for live daily rankings.",
      metadata: { source },
    });

    return NextResponse.json(
      { error: "FMP_API_KEY is required for live daily rankings.", source },
      { status: 503 },
    );
  }

  try {
    const persistedCalibration = await hydrateRuntimeCalibrationFromSupabase();
    const result = await runFmpDailyRankingAgent({ limit: 30 });
    const persistence = await persistAgentRun(result);
    const calibration = summarizeCalibration(result.rankings);

    if (persistence.persisted) {
      invalidateOpportunityListCache();
    }

    if (result.selectedCount === 0) {
      await recordAppEvent({
        level: "error",
        source: "daily-rankings-cron",
        message: "Daily ranking run produced zero customer picks.",
        metadata: { runId: result.runId, universeCount: result.universeCount },
      });
      await sendAdminFailureAlert({
        source: "daily-rankings-cron",
        message: "Daily ranking run produced zero customer picks.",
        metadata: { runId: result.runId, universeCount: result.universeCount },
      });
    } else if (result.selectedCount < 30) {
      await recordAppEvent({
        level: "warning",
        source: "daily-rankings-cron",
        message: "Daily ranking run produced fewer than 30 live picks.",
        metadata: {
          runId: result.runId,
          selectedCount: result.selectedCount,
          universeCount: result.universeCount,
        },
      });
      await sendAdminFailureAlert({
        source: "daily-rankings-cron",
        message: "Daily ranking run produced fewer than 30 live picks.",
        metadata: {
          runId: result.runId,
          selectedCount: result.selectedCount,
          universeCount: result.universeCount,
        },
      });
    }

    if (!persistence.persisted) {
      await recordAppEvent({
        level: "warning",
        source: "daily-rankings-cron",
        message: "Daily ranking run completed but was not persisted.",
        metadata: { reason: persistence.reason, error: persistence.error, runId: result.runId },
      });
      await sendAdminFailureAlert({
        source: "daily-rankings-cron",
        message: "Daily ranking run completed but was not persisted.",
        error: persistence.error ?? persistence.reason,
        metadata: { runId: result.runId },
      });
    }

    return NextResponse.json({
      ...result,
      persisted: persistence.persisted,
      persistence,
      calibration,
      persistedCalibration,
      note: persistence.persisted
        ? "Daily rankings were saved to Supabase."
        : "Daily rankings completed but were not saved because Supabase persistence is not configured or failed.",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await recordAppEvent({
      level: "error",
      source: "daily-rankings-cron",
      message: "Daily ranking cron failed.",
      metadata: { error: errorMessage, source },
    });
    await sendAdminFailureAlert({
      source: "daily-rankings-cron",
      message: "Daily ranking cron failed.",
      error: errorMessage,
      metadata: { source },
    });

    return NextResponse.json(
      {
        error: errorMessage || "Daily ranking cron failed",
        source,
      },
      { status: 503 },
    );
  }
}

export async function GET(request: NextRequest) {
  return runCron(request);
}

export async function POST(request: NextRequest) {
  return runCron(request);
}
