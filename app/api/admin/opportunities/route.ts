import { NextRequest, NextResponse } from "next/server";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import {
  listLatestOpportunities,
  upsertSupabaseOpportunity,
  type OpportunityWriteValues,
} from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAdminApiRequest(request)) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const result = await listLatestOpportunities(100);

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  if (!isAdminApiRequest(request)) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const values = (await request.json().catch(() => null)) as OpportunityWriteValues | null;

  if (!values?.symbol) {
    return NextResponse.json({ error: "Opportunity payload is required." }, { status: 400 });
  }

  const result = await upsertSupabaseOpportunity(values);

  if (!result.ok) {
    return NextResponse.json(result, { status: 503 });
  }

  return NextResponse.json(result);
}
