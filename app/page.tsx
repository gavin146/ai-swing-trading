import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { opportunityFromRow } from "@/lib/opportunities";
import { listLatestOpportunities } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";

const workflow = [
  {
    title: "Morning scan",
    text: "The system screens liquid US stocks before the market opens and narrows the list to the strongest swing setups.",
  },
  {
    title: "Plain-English ranking",
    text: "Each idea shows opportunity, confidence, risk, entry range, target, stop loss, and expected trade window.",
  },
  {
    title: "Customer brief",
    text: "Users receive a daily email link to the analysis page so they can review the plan without running any agent controls.",
  },
];

const scoreGuide = [
  ["Opportunity", "How attractive the setup looks across technicals, financial quality, catalysts, macro backdrop, liquidity, and risk."],
  ["Confidence", "How much the underlying signals agree with each other. Higher confidence means the setup is cleaner, not guaranteed."],
  ["Risk", "How fragile the setup may be because of volatility, support distance, debt, news risk, or stretched price action."],
];

export default async function LandingPage() {
  const latest = await listLatestOpportunities(3);
  const featured = latest.rows.map(opportunityFromRow);

  return (
    <main>
      <section className="border-b border-line/80 bg-panel/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <BrandMark />
          <nav className="flex items-center gap-2 text-sm font-bold">
            <Link
              href="/pricing"
              className="rounded-lg border border-transparent px-4 py-2 text-ink/70 hover:bg-surface hover:text-ink"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-line bg-surface px-4 py-2 text-ink hover:border-pine"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-ink px-4 py-2 text-white shadow-[0_12px_28px_rgba(7,20,24,0.16)] hover:bg-pine"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </section>

      <section className="border-b border-line/80 bg-panel/70">
        <div className="mx-auto grid min-h-[78vh] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-pine">
              Pre-market swing trading intelligence
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.02] text-ink sm:text-6xl">
              Daily swing trade ideas explained for beginner investors
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
              TradePilot AI ranks high-quality stock opportunities before the market
              opens, explains why each setup scored well, and shows the buy range,
              target, stop loss, confidence, risk, and estimated holding window.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="rounded-lg bg-ink px-5 py-3 text-center text-sm font-black text-white shadow-[0_18px_42px_rgba(7,20,24,0.2)] hover:bg-pine"
              >
                Create account
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg border border-line bg-panel px-5 py-3 text-center text-sm font-bold text-ink hover:border-pine hover:shadow-soft"
              >
                View dashboard
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["8:30 AM ET brief", "Top 30 ranked ideas", "Risk-first explanations"].map(
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
                  Ranked, explained, and ready to review
                </p>
              </div>
              <div className="rounded-lg bg-lime px-3 py-2 text-sm font-black text-ink">
                30 ranked
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
                    TradePilot AI displays only saved live analysis. Once the production
                    database and scheduled agent are active, this panel will show the top
                    current opportunities.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold text-ink">
            A simple daily routine, not a complicated trading terminal
          </h2>
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
              Score clarity
            </p>
            <h2 className="mt-3 text-3xl font-bold text-ink">
              The numbers are designed to be understandable
            </h2>
            <p className="mt-4 text-sm leading-7 text-ink/65">
              Scores help users compare setups quickly. They are research signals, not
              promises. Every opportunity still shows the actual entry, target, stop,
              potential gain, potential loss, and estimated swing-trade timeframe.
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
              receive the morning stock analysis when production email is connected.
              TradePilot AI is research software and does not place trades for users.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-lg bg-lime px-5 py-3 text-center text-sm font-black text-ink hover:bg-white"
            >
              Sign up
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
