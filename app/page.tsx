import Link from "next/link";
import { opportunities } from "@/lib/opportunities";
import { OpportunityCard } from "@/components/OpportunityCard";

const featured = opportunities.slice(0, 3);

export default function LandingPage() {
  return (
    <main>
      <section className="border-b border-line bg-panel">
        <div className="mx-auto grid min-h-[86vh] max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-pine text-sm font-bold text-white">
                TP
              </span>
              <span className="text-lg font-bold text-ink">TradePilot AI</span>
            </Link>
            <p className="mt-10 text-sm font-bold uppercase tracking-normal text-pine">
              Swing trading intelligence
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.02] text-ink sm:text-6xl">
              TradePilot AI
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
              Discover clear, ranked swing trade opportunities across US stocks,
              ETFs, and crypto with beginner-friendly risk context.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="rounded-md bg-pine px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-ink"
              >
                Create account
              </Link>
              <Link
                href="/dashboard"
                className="rounded-md border border-line bg-panel px-5 py-3 text-center text-sm font-bold text-ink transition hover:border-pine"
              >
                View demo dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface p-4 shadow-soft">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <p className="text-sm font-bold text-ink">Today&apos;s top opportunities</p>
                <p className="mt-1 text-xs font-medium text-ink/55">Mock portfolio scan</p>
              </div>
              <div className="rounded-md bg-mint px-3 py-2 text-sm font-bold text-pine">
                30 ranked
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              {featured.map((opportunity, index) => (
                <div
                  key={opportunity.symbol}
                  className="grid gap-4 rounded-lg border border-line bg-panel p-4 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-ink px-2 py-1 text-xs font-bold text-white">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-bold text-ink">{opportunity.symbol}</span>
                      <span className="text-xs font-semibold text-ink/50">
                        {opportunity.assetType}
                      </span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-pine"
                        style={{ width: `${opportunity.opportunityScore}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-ink/65">{opportunity.setup}</p>
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
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {featured.map((opportunity, index) => (
            <OpportunityCard
              key={opportunity.symbol}
              opportunity={opportunity}
              rank={index + 1}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
