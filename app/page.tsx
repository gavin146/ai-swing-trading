import Link from "next/link";
import { opportunities } from "@/lib/opportunities";
import { BrandMark } from "@/components/BrandMark";
import { OpportunityCard } from "@/components/OpportunityCard";

const featured = opportunities.slice(0, 3);

export default function LandingPage() {
  return (
    <main>
      <section className="border-b border-line/80 bg-panel/80">
        <div className="mx-auto grid min-h-[88vh] max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <BrandMark />
            <p className="mt-10 text-sm font-bold uppercase tracking-normal text-pine">
              Pre-market swing trading intelligence
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.02] text-ink sm:text-6xl">
              Daily trade ideas without the trading-desk confusion
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
              TradePilot AI ranks swing opportunities before the market opens, explains
              the setup in plain English, and sends customers a direct link to the
              day&apos;s stock analysis.
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
                View demo dashboard
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["8:30 AM ET scan", "Plain-English scores", "Tracked email links"].map((item) => (
                <div key={item} className="rounded-lg border border-line bg-white/70 px-3 py-2 text-sm font-bold text-ink/75 shadow-[0_8px_22px_rgba(7,20,24,0.04)]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="premium-panel rounded-xl p-4">
            <div className="signal-line mb-4 h-1.5 rounded-full" />
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <p className="text-sm font-bold text-ink">Customer morning dashboard</p>
                <p className="mt-1 text-xs font-medium text-ink/55">
                  Ranked, explained, and ready to review
                </p>
              </div>
              <div className="rounded-lg bg-lime px-3 py-2 text-sm font-black text-ink">
                30 ranked
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              {featured.map((opportunity, index) => (
                <div
                  key={opportunity.symbol}
                  className="grid gap-4 rounded-xl border border-line bg-panel p-4 shadow-[0_12px_34px_rgba(7,20,24,0.06)] sm:grid-cols-[1fr_auto]"
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
                        className="h-full rounded-full bg-[linear-gradient(90deg,#b7f34b,#0b3d3f)]"
                        style={{ width: `${opportunity.opportunityScore}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-ink/65">{opportunity.setup}</p>
                    <p className="mt-2 text-xs font-semibold text-ink/50">
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
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            What customers see
          </p>
          <h2 className="mt-3 text-3xl font-bold text-ink">Clear picks, no operator controls</h2>
        </div>
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
