import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { normalizeAppUrl } from "@/lib/brand";
import { sendEmail } from "@/lib/email";
import { brandedButton, buildBrandedEmail, escapeHtml } from "@/lib/email-branding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function firstName(value: unknown) {
  const cleaned = String(value ?? "").trim();
  return cleaned ? cleaned.split(/\s+/)[0] : "there";
}

export async function POST(request: NextRequest) {
  const session = await resolveCustomerSession(request);
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
  };
  const email = cleanEmail(session.user?.email);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid login session is required." }, { status: 401 });
  }

  const name = firstName(body.name || session.user?.email);
  const safeName = escapeHtml(name);
  const dashboardUrl = `${normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin)}/dashboard`;
  const subject = "Welcome to SwingFi";
  const text = [
    `Welcome to SwingFi, ${name}.`,
    "",
    "Your 30-day free trial has started. You can now review the daily ranked swing-trade opportunities, score explanations, entry ranges, targets, stop losses, and estimated trade time frames.",
    "",
    `Open your dashboard: ${dashboardUrl}`,
    "",
    "SwingFi is research software, not financial advice. Always review risk and do your own research before making trading decisions.",
  ].join("\n");
  const html = buildBrandedEmail({
    eyebrow: "Welcome to SwingFi",
    preheader: "Your SwingFi 30-day free trial is live.",
    title: "Your free trial is live",
    bodyHtml: `
      <p style="margin:0 0 14px;color:#071418;font-size:17px;font-weight:900;">Welcome, ${safeName}.</p>
      <p style="margin:0;color:#33423d;">Your 30-day free trial has started. Use SwingFi to review ranked swing-trade opportunities, confidence, risk, entry range, target, stop loss, and estimated trade time frame.</p>
      ${brandedButton("Open dashboard", dashboardUrl)}
      <div style="margin-top:22px;border-radius:16px;background:#f4f8f5;border:1px solid #d8e0ea;padding:16px;">
        <p style="margin:0;color:#071418;font-size:14px;font-weight:900;">A simple way to use SwingFi</p>
        <p style="margin:7px 0 0;color:#33423d;font-size:13px;line-height:1.6;">Start with the highest-ranked setups, then compare confidence, risk, entry range, target, stop loss, and the estimated holding window before doing deeper research.</p>
      </div>`,
  });

  const delivery = await sendEmail({ to: email, subject, text, html });

  return NextResponse.json({ delivery });
}
