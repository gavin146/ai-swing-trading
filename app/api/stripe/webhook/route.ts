import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/server";
import { recordAppEvent } from "@/lib/persistence";
import type { SubscriptionStatus } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const subscriptionStatuses = new Set<SubscriptionStatus>([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

function unixToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function getCustomerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

function getSubscriptionStatus(value: string) {
  return subscriptionStatuses.has(value as SubscriptionStatus)
    ? (value as SubscriptionStatus)
    : "incomplete";
}

async function upsertSubscription(subscription: Stripe.Subscription) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    await recordAppEvent({
      level: "warning",
      source: "stripe-webhook",
      message: "Stripe webhook received but Supabase is not configured.",
      metadata: { subscriptionId: subscription.id },
    });
    return;
  }

  const firstItem = subscription.items.data[0];
  const customerId = getCustomerId(subscription.customer);
  const planKey = subscription.metadata.planKey || firstItem?.price.lookup_key || "unknown";
  const appCustomerId = subscription.metadata.appCustomerId || null;
  const periodStart = "current_period_start" in subscription
    ? (subscription as Stripe.Subscription & { current_period_start?: number }).current_period_start
    : undefined;
  const periodEnd = "current_period_end" in subscription
    ? (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
    : undefined;

  await supabase.from("subscriptions").upsert(
    {
      user_id: appCustomerId || null,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: firstItem?.price.id ?? "unknown",
      plan_key: planKey,
      status: getSubscriptionStatus(subscription.status),
      current_period_start: unixToIso(periodStart),
      current_period_end: unixToIso(periodEnd),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: unixToIso(subscription.canceled_at),
      trial_end: unixToIso(subscription.trial_end),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook signature." },
      { status: 400 },
    );
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await upsertSubscription(event.data.object);
  }

  if (event.type === "checkout.session.completed") {
    await recordAppEvent({
      level: "info",
      source: "stripe-webhook",
      message: "Stripe checkout completed.",
      metadata: { sessionId: event.data.object.id },
    });
  }

  return NextResponse.json({ received: true });
}
