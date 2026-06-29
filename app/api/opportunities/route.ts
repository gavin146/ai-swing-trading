import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveResearchAccess } from "@/lib/auth/research-access";
import { listLatestOpportunities } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = await resolveResearchAccess(request);
  if (!access.allowed) {
    return NextResponse.json(access.body, { status: access.status });
  }

  const result = await listLatestOpportunities(90);
  const response = NextResponse.json(result);

  response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=120");

  return response;
}
