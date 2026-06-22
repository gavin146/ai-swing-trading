"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MetricPill } from "@/components/MetricPill";
import { TradeStatGrid } from "@/components/TradeStatGrid";
import { getStoredOpportunities } from "@/lib/opportunity-store";
import type { Opportunity } from "@/lib/opportunities";

type OpportunityDetailViewProps = {
  initialOpportunity?: Opportunity;
  symbol: string;
};

export function OpportunityDetailView({
  initialOpportunity,
  symbol,
}: OpportunityDetailViewProps) {
  const [opportunity, setOpportunity] = useState<Opportunity | undefined>(
    initialOpportunity,
  );

  useEffect(() => {
    const refresh = () => {
      setOpportunity(
        getStoredOpportunities().find(
          (item) => item.symbol.toLowerCase() === symbol.toLowerCase(),
        ),
      );
    };

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("tradepilot-opportunities-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("tradepilot-opportunities-updated", refresh);
    };
  }, [symbol]);

  if (!opportunity) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex rounded-lg border border-line bg-panel px-3 py-2 text-sm font-bold text-ink hover:border-pine hover:shadow-soft"
        >
          Back to dashboard
        </Link>
        <div className="premium-panel mt-6 rounded-xl p-6">
          <h1 className="text-3xl font-black text-ink">Opportunity not found</h1>
          <p className="mt-3 leading-7 text-ink/65">
            This mock opportunity may have been deleted from the admin panel.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="inline-flex rounded-lg border border-line bg-panel px-3 py-2 text-sm font-bold text-ink hover:border-pine hover:shadow-soft"
      >
        Back to dashboard
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="premium-panel rounded-xl p-6">
          <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
          <div className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-surface px-2 py-1 text-xs font-bold text-ink/65">
                  {opportunity.assetType}
                </span>
                <span className="rounded-md bg-mint px-2 py-1 text-xs font-bold text-pine">
                  {opportunity.tradeQuality}
                </span>
              </div>
              <h1 className="mt-4 text-5xl font-black text-ink">{opportunity.symbol}</h1>
              <p className="mt-2 text-base font-semibold text-ink/60">{opportunity.name}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 text-center sm:min-w-36">
              <p className="text-xs font-bold uppercase tracking-normal text-ink/55">
                Opportunity
              </p>
              <p className="mt-2 text-4xl font-black text-pine">
                {opportunity.opportunityScore}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <TradeStatGrid opportunity={opportunity} />
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="text-lg font-bold text-ink">Full trade information</h2>
              <dl className="mt-5 grid gap-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-ink/55">Current price</dt>
                  <dd className="font-bold text-ink">{opportunity.currentPrice}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-ink/55">Entry range</dt>
                  <dd className="text-right font-bold text-ink">{opportunity.entryRange}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-ink/55">Target price</dt>
                  <dd className="font-bold text-pine">{opportunity.targetPrice}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-ink/55">Stop loss</dt>
                  <dd className="font-bold text-coral">{opportunity.stopLoss}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-ink/55">Buy window</dt>
                  <dd className="text-right font-bold text-ink">
                    {opportunity.estimatedBuyWindow}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-ink/55">Estimated sell window</dt>
                  <dd className="text-right font-bold text-pine">
                    {opportunity.estimatedSellWindow}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="text-lg font-bold text-ink">Scores</h2>
              <div className="mt-5 grid gap-3">
                <MetricPill
                  label="Confidence score"
                  value={`${opportunity.confidenceScore}/100`}
                  tone="positive"
                />
                <MetricPill
                  label="Risk score"
                  value={`${opportunity.riskScore}/100`}
                  tone={opportunity.riskScore >= 55 ? "risk" : "positive"}
                />
                <MetricPill label="Setup" value={opportunity.setup} tone="neutral" />
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-xl border border-line bg-surface p-5">
            <h2 className="text-lg font-bold text-ink">Why this ranked here</h2>
            <p className="mt-4 leading-7 text-ink/70">{opportunity.rankingSummary}</p>
          </section>

          <section className="mt-6 rounded-xl border border-line bg-surface p-5">
            <h2 className="text-lg font-bold text-ink">AI explanation</h2>
            <p className="mt-4 leading-7 text-ink/70">{opportunity.aiExplanation}</p>
            <p className="mt-4 leading-7 text-ink/70">{opportunity.thesis}</p>
          </section>
        </div>

        <aside className="grid gap-5 self-start">
          <section className="rounded-xl border border-line bg-panel p-5 shadow-soft">
            <h2 className="text-lg font-bold text-ink">Historical performance</h2>
            <div className="mt-5 grid gap-3">
              {opportunity.historicalPerformance.map((item) => (
                <MetricPill
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  tone={item.tone}
                />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-line bg-panel p-5 shadow-soft">
            <h2 className="text-lg font-bold text-ink">Score translation</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="rounded-md bg-mint px-3 py-2">
                <p className="font-bold text-pine">Opportunity</p>
                <p className="mt-1 leading-6 text-ink/70">{opportunity.scoreLabel}</p>
              </div>
              <div className="rounded-md bg-sky px-3 py-2">
                <p className="font-bold text-ink">Confidence</p>
                <p className="mt-1 leading-6 text-ink/70">{opportunity.confidenceLabel}</p>
              </div>
              <div className="rounded-md bg-coral/20 px-3 py-2">
                <p className="font-bold text-ink">Risk</p>
                <p className="mt-1 leading-6 text-ink/70">{opportunity.riskLabel}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-panel p-5 shadow-soft">
            <h2 className="text-lg font-bold text-ink">Beginner risk note</h2>
            <p className="mt-4 text-sm leading-6 text-ink/65">
              Use the entry, target, and stop as a plan to review. The scores help you
              compare setups, but they do not remove market risk or replace position
              sizing.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
