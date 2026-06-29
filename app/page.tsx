import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { brand, getPublicAppUrl } from "@/lib/brand";
import { opportunityFromRow } from "@/lib/opportunities";
import { listLatestOpportunities } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";

const workflow = [
  {
    title: "Open the morning brief",
    text: "Start with the ranked list. The highest-ranked ideas are the first setups to review, not automatic buys.",
  },
  {
    title: "Check the trade plan",
    text: "Look at the entry range, target, stop loss, expected gain, expected loss, and estimated holding window before making a decision.",
  },
  {
    title: "Decide if it fits you",
    text: "Use your risk settings, budget, and confidence preference to decide whether to watch, skip, or research the idea further.",
  },
];

const scoreGuide = [
  ["Opportunity score", "The main ranking number. Higher means the setup looks stronger across trend, momentum, reward/risk, company quality, catalysts, and market backdrop."],
  ["Confidence score", "How much the data agrees. Higher means the setup has cleaner support from multiple signals. It still does not mean the trade is guaranteed."],
  ["Risk score", "How fragile the setup may be. Lower is better. Higher risk can mean more volatility, wider stop loss, event risk, or stretched price action."],
];

const beginnerActions = [
  ["80-100", "High-priority review", "Worth deeper research if risk is acceptable and price is inside the entry range."],
  ["65-79", "Watchlist review", "Potentially useful, but be patient. Entry discipline matters more than the headline score."],
  ["Below 65", "Low-priority idea", "Usually better to wait for a cleaner setup or stronger confirmation."],
];

const cardAnatomy = [
  ["Entry range", "The price area where the setup is designed to be reviewed. Chasing far above this range can change the risk/reward."],
  ["Target", "The estimated upside area where taking profit may make sense if the trade works."],
  ["Stop loss", "The price level that helps define when the idea is likely wrong and risk should be controlled."],
  ["Trade window", "The estimated swing-trade holding period, usually days to weeks rather than minutes or months."],
];

const trustProof = [
  ["Market data", "Price action, volume, trend, and reward/risk context."],
  ["Macro backdrop", "Economic context that can affect market risk appetite."],
  ["Filings and events", "SEC filings, earnings, and corporate event checks."],
  ["Calibration", "Backtesting feedback used to pressure-test ranking quality."],
];

const signupJourney = [
  ["1", "Choose a plan", "Starter keeps the list simple. Pro is the best default. Premium gives the widest daily scan."],
  ["2", "Answer risk questions", "Tell SwingFi how cautious, balanced, or aggressive you want the dashboard to feel."],
  ["3", "Review the morning list", "Start with Best fit, then compare score, confidence, risk, entry, target, and stop."],
  ["4", "Track what you act on", "If you make a trade, save it to Portfolio so the plan stays visible after rankings refresh."],
];

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  description:
    "SwingFi gives beginner and intermediate traders AI-ranked swing trade research with scores, entry ranges, targets, stop losses, risk context, and daily morning plans.",
  openGraph: {
    description:
      "AI-ranked swing trade research with beginner-friendly trade plans, risk context, and daily rankings.",
    title: "SwingFi | AI-Ranked Swing Trade Research",
    url: "/",
  },
  title: "AI-Ranked Swing Trade Research",
  twitter: {
    description:
      "Review daily swing trade rankings with plain-English scores, risk, entry, target, and stop-loss context.",
    title: "SwingFi | AI-Ranked Swing Trade Research",
  },
};

export default async function LandingPage() {
  const latest = await listLatestOpportunities(3);
  const featured = latest.rows.map(opportunityFromRow);
  const appUrl = getPublicAppUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: brand.appName,
        url: appUrl,
        email: brand.contactEmail,
        logo: `${appUrl}/icon.svg`,
      },
      {
        "@type": "WebSite",
        name: brand.appName,
        url: appUrl,
        description:
          "Beginner-friendly AI-ranked swing trade research with opportunity scores, confidence, risk, entry ranges, targets, stop losses, and outcome tracking.",
        publisher: {
          "@type": "Organization",
          name: brand.appName,
        },
      },
      {
        "@type": "SoftwareApplication",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        name: brand.appName,
        url: appUrl,
        description:
          "AI-ranked swing trade research software for reviewing US stock, ETF, and crypto opportunities with entry, target, stop-loss, risk, confidence, and historical outcome context.",
        offers: {
          "@type": "Offer",
          availability: "https://schema.org/InStock",
          category: "Subscription",
          price: "0",
          priceCurrency: "USD",
          description: "30-day free trial for new SwingFi accounts.",
        },
      },
    ],
  };

  return (
    <main>
      <script
        id="swingfi-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="border-b border-line/80 bg-panel/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="sm:hidden">
            <BrandMark compact />
          </div>
          <div className="hidden sm:block">
            <BrandMark />
          </div>
          <nav className="flex shrink-0 items-center gap-2 text-sm font-bold">
            <Link
              href="/pricing"
              className="rounded-lg border border-transparent px-2.5 py-2 text-ink/70 hover:bg-surface hover:text-ink sm:px-4"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-ink hover:border-pine sm:px-4"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-ink px-3 py-2 text-white shadow-[0_12px_28px_rgba(7,20,24,0.16)] hover:bg-pine sm:px-4"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </section>

      <section className="border-b border-line/80 bg-panel/70">
        <div className="mx-auto grid min-h-[78vh] max-w-7xl items-center gap-10 px-4 py-9 sm:px-6 sm:py-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-pine">
              30 days free · Beginner-friendly swing trading research
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.04] text-ink sm:text-6xl">
              AI-ranked swing trade research, explained before you trade
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
              SwingFi scans the market each morning and turns the noise into a ranked
              list of trade ideas with the plan already visible: why it ranked,
              what price range to review, where the target and stop loss sit, how risky
              it looks, and how long the swing trade may take.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/pricing"
                className="rounded-lg bg-ink px-5 py-3 text-center text-sm font-black text-white shadow-[0_18px_42px_rgba(7,20,24,0.2)] hover:bg-pine"
              >
                Choose a free trial plan
              </Link>
              <Link
                href="#how-it-works"
                className="rounded-lg border border-line bg-panel px-5 py-3 text-center text-sm font-bold text-ink hover:border-pine hover:shadow-soft"
              >
                See how it works
              </Link>
            </div>
            <div className="mt-6 rounded-3xl border border-line/80 bg-white/80 p-4 shadow-[0_14px_40px_rgba(7,20,24,0.055)]">
              <p className="text-xs font-black uppercase tracking-normal text-pine">
                The beginner rule
              </p>
              <p className="mt-2 text-sm font-semibold leading-7 text-ink/68">
                A ranking is a research starting point, not a buy button. Start with the
                highest-quality ideas, then check confidence, risk, entry range, target,
                stop loss, and estimated holding window before deciding what deserves
                more research.
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Morning rankings", "Plain-English scores", "Entry, target, stop"].map(
                (item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-line bg-white/75 px-3 py-2 text-sm font-bold text-ink/75 shadow-[0_8px_22px_rgba(7,20,24,0.04)]"
                  >
                    {item}
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="premium-panel rounded-xl p-4">
            <div className="signal-line mb-4 h-1.5 rounded-full" />
            <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-ink">Today&apos;s customer view</p>
                <p className="mt-1 text-xs font-medium text-ink/55">
                  Rank first, then review the plan
                </p>
              </div>
              <div className="rounded-lg bg-lime px-3 py-2 text-sm font-black text-ink">
                Up to 90 ranked
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              {featured.length > 0 ? (
                featured.map((opportunity, index) => (
                  <div
                    key={opportunity.symbol}
                    className="rounded-xl border border-line bg-panel p-4 shadow-[0_12px_34px_rgba(7,20,24,0.06)]"
                  >
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-ink px-2 py-1 text-xs font-bold text-white">
                            #{index + 1}
                          </span>
                          <span className="text-sm font-bold text-ink">
                            {opportunity.symbol}
                          </span>
                          <span className="text-xs font-semibold text-ink/50">
                            {opportunity.assetType}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-ink/70">
                          {opportunity.scoreLabel}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-ink/55">
                          {opportunity.rankingSummary}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center sm:w-56">
                        <div className="rounded-md bg-mint px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-normal text-pine/65">
                            Opp
                          </p>
                          <p className="text-lg font-bold text-pine">
                            {opportunity.opportunityScore}
                          </p>
                        </div>
                        <div className="rounded-md bg-sky px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-normal text-ink/55">
                            Conf
                          </p>
                          <p className="text-lg font-bold text-ink">
                            {opportunity.confidenceScore}
                          </p>
                        </div>
                        <div className="rounded-md bg-coral/20 px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-normal text-ink/55">
                            Risk
                          </p>
                          <p className="text-lg font-bold text-ink">{opportunity.riskScore}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 border-t border-line pt-3 text-xs font-semibold text-ink/60 sm:grid-cols-3">
                      <p>Entry: {opportunity.entryRange}</p>
                      <p>Target: {opportunity.targetPrice}</p>
                      <p>Stop: {opportunity.stopLoss}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-line bg-panel p-5 shadow-[0_12px_34px_rgba(7,20,24,0.06)]">
                  <p className="text-sm font-black uppercase tracking-normal text-pine">
                    Live analysis pending
                  </p>
                  <h2 className="mt-3 text-2xl font-black text-ink">
                    Today&apos;s ranked opportunities will appear here after the morning run
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-ink/60">
                    SwingFi displays only saved live analysis. Once the production
                    database and scheduled agent are active, this panel will show the top
                    current opportunities.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-white/70">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-6 sm:px-6 md:grid-cols-4 lg:px-8">
          {trustProof.map(([label, text]) => (
            <div key={label} className="rounded-2xl border border-line bg-panel p-4 shadow-[0_10px_28px_rgba(7,20,24,0.045)]">
              <p className="text-sm font-black text-ink">{label}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-ink/58">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-line bg-panel/55">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-normal text-pine">
              The customer path
            </p>
            <h2 className="mt-3 text-3xl font-bold text-ink">
              From signup to a calmer daily review
            </h2>
            <p className="mt-3 text-sm leading-7 text-ink/65">
              SwingFi is designed to slow the process down: choose the amount of
              research you want, set your risk comfort, review the list in order, then
              track only the trades you actually decide to make.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {signupJourney.map(([step, title, text]) => (
              <div key={step} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-black text-white">
                  {step}
                </span>
                <h3 className="mt-4 text-lg font-black text-ink">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-ink/62">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            How to use SwingFi
          </p>
          <h2 className="mt-3 text-3xl font-bold text-ink">
            A simple daily routine for reviewing ideas
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink/65">
            SwingFi is built to help newer traders slow down and compare trade ideas
            consistently. The goal is not to push more trades. The goal is to make the
            research process easier to understand.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {workflow.map((item, index) => (
            <div key={item.title} className="rounded-xl border border-line bg-panel p-5 shadow-soft">
              <p className="text-sm font-black text-pine">0{index + 1}</p>
              <h3 className="mt-3 text-xl font-bold text-ink">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink/65">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-panel/65">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-pine">
              Ranking clarity
            </p>
            <h2 className="mt-3 text-3xl font-bold text-ink">
              What the scores mean in plain English
            </h2>
            <p className="mt-4 text-sm leading-7 text-ink/65">
              Scores help you compare setups quickly. They are research signals, not
              promises. Every opportunity still needs to be checked against the actual
              entry, target, stop, potential gain, potential loss, and timeframe.
            </p>
          </div>
          <div className="grid gap-3">
            {scoreGuide.map(([title, text]) => (
              <div key={title} className="rounded-xl border border-line bg-surface p-4">
                <h3 className="text-lg font-bold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink/65">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-pine">
              What to do with a ranking
            </p>
            <h2 className="mt-3 text-3xl font-bold text-ink">
              A high rank means review first, not buy immediately
            </h2>
            <p className="mt-4 text-sm leading-7 text-ink/65">
              Beginner traders often get hurt by chasing a stock after seeing a strong
              signal. SwingFi keeps the trade plan next to the score so you can see
              whether the price, downside, and timeframe still make sense.
            </p>
          </div>
          <div className="grid gap-3">
            {beginnerActions.map(([range, label, text]) => (
              <div key={range} className="rounded-2xl border border-line bg-panel p-4 shadow-[0_10px_28px_rgba(7,20,24,0.05)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xl font-black text-ink">{range}</p>
                  <span className="w-fit rounded-full bg-mint px-3 py-1 text-xs font-black uppercase tracking-normal text-pine">
                    {label}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-ink/65">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white/65">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-normal text-pine">
              Reading a trade card
            </p>
            <h2 className="mt-3 text-3xl font-bold text-ink">
              Every pick shows the information a beginner should check
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {cardAnatomy.map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-line bg-panel p-5 shadow-soft">
                <h3 className="text-lg font-black text-ink">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-ink/62">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            What customers review
          </p>
          <h2 className="mt-3 text-3xl font-bold text-ink">
            Clear picks with the trade plan visible
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {featured.length > 0 ? (
            featured.map((opportunity, index) => (
              <div
                key={opportunity.symbol}
                className="rounded-xl border border-line bg-panel p-5 shadow-soft"
              >
                <p className="text-xs font-black uppercase tracking-normal text-pine">
                  Rank #{index + 1}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black text-ink">{opportunity.symbol}</h3>
                    <p className="text-sm font-semibold text-ink/55">
                      {opportunity.assetType}
                    </p>
                  </div>
                  <div className="rounded-lg bg-mint px-3 py-2 text-center">
                    <p className="text-[11px] font-black uppercase tracking-normal text-pine/65">
                      Score
                    </p>
                    <p className="text-xl font-black text-pine">
                      {opportunity.opportunityScore}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold leading-6 text-ink/65">
                  {opportunity.rankingSummary}
                </p>
              </div>
            ))
          ) : (
            ["Ranked setup", "Risk plan", "Email link"].map((title) => (
              <div key={title} className="rounded-xl border border-line bg-panel p-5 shadow-soft">
                <p className="text-xs font-black uppercase tracking-normal text-pine">
                  {title}
                </p>
                <p className="mt-3 text-sm leading-6 text-ink/60">
                  Live customer cards appear here after the production ranking agent saves
                  the day&apos;s opportunities.
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="border-t border-line bg-ink px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-3xl font-bold">Ready to review today&apos;s ideas?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68">
              Create an account to set alert preferences, review the dashboard, and
              receive the morning stock analysis through branded email alerts.
              SwingFi is research software and does not place trades for users.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/pricing"
              className="rounded-lg bg-lime px-5 py-3 text-center text-sm font-black text-ink hover:bg-white"
            >
              Choose plan
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/20 px-5 py-3 text-center text-sm font-bold text-white hover:bg-white/10"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
