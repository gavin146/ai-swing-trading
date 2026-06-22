import { NextRequest, NextResponse } from "next/server";
import { runRollingBacktest } from "@/lib/backtesting";

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

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Backtest failed.",
      },
      { status: 500 },
    );
  }
}
