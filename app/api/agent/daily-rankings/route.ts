import { NextRequest, NextResponse } from "next/server";
import { runFmpDailyRankingAgent } from "@/lib/agent";

export const dynamic = "force-dynamic";

function parseLimit(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return 30;
  }

  const limit = Number(value);

  if (!Number.isFinite(limit)) {
    return 30;
  }

  return Math.max(1, Math.min(90, Math.round(limit)));
}

function parseRange(value: unknown, fallback: number, min: number, max: number) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

async function runAgent(args: {
  detailedLimit?: number;
  limit: number;
  universeLimit?: number;
}) {
  if (!process.env.FMP_API_KEY && !process.env.FINANCIAL_DATA_API_KEY) {
    throw new Error("FMP_API_KEY is required for live ranking runs.");
  }

  return runFmpDailyRankingAgent({
    detailedLimit: args.detailedLimit,
    limit: args.limit,
    universeLimit: args.universeLimit,
  });
}

export async function GET(request: NextRequest) {
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const source = "fmp";
  const universeLimit = parseRange(
    request.nextUrl.searchParams.get("universeLimit"),
    500,
    5,
    500,
  );
  const detailedLimit = parseRange(
    request.nextUrl.searchParams.get("detailedLimit"),
    200,
    5,
    200,
  );

  try {
    const result = await runAgent({ detailedLimit, limit, universeLimit });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Agent run failed",
        source,
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    detailedLimit?: number;
    limit?: number;
    universeLimit?: number;
  };
  const source = "fmp";

  try {
    const result = await runAgent({
      detailedLimit: parseRange(body.detailedLimit, 200, 5, 200),
      limit: parseLimit(body.limit),
      universeLimit: parseRange(body.universeLimit, 500, 5, 500),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Agent run failed",
        source,
      },
      { status: 503 },
    );
  }
}
