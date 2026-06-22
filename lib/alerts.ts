import type { OpportunityRow } from "./database.types";

export function buildMorningAlertMessage(args: {
  customerName: string;
  marketRegime: string;
  opportunities: OpportunityRow[];
}) {
  const top = args.opportunities.slice(0, 3);
  const picks = top
    .map(
      (item, index) =>
        `${index + 1}. ${item.symbol} score ${item.score}, confidence ${item.confidence}, entry $${item.entry_low}-${item.entry_high}, target $${item.target_price}, stop $${item.stop_loss}`,
    )
    .join(" | ");

  return `TradePilot AI morning brief for ${args.customerName}: market is ${args.marketRegime}. Top picks: ${picks}. Review risk before trading.`;
}
