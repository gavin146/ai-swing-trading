import { NextRequest, NextResponse } from "next/server";
import { runDailyRankingAgent, runFmpDailyRankingAgent } from "@/lib/agent";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function runCron(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = process.env.AGENT_DATA_SOURCE === "fmp" ? "fmp" : "mock";

  try {
    const result =
      source === "fmp"
        ? await runFmpDailyRankingAgent({ limit: 30 })
        : runDailyRankingAgent({ limit: 30 });

    return NextResponse.json({
      ...result,
      persisted: false,
      note:
        "Supabase is not connected yet, so this cron returns the top 30 ranked opportunities. The persistence hook is ready for the future database write.",
    });
  } catch (error) {
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
