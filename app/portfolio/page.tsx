import { AppShell } from "@/components/AppShell";
import { SwingPortfolioPanel } from "@/components/SwingPortfolioPanel";

type PortfolioPageProps = {
  searchParams: Promise<{
    assetType?: string;
    entryHigh?: string;
    entryLow?: string;
    holdingPeriodDays?: string;
    opportunityId?: string;
    stopLoss?: string;
    symbol?: string;
    targetPrice?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function PortfolioPage({ searchParams }: PortfolioPageProps) {
  const initialTrade = await searchParams;

  return (
    <AppShell
      active="portfolio"
      eyebrow="Swing Portfolio"
      title="Track the trades you decide to make"
      subtitle="Save entries, targets, stops, current price context, and the decision status for open swing trades after daily rankings refresh."
    >
      <SwingPortfolioPanel initialTrade={initialTrade} />
    </AppShell>
  );
}
