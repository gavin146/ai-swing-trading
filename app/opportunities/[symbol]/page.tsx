import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { OpportunityDetailView } from "@/components/OpportunityDetailView";

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
  const normalizedSymbol = symbol.toUpperCase();

  return (
    <AppShell
      active="dashboard"
      eyebrow="Opportunity analysis"
      title={`${normalizedSymbol} trade review`}
      subtitle="A structured breakdown of the setup, score quality, entry range, target, stop, and estimated swing-trade window."
    >
      <OpportunityDetailView
        dataSource="empty"
        fallbackReason="Sign in with an active trial or subscription to load this analysis."
        symbol={symbol}
      />
    </AppShell>
  );
}
