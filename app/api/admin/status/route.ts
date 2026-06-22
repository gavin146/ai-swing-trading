import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    cronProtected: Boolean(process.env.CRON_SECRET),
    twilioReady: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID),
    ),
    supabaseReady: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    marketDataReady: Boolean(process.env.MARKET_DATA_API_KEY),
    newsReady: Boolean(process.env.NEWS_API_KEY),
    financialDataReady: Boolean(process.env.FINANCIAL_DATA_API_KEY),
  });
}
