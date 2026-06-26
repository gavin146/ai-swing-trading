import { NextRequest, NextResponse } from "next/server";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import {
  deleteSupabaseOpportunity,
  upsertSupabaseOpportunity,
  type OpportunityWriteValues,
} from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  if (!(await isAdminApiRequest(request))) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const { id } = await context.params;
  const values = (await request.json().catch(() => null)) as OpportunityWriteValues | null;

  if (!values?.symbol) {
    return NextResponse.json({ error: "Opportunity payload is required." }, { status: 400 });
  }

  const result = await upsertSupabaseOpportunity(values, id);

  if (!result.ok) {
    return NextResponse.json(result, { status: 503 });
  }

  return NextResponse.json(result);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!(await isAdminApiRequest(request))) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const { id } = await context.params;
  const result = await deleteSupabaseOpportunity(id);

  if (!result.ok) {
    return NextResponse.json(result, { status: 503 });
  }

  return NextResponse.json(result);
}
