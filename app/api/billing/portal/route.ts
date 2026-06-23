import { NextRequest, NextResponse } from "next/server";
import { getAppUrl, getStripeClient } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  if (!body.stripeCustomerId) {
    return NextResponse.json(
      { error: "A Stripe customer id is required for the billing portal." },
      { status: 400 },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: body.stripeCustomerId,
    return_url: `${getAppUrl()}/settings`,
  });

  return NextResponse.json({ url: session.url });
}
