export type BillingPlanKey = "starter" | "pro" | "premium";

export type BillingPlan = {
  key: BillingPlanKey;
  name: string;
  recommendedPrice: number;
  priceLabel: string;
  description: string;
  features: string[];
  stripePriceEnv: string;
  highlighted?: boolean;
};

export const billingPlans: BillingPlan[] = [
  {
    key: "starter",
    name: "Starter",
    recommendedPrice: 19,
    priceLabel: "$19/mo",
    description: "For beginners who want a simple morning watchlist.",
    features: [
      "Daily top 10 opportunities",
      "Plain-English stock explanations",
      "Email morning brief",
      "Basic watchlist",
    ],
    stripePriceEnv: "STRIPE_STARTER_PRICE_ID",
  },
  {
    key: "pro",
    name: "Pro",
    recommendedPrice: 39,
    priceLabel: "$39/mo",
    description: "Best starting paid plan for serious swing-trading research.",
    features: [
      "Daily top 30 opportunities",
      "Full trade plans with entry, target, and stop",
      "Confidence, risk, and calibration notes",
      "Historical outcome tracking",
      "Email alerts and analysis links",
    ],
    stripePriceEnv: "STRIPE_PRO_PRICE_ID",
    highlighted: true,
  },
  {
    key: "premium",
    name: "Premium",
    recommendedPrice: 79,
    priceLabel: "$79/mo",
    description: "For active users who want deeper tracking and priority features.",
    features: [
      "Everything in Pro",
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

export function isStripeCheckoutConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      billingPlans.some((plan) => getPlanPriceId(plan)),
  );
}
