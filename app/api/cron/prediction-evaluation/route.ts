import { NextRequest, NextResponse } from "next/server";
import { sendAdminFailureAlert } from "@/lib/email";
import { recordAppEvent } from "@/lib/persistence";
import {
  evaluatePendingPredictions,
  persistForwardCalibrationFromPredictions,
} from "@/lib/prediction-tracking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function parseLimit(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

async function runPredictionEvaluation(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const evaluationLimit = parseLimit(request.nextUrl.searchParams.get("limit"), 120, 1, 300);
  const calibrationLimit = parseLimit(
    request.nextUrl.searchParams.get("calibrationLimit"),
    600,
    50,
    1200,
  );

  try {
    const summary = await evaluatePendingPredictions(evaluationLimit);
    const calibration = await persistForwardCalibrationFromPredictions(calibrationLimit);

    await recordAppEvent({
      level: "info",
      source: "prediction-evaluation-cron",
      message: "Forward prediction evaluation completed.",
      metadata: {
        calibrationGeneratedCount: calibration.generatedCount,
        evaluatedCount: summary.evaluatedCount,
        pendingCount: summary.pendingCount,
        targetHitRate: summary.targetHitRate,
        totalPredictions: summary.totalPredictions,
        updatedCount: summary.updatedCount,
      },
    });

    return NextResponse.json({
      calibration,
      summary,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await recordAppEvent({
      level: "error",
      source: "prediction-evaluation-cron",
      message: "Forward prediction evaluation failed.",
      metadata: { error: errorMessage },
    });
    await sendAdminFailureAlert({
      source: "prediction-evaluation-cron",
      message: "Forward prediction evaluation failed.",
      error: errorMessage,
    });

    return NextResponse.json(
      { error: errorMessage || "Forward prediction evaluation failed." },
      { status: 503 },
    );
  }
}

export async function GET(request: NextRequest) {
  return runPredictionEvaluation(request);
}

export async function POST(request: NextRequest) {
  return runPredictionEvaluation(request);
}
