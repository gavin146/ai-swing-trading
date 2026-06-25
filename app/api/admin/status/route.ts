import { NextResponse } from "next/server";
import { getEmailDeliveryStatus } from "@/lib/email";
import { hasSupabaseAdminConfig, hasSupabasePublicConfig } from "@/lib/supabase/server";
import { isStripeCheckoutConfigured, isStripeCheckoutEnabled } from "@/lib/stripe/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const email = getEmailDeliveryStatus();

  return NextResponse.json({
    adminProtected: Boolean(process.env.ADMIN_API_SECRET),
    cronProtected: Boolean(process.env.CRON_SECRET),
    vercelCronConfigured: true,
    emailReady: email.configured,
    emailFrom: email.from,
    emailProvider: email.provider,
    emailReason: email.reason,
    openAiReady: Boolean(process.env.OPENAI_API_KEY),
    stripeReady: isStripeCheckoutConfigured(),
    stripeCheckoutEnabled: isStripeCheckoutEnabled(),
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
