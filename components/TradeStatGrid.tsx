import type { Opportunity } from "@/lib/opportunities";
import { MetricPill } from "./MetricPill";

type TradeStatGridProps = {
  opportunity: Opportunity;
};

export function TradeStatGrid({ opportunity }: TradeStatGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricPill label="Potential gain" value={opportunity.potentialGain} tone="positive" />
      <MetricPill label="Potential loss" value={opportunity.potentialLoss} tone="risk" />
      <MetricPill label="Trade quality" value={opportunity.tradeQuality} tone="neutral" />
      <MetricPill label="Sell window" value={opportunity.estimatedSellWindow} tone="caution" />
    </div>
  );
}
