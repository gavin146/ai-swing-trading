import { NextRequest, NextResponse } from "next/server";
import { getBillingPlan, getPlanPriceId, getStripeTrialDays } from "@/lib/stripe/config";
import { getAppUrl, getStripeClient } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckoutRequest = {
  customerId?: string;
  email?: string;
  planKey?: string;
};

type CheckoutCustomer = {
  appCustomerId: string;
  email: string;
  stripeCustomerId: string;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

async function getCheckoutCustomerFromSession(request: NextRequest): Promise<CheckoutCustomer | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) return null;

  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(token);
  const authUser = data.user;
  const email = cleanText(authUser?.email).toLowerCase();

  if (error || !authUser || !email) return null;

  const byAuthUserId = await supabase
    .from("users")
    .select("id,email,stripe_customer_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  const byEmail =
    !byAuthUserId.data && email
      ? await supabase
          .from("users")
          .select("id,email,stripe_customer_id")
          .eq("email", email)
          .maybeSingle()
      : { data: null };
  const userRow = byAuthUserId.data ?? byEmail.data;

  if (!userRow?.id) return null;

  return {
    appCustomerId: cleanText(userRow.id),
    email: cleanText(userRow.email || email).toLowerCase(),
    stripeCustomerId: cleanText(userRow.stripe_customer_id),
  };
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const body = (await request.json().catch(() => ({}))) as CheckoutRequest;
  const plan = getBillingPlan(body.planKey);
  const sessionCustomer = await getCheckoutCustomerFromSession(request);

  if (!plan) {
    return NextResponse.json({ error: "Unknown billing plan." }, { status: 400 });
  }

  if (process.env.STRIPE_CHECKOUT_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: "Checkout is temporarily unavailable.",
        setupNeeded: true,
        nextStep:
          "Free-trial checkout is not available right now. Please create an account and check back shortly.",
      },
      { status: 409 },
    );
  }

  if (!stripe) {
    return NextResponse.json(
      { error: "Checkout is temporarily unavailable.", setupNeeded: true },
      { status: 503 },
    );
  }

  const priceId = getPlanPriceId(plan);

  if (!priceId) {
    return NextResponse.json(
      {
        error: "Checkout is temporarily unavailable for this plan.",
        setupNeeded: true,
      },
      { status: 503 },
    );
  }

  if (process.env.NODE_ENV === "production" && !sessionCustomer) {
    return NextResponse.json(
      {
        error: "A verified login session is required before starting checkout.",
        nextStep: "Log in again, then start your free trial from Pricing or Settings.",
      },
      { status: 401 },
    );
  }

  const email = sessionCustomer?.email || cleanText(body.email).toLowerCase();
  const appCustomerId = sessionCustomer?.appCustomerId || cleanText(body.customerId);
  const existingStripeCustomerId = sessionCustomer?.stripeCustomerId || "";
  const appUrl = getAppUrl();
  const trialDays = getStripeTrialDays();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(existingStripeCustomerId
      ? { customer: existingStripeCustomerId }
      : { customer_email: email || undefined }),
    client_reference_id: appCustomerId || undefined,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    payment_method_collection: "always",
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    metadata: {
      planKey: plan.key,
      appCustomerId,
      email: email ?? "",
      trialDays: String(trialDays),
    },
    subscription_data: {
      trial_period_days: trialDays || undefined,
      metadata: {
        planKey: plan.key,
        appCustomerId,
        email: email ?? "",
        trialDays: String(trialDays),
      },
    },
  });

  return NextResponse.json({
    url: session.url,
    sessionId: session.id,
  });
}
