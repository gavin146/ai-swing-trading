import { NextRequest, NextResponse } from "next/server";
import { getAppUrl, getStripeClient } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

async function getStripeCustomerIdFromSession(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) return "";

  const supabase = createSupabaseAdminClient();
  if (!supabase) return "";

  const { data, error } = await supabase.auth.getUser(token);
  const authUser = data.user;

  if (error || !authUser) return "";

  const email = cleanText(authUser.email).toLowerCase();
  const byAuthUserId = authUser.id
    ? await supabase
        .from("users")
        .select("stripe_customer_id")
        .eq("auth_user_id", authUser.id)
        .maybeSingle()
    : { data: null };
  const byEmail =
    !byAuthUserId.data?.stripe_customer_id && email
      ? await supabase
          .from("users")
          .select("stripe_customer_id")
          .eq("email", email)
          .maybeSingle()
      : { data: null };
  const userRow = byAuthUserId.data ?? byEmail.data;

  return cleanText(userRow?.stripe_customer_id);
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const body = (await request.json().catch(() => ({}))) as {
    stripeCustomerId?: string;
  };

  if (!stripe) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY is not configured.", setupNeeded: true },
      { status: 503 },
    );
  }

  const stripeCustomerId =
    (await getStripeCustomerIdFromSession(request)) ||
    (process.env.NODE_ENV !== "production" ? cleanText(body.stripeCustomerId) : "");

  if (!stripeCustomerId) {
    return NextResponse.json(
      {
        error: "No active Stripe customer was found for this account.",
        nextStep: "Start or sync a subscription before opening the billing portal.",
      },
      { status: 404 },
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID
        ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID }
        : {}),
      customer: stripeCustomerId,
      return_url: `${getAppUrl()}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not create billing portal session.",
        nextStep: "Confirm the Stripe customer portal is configured in Stripe.",
      },
      { status: 503 },
    );
  }
}
