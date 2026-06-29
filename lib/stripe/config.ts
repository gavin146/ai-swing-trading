export type BillingPlanKey = "starter" | "pro" | "premium";

export type BillingPlan = {
  key: BillingPlanKey;
  name: string;
  recommendedPrice: number;
  priceLabel: string;
  description: string;
  features: string[];
  dailyPickLimit: number;
  stripePriceEnv: string;
  highlighted?: boolean;
};

export const billingPlans: BillingPlan[] = [
  {
    key: "starter",
    name: "Starter",
    recommendedPrice: 19,
    priceLabel: "$19/mo",
    description: "For beginners who want a simple, lower-noise morning watchlist.",
    dailyPickLimit: 10,
    features: [
      "Daily top 10 personalized opportunities",
      "Plain-English stock explanations",
      "Email morning brief",
      "Swing Portfolio trade tracking",
      "Beginner score guide",
    ],
    stripePriceEnv: "STRIPE_STARTER_PRICE_ID",
  },
  {
    key: "pro",
    name: "Pro",
    recommendedPrice: 39,
    priceLabel: "$39/mo",
    description: "Best launch plan for users who want the full daily research workflow.",
    dailyPickLimit: 30,
    features: [
      "Daily top 30 personalized opportunities",
      "Full trade plans with entry, target, and stop",
      "Confidence, risk, and calibration notes",
      "Historical outcome tracking",
      "Morning email alerts and analysis links",
      "Portfolio review status for trades you save",
    ],
    stripePriceEnv: "STRIPE_PRO_PRICE_ID",
    highlighted: true,
  },
  {
    key: "premium",
    name: "Premium",
    recommendedPrice: 79,
    priceLabel: "$79/mo",
    description: "For active users who want the widest scan view and early power features.",
    dailyPickLimit: 90,
    features: [
      "Everything in Pro",
      "Daily top 90 ranked opportunities",
      "Expanded ranking history",
      "Advanced backtest insights",
      "Priority email alerts",
      "Early feature access",
    ],
    stripePriceEnv: "STRIPE_PREMIUM_PRICE_ID",
  },
];

export function getBillingPlan(key: string | null | undefined) {
  return billingPlans.find((plan) => plan.key === key);
}

export function getPlanPriceId(plan: BillingPlan) {
  return process.env[plan.stripePriceEnv] ?? "";
}

function getStripeMode(value: string | undefined) {
  if (value?.startsWith("sk_live_") || value?.startsWith("pk_live_")) return "live";
  if (value?.startsWith("sk_test_") || value?.startsWith("pk_test_")) return "test";
  return "unknown";
}

function isPublicSwingFiDomain() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return appUrl.includes("swingfi.trade") || appUrl.includes("getswingfi.com");
}

export function getStripeBillingReadiness() {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  const secretMode = getStripeMode(secretKey);
  const publishableMode = getStripeMode(publishableKey);
  const priceIdsConfigured = billingPlans.every((plan) => Boolean(getPlanPriceId(plan)));
  const checkoutFlagEnabled = process.env.STRIPE_CHECKOUT_ENABLED === "true";
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const portalConfigured = Boolean(process.env.STRIPE_PORTAL_CONFIGURATION_ID);
  const liveKeysMatch = secretMode === "live" && publishableMode === "live";
  const testKeysMatch = secretMode === "test" && publishableMode === "test";
  const keyModesMatch = liveKeysMatch || testKeysMatch;
  const liveStripeRequired =
    process.env.REQUIRE_LIVE_STRIPE === "true" ||
    (process.env.NODE_ENV === "production" && isPublicSwingFiDomain());
  const liveModeSatisfied = !liveStripeRequired || liveKeysMatch;
  const configured = Boolean(secretKey && publishableKey && priceIdsConfigured);
  const ready =
    configured &&
    checkoutFlagEnabled &&
    webhookConfigured &&
    portalConfigured &&
    keyModesMatch &&
    liveModeSatisfied;

  let reason = "Stripe checkout is ready.";
  let publicReason = "Checkout is ready.";
  if (!configured) reason = "Stripe keys and all plan price IDs must be configured.";
  else if (!keyModesMatch) reason = "Stripe publishable and secret keys must both use test mode or both use live mode.";
  else if (!checkoutFlagEnabled) reason = "STRIPE_CHECKOUT_ENABLED must be true before checkout is available.";
  else if (!webhookConfigured) reason = "STRIPE_WEBHOOK_SECRET is required so subscriptions sync after checkout.";
  else if (!portalConfigured) reason = "STRIPE_PORTAL_CONFIGURATION_ID is required so customers can manage billing.";
  else if (!liveModeSatisfied) reason = "Live Stripe keys are required before production checkout can be enabled.";

  if (!ready) {
    publicReason =
      "Paid checkout is being finalized. Create your account to use the free trial now; subscription checkout will open after billing is fully verified.";
  }

  return {
    checkoutFlagEnabled,
    configured,
    keyModesMatch,
    liveModeSatisfied,
    mode: liveKeysMatch ? "live" : testKeysMatch ? "test" : "unknown",
    portalConfigured,
    priceIdsConfigured,
    publishableMode,
    publicReason,
    ready,
    reason,
    secretMode,
    webhookConfigured,
  };
}

export function getStripeTrialDays() {
  const parsed = Number(process.env.STRIPE_TRIAL_DAYS ?? 30);

  if (!Number.isFinite(parsed)) return 30;

  return Math.max(0, Math.min(365, Math.round(parsed)));
}

export function isStripeCheckoutConfigured() {
  return getStripeBillingReadiness().configured;
}

export function isStripeCheckoutEnabled() {
  return getStripeBillingReadiness().ready;
}
