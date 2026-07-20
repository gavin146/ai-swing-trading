import { brandedButton, buildBrandedEmail, escapeHtml } from "../email-branding";
import { formatCopilotMoney } from "./formatting";
import type { CopilotUiViewModel } from "./ui-view-model";

export type CopilotDailyDigestEmailArgs = {
  copilotUrl: string;
  customerName?: string;
  subject?: string;
  unsubscribeUrl?: string;
  viewModel: CopilotUiViewModel;
};

export type CopilotDailyDigestEmail = {
  html: string;
  subject: string;
  text: string;
};

const bannedLanguage = [
  /buy\s+now/i,
  /sell\s+now/i,
  /guaranteed/i,
  /high\s+yield/i,
  /cannot\s+lose/i,
];

function cleanText(value: unknown, fallback = "Not available") {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text || fallback;
}

function formatMoney(value: number | null | undefined) {
  return formatCopilotMoney(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function getGreeting(customerName: string | undefined) {
  const cleaned = cleanText(customerName, "");

  if (!cleaned) return "Good morning.";

  return `Good morning ${cleaned.split(/\s+/)[0]}.`;
}

function statusPill(label: string, color = "#0b3d3f", background = "#dbf7e8") {
  return `<span style="display:inline-block;border-radius:999px;background:${background};color:${color};font-size:12px;font-weight:900;padding:7px 10px;white-space:nowrap;">${escapeHtml(label)}</span>`;
}

function section(title: string, body: string) {
  return `
    <div style="margin-top:18px;border:1px solid #d8e0ea;border-radius:16px;background:#ffffff;padding:18px;">
      <h2 style="margin:0;color:#071418;font-size:20px;line-height:1.25;font-weight:900;">${escapeHtml(title)}</h2>
      <div style="margin-top:12px;color:#33423d;font-size:13px;line-height:1.62;">${body}</div>
    </div>`;
}

function findingRows(viewModel: CopilotUiViewModel, maxItems: number) {
  const findings = viewModel.findings
    .filter((finding) => finding.severity === "high" || finding.severity === "attention")
    .slice(0, maxItems);

  if (!findings.length) {
    return `<p style="margin:0;color:#33423d;">No urgent Copilot findings were supplied for this digest.</p>`;
  }

  return findings
    .map((finding) => {
      const label = finding.severity === "high" ? "Review first" : "Needs attention";
      const background = finding.severity === "high" ? "#fff0ec" : "#fff7df";
      const color = finding.severity === "high" ? "#b4533f" : "#7a5600";

      return `
        <div style="margin-top:10px;border-radius:14px;background:#f8fbfa;border:1px solid #e6ece8;padding:14px;">
          ${statusPill(label, color, background)}
          <p style="margin:10px 0 0;color:#071418;font-size:15px;font-weight:900;">${escapeHtml(finding.symbol ? `${finding.symbol}: ${finding.title}` : finding.title)}</p>
          <p style="margin:6px 0 0;color:#33423d;font-size:13px;line-height:1.6;">${escapeHtml(finding.message)}</p>
        </div>`;
    })
    .join("");
}

function insidePlanRows(viewModel: CopilotUiViewModel) {
  const insidePlan = viewModel.findings
    .filter((finding) => finding.type === "INSIDE_ORIGINAL_PLAN")
    .slice(0, 4);

  if (!insidePlan.length) {
    return `<p style="margin:0;color:#33423d;">No positions were confirmed as clearly inside the saved plan from the supplied evidence.</p>`;
  }

  return insidePlan
    .map(
      (finding) => `
        <div style="margin-top:10px;border-radius:14px;background:#f8fbfa;border:1px solid #e6ece8;padding:14px;">
          ${statusPill("Inside saved plan")}
          <p style="margin:10px 0 0;color:#071418;font-size:15px;font-weight:900;">${escapeHtml(finding.symbol ?? "Tracked position")}</p>
          <p style="margin:6px 0 0;color:#33423d;font-size:13px;line-height:1.6;">${escapeHtml(finding.message)}</p>
        </div>`,
    )
    .join("");
}

function dataHealthRows(viewModel: CopilotUiViewModel) {
  const limited = viewModel.dataHealth.filter((item) => item.status !== "fresh");
  const rows = limited.length ? limited : viewModel.dataHealth.slice(0, 3);

  if (!rows.length) {
    return `<p style="margin:0;color:#33423d;">No source-health records were supplied.</p>`;
  }

  return rows
    .map((item) => {
      const label = cleanText(item.label ?? item.source);
      const status = cleanText(item.status);
      const background = item.status === "fresh" ? "#dbf7e8" : "#fff7df";

      return `
        <div style="margin-top:10px;border-radius:14px;background:#f8fbfa;border:1px solid #e6ece8;padding:14px;">
          ${statusPill(status, item.status === "fresh" ? "#0b3d3f" : "#7a5600", background)}
          <p style="margin:10px 0 0;color:#071418;font-size:15px;font-weight:900;">${escapeHtml(label)}</p>
          <p style="margin:6px 0 0;color:#33423d;font-size:13px;line-height:1.6;">Data as of ${escapeHtml(formatDate(item.dataAsOf))}.${item.message ? ` ${escapeHtml(item.message)}` : ""}</p>
        </div>`;
    })
    .join("");
}

function positionSnapshotRows(viewModel: CopilotUiViewModel) {
  if (!viewModel.positions.length) {
    return `<p style="margin:0;color:#33423d;">No tracked SwingFi positions were supplied for this Copilot preview.</p>`;
  }

  return viewModel.positions
    .slice(0, 5)
    .map(
      (position) => `
        <tr>
          <td style="padding:11px 8px;border-bottom:1px solid #e6ece8;color:#071418;font-size:14px;font-weight:900;word-break:break-word;">${escapeHtml(position.symbol)}</td>
          <td style="padding:11px 8px;border-bottom:1px solid #e6ece8;color:#33423d;font-size:13px;font-weight:800;">${escapeHtml(position.planStatus)}</td>
          <td style="padding:11px 8px;border-bottom:1px solid #e6ece8;color:#071418;font-size:13px;font-weight:900;">${escapeHtml(formatMoney(position.currentPrice))}</td>
          <td style="padding:11px 8px;border-bottom:1px solid #e6ece8;color:#0b3d3f;font-size:13px;font-weight:900;">${escapeHtml(formatMoney(position.targetPrice))}</td>
          <td style="padding:11px 8px;border-bottom:1px solid #e6ece8;color:#b4533f;font-size:13px;font-weight:900;">${escapeHtml(formatMoney(position.stopLoss))}</td>
        </tr>`,
    )
    .join("");
}

function researchRows(args: CopilotDailyDigestEmailArgs) {
  const opportunities = args.viewModel.researchOpportunities.slice(0, 4);

  if (!opportunities.length) {
    return `<p style="margin:0;color:#33423d;">No SwingFi research opportunities were supplied for this Copilot preview.</p>`;
  }

  return opportunities
    .map((opportunity) => {
      const symbol = cleanText(opportunity.symbol);
      const label = opportunity.companyName
        ? `${symbol}: ${opportunity.companyName}`
        : symbol;
      const href = new URL(`/opportunities/${encodeURIComponent(symbol)}`, args.copilotUrl).toString();

      return `
        <div style="margin-top:10px;border-radius:14px;background:#f8fbfa;border:1px solid #e6ece8;padding:14px;">
          <p style="margin:0;color:#071418;font-size:15px;font-weight:900;word-break:break-word;">${escapeHtml(label)}</p>
          <p style="margin:6px 0 0;color:#33423d;font-size:13px;line-height:1.6;">Score ${escapeHtml(String(opportunity.score ?? "unknown"))}; confidence ${escapeHtml(String(opportunity.confidence ?? "unknown"))}; risk ${escapeHtml(String(opportunity.riskScore ?? "unknown"))}. ${escapeHtml(opportunity.summary ?? "Review the full SwingFi research page before relying on this setup.")}</p>
          <p style="margin:10px 0 0;"><a href="${escapeHtml(href)}" style="color:#0b3d3f;text-decoration:underline;font-size:13px;font-weight:900;">Review research page</a></p>
        </div>`;
    })
    .join("");
}

function validateRenderedEmail(rendered: CopilotDailyDigestEmail) {
  const combined = `${rendered.subject}\n${rendered.text}\n${rendered.html}`;
  const banned = bannedLanguage.find((pattern) => pattern.test(combined));

  if (banned) {
    throw new Error(`Copilot email contains banned language: ${banned.source}.`);
  }
}

export function buildCopilotDailyDigestEmail(
  args: CopilotDailyDigestEmailArgs,
): CopilotDailyDigestEmail {
  const report = args.viewModel.report;
  const greeting = getGreeting(args.customerName);
  const subject =
    args.subject ??
    `SwingFi Copilot digest for ${report.reportDate}`;
  const copilotButton = brandedButton("Open Copilot", args.copilotUrl);
  const unsubscribe = args.unsubscribeUrl
    ? `<a href="${escapeHtml(args.unsubscribeUrl)}" style="color:#0b3d3f;text-decoration:underline;font-weight:800;">Unsubscribe</a>`
    : "";
  const bodyHtml = `
    <p style="margin:0;color:#33423d;font-size:15px;line-height:1.68;">${escapeHtml(greeting)} Your Copilot research digest is ready. It reviews the SwingFi plans you track, highlights stale or missing information, and points you back to the full Copilot page for context.</p>
    <div style="margin-top:18px;border-radius:16px;background:#f8fbfa;border:1px solid #d8e0ea;padding:16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:0 8px 10px 0;width:50%;">
            <p style="margin:0 0 5px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Report date</p>
            <p style="margin:0;color:#071418;font-size:15px;font-weight:900;">${escapeHtml(report.reportDate)}</p>
          </td>
          <td style="padding:0 0 10px 8px;width:50%;">
            <p style="margin:0 0 5px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Portfolio data as of</p>
            <p style="margin:0;color:#071418;font-size:15px;font-weight:900;">${escapeHtml(formatDate(report.portfolioDataAsOf))}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 8px 0 0;width:50%;">
            <p style="margin:0 0 5px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Tracked positions</p>
            <p style="margin:0;color:#071418;font-size:15px;font-weight:900;">${escapeHtml(String(report.accountSummary.positionCount))}</p>
          </td>
          <td style="padding:8px 0 0 8px;width:50%;">
            <p style="margin:0 0 5px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Source</p>
            <p style="margin:0;color:#071418;font-size:15px;font-weight:900;">${escapeHtml(args.viewModel.sourceLabel)}</p>
          </td>
        </tr>
      </table>
    </div>
    ${section(
      "Portfolio snapshot",
      `<div style="overflow-x:auto;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width:560px;border-collapse:collapse;">
          <tr>
            <th align="left" style="padding:0 8px 9px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Symbol</th>
            <th align="left" style="padding:0 8px 9px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Plan status</th>
            <th align="left" style="padding:0 8px 9px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Current</th>
            <th align="left" style="padding:0 8px 9px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Target</th>
            <th align="left" style="padding:0 8px 9px;color:#3f4d47;font-size:10px;font-weight:900;text-transform:uppercase;">Stop</th>
          </tr>
          ${positionSnapshotRows(args.viewModel)}
        </table>
      </div>`,
    )}
    ${section("Needs attention", findingRows(args.viewModel, 3))}
    ${section("Still inside plan", insidePlanRows(args.viewModel))}
    ${section("Data health", dataHealthRows(args.viewModel))}
    ${section("Research opportunities to review", researchRows(args))}
    <div style="margin-top:20px;border-radius:16px;background:#f5f7fb;border:1px solid #d8e0ea;padding:16px;">
      <p style="margin:0;color:#071418;font-size:14px;font-weight:900;">Open the full Copilot page</p>
      <p style="margin:7px 0 0;color:#33423d;font-size:13px;line-height:1.6;">Use the full page to review all supplied findings, stale data notes, and original SwingFi plan context.</p>
      ${copilotButton}
    </div>
    <p style="margin:18px 0 0;color:#3f4d47;font-size:12px;line-height:1.6;">You are receiving this because SwingFi research emails are enabled for your account. ${unsubscribe}</p>`;
  const textLines = [
    greeting,
    "",
    `SwingFi Copilot digest for ${report.reportDate}`,
    `Portfolio data as of: ${formatDate(report.portfolioDataAsOf)}`,
    `Tracked positions: ${report.accountSummary.positionCount}`,
    `Source: ${args.viewModel.sourceLabel}`,
    "",
    "Needs attention:",
    ...args.viewModel.findings
      .filter((finding) => finding.severity === "high" || finding.severity === "attention")
      .slice(0, 3)
      .map((finding) => `- ${finding.symbol ? `${finding.symbol}: ` : ""}${finding.title}. ${finding.message}`),
    "",
    "Still inside plan:",
    ...args.viewModel.findings
      .filter((finding) => finding.type === "INSIDE_ORIGINAL_PLAN")
      .slice(0, 4)
      .map((finding) => `- ${finding.symbol ? `${finding.symbol}: ` : ""}${finding.message}`),
    "",
    "Data health:",
    ...args.viewModel.dataHealth
      .filter((item) => item.status !== "fresh")
      .map((item) => `- ${item.label ?? item.source}: ${item.status}, data as of ${formatDate(item.dataAsOf)}${item.message ? `. ${item.message}` : ""}`),
    "",
    `Open Copilot: ${args.copilotUrl}`,
    "SwingFi is research software, not financial advice.",
    args.unsubscribeUrl ? `Unsubscribe: ${args.unsubscribeUrl}` : "",
  ].filter((line, index, list) => line || list[index - 1]);
  const rendered = {
    html: buildBrandedEmail({
      bodyHtml,
      eyebrow: "Copilot digest",
      footerNote:
        "SwingFi is research software, not financial advice. Review source freshness, original target, stop, and your own risk plan before making trading decisions.",
      preheader: `SwingFi Copilot digest for ${report.reportDate}`,
      title: "Your Copilot research digest",
    }),
    subject,
    text: textLines.join("\n"),
  };

  validateRenderedEmail(rendered);

  return rendered;
}
