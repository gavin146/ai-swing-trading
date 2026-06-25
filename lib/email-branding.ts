import type { OpportunityRow } from "@/lib/database.types";

type BrandedMorningEmailArgs = {
  analysisUrl: (symbol: string) => string;
  customerName: string;
  intro: string;
  marketRegime: string;
  openTrackingUrl?: string;
  opportunities: OpportunityRow[];
  signoff: string;
  subject?: string;
  unsubscribeUrl?: string;
};

type BrandedEmailArgs = {
  bodyHtml: string;
  eyebrow?: string;
  footerNote?: string;
  preheader?: string;
  title: string;
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function brandedButton(label: string, href: string) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 0;">
      <tr>
        <td style="border-radius:14px;background:#071418;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:900;line-height:1.1;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

export function buildBrandedEmail(args: BrandedEmailArgs) {
  const safeEyebrow = escapeHtml(args.eyebrow ?? "SwingFi");
  const safePreheader = escapeHtml(
    args.preheader ?? "SwingFi daily swing trade intelligence.",
  );
  const safeTitle = escapeHtml(args.title);
  const safeFooter = escapeHtml(
    args.footerNote ??
      "SwingFi is research software, not financial advice. Always review risk and do your own research before making trading decisions.",
  );

  return `
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
      ${safePreheader}
    </div>
    <div style="margin:0;padding:0;background:#f5f7fb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f5f7fb;">
        <tr>
          <td align="center" style="padding:28px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;font-family:Inter,Arial,sans-serif;color:#071418;">
              <tr>
                <td style="border-radius:22px 22px 0 0;background:linear-gradient(135deg,#061c1f,#0b3d3f 64%,#123b37);padding:28px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td>
                        <span style="display:inline-block;border:1px solid rgba(255,255,255,.22);border-radius:13px;background:rgba(255,255,255,.10);padding:10px 12px;color:#ffffff;font-size:14px;font-weight:900;letter-spacing:.02em;">SF</span>
                        <span style="display:inline-block;margin-left:12px;vertical-align:middle;">
                          <span style="display:block;color:#ffffff;font-size:22px;font-weight:900;line-height:1;">SwingFi <span style="display:inline-block;border-radius:6px;background:#b7f34b;color:#071418;font-size:11px;padding:4px 6px;vertical-align:middle;">AI</span></span>
                          <span style="display:block;margin-top:6px;color:#e7f3ee;font-size:13px;font-weight:800;">Daily swing trade intelligence</span>
                        </span>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:28px 0 10px;color:#b7f34b;font-size:12px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;">${safeEyebrow}</p>
                  <h1 style="margin:0;color:#ffffff;font-size:34px;line-height:1.08;font-weight:900;letter-spacing:0;">${safeTitle}</h1>
                </td>
              </tr>
              <tr>
                <td style="border:1px solid #d8e0ea;border-top:0;border-radius:0 0 22px 22px;background:#ffffff;padding:28px;">
                  <div style="color:#33423d;font-size:15px;line-height:1.68;">
                    ${args.bodyHtml}
                  </div>
                  <div style="margin-top:26px;border-radius:16px;background:#f5f7fb;border:1px solid #d8e0ea;padding:16px;">
                    <p style="margin:0;color:#071418;font-size:14px;font-weight:900;">Before using SwingFi research</p>
                    <p style="margin:7px 0 0;color:#33423d;font-size:12px;line-height:1.6;">${safeFooter}</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>`;
}

function currency(value: number) {
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    minimumFractionDigits: value >= 1000 ? 0 : 2,
  })}`;
}

function scoreTone(score: number) {
  if (score >= 80) return "#0b3d3f";
  if (score >= 65) return "#33423d";
  return "#b4533f";
}

function statCard(label: string, value: string, color = "#071418") {
  return `
    <td style="padding:0 8px 0 0;">
      <div style="border:1px solid #d8e0ea;border-radius:12px;background:#ffffff;padding:14px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;color:#3f4d47;">${label}</p>
        <p style="margin:0;font-size:22px;font-weight:900;color:${color};">${value}</p>
      </div>
    </td>`;
}

function getGreeting(customerName: string) {
  const cleaned = customerName.trim();
  const genericNames = new Set(["investor", "swingfi customer", "demo investor"]);

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
        const analysisUrl = escapeHtml(args.analysisUrl(item.symbol));

        return `
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;margin:0 0 14px;border:1px solid #d8e0ea;border-radius:16px;background:#ffffff;">
            <tr>
              <td style="padding:16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td>
                      <span style="display:inline-block;border-radius:9px;background:#071418;color:#ffffff;font-size:12px;font-weight:900;padding:6px 8px;">#${index + 1}</span>
                      <a href="${analysisUrl}" style="display:inline-block;margin-left:8px;color:#071418;text-decoration:none;font-size:20px;font-weight:900;vertical-align:middle;">${symbol}</a>
                      <p style="margin:6px 0 0;color:#3f4d47;font-size:12px;font-weight:900;text-transform:uppercase;">${escapeHtml(item.asset_type)}</p>
                    </td>
                    <td align="right">
                      <span style="display:inline-block;border-radius:12px;background:#dbf7e8;color:${scoreTone(item.score)};font-size:18px;font-weight:900;padding:9px 12px;">${item.score}/100</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0;color:#33423d;font-size:13px;line-height:1.6;">Review the entry range before chasing price. Use the stop loss to decide if the setup fits your risk plan.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:14px;">
                  <tr>
                    <td style="width:50%;padding:0 6px 8px 0;">
                      <div style="border-radius:12px;background:#f5f7fb;border:1px solid #e6ece8;padding:12px;">
                        <p style="margin:0 0 5px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Confidence</p>
                        <p style="margin:0;color:#071418;font-size:16px;font-weight:900;">${item.confidence}/100</p>
                      </div>
                    </td>
                    <td style="width:50%;padding:0 0 8px 6px;">
                      <div style="border-radius:12px;background:#f5f7fb;border:1px solid #e6ece8;padding:12px;">
                        <p style="margin:0 0 5px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Risk</p>
                        <p style="margin:0;color:${item.risk_score >= 60 ? "#b4533f" : "#0b3d3f"};font-size:16px;font-weight:900;">${item.risk_score}/100</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="width:50%;padding:0 6px 8px 0;">
                      <div style="border-radius:12px;background:#f5f7fb;border:1px solid #e6ece8;padding:12px;">
                        <p style="margin:0 0 5px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Entry</p>
                        <p style="margin:0;color:#071418;font-size:15px;font-weight:900;">${currency(item.entry_low)} - ${currency(item.entry_high)}</p>
                      </div>
                    </td>
                    <td style="width:50%;padding:0 0 8px 6px;">
                      <div style="border-radius:12px;background:#f5f7fb;border:1px solid #e6ece8;padding:12px;">
                        <p style="margin:0 0 5px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Target</p>
                        <p style="margin:0;color:#0b3d3f;font-size:15px;font-weight:900;">${currency(item.target_price)}</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="width:50%;padding:0 6px 0 0;">
                      <div style="border-radius:12px;background:#fff7f5;border:1px solid #f0d5ce;padding:12px;">
                        <p style="margin:0 0 5px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Stop loss</p>
                        <p style="margin:0;color:#b4533f;font-size:15px;font-weight:900;">${currency(item.stop_loss)}</p>
                      </div>
                    </td>
                    <td style="width:50%;padding:0 0 0 6px;">
                      <a href="${analysisUrl}" style="display:block;border-radius:12px;background:#071418;color:#ffffff;text-align:center;text-decoration:none;font-size:13px;font-weight:900;padding:14px 10px;">View analysis</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>`;
      })
      .join("") ||
    `
      <div style="border:1px solid #d8e0ea;border-radius:16px;background:#ffffff;padding:18px;color:#33423d;font-size:14px;font-weight:800;">
          No live ranked opportunities have been saved yet.
      </div>`;
  const textRows =
    top
      .map(
        (item, index) =>
          `${index + 1}. ${item.symbol}: score ${item.score}, confidence ${item.confidence}, risk ${item.risk_score}, entry ${currency(item.entry_low)}-${currency(item.entry_high)}, target ${currency(item.target_price)}, stop ${currency(item.stop_loss)}. Analysis: ${args.analysisUrl(item.symbol)}`,
      )
      .join("\n") || "No live ranked opportunities have been saved yet.";
  const subject =
    args.subject ??
    `SwingFi morning picks${top.length ? `: ${top.map((item) => item.symbol).join(", ")}` : ""}`;
  const unsubscribe = args.unsubscribeUrl
    ? `<a href="${args.unsubscribeUrl}" style="color:#0b3d3f;text-decoration:underline;font-weight:800;">Unsubscribe</a>`
    : "";
  const openPixel = args.openTrackingUrl
    ? `<img src="${args.openTrackingUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;opacity:0;border:0;" />`
    : "";

  return {
    subject,
    text: `${greeting}\n\n${args.intro}\nMarket regime: ${args.marketRegime}\n\nTop opportunities:\n${textRows}\n\n${args.signoff}\n\nSwingFi is research software, not financial advice.${args.unsubscribeUrl ? `\n\nUnsubscribe: ${args.unsubscribeUrl}` : ""}`,
    html: `
      <div style="margin:0;padding:0;background:#f5f7fb;">
        ${openPixel}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f5f7fb;">
          <tr>
            <td align="center" style="padding:28px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:780px;border-collapse:collapse;font-family:Inter,Arial,sans-serif;color:#071418;">
                <tr>
                  <td style="border-radius:18px 18px 0 0;background:linear-gradient(135deg,#061c1f,#0b3d3f 64%,#123b37);padding:28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <div style="display:inline-block;border:1px solid rgba(255,255,255,.22);border-radius:12px;background:rgba(255,255,255,.10);padding:10px 12px;color:#ffffff;font-weight:900;letter-spacing:.02em;">SF</div>
                          <div style="display:inline-block;margin-left:12px;vertical-align:middle;">
                            <div style="color:#ffffff;font-size:22px;font-weight:900;line-height:1;">SwingFi <span style="display:inline-block;border-radius:6px;background:#b7f34b;color:#071418;font-size:11px;padding:4px 6px;vertical-align:middle;">AI</span></div>
                            <div style="margin-top:6px;color:#e7f3ee;font-size:13px;font-weight:800;">Daily swing trade intelligence</div>
                          </div>
                        </td>
                        <td align="right" style="color:#eef8f4;font-size:12px;font-weight:900;text-transform:uppercase;">Pre-market brief</td>
                      </tr>
                    </table>
                    <h1 style="margin:28px 0 8px;color:#ffffff;font-size:34px;line-height:1.08;font-weight:900;">Morning trade ideas are ready</h1>
                    <p style="margin:0;color:#eef8f4;font-size:15px;line-height:1.6;">${safeGreeting} ${safeIntro}</p>
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
                    <div style="margin-top:8px;">${rows}</div>
                    <div style="margin-top:20px;border-radius:14px;background:#f5f7fb;border:1px solid #d8e0ea;padding:16px;">
                      <p style="margin:0;color:#071418;font-size:14px;font-weight:900;">Before trading</p>
                      <p style="margin:6px 0 0;color:#33423d;font-size:13px;line-height:1.6;">${safeSignoff} SwingFi is research software, not financial advice.</p>
                    </div>
                    <p style="margin:18px 0 0;color:#3f4d47;font-size:12px;line-height:1.6;">
                      You are receiving this because morning alerts are enabled for your SwingFi account. ${unsubscribe}
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
