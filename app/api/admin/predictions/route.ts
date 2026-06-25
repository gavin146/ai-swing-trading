import { NextRequest, NextResponse } from "next/server";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import {
  evaluatePendingPredictions,
  getPredictionAccuracySummary,
  persistForwardCalibrationFromPredictions,
} from "@/lib/prediction-tracking";
import { recordAppEvent } from "@/lib/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseLimit(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export async function GET(request: NextRequest) {
  if (!isAdminApiRequest(request)) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"), 300, 25, 1000);

  try {
    return NextResponse.json(await getPredictionAccuracySummary(limit));
  } catch (error) {
    await recordAppEvent({
      level: "error",
      source: "prediction-accuracy",
      message: "Prediction accuracy summary failed.",
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prediction accuracy failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminApiRequest(request)) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"), 80, 1, 250);

  try {
    const summary = await evaluatePendingPredictions(limit);
    const calibration = await persistForwardCalibrationFromPredictions(600);
    await recordAppEvent({
      level: "info",
      source: "prediction-accuracy",
      message: "Forward prediction outcomes evaluated.",
      metadata: {
        calibrationGeneratedCount: calibration.generatedCount,
        evaluatedCount: summary.evaluatedCount,
        totalPredictions: summary.totalPredictions,
        updatedCount: summary.updatedCount,
      },
    });

    return NextResponse.json({
      ...summary,
      calibrationGeneratedCount: calibration.generatedCount,
      calibrationStatus: calibration.generatedCount > 0 ? "active" : summary.calibrationStatus,
    });
  } catch (error) {
    await recordAppEvent({
      level: "error",
      source: "prediction-accuracy",
      message: "Forward prediction evaluation failed.",
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prediction evaluation failed." },
      { status: 500 },
    );
  }
}
