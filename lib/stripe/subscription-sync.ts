import Stripe from "stripe";
import type { SubscriptionStatus } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/server";

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

function isUuid(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

async function getCustomerEmail(customerId: string) {
  const stripe = getStripeClient();
  if (!stripe || !customerId) return "";

  const customer = await stripe.customers.retrieve(customerId).catch(() => null);

  if (!customer || customer.deleted) return "";

  return customer.email?.trim().toLowerCase() ?? "";
}

async function resolveUser(args: {
  appCustomerId?: string | null;
  customerId: string;
  email?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  if (isUuid(args.appCustomerId)) {
    const { data } = await supabase
      .from("users")
      .select("id,email")
      .eq("id", args.appCustomerId)
      .maybeSingle();

    if (data?.id) return data;
  }

  if (args.customerId) {
    const { data } = await supabase
      .from("users")
      .select("id,email")
      .eq("stripe_customer_id", args.customerId)
      .maybeSingle();

    if (data?.id) return data;
  }

  const email = args.email?.trim().toLowerCase();
  if (email) {
    const { data } = await supabase
      .from("users")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();

    if (data?.id) return data;
  }

  return null;
}

async function attachStripeCustomerToUser(args: {
  appCustomerId?: string | null;
  customerId: string;
  email?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase || !args.customerId) return null;

  const user = await resolveUser(args);

  if (user?.id) {
    await supabase.from("users").update({ stripe_customer_id: args.customerId }).eq("id", user.id);
  }

  return user;
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      persisted: false,
      reason: "Supabase service role is not configured.",
    };
  }

  const firstItem = subscription.items.data[0];
  const customerId = getCustomerId(subscription.customer);
  const planKey = subscription.metadata.planKey || firstItem?.price.lookup_key || "unknown";
  const appCustomerId = subscription.metadata.appCustomerId || null;
  const email = subscription.metadata.email || (await getCustomerEmail(customerId));
  const user = await attachStripeCustomerToUser({ appCustomerId, customerId, email });
  const periodStart = "current_period_start" in subscription
    ? (subscription as Stripe.Subscription & { current_period_start?: number }).current_period_start
    : undefined;
  const periodEnd = "current_period_end" in subscription
    ? (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
    : undefined;

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: user?.id ?? null,
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

  return {
    error: error?.message ?? null,
    persisted: !error,
    status: subscription.status,
    userId: user?.id ?? null,
  };
}

export async function syncCheckoutSession(sessionId: string) {
  const stripe = getStripeClient();

  if (!stripe) {
    return {
      persisted: false,
      reason: "Stripe is not configured.",
    };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  const customerId = getCustomerId(session.customer);
  const email =
    session.customer_details?.email?.trim().toLowerCase() ||
    session.customer_email?.trim().toLowerCase() ||
    String(session.metadata?.email ?? "").trim().toLowerCase();

  await attachStripeCustomerToUser({
    appCustomerId: session.client_reference_id || session.metadata?.appCustomerId || null,
    customerId,
    email,
  });

  if (!session.subscription) {
    return {
      persisted: false,
      reason: "Checkout session does not include a subscription.",
    };
  }

  const subscription =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;

  return syncStripeSubscription(subscription);
}
