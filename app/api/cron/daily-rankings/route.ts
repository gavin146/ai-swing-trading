import { NextRequest, NextResponse } from "next/server";
import { runFmpDailyRankingAgent } from "@/lib/agent";
import { persistAgentRun, recordAppEvent, summarizeCalibration } from "@/lib/persistence";

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
    return NextResponse.json(
      { error: "FMP_API_KEY is required for live daily rankings.", source },
      { status: 503 },
    );
  }

  try {
    const result = await runFmpDailyRankingAgent({ limit: 90 });
    const persistence = await persistAgentRun(result);
    const calibration = summarizeCalibration(result.rankings);

    if (!persistence.persisted) {
      await recordAppEvent({
        level: "warning",
        source: "daily-rankings-cron",
        message: "Daily ranking run completed but was not persisted.",
        metadata: { reason: persistence.reason, error: persistence.error, runId: result.runId },
      });
    }

    return NextResponse.json({
      ...result,
      persisted: persistence.persisted,
      persistence,
      calibration,
      note: persistence.persisted
        ? "Daily rankings were saved to Supabase."
        : "Daily rankings completed but were not saved because Supabase persistence is not configured or failed.",
    });
  } catch (error) {
    await recordAppEvent({
      level: "error",
      source: "daily-rankings-cron",
      message: "Daily ranking cron failed.",
      metadata: { error: error instanceof Error ? error.message : String(error), source },
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Daily ranking cron failed",
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
