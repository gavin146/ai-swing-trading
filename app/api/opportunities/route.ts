import { NextResponse } from "next/server";
import { listLatestOpportunities } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await listLatestOpportunities(90);
  const response = NextResponse.json(result);

  response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=120");

  return response;
}
