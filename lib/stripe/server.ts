import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-06-24.dahlia",
    });
  }

  return stripeClient;
}

export function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? process.env.VERCEL_URL;
  const url = configured
    ? configured.startsWith("http")
      ? configured
      : `https://${configured}`
    : "http://localhost:3000";

  return url.replace(/\/$/, "");
}
