import { NextRequest, NextResponse } from "next/server";
import { buildMorningAlertMessage, buildMorningEmailAlert } from "@/lib/alerts";
import { runFmpDailyRankingAgent } from "@/lib/agent";
import { sendAdminFailureAlert, sendEmail } from "@/lib/email";
import {
  getMorningAlertRecipients,
  persistAgentRun,
  persistAlertLog,
  recordAppEvent,
} from "@/lib/persistence";
import { sendTwilioSms } from "@/lib/twilio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function runMorningAlerts(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipientResult = await getMorningAlertRecipients();
  const recipients = recipientResult.recipients;
  const phone = process.env.ALERT_TEST_PHONE;
  const customerName = process.env.ALERT_TEST_CUSTOMER_NAME ?? "";

  if (!process.env.FMP_API_KEY && !process.env.FINANCIAL_DATA_API_KEY) {
    return NextResponse.json(
      { error: "FMP_API_KEY is required for live morning alerts." },
      { status: 503 },
    );
  }

  try {
    const result = await runFmpDailyRankingAgent({ limit: 90 });
    const persistence = await persistAgentRun(result);
    const deliveries = [];

    if (recipients.length > 0) {
      for (const recipient of recipients) {
        const emailAlert = buildMorningEmailAlert({
          customerName: recipient.fullName,
          customerId: recipient.userId ?? undefined,
          marketRegime: result.marketRegime,
          opportunities: result.opportunities,
        });
        const delivery = await sendEmail({
          to: recipient.email,
          ...emailAlert,
        });
        await persistAlertLog({
          userId: recipient.userId,
          agentRunId: result.runId,
          channel: "email",
          status: delivery.status,
          recipient: recipient.email,
          message: emailAlert.text,
          providerMessageId: delivery.id,
          errorMessage: "error" in delivery ? delivery.error : null,
        });

        deliveries.push({
          channel: "email",
          to: recipient.email,
          delivery,
          preview: emailAlert,
        });
      }
    }

    if (phone) {
      const message = buildMorningAlertMessage({
        customerName,
        marketRegime: result.marketRegime,
        opportunities: result.opportunities,
      });
      const delivery = await sendTwilioSms(phone, message);

      deliveries.push({
        channel: "sms",
        delivery,
        message,
      });
    }

    if (deliveries.length === 0) {
      const emailAlert = buildMorningEmailAlert({
        customerName,
        marketRegime: result.marketRegime,
        opportunities: result.opportunities,
      });

      return NextResponse.json({
        sent: 0,
        mode: "preview",
        email: emailAlert,
        persistence,
        recipients: recipientResult,
        note:
          "No alert recipients were found. Add users with email alerts enabled in Supabase, or set ALERT_CUSTOMER_EMAILS while Supabase is not configured.",
      });
    }

    if (!persistence.persisted) {
      await recordAppEvent({
        level: "warning",
        source: "morning-alerts-cron",
        message: "Morning alerts sent but the ranking run was not persisted.",
        metadata: { reason: persistence.reason, error: persistence.error, runId: result.runId },
      });
      await sendAdminFailureAlert({
        source: "morning-alerts-cron",
        message: "Morning alerts sent but the ranking run was not persisted.",
        error: persistence.error ?? persistence.reason,
        metadata: { runId: result.runId },
      });
    }

    return NextResponse.json({
      sent: deliveries.filter((item) => item.delivery.status !== "failed").length,
      deliveries,
      persistence,
      recipientSource: recipientResult.source,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await recordAppEvent({
      level: "error",
      source: "morning-alerts-cron",
      message: "Morning alert cron failed.",
      metadata: { error: errorMessage },
    });
    await sendAdminFailureAlert({
      source: "morning-alerts-cron",
      message: "Morning alert cron failed.",
      error: errorMessage,
    });

    return NextResponse.json({ error: errorMessage }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  return runMorningAlerts(request);
}

export async function POST(request: NextRequest) {
  return runMorningAlerts(request);
}
