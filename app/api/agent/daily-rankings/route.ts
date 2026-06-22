import { NextRequest, NextResponse } from "next/server";
import { runDailyRankingAgent, runFmpDailyRankingAgent } from "@/lib/agent";

export const dynamic = "force-dynamic";

function parseLimit(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return 30;
  }

  const limit = Number(value);

  if (!Number.isFinite(limit)) {
    return 30;
  }

  return Math.max(1, Math.min(30, Math.round(limit)));
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

function parseSource(value: unknown) {
  return value === "fmp" ? "fmp" : "mock";
}

async function runAgent(args: {
  detailedLimit?: number;
  limit: number;
  source: "mock" | "fmp";
  universeLimit?: number;
}) {
  if (args.source === "fmp") {
    return runFmpDailyRankingAgent({
      detailedLimit: args.detailedLimit,
      limit: args.limit,
      universeLimit: args.universeLimit,
    });
  }

  return runDailyRankingAgent({ limit: args.limit });
}

export async function GET(request: NextRequest) {
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const source = parseSource(request.nextUrl.searchParams.get("source"));
  const universeLimit = parseRange(
    request.nextUrl.searchParams.get("universeLimit"),
    160,
    5,
    500,
  );
  const detailedLimit = parseRange(
    request.nextUrl.searchParams.get("detailedLimit"),
    90,
    5,
    200,
  );

  try {
    const result = await runAgent({ detailedLimit, limit, source, universeLimit });
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
    source?: "mock" | "fmp";
    universeLimit?: number;
  };
  const source = parseSource(body.source);

  try {
    const result = await runAgent({
      detailedLimit: parseRange(body.detailedLimit, 90, 5, 200),
      limit: parseLimit(body.limit),
      source,
      universeLimit: parseRange(body.universeLimit, 160, 5, 500),
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
