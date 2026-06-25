import { NextRequest, NextResponse } from "next/server";
import { getBillingPlan, getPlanPriceId, getStripeTrialDays } from "@/lib/stripe/config";
import { getAppUrl, getStripeClient } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckoutRequest = {
  customerId?: string;
  email?: string;
  planKey?: string;
};

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const body = (await request.json().catch(() => ({}))) as CheckoutRequest;
  const plan = getBillingPlan(body.planKey);

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

  const email = body.email?.trim().toLowerCase();
  const appUrl = getAppUrl();
  const trialDays = getStripeTrialDays();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email || undefined,
    client_reference_id: body.customerId || undefined,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    payment_method_collection: "always",
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    metadata: {
      planKey: plan.key,
      appCustomerId: body.customerId ?? "",
      email: email ?? "",
      trialDays: String(trialDays),
    },
    subscription_data: {
      trial_period_days: trialDays || undefined,
      metadata: {
        planKey: plan.key,
        appCustomerId: body.customerId ?? "",
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
