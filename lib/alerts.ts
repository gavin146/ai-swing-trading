import type { OpportunityRow } from "./database.types";
import { getPublicAppUrl } from "./brand";
import { buildBrandedMorningEmail } from "./email-branding";

function getAppUrl() {
  return getPublicAppUrl();
}

function getAnalysisUrl(symbol: string, customerId = "customer", source = "morning_email") {
  const trackingId = `${customerId}-${symbol}-${new Date().toISOString().slice(0, 10)}`;
  const params = new URLSearchParams({
    source,
    symbol,
    customerId,
  });

  return `${getAppUrl()}/e/${encodeURIComponent(trackingId)}?${params.toString()}`;
}

function getOpenTrackingUrl(customerId?: string) {
  if (!customerId) return undefined;

  const trackingId = `${customerId}-email-open-${new Date().toISOString().slice(0, 10)}`;
  const params = new URLSearchParams({
    customerId,
    source: "morning_email",
  });

  return `${getAppUrl()}/api/track/open/${encodeURIComponent(trackingId)}?${params.toString()}`;
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
        `${index + 1}. ${item.symbol} score ${item.score}, confidence ${item.confidence}, entry $${item.entry_low}-${item.entry_high}, target $${item.target_price}, stop $${item.stop_loss}. Analysis: ${getAnalysisUrl(item.symbol, args.customerId, "morning_sms")}`,
    )
    .join(" | ");
  const recipient = args.customerName.trim()
    ? ` for ${args.customerName.trim().split(/\s+/)[0]}`
    : "";

  return `SwingFi morning brief${recipient}: market is ${args.marketRegime}. Top picks: ${picks}. Review risk before trading. Reply STOP to unsubscribe or HELP for help.`;
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
    analysisUrl: (symbol) => getAnalysisUrl(symbol, args.customerId, "morning_email"),
    customerName: args.customerName,
    intro: "Your pre-market SwingFi brief is ready.",
    marketRegime: args.marketRegime,
    openTrackingUrl: getOpenTrackingUrl(args.customerId),
    opportunities: top,
    signoff: "Review risk, position size, and your own plan before trading.",
    subject: `SwingFi morning picks${top.length ? `: ${top.map((item) => item.symbol).join(", ")}` : ""}`,
    unsubscribeUrl,
  });
}
