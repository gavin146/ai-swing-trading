import { NextRequest, NextResponse } from "next/server";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import { runRollingBacktest } from "@/lib/backtesting";
import { getLatestBacktestSummary, persistBacktestSummary, recordAppEvent } from "@/lib/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export async function GET(request: NextRequest) {
  if (!(await isAdminApiRequest(request))) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const mode = request.nextUrl.searchParams.get("mode");

  if (mode === "latest") {
    const latest = await getLatestBacktestSummary();

    if (!latest.summary) {
      return NextResponse.json(
        {
          error: latest.persistence.error ?? latest.persistence.reason ?? "No saved backtest report found.",
          persistence: latest.persistence,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ...latest.summary,
      persistence: latest.persistence,
    });
  }

  const windows = parseNumber(request.nextUrl.searchParams.get("windows"), 5, 1, 8);
  const intervalDays = parseNumber(request.nextUrl.searchParams.get("intervalDays"), 21, 7, 45);
  const limitPerWindow = parseNumber(request.nextUrl.searchParams.get("limit"), 6, 1, 12);
  const symbols = request.nextUrl.searchParams
    .get("symbols")
    ?.split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  try {
    const result = await runRollingBacktest({
      windows,
      intervalDays,
      limitPerWindow,
      symbols,
    });
    const persistence = await persistBacktestSummary(result);

    if (!persistence.persisted) {
      await recordAppEvent({
        level: "warning",
        source: "rolling-backtest",
        message: "Backtest completed but was not persisted.",
        metadata: { reason: persistence.reason, error: persistence.error, runId: result.runId },
      });
    }

    return NextResponse.json({
      ...result,
      persistence,
    });
  } catch (error) {
    await recordAppEvent({
      level: "error",
      source: "rolling-backtest",
      message: "Backtest failed.",
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Backtest failed.",
      },
      { status: 500 },
    );
  }
}
