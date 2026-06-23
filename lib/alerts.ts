import type { OpportunityRow } from "./database.types";
import { buildBrandedMorningEmail } from "./email-branding";

function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  const url = configured
    ? configured.startsWith("http")
      ? configured
      : `https://${configured}`
    : "http://localhost:3000";

  return url.replace(/\/$/, "");
}

function getAnalysisUrl(symbol: string, customerId = "customer") {
  const trackingId = `${customerId}-${symbol}-${new Date().toISOString().slice(0, 10)}`;
  const params = new URLSearchParams({
    symbol,
    customerId,
  });

  return `${getAppUrl()}/e/${encodeURIComponent(trackingId)}?${params.toString()}`;
}

function getUnsubscribeUrl(customerId?: string) {
  const params = new URLSearchParams();

  if (customerId) {
    params.set("customerId", customerId);
  }

  return `${getAppUrl()}/unsubscribe${params.toString() ? `?${params.toString()}` : ""}`;
}

export function buildMorningAlertMessage(args: {
  customerName: string;
  customerId?: string;
  marketRegime: string;
  opportunities: OpportunityRow[];
}) {
  const top = args.opportunities.slice(0, 3);
  const picks = top
    .map(
      (item, index) =>
        `${index + 1}. ${item.symbol} score ${item.score}, confidence ${item.confidence}, entry $${item.entry_low}-${item.entry_high}, target $${item.target_price}, stop $${item.stop_loss}. Analysis: ${getAnalysisUrl(item.symbol, args.customerId)}`,
    )
    .join(" | ");
  const recipient = args.customerName.trim()
    ? ` for ${args.customerName.trim().split(/\s+/)[0]}`
    : "";

  return `SwingFi morning brief${recipient}: market is ${args.marketRegime}. Top picks: ${picks}. Review risk before trading.`;
}

export function buildMorningEmailAlert(args: {
  customerName: string;
  customerId?: string;
  marketRegime: string;
  opportunities: OpportunityRow[];
}) {
  const top = args.opportunities.slice(0, 5);
  const unsubscribeUrl = getUnsubscribeUrl(args.customerId);

  return buildBrandedMorningEmail({
    analysisUrl: (symbol) => getAnalysisUrl(symbol, args.customerId),
    customerName: args.customerName,
    intro: "Your pre-market SwingFi brief is ready.",
    marketRegime: args.marketRegime,
    opportunities: top,
    signoff: "Review risk, position size, and your own plan before trading.",
    subject: `SwingFi morning picks${top.length ? `: ${top.map((item) => item.symbol).join(", ")}` : ""}`,
    unsubscribeUrl,
  });
}
