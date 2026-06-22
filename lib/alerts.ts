import type { OpportunityRow } from "./database.types";

function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  const url = configured
    ? configured.startsWith("http")
      ? configured
      : `https://${configured}`
    : "http://localhost:3000";

  return url.replace(/\/$/, "");
}

function getAnalysisUrl(symbol: string, customerId = "demo-customer") {
  const trackingId = `${customerId}-${symbol}-${new Date().toISOString().slice(0, 10)}`;
  const params = new URLSearchParams({
    symbol,
    customerId,
  });

  return `${getAppUrl()}/e/${encodeURIComponent(trackingId)}?${params.toString()}`;
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

  return `TradePilot AI morning brief for ${args.customerName}: market is ${args.marketRegime}. Top picks: ${picks}. Review risk before trading.`;
}

export function buildMorningEmailAlert(args: {
  customerName: string;
  customerId?: string;
  marketRegime: string;
  opportunities: OpportunityRow[];
}) {
  const top = args.opportunities.slice(0, 5);
  const rows = top
    .map(
      (item) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e6ece8;font-weight:700;"><a href="${getAnalysisUrl(item.symbol, args.customerId)}" style="color:#183f36;">${item.symbol}</a></td>
          <td style="padding:12px;border-bottom:1px solid #e6ece8;">${item.score}</td>
          <td style="padding:12px;border-bottom:1px solid #e6ece8;">${item.confidence}</td>
          <td style="padding:12px;border-bottom:1px solid #e6ece8;">${item.risk_score}</td>
          <td style="padding:12px;border-bottom:1px solid #e6ece8;">$${item.entry_low} - $${item.entry_high}</td>
          <td style="padding:12px;border-bottom:1px solid #e6ece8;">$${item.target_price}</td>
          <td style="padding:12px;border-bottom:1px solid #e6ece8;">$${item.stop_loss}</td>
        </tr>`,
    )
    .join("");
  const textPicks = top
    .map(
      (item, index) =>
        `${index + 1}. ${item.symbol}: score ${item.score}, confidence ${item.confidence}, risk ${item.risk_score}, entry $${item.entry_low}-${item.entry_high}, target $${item.target_price}, stop $${item.stop_loss}. Analysis: ${getAnalysisUrl(item.symbol, args.customerId)}`,
    )
    .join("\n");

  return {
    subject: `TradePilot AI morning picks: ${top.map((item) => item.symbol).join(", ")}`,
    text: `Good morning ${args.customerName},\n\nYour pre-market TradePilot brief is ready. Market regime: ${args.marketRegime}\n\nTop opportunities:\n${textPicks}\n\nReview risk, position size, and your own plan before trading. TradePilot AI is not financial advice.`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;color:#17211d;line-height:1.5;max-width:760px;margin:0 auto;">
        <h1 style="font-size:28px;margin:0 0 8px;">TradePilot AI pre-market brief</h1>
        <p style="margin:0 0 20px;color:#52615b;">Good morning ${args.customerName}. Your daily stock analysis is ready before the market opens. Market regime: <strong>${args.marketRegime}</strong>.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead>
            <tr style="background:#f4f8f5;text-align:left;">
              <th style="padding:12px;">Symbol</th>
              <th style="padding:12px;">Score</th>
              <th style="padding:12px;">Confidence</th>
              <th style="padding:12px;">Risk</th>
              <th style="padding:12px;">Entry</th>
              <th style="padding:12px;">Target</th>
              <th style="padding:12px;">Stop</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:22px;color:#697770;font-size:13px;">Review risk, position size, and your own plan before trading. TradePilot AI is not financial advice.</p>
      </div>`,
  };
}
