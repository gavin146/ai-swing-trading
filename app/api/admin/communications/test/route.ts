import { NextRequest, NextResponse } from "next/server";
import { buildMorningEmailAlert } from "@/lib/alerts";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import { sendEmail } from "@/lib/email";
import { recordAppEvent } from "@/lib/persistence";
import { listLatestOpportunities } from "@/lib/repositories/opportunities";
import { sendTwilioSms } from "@/lib/twilio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CommunicationTestRequest = {
  channel?: "email" | "sms";
  email?: string;
  html?: string;
  mode?: "custom" | "morning_email";
  phone?: string;
  sms?: string;
  subject?: string;
  text?: string;
};

export async function POST(request: NextRequest) {
  if (!isAdminApiRequest(request)) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as CommunicationTestRequest;

  if (body.channel === "email") {
    const email = body.email?.trim();

    if (!email) {
      return NextResponse.json(
        { error: "A test email address is required." },
        { status: 400 },
      );
    }

    if (body.mode === "morning_email") {
      const opportunityResult = await listLatestOpportunities(30);
      const alert = buildMorningEmailAlert({
        customerName: "SwingFi Admin",
        customerId: "admin-test",
        marketRegime: "balanced",
        opportunities: opportunityResult.rows,
      });
      const delivery = await sendEmail({
        to: email,
        subject: `[Test] ${alert.subject}`,
        text: `TEST EMAIL ONLY\n\n${alert.text}`,
        html: alert.html.replace(
          /(<body[^>]*>)/i,
          `$1<div style="max-width:640px;margin:0 auto;padding:12px 20px;background:#f5c16c;color:#071418;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:900;text-align:center;">TEST EMAIL ONLY - not sent to customers</div>`,
        ),
      });

      await recordAppEvent({
        level: delivery.status === "failed" ? "error" : "info",
        source: "admin-morning-email-test",
        message: "Admin sent a safe morning email test.",
        metadata: {
          mode: delivery.mode,
          opportunityCount: opportunityResult.rows.length,
          status: delivery.status,
          to: email,
          error: delivery.error,
        },
      });

      return NextResponse.json({
        delivery,
        opportunityCount: opportunityResult.rows.length,
        subject: `[Test] ${alert.subject}`,
      });
    }

    if (!body.subject || !body.text || !body.html) {
      return NextResponse.json(
        { error: "Subject, text, and HTML preview are required for custom email tests." },
        { status: 400 },
      );
    }

    const delivery = await sendEmail({
      to: email,
      subject: body.subject,
      text: body.text,
      html: body.html,
    });

    await recordAppEvent({
      level: delivery.status === "failed" ? "error" : "info",
      source: "admin-communications-test",
      message: "Admin sent an email template test.",
      metadata: {
        mode: delivery.mode,
        status: delivery.status,
        to: email,
        error: delivery.error,
      },
    });

    return NextResponse.json({ delivery });
  }

  if (body.channel === "sms") {
    const phone = body.phone?.trim();

    if (!phone || !body.sms) {
      return NextResponse.json(
        { error: "Phone number and SMS body are required." },
        { status: 400 },
      );
    }

    const delivery = await sendTwilioSms(phone, body.sms);

    await recordAppEvent({
      level: delivery.status === "failed" ? "error" : "info",
      source: "admin-communications-test",
      message: "Admin sent an SMS template test.",
      metadata: {
        mode: delivery.mode,
        status: delivery.status,
        to: phone,
        error: "error" in delivery ? delivery.error : null,
      },
    });

    return NextResponse.json({ delivery });
  }

  return NextResponse.json({ error: "Choose email or sms." }, { status: 400 });
}
