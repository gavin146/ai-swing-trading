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

loadLocalEnv();

const secretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");

if (!secretKey) {
  console.error("Missing STRIPE_SECRET_KEY. Run with STRIPE_SECRET_KEY=sk_test_...");
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2026-05-27.dahlia",
});

const plans = [
  {
    env: "STRIPE_STARTER_PRICE_ID",
    key: "starter",
    lookupKey: "swingfi_starter_monthly",
    name: "SwingFi Starter",
    amount: 1900,
    description: "Beginner-friendly daily swing trade watchlist.",
  },
  {
    env: "STRIPE_PRO_PRICE_ID",
    key: "pro",
    lookupKey: "swingfi_pro_monthly",
    name: "SwingFi Pro",
    amount: 3900,
    description: "Daily top 30 swing trade opportunities with full trade plans.",
  },
  {
    env: "STRIPE_PREMIUM_PRICE_ID",
    key: "premium",
    lookupKey: "swingfi_premium_monthly",
    name: "SwingFi Premium",
    amount: 7900,
    description: "Expanded SwingFi analysis, history, backtesting insight, and priority alerts.",
  },
];

async function findOrCreateProduct(plan) {
  const existing = await stripe.products.search({
    query: `metadata['swingfi_plan_key']:'${plan.key}'`,
    limit: 1,
  });

  if (existing.data[0]) return existing.data[0];

  return stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: {
      app: "swingfi",
      swingfi_plan_key: plan.key,
    },
  });
}

async function findOrCreatePrice(plan, productId) {
  const existing = await stripe.prices.list({
    active: true,
    lookup_keys: [plan.lookupKey],
    limit: 1,
  });

  if (existing.data[0]) return existing.data[0];

  return stripe.prices.create({
    currency: "usd",
    lookup_key: plan.lookupKey,
    product: productId,
    recurring: {
      interval: "month",
    },
    unit_amount: plan.amount,
    metadata: {
      app: "swingfi",
      swingfi_plan_key: plan.key,
    },
  });
}

async function findOrCreateWebhookEndpoint() {
  if (!appUrl) return null;

  const webhookUrl = `${appUrl}/api/stripe/webhook`;
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((endpoint) => endpoint.url === webhookUrl);

  if (existing) {
    return {
      endpoint: existing,
      created: false,
    };
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ],
    metadata: {
      app: "swingfi",
    },
  });

  return {
    endpoint,
    created: true,
  };
}

const envLines = [];

for (const plan of plans) {
  const product = await findOrCreateProduct(plan);
  const price = await findOrCreatePrice(plan, product.id);

  envLines.push(`${plan.env}=${price.id}`);
}

const webhook = await findOrCreateWebhookEndpoint();

if (webhook?.created && webhook.endpoint.secret) {
  envLines.push(`STRIPE_WEBHOOK_SECRET=${webhook.endpoint.secret}`);
}

envLines.push("STRIPE_TRIAL_DAYS=30");
envLines.push("STRIPE_CHECKOUT_ENABLED=true");

console.log("\nStripe setup complete. Add/update these environment variables:\n");
console.log(envLines.join("\n"));

if (webhook && !webhook.created) {
  console.log(
    "\nWebhook endpoint already exists. Copy its signing secret from Stripe Dashboard > Developers > Webhooks.",
  );
}

if (!webhook) {
  console.log(
    "\nWebhook endpoint was not created because NEXT_PUBLIC_APP_URL or APP_URL was not provided.",
  );
}
