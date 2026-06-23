import { NextResponse } from "next/server";
import { listLatestOpportunities } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await listLatestOpportunities(90);

  return NextResponse.json(result);
}
