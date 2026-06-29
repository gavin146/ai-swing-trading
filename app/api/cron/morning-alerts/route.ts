import { NextRequest, NextResponse } from "next/server";
import { buildMorningAlertMessage, buildMorningEmailAlert } from "@/lib/alerts";
import { hydrateRuntimeCalibrationFromSupabase, runFmpDailyRankingAgent } from "@/lib/agent";
import { sendAdminFailureAlert, sendEmail } from "@/lib/email";
import {
  getLatestPersistedMorningRun,
  getMorningAlertRecipients,
  persistAgentRun,
  persistAlertLog,
  type PersistenceResult,
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

function alertReuseWindowMinutes() {
  const parsed = Number(process.env.MORNING_ALERT_REUSE_WINDOW_MINUTES ?? 180);

  if (!Number.isFinite(parsed)) return 180;

  return Math.max(15, Math.min(720, Math.round(parsed)));
}

async function runMorningAlerts(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipientResult = await getMorningAlertRecipients();
  const recipients = recipientResult.recipients;
  const phone = process.env.ALERT_TEST_PHONE;
  const customerName = process.env.ALERT_TEST_CUSTOMER_NAME ?? "";
  const smsAlertsEnabled = process.env.ENABLE_TWILIO_MORNING_ALERTS === "true";
  const reuseWindowMinutes = alertReuseWindowMinutes();

  try {
    const savedRun = await getLatestPersistedMorningRun(30, reuseWindowMinutes);
    let persistedCalibration: unknown = {
      reason: "Morning alerts reused the latest saved ranking run.",
      skipped: true,
    };
    let persistence: PersistenceResult = {
      persisted: Boolean(savedRun.run),
      reason: savedRun.run
        ? "Reused the latest saved ranking run for morning alerts."
        : savedRun.error ?? savedRun.reason ?? "No fresh saved run was available.",
    };
    let result = savedRun.run
      ? {
          marketRegime: savedRun.run.marketRegime,
          opportunities: savedRun.run.opportunities,
          runId: savedRun.run.runId,
          selectedCount: savedRun.run.selectedCount,
          universeCount: savedRun.run.universeCount,
        }
      : null;

    if (!result) {
      if (!process.env.FMP_API_KEY && !process.env.FINANCIAL_DATA_API_KEY) {
        await recordAppEvent({
          level: "error",
          source: "morning-alerts-cron",
          message: "Morning alerts blocked because no fresh saved run exists and FMP market data is not configured.",
          metadata: { reuseWindowMinutes },
        });
        await sendAdminFailureAlert({
          source: "morning-alerts-cron",
          message: "Morning alerts blocked because no fresh saved run exists and FMP market data is not configured.",
          error: "FMP_API_KEY is required when the morning alert cron cannot reuse a saved ranking run.",
          metadata: { reuseWindowMinutes },
        });

        return NextResponse.json(
          {
            error:
              "No fresh saved ranking run was available, and FMP_API_KEY is required to generate a fallback morning alert run.",
            reuseWindowMinutes,
          },
          { status: 503 },
        );
      }

      await recordAppEvent({
        level: "warning",
        source: "morning-alerts-cron",
        message: "Morning alerts could not reuse a saved ranking run, so a fallback live scan started.",
        metadata: {
          reason: savedRun.error ?? savedRun.reason,
          reuseWindowMinutes,
        },
      });
      persistedCalibration = await hydrateRuntimeCalibrationFromSupabase();
      const freshResult = await runFmpDailyRankingAgent({ limit: 30 });
      persistence = await persistAgentRun(freshResult);
      result = {
        marketRegime: freshResult.marketRegime,
        opportunities: freshResult.opportunities,
        runId: freshResult.runId,
        selectedCount: freshResult.selectedCount,
        universeCount: freshResult.universeCount,
      };
    }
    const deliveries = [];

    if (result.selectedCount === 0) {
      await recordAppEvent({
        level: "error",
        source: "morning-alerts-cron",
        message: "Morning alert run produced zero customer picks.",
        metadata: { runId: result.runId, universeCount: result.universeCount },
      });
      await sendAdminFailureAlert({
        source: "morning-alerts-cron",
        message: "Morning alert run produced zero customer picks.",
        metadata: { runId: result.runId, universeCount: result.universeCount },
      });
    } else if (result.selectedCount < 30) {
      await recordAppEvent({
        level: "warning",
        source: "morning-alerts-cron",
        message: "Morning alert run produced fewer than 30 live picks.",
        metadata: {
          runId: result.runId,
          selectedCount: result.selectedCount,
          universeCount: result.universeCount,
        },
      });
      await sendAdminFailureAlert({
        source: "morning-alerts-cron",
        message: "Morning alert run produced fewer than 30 live picks.",
        metadata: {
          runId: result.runId,
          selectedCount: result.selectedCount,
          universeCount: result.universeCount,
        },
      });
    }

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

    if (phone && smsAlertsEnabled) {
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
    } else if (phone && !smsAlertsEnabled) {
      await recordAppEvent({
        level: "info",
        source: "morning-alerts-cron",
        message: "SMS alert delivery skipped because Twilio A2P approval is not enabled for production sends.",
        metadata: { phoneConfigured: true },
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
        persistedCalibration,
        recipients: recipientResult,
        runSource: savedRun.run ? "saved" : "fallback-live-scan",
        note:
          "No alert recipients were found. Add users with email alerts enabled in Supabase, or set ALERT_CUSTOMER_EMAILS while Supabase is not configured.",
      });
    }

    const failedDeliveries = deliveries.filter((item) => item.delivery.status === "failed");

    if (failedDeliveries.length > 0) {
      await recordAppEvent({
        level: "error",
        source: "morning-alerts-cron",
        message: "One or more morning alert deliveries failed.",
        metadata: {
          failedCount: failedDeliveries.length,
          totalDeliveries: deliveries.length,
        },
      });
      await sendAdminFailureAlert({
        source: "morning-alerts-cron",
        message: "One or more morning alert deliveries failed.",
        metadata: {
          failedCount: failedDeliveries.length,
          totalDeliveries: deliveries.length,
        },
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
      persistedCalibration,
      recipientSource: recipientResult.source,
      runSource: savedRun.run ? "saved" : "fallback-live-scan",
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
