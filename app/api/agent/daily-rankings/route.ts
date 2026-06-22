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

function parseSource(value: unknown) {
  return value === "fmp" ? "fmp" : "mock";
}

async function runAgent(args: { limit: number; source: "mock" | "fmp" }) {
  if (args.source === "fmp") {
    return runFmpDailyRankingAgent({ limit: args.limit });
  }

  return runDailyRankingAgent({ limit: args.limit });
}

export async function GET(request: NextRequest) {
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const source = parseSource(request.nextUrl.searchParams.get("source"));

  try {
    const result = await runAgent({ limit, source });
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
    limit?: number;
    source?: "mock" | "fmp";
  };
  const source = parseSource(body.source);

  try {
    const result = await runAgent({ limit: parseLimit(body.limit), source });
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
