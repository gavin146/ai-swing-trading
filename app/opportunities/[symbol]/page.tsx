import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { OpportunityDetailView } from "@/components/OpportunityDetailView";
import { getOpportunity, opportunities } from "@/lib/opportunities";

type OpportunityDetailProps = {
  params: Promise<{
    symbol: string;
  }>;
};

export function generateStaticParams() {
  return opportunities.map((opportunity) => ({
    symbol: opportunity.symbol,
  }));
}

export async function generateMetadata({
  params,
}: OpportunityDetailProps): Promise<Metadata> {
  const { symbol } = await params;
  const opportunity = getOpportunity(symbol);

  if (!opportunity) {
    return {
      title: "Opportunity not found | TradePilot AI",
    };
  }

  return {
    title: `${opportunity.symbol} opportunity | TradePilot AI`,
    description: opportunity.thesis,
  };
}

export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailProps) {
  const { symbol } = await params;
  const opportunity = getOpportunity(symbol);

  return (
    <main className="min-h-screen">
      <AppHeader active="dashboard" />
      <OpportunityDetailView initialOpportunity={opportunity} symbol={symbol} />
    </main>
  );
}
