"use client";

import Link from "next/link";
import { MetricPill } from "@/components/MetricPill";
import { ScoreMeter } from "@/components/ScoreMeter";
import { TradeStatGrid } from "@/components/TradeStatGrid";
import type { Opportunity } from "@/lib/opportunities";
import type { OpportunityDataSource } from "@/lib/repositories/opportunities";

type OpportunityDetailViewProps = {
  dataSource: OpportunityDataSource;
  fallbackReason?: string;
  initialOpportunity?: Opportunity;
  symbol: string;
};

function statusMessage(dataSource: OpportunityDataSource, fallbackReason?: string) {
  if (dataSource === "empty") {
    return `This page is waiting for live saved analysis${fallbackReason ? `: ${fallbackReason}` : "."}`;
  }

  if (dataSource === "agent-preview") {
    return `Showing a fresh live agent preview because saved Supabase analysis is not active yet. ${fallbackReason ?? ""}`;
  }

  return null;
}

export function OpportunityDetailView({
  dataSource,
  fallbackReason,
  initialOpportunity,
  symbol,
}: OpportunityDetailViewProps) {
  const opportunity = initialOpportunity;
  const message = statusMessage(dataSource, fallbackReason);

  if (!opportunity) {
    return (
      <section className="rounded-3xl border border-line bg-white p-6 shadow-soft">
        <Link
          href="/dashboard"
          className="inline-flex rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink hover:border-pine hover:shadow-soft"
        >
          Back to dashboard
        </Link>
        <h1 className="mt-6 text-3xl font-black text-ink">Opportunity not found</h1>
        <p className="mt-3 leading-7 text-ink/65">
          No saved opportunity is available for {symbol.toUpperCase()}.
          {fallbackReason ? ` ${fallbackReason}` : ""}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <Link
        href="/dashboard"
        className="w-fit rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink shadow-[0_10px_30px_rgba(7,20,24,0.04)] hover:border-pine"
      >
        Back to dashboard
      </Link>

      {message ? (
        <p className="rounded-2xl border border-line bg-sky px-4 py-3 text-sm font-bold text-ink/70">
          {message}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
        <div className="grid lg:grid-cols-[1fr_380px]">
          <div className="p-6 sm:p-8">
            <div className="signal-line mb-6 h-1.5 max-w-56 rounded-full" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-black text-white">
                {opportunity.assetType}
              </span>
              <span className="rounded-full bg-mint px-3 py-1 text-xs font-black text-pine">
                {opportunity.tradeQuality}
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink/55 ring-1 ring-line">
                {opportunity.timeHorizon}
              </span>
            </div>
            <h2 className="mt-5 text-5xl font-black tracking-normal text-ink">
              {opportunity.symbol}
            </h2>
            <p className="mt-2 text-base font-semibold text-ink/58">{opportunity.name}</p>
            <p className="mt-5 max-w-3xl text-sm font-medium leading-7 text-ink/66">
              {opportunity.rankingSummary}
            </p>
          </div>
          <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white lg:border-l lg:border-t-0">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Opportunity score
            </p>
            <p className="mt-4 text-6xl font-black text-lime">
              {opportunity.opportunityScore}
              <span className="text-lg text-white/42">/100</span>
            </p>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/68">
              {opportunity.scoreLabel}. Review the entry range and stop before deciding
              whether the setup fits your plan.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <div className="grid gap-3 md:grid-cols-3">
            <ScoreMeter
              label="Opportunity"
              score={opportunity.opportunityScore}
              sublabel={opportunity.scoreLabel}
            />
            <ScoreMeter
              label="Confidence"
              score={opportunity.confidenceScore}
              sublabel={opportunity.confidenceLabel}
              tone="confidence"
            />
            <ScoreMeter
              label="Risk"
              score={opportunity.riskScore}
              sublabel={opportunity.riskLabel}
              tone="risk"
            />
          </div>

          <section className="rounded-3xl border border-line bg-white p-6 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-pine">
                  Trade plan
                </p>
                <h2 className="mt-2 text-2xl font-black text-ink">
                  Entry, target, stop, and timing
                </h2>
              </div>
              <p className="text-sm font-bold text-ink/52">Estimated hold: {opportunity.timeHorizon}</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {[
                ["Entry range", opportunity.entryRange, "text-ink"],
                ["Target", opportunity.targetPrice, "text-pine"],
                ["Stop loss", opportunity.stopLoss, "text-coral"],
                ["Current", opportunity.currentPrice, "text-ink"],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                    {label}
                  </p>
                  <p className={`mt-2 text-lg font-black ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <MetricPill label="Buy window" value={opportunity.estimatedBuyWindow} />
              <MetricPill label="Estimated sell window" value={opportunity.estimatedSellWindow} tone="caution" />
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-white p-6 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              AI explanation
            </p>
            <h2 className="mt-2 text-2xl font-black text-ink">Why SwingFi ranked it</h2>
            <p className="mt-4 leading-7 text-ink/70">{opportunity.aiExplanation}</p>
            <p className="mt-4 leading-7 text-ink/70">{opportunity.thesis}</p>
          </section>
        </div>

        <aside className="grid gap-5 self-start">
          <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              Reward and risk
            </p>
            <div className="mt-4">
              <TradeStatGrid opportunity={opportunity} />
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              Historical read
            </p>
            <div className="mt-4 grid gap-3">
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

          <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              Beginner risk note
            </p>
            <p className="mt-3 text-sm font-medium leading-7 text-ink/64">
              Scores help compare setups, but they do not remove market risk. Confirm
              news, earnings, liquidity, and position size before placing any trade.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
