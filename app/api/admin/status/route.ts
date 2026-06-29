import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import { getEmailDeliveryStatus } from "@/lib/email";
import { hasSupabaseAdminConfig, hasSupabasePublicConfig } from "@/lib/supabase/server";
import { getStripeBillingReadiness } from "@/lib/stripe/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminApiRequest(request))) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const email = getEmailDeliveryStatus();
  const stripe = getStripeBillingReadiness();

  return NextResponse.json({
    adminProtected: Boolean(process.env.ADMIN_API_SECRET),
    cronProtected: Boolean(process.env.CRON_SECRET),
    vercelCronConfigured: true,
    predictionEvaluationCronConfigured: true,
    dailyRankingsScheduleUtc: "0 13 * * 1-5",
    morningAlertsScheduleUtc: "20 13 * * 1-5",
    predictionEvaluationScheduleUtc: "15 22 * * 1-5",
    emailReady: email.configured,
    emailFrom: email.from,
    emailProvider: email.provider,
    emailReason: email.reason,
    openAiReady: Boolean(process.env.OPENAI_API_KEY),
    stripeReady: stripe.configured,
    stripeCheckoutEnabled: stripe.ready,
    stripeMode: stripe.mode,
    stripePortalConfigured: stripe.portalConfigured,
    stripeReason: stripe.reason,
    stripeWebhookConfigured: stripe.webhookConfigured,
    twilioReady: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID),
    ),
    supabaseReady: hasSupabasePublicConfig(),
    supabaseAdminReady: hasSupabaseAdminConfig(),
    livePersistenceReady: hasSupabaseAdminConfig(),
    liveDataMissing: !hasSupabaseAdminConfig(),
    marketDataReady: Boolean(process.env.FMP_API_KEY || process.env.FINANCIAL_DATA_API_KEY),
    macroDataReady: Boolean(process.env.FRED_API_KEY),
    blsReady: Boolean(process.env.BLS_API_KEY) || true,
  });
}
