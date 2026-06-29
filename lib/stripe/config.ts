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

export function getStripeTrialDays() {
  const parsed = Number(process.env.STRIPE_TRIAL_DAYS ?? 30);

  if (!Number.isFinite(parsed)) return 30;

  return Math.max(0, Math.min(365, Math.round(parsed)));
}

export function isStripeCheckoutConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      billingPlans.some((plan) => getPlanPriceId(plan)),
  );
}

export function isStripeCheckoutEnabled() {
  return isStripeCheckoutConfigured() && process.env.STRIPE_CHECKOUT_ENABLED === "true";
}
