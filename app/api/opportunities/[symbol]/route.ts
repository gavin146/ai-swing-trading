import { NextRequest, NextResponse } from "next/server";
import { getOpportunityBySymbol } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OpportunityDetailApiProps = {
  params: Promise<{
    symbol: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: OpportunityDetailApiProps) {
  const { symbol } = await params;
  const result = await getOpportunityBySymbol(symbol);

  return NextResponse.json(result);
}
