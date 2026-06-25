import Link from "next/link";
import { BillingCheckoutButton } from "@/components/BillingCheckoutButton";
import { BrandMark } from "@/components/BrandMark";
import {
  billingPlans,
  getStripeTrialDays,
  isStripeCheckoutConfigured,
  isStripeCheckoutEnabled,
} from "@/lib/stripe/config";

const trustSignals = [
  "Daily ranking workflow",
  "Plain-English trade plans",
  "Entry, target, and stop loss",
  "Backtest-aware calibration",
];

const faqs = [
  [
    "Is SwingFi financial advice?",
    "No. SwingFi is research software. It helps you review opportunities more consistently, but you decide what to research, watch, or avoid.",
  ],
  [
    "When do I get picks?",
    "The morning workflow is designed around pre-market review so users can compare setups before chasing intraday movement.",
  ],
  [
    "Can beginners use it?",
    "Yes. Every card explains score, confidence, risk, entry, target, stop loss, and estimated trade window in plain English.",
  ],
];

export default function PricingPage() {
  const checkoutConfigured = isStripeCheckoutConfigured();
  const checkoutEnabled = isStripeCheckoutEnabled();
  const trialDays = getStripeTrialDays();
  const checkoutReady = checkoutConfigured && checkoutEnabled;

  return (
    <main className="min-h-screen">
      <section className="border-b border-line bg-panel/80 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="sm:hidden">
            <BrandMark compact />
          </div>
          <div className="hidden sm:block">
            <BrandMark />
          </div>
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

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            30-day free trial
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-ink sm:text-5xl">
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

        <div className="mt-8 grid gap-3 rounded-3xl border border-line bg-panel p-4 shadow-soft sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
          <div>
            <p className="text-sm font-black text-ink">
              {checkoutReady ? "Free trial checkout is ready" : "Free trial access is available"}
            </p>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Start with the plan that fits your research needs. You can review rankings,
              learn the score system, and cancel before paid billing begins.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {trustSignals.map((signal) => (
              <span
                key={signal}
                className="rounded-2xl border border-line bg-surface px-3 py-2 text-xs font-black text-ink/68"
              >
                {signal}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-pine/15 bg-mint p-5">
          <p className="text-sm font-black uppercase tracking-normal text-pine">
            Beginner promise
          </p>
          <p className="mt-2 text-sm font-semibold leading-7 text-ink/68">
            SwingFi does not tell you to blindly buy a stock. It gives you a ranked
            research list, the trade plan, and the risk context so you can slow down and
            make a more informed decision.
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

        <section className="mt-10 rounded-3xl border border-line bg-panel p-6 shadow-soft">
          <h2 className="text-2xl font-black text-ink">Which plan should I choose?</h2>
          <div className="mt-4 grid gap-4 text-sm leading-7 text-ink/68 lg:grid-cols-3">
            <p>
              Start with Starter if you want a simple morning watchlist and a slower,
              beginner-friendly routine for reviewing ideas.
            </p>
            <p>
              Choose Pro if you want the full daily research workflow: more ranked
              opportunities, deeper trade plans, and historical outcome tracking.
            </p>
            <p>
              Premium is best for active users who want expanded history, deeper
              backtest context, and priority alert features as SwingFi grows.
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {faqs.map(([question, answer]) => (
            <div key={question} className="rounded-2xl border border-line bg-panel p-5 shadow-soft">
              <h2 className="text-lg font-black text-ink">{question}</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-ink/62">
                {answer}
              </p>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}
