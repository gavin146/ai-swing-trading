import Stripe from "stripe";
import { getPublicAppUrl } from "@/lib/brand";

const stripeApiVersion = "2026-05-27.dahlia" as NonNullable<
  ConstructorParameters<typeof Stripe>[1]
>["apiVersion"];
let stripeClient: Stripe | null = null;

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: stripeApiVersion,
    });
  }

  return stripeClient;
}

export function getAppUrl() {
  return getPublicAppUrl();
}
