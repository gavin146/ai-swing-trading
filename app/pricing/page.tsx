import Link from "next/link";
import { BillingCheckoutButton } from "@/components/BillingCheckoutButton";
import { BrandMark } from "@/components/BrandMark";
import {
  billingPlans,
  getStripeTrialDays,
  isStripeCheckoutConfigured,
  isStripeCheckoutEnabled,
} from "@/lib/stripe/config";

export default function PricingPage() {
  const checkoutConfigured = isStripeCheckoutConfigured();
  const checkoutEnabled = isStripeCheckoutEnabled();
  const trialDays = getStripeTrialDays();

  return (
    <main className="min-h-screen">
      <section className="border-b border-line bg-panel/80 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <BrandMark />
          <div className="flex gap-2 text-sm font-bold">
            <Link href="/login" className="rounded-lg border border-line bg-surface px-4 py-2">
              Log in
            </Link>
            <Link href="/signup" className="rounded-lg bg-ink px-4 py-2 text-white">
              Sign up
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            30-day free trial
          </p>
          <h1 className="mt-3 text-5xl font-bold leading-tight text-ink">
            Try SwingFi free for one month
          </h1>
          <p className="mt-5 text-base leading-8 text-ink/68">
            New accounts unlock stock rankings, opportunity details, saved picks, and
            morning email links for {trialDays} days. After the trial, analysis requires
            an active subscription. Admin accounts always keep full access.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-lg bg-ink px-4 py-3 text-center text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine"
            >
              Start free trial
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-line bg-surface px-4 py-3 text-center text-sm font-bold text-ink hover:border-pine"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-line bg-panel p-4 shadow-soft">
          <p className="text-sm font-bold text-ink">
            Billing status:{" "}
            <span className={checkoutEnabled ? "text-pine" : "text-coral"}>
              {checkoutEnabled
                ? "checkout is enabled"
                : checkoutConfigured
                  ? "configured but disabled"
                  : "not ready to charge"}
            </span>
          </p>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            Checkout starts a {trialDays}-day Stripe subscription trial. To activate it,
            set Stripe keys, price IDs, webhook secret, and `STRIPE_CHECKOUT_ENABLED=true`
            in Vercel and local development.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {billingPlans.map((plan) => (
            <article
              key={plan.key}
              className={`flex rounded-xl border p-6 shadow-soft ${
                plan.highlighted
                  ? "border-pine bg-panel ring-4 ring-lime/20"
                  : "border-line bg-panel"
              }`}
            >
              <div className="flex w-full flex-col">
                {plan.highlighted ? (
                  <p className="mb-4 w-fit rounded-md bg-lime px-2 py-1 text-xs font-black text-ink">
                    Recommended
                  </p>
                ) : null}
                <h2 className="text-2xl font-bold text-ink">{plan.name}</h2>
                <p className="mt-2 text-sm leading-6 text-ink/60">{plan.description}</p>
                <p className="mt-5 text-4xl font-black text-ink">{plan.priceLabel}</p>
                <p className="mt-1 text-xs font-semibold text-ink/50">
                  Recommended starting price
                </p>
                <ul className="mt-6 grid gap-3 text-sm leading-6 text-ink/70">
                  {plan.features.map((feature) => (
                    <li key={feature} className="border-t border-line pt-3">
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <BillingCheckoutButton
                    planKey={plan.key}
                    label={checkoutEnabled ? `Start ${trialDays}-day trial` : "Checkout not enabled"}
                    highlighted={plan.highlighted}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>

        <section className="mt-10 rounded-xl border border-line bg-panel p-6 shadow-soft">
          <h2 className="text-2xl font-bold text-ink">Pricing recommendation</h2>
          <div className="mt-4 grid gap-4 text-sm leading-7 text-ink/68 lg:grid-cols-3">
            <p>
              Launch with one paid plan first. I would start with Pro at $39/month
              because the product is a daily research workflow, not a casual newsletter.
            </p>
            <p>
              Keep Starter at $19/month only if you want a low-friction beginner tier
              with fewer picks and less history. It helps conversion but can increase
              support volume.
            </p>
            <p>
              Add Premium later after users prove they want deeper backtests, more
              historical tracking, and priority alerts. Do not overcomplicate day one.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
