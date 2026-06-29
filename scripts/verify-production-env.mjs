#!/usr/bin/env node

const env = process.env;

function has(name) {
  return Boolean(env[name]?.trim());
}

function oneOf(names) {
  return names.some(has);
}

function value(name) {
  return env[name]?.trim() ?? "";
}

const checks = [];

function addCheck(label, passed, detail, level = "error", okDetail = "configured") {
  checks.push({ detail, label, level, okDetail, passed });
}

function requireEnv(name, detail) {
  addCheck(name, has(name), detail ?? `${name} must be configured.`);
}

function requireOne(label, names, detail) {
  addCheck(label, oneOf(names), detail ?? `Configure one of: ${names.join(", ")}.`);
}

function warnEnv(name, detail) {
  addCheck(name, has(name), detail ?? `${name} is recommended.`, "warning");
}

requireEnv("NEXT_PUBLIC_APP_URL", "Set this to https://www.swingfi.trade in production.");
requireEnv("ADMIN_API_SECRET", "Protects trusted admin tooling and server-side admin actions.");
requireEnv("CRON_SECRET", "Protects Vercel cron endpoints from public triggering.");

requireEnv("NEXT_PUBLIC_SUPABASE_URL", "Required for Supabase auth and database access.");
requireOne(
  "Supabase public key",
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  "Required for browser-side Supabase auth.",
);
requireOne(
  "Supabase service role",
  ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
  "Required for persistence, admin reads, daily picks, prediction outcomes, and Stripe sync.",
);

requireOne(
  "Market data key",
  ["FMP_API_KEY", "FINANCIAL_DATA_API_KEY"],
  "Required for live FMP rankings. Without this, customer-facing picks cannot refresh.",
);
requireEnv("OPENAI_API_KEY", "Required for AI-assisted explanations and analysis summaries.");
warnEnv("FRED_API_KEY", "Recommended for live macro scoring. The app can run without it, but macro quality is weaker.");
warnEnv("BLS_API_KEY", "Optional. Keyless BLS works with lower limits; a key improves reliability.");

requireEnv("RESEND_API_KEY", "Required for branded transactional and morning emails.");
requireEnv("ALERT_FROM_EMAIL", "Use a verified sender such as SwingFi <alerts@swingfi.trade>.");
addCheck(
  "ALERT_FROM_EMAIL domain",
  !has("ALERT_FROM_EMAIL") || value("ALERT_FROM_EMAIL").includes("swingfi.trade"),
  "Use the verified swingfi.trade sender domain for production email.",
  has("ALERT_FROM_EMAIL") ? "warning" : "error",
  "valid or waiting on sender",
);

const checkoutEnabled = value("STRIPE_CHECKOUT_ENABLED") === "true";
if (checkoutEnabled) {
  requireEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "Required when checkout is enabled.");
  requireEnv("STRIPE_SECRET_KEY", "Required when checkout is enabled.");
  requireEnv("STRIPE_WEBHOOK_SECRET", "Required to sync subscription status from Stripe.");
  requireEnv("STRIPE_STARTER_PRICE_ID", "Required for the Starter checkout option.");
  requireEnv("STRIPE_PRO_PRICE_ID", "Required for the Pro checkout option.");
  requireEnv("STRIPE_PREMIUM_PRICE_ID", "Required for the Premium checkout option.");
  requireEnv("STRIPE_PORTAL_CONFIGURATION_ID", "Required for customer billing self-service.");
} else {
  addCheck(
    "STRIPE_CHECKOUT_ENABLED",
    false,
    "Checkout is disabled. That is fine before paid launch, but customers cannot start paid subscriptions.",
    "warning",
  );
}

if (value("REQUIRE_LIVE_STRIPE") === "true") {
  addCheck(
    "Stripe live keys",
    value("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY").startsWith("pk_live_") &&
      value("STRIPE_SECRET_KEY").startsWith("sk_live_"),
    "REQUIRE_LIVE_STRIPE=true expects pk_live_ and sk_live_ keys.",
  );
}

const twilioConfigured =
  has("TWILIO_ACCOUNT_SID") &&
  has("TWILIO_AUTH_TOKEN") &&
  (has("TWILIO_FROM_NUMBER") || has("TWILIO_MESSAGING_SERVICE_SID"));
addCheck(
  "Twilio SMS",
  twilioConfigured || value("ENABLE_TWILIO_MORNING_ALERTS") !== "true",
  "If SMS alerts are enabled, configure Twilio SID, auth token, and a sender number or messaging service.",
  twilioConfigured ? "warning" : "error",
  twilioConfigured ? "configured" : "disabled",
);

const errors = checks.filter((check) => check.level === "error" && !check.passed);
const warnings = checks.filter((check) => check.level === "warning" && !check.passed);

for (const check of checks) {
  const marker = check.passed ? "PASS" : check.level === "warning" ? "WARN" : "FAIL";
  console.log(`${marker} ${check.label} - ${check.passed ? check.okDetail : check.detail}`);
}

console.log(`\nProduction env check: ${checks.length - errors.length - warnings.length}/${checks.length} passing, ${warnings.length} warning(s), ${errors.length} failure(s).`);

if (errors.length > 0) {
  process.exitCode = 1;
}
