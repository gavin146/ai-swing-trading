import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
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
    title: `${normalizedSymbol} opportunity | SwingFi`,
    description: `SwingFi swing trade analysis for ${normalizedSymbol}.`,
  };
}

export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailProps) {
  const { symbol } = await params;
  const result = await getOpportunityBySymbol(symbol);
  const opportunity = result.rows[0] ? opportunityFromRow(result.rows[0]) : undefined;

  return (
    <AppShell
      active="dashboard"
      eyebrow="Opportunity analysis"
      title={opportunity ? `${opportunity.symbol} trade review` : `${symbol.toUpperCase()} review`}
      subtitle="A structured breakdown of the setup, score quality, entry range, target, stop, and estimated swing-trade window."
    >
      <OpportunityDetailView
        dataSource={result.source}
        fallbackReason={result.reason}
        initialOpportunity={opportunity}
        symbol={symbol}
      />
    </AppShell>
  );
}
