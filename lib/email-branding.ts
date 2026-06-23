import type { OpportunityRow } from "@/lib/database.types";

type BrandedMorningEmailArgs = {
  analysisUrl: (symbol: string) => string;
  customerName: string;
  intro: string;
  marketRegime: string;
  opportunities: OpportunityRow[];
  signoff: string;
  subject?: string;
  unsubscribeUrl?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function currency(value: number) {
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    minimumFractionDigits: value >= 1000 ? 0 : 2,
  })}`;
}

function scoreTone(score: number) {
  if (score >= 80) return "#0b3d3f";
  if (score >= 65) return "#52615b";
  return "#b4533f";
}

function statCard(label: string, value: string, color = "#071418") {
  return `
    <td style="padding:0 8px 0 0;">
      <div style="border:1px solid #d8e0ea;border-radius:12px;background:#ffffff;padding:14px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;color:#697770;">${label}</p>
        <p style="margin:0;font-size:22px;font-weight:900;color:${color};">${value}</p>
      </div>
    </td>`;
}

function getGreeting(customerName: string) {
  const cleaned = customerName.trim();
  const genericNames = new Set(["investor", "tradepilot customer", "demo investor"]);

  if (!cleaned || genericNames.has(cleaned.toLowerCase())) {
    return "Good morning.";
  }

  return `Good morning ${cleaned.split(/\s+/)[0]}.`;
}

export function buildBrandedMorningEmail(args: BrandedMorningEmailArgs) {
  const top = args.opportunities.slice(0, 5);
  const greeting = getGreeting(args.customerName);
  const safeGreeting = escapeHtml(greeting);
  const safeIntro = escapeHtml(args.intro);
  const safeRegime = escapeHtml(args.marketRegime);
  const safeSignoff = escapeHtml(args.signoff);
  const avgScore = top.length
    ? Math.round(top.reduce((total, item) => total + item.score, 0) / top.length)
    : 0;
  const avgConfidence = top.length
    ? Math.round(top.reduce((total, item) => total + item.confidence, 0) / top.length)
    : 0;
  const lowerRisk = top.filter((item) => item.risk_score < 45).length;
  const rows =
    top
      .map((item, index) => {
        const symbol = escapeHtml(item.symbol);
        const analysisUrl = args.analysisUrl(item.symbol);

        return `
          <tr>
            <td style="padding:16px 12px;border-bottom:1px solid #e6ece8;">
              <span style="display:inline-block;min-width:28px;color:#697770;font-size:12px;font-weight:800;">#${index + 1}</span>
              <a href="${analysisUrl}" style="color:#071418;text-decoration:none;font-size:16px;font-weight:900;">${symbol}</a>
              <div style="margin-top:3px;color:#697770;font-size:12px;text-transform:uppercase;">${escapeHtml(item.asset_type)}</div>
            </td>
            <td style="padding:16px 12px;border-bottom:1px solid #e6ece8;">
              <span style="display:inline-block;border-radius:10px;background:#dbf7e8;color:${scoreTone(item.score)};font-weight:900;padding:7px 10px;">${item.score}</span>
            </td>
            <td style="padding:16px 12px;border-bottom:1px solid #e6ece8;font-weight:800;color:#071418;">${item.confidence}</td>
            <td style="padding:16px 12px;border-bottom:1px solid #e6ece8;font-weight:800;color:${item.risk_score >= 60 ? "#b4533f" : "#0b3d3f"};">${item.risk_score}</td>
            <td style="padding:16px 12px;border-bottom:1px solid #e6ece8;color:#52615b;font-weight:700;">${currency(item.entry_low)} - ${currency(item.entry_high)}</td>
            <td style="padding:16px 12px;border-bottom:1px solid #e6ece8;color:#0b3d3f;font-weight:900;">${currency(item.target_price)}</td>
            <td style="padding:16px 12px;border-bottom:1px solid #e6ece8;color:#b4533f;font-weight:900;">${currency(item.stop_loss)}</td>
          </tr>`;
      })
      .join("") ||
    `
      <tr>
        <td colspan="7" style="padding:22px 12px;border-bottom:1px solid #e6ece8;color:#697770;font-weight:700;">
          No live ranked opportunities have been saved yet.
        </td>
      </tr>`;
  const textRows =
    top
      .map(
        (item, index) =>
          `${index + 1}. ${item.symbol}: score ${item.score}, confidence ${item.confidence}, risk ${item.risk_score}, entry ${currency(item.entry_low)}-${currency(item.entry_high)}, target ${currency(item.target_price)}, stop ${currency(item.stop_loss)}. Analysis: ${args.analysisUrl(item.symbol)}`,
      )
      .join("\n") || "No live ranked opportunities have been saved yet.";
  const subject =
    args.subject ??
    `TradePilot AI morning picks${top.length ? `: ${top.map((item) => item.symbol).join(", ")}` : ""}`;
  const unsubscribe = args.unsubscribeUrl
    ? `<a href="${args.unsubscribeUrl}" style="color:#52615b;text-decoration:underline;">Unsubscribe</a>`
    : "";

  return {
    subject,
    text: `${greeting}\n\n${args.intro}\nMarket regime: ${args.marketRegime}\n\nTop opportunities:\n${textRows}\n\n${args.signoff}\n\nTradePilot AI is research software, not financial advice.${args.unsubscribeUrl ? `\n\nUnsubscribe: ${args.unsubscribeUrl}` : ""}`,
    html: `
      <div style="margin:0;padding:0;background:#f5f7fb;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f5f7fb;">
          <tr>
            <td align="center" style="padding:28px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:780px;border-collapse:collapse;font-family:Inter,Arial,sans-serif;color:#071418;">
                <tr>
                  <td style="border-radius:18px 18px 0 0;background:linear-gradient(135deg,#061c1f,#0c4a4d 58%,#b7f34b);padding:28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <div style="display:inline-block;border:1px solid rgba(255,255,255,.22);border-radius:12px;background:rgba(255,255,255,.10);padding:10px 12px;color:#ffffff;font-weight:900;letter-spacing:.02em;">TP</div>
                          <div style="display:inline-block;margin-left:12px;vertical-align:middle;">
                            <div style="color:#ffffff;font-size:22px;font-weight:900;line-height:1;">TradePilot <span style="display:inline-block;border-radius:6px;background:#b7f34b;color:#071418;font-size:11px;padding:4px 6px;vertical-align:middle;">AI</span></div>
                            <div style="margin-top:6px;color:rgba(255,255,255,.74);font-size:13px;font-weight:700;">Swing intelligence platform</div>
                          </div>
                        </td>
                        <td align="right" style="color:rgba(255,255,255,.78);font-size:12px;font-weight:800;text-transform:uppercase;">Pre-market brief</td>
                      </tr>
                    </table>
                    <h1 style="margin:28px 0 8px;color:#ffffff;font-size:34px;line-height:1.08;font-weight:900;">Morning trade ideas are ready</h1>
                    <p style="margin:0;color:rgba(255,255,255,.78);font-size:15px;line-height:1.6;">${safeGreeting} ${safeIntro}</p>
                  </td>
                </tr>
                <tr>
                  <td style="border:1px solid #d8e0ea;border-top:0;background:#ffffff;padding:22px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:18px;">
                      <tr>
                        ${statCard("Market regime", safeRegime, "#0b3d3f")}
                        ${statCard("Avg score", top.length ? `${avgScore}/100` : "Pending", "#0b3d3f")}
                        ${statCard("Avg confidence", top.length ? `${avgConfidence}/100` : "Pending", "#071418")}
                        ${statCard("Lower risk", top.length ? `${lowerRisk}` : "Pending", "#0b3d3f")}
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #d8e0ea;border-radius:14px;overflow:hidden;font-size:13px;">
                      <thead>
                        <tr style="background:#f4f8f5;text-align:left;color:#52615b;font-size:11px;text-transform:uppercase;letter-spacing:.02em;">
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
                    <div style="margin-top:20px;border-radius:14px;background:#f5f7fb;border:1px solid #d8e0ea;padding:16px;">
                      <p style="margin:0;color:#071418;font-size:14px;font-weight:900;">Before trading</p>
                      <p style="margin:6px 0 0;color:#52615b;font-size:13px;line-height:1.6;">${safeSignoff} TradePilot AI is research software, not financial advice.</p>
                    </div>
                    <p style="margin:18px 0 0;color:#697770;font-size:12px;line-height:1.6;">
                      You are receiving this because morning alerts are enabled for your TradePilot AI account. ${unsubscribe}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>`,
  };
}
