import Stripe from "stripe";
import fs from "node:fs";
import path from "node:path";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getMode(value) {
  if (value?.startsWith("sk_live_") || value?.startsWith("pk_live_")) return "live";
  if (value?.startsWith("sk_test_") || value?.startsWith("pk_test_")) return "test";
  return "unknown";
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

loadLocalEnv();

const secretKey = required("STRIPE_SECRET_KEY");
const publishableKey = required("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
const appUrl = required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
const mode = getMode(secretKey);
const publishableMode = getMode(publishableKey);

if (mode !== publishableMode) {
  throw new Error(
    `Stripe key mode mismatch: secret key is ${mode}, publishable key is ${publishableMode}.`,
  );
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2026-05-27.dahlia",
});

const priceEnvNames = [
  "STRIPE_STARTER_PRICE_ID",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_PREMIUM_PRICE_ID",
];

const prices = [];

for (const envName of priceEnvNames) {
  const priceId = required(envName);
  const price = await stripe.prices.retrieve(priceId, {
    expand: ["product"],
  });

  prices.push({
    active: price.active,
    amount: price.unit_amount,
    currency: price.currency,
    envName,
    id: price.id,
    interval: price.recurring?.interval ?? null,
    product: typeof price.product === "string" ? price.product : price.product.name,
  });
}

const webhookUrl = `${appUrl}/api/stripe/webhook`;
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
const webhook = endpoints.data.find((endpoint) => endpoint.url === webhookUrl);
const portalConfigurationId = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
const portalConfiguration = portalConfigurationId
  ? await stripe.billingPortal.configurations.retrieve(portalConfigurationId)
  : null;
const activePortalConfigurations = portalConfiguration
  ? [portalConfiguration]
  : (await stripe.billingPortal.configurations.list({ limit: 100 })).data.filter(
      (configuration) => configuration.active,
    );
const portalCandidate = activePortalConfigurations.find((configuration) => {
  const features = configuration.features;

  return (
    configuration.active &&
    features.invoice_history.enabled &&
    features.payment_method_update.enabled &&
    features.subscription_cancel.enabled
  );
});

const trialDays = Number(process.env.STRIPE_TRIAL_DAYS ?? 30);
const checkoutEnabled = process.env.STRIPE_CHECKOUT_ENABLED === "true";
const proPrice = process.env.STRIPE_PRO_PRICE_ID;
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  line_items: [{ price: proPrice, quantity: 1 }],
  customer_email: `readiness-${Date.now()}@example.com`,
  client_reference_id: "readiness-check",
  payment_method_collection: "always",
  success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${appUrl}/pricing?checkout=cancelled`,
  metadata: {
    app: "swingfi",
    purpose: "readiness-check",
  },
  subscription_data: {
    trial_period_days: Number.isFinite(trialDays) && trialDays > 0 ? trialDays : undefined,
    metadata: {
      app: "swingfi",
      purpose: "readiness-check",
    },
  },
});

await stripe.checkout.sessions.expire(session.id);

let portalSession = null;
let portalError = null;
const portalCustomer = await stripe.customers.create({
  email: `portal-readiness-${Date.now()}@example.com`,
  metadata: {
    app: "swingfi",
    purpose: "portal-readiness-check",
  },
});

try {
  portalSession = await stripe.billingPortal.sessions.create({
    ...(portalConfigurationId ? { configuration: portalConfigurationId } : {}),
    customer: portalCustomer.id,
    return_url: `${appUrl}/settings`,
  });
} catch (error) {
  portalError = error instanceof Error ? error.message : String(error);
} finally {
  await stripe.customers.del(portalCustomer.id).catch(() => null);
}

console.log(
  JSON.stringify(
    {
      appUrl,
      checkoutEnabled,
      mode,
      prices,
      readinessCheckout: {
        createdAndExpired: true,
        mode: session.mode,
        status: "expired",
      },
      readinessPortal: {
        configurationId: portalConfigurationId ?? portalCandidate?.id ?? null,
        createdSession: Boolean(portalSession?.url),
        error: portalError,
        features: portalCandidate
          ? {
              invoiceHistory: portalCandidate.features.invoice_history.enabled,
              paymentMethodUpdate: portalCandidate.features.payment_method_update.enabled,
              subscriptionCancel: portalCandidate.features.subscription_cancel.enabled,
              subscriptionUpdate: portalCandidate.features.subscription_update.enabled,
            }
          : null,
      },
      webhook: webhook
        ? {
            enabledEvents: webhook.enabled_events,
            status: webhook.status,
            url: webhook.url,
          }
        : null,
    },
    null,
    2,
  ),
);

if (mode !== "live") {
  process.exitCode = 2;
}

if (
  !checkoutEnabled ||
  !webhook ||
  webhook.status !== "enabled" ||
  !portalCandidate ||
  !portalSession?.url
) {
  process.exitCode = 1;
}
