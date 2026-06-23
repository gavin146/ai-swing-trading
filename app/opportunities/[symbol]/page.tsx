import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { OpportunityDetailView } from "@/components/OpportunityDetailView";
import { opportunityFromRow } from "@/lib/opportunities";
import { getOpportunityBySymbol } from "@/lib/repositories/opportunities";

type OpportunityDetailProps = {
  params: Promise<{
    symbol: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: OpportunityDetailProps): Promise<Metadata> {
  const { symbol } = await params;
  const normalizedSymbol = symbol.toUpperCase();

  return {
    title: `${normalizedSymbol} opportunity | TradePilot AI`,
    description: `TradePilot AI swing trade analysis for ${normalizedSymbol}.`,
  };
}

export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailProps) {
  const { symbol } = await params;
  const result = await getOpportunityBySymbol(symbol);
  const opportunity = result.rows[0] ? opportunityFromRow(result.rows[0]) : undefined;

  return (
    <main className="min-h-screen">
      <AppHeader active="dashboard" />
      <OpportunityDetailView
        dataSource={result.source}
        fallbackReason={result.reason}
        initialOpportunity={opportunity}
        symbol={symbol}
      />
    </main>
  );
}
