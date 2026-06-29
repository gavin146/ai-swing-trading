import { NextRequest, NextResponse } from "next/server";
import { resolveResearchAccess } from "@/lib/auth/research-access";
import { getOpportunityBySymbol } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OpportunityDetailApiProps = {
  params: Promise<{
    symbol: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: OpportunityDetailApiProps) {
  const access = await resolveResearchAccess(_request);
  if (!access.allowed) {
    return NextResponse.json(access.body, { status: access.status });
  }

  const { symbol } = await params;
  const result = await getOpportunityBySymbol(symbol);

  return NextResponse.json(result);
}
