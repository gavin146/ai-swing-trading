import { NextRequest, NextResponse } from "next/server";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import { sendEmail } from "@/lib/email";
import { recordAppEvent } from "@/lib/persistence";
import { sendTwilioSms } from "@/lib/twilio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CommunicationTestRequest = {
  channel?: "email" | "sms";
  email?: string;
  html?: string;
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

    if (!email || !body.subject || !body.text || !body.html) {
      return NextResponse.json(
        { error: "Email, subject, text, and HTML preview are required." },
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
