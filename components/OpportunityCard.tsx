import Link from "next/link";
import type { Opportunity } from "@/lib/opportunities";
import { MetricPill } from "./MetricPill";
import { ScoreMeter } from "./ScoreMeter";

type OpportunityCardProps = {
  animationDelay?: number;
  opportunity: Opportunity;
  rank: number;
};

function scoreTone(score: number) {
  if (score >= 85) return "positive";
  if (score >= 70) return "neutral";
  return "caution";
}

export function OpportunityCard({ animationDelay = 0, opportunity, rank }: OpportunityCardProps) {
  return (
    <article
      className="motion-card flex h-full flex-col overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_20px_70px_rgba(7,20,24,0.075)] transition will-change-transform hover:-translate-y-1 hover:border-pine/35 hover:shadow-lift"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="signal-line h-1.5" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-black text-white">
                Rank #{rank}
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink/58 ring-1 ring-line/70">
                {opportunity.assetType}
              </span>
              <span className="rounded-full bg-mint px-3 py-1 text-xs font-black text-pine">
                {opportunity.tradeQuality}
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-normal text-ink">
              {opportunity.symbol}
            </h2>
            <p className="mt-1 text-sm font-semibold text-ink/55">{opportunity.name}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface px-4 py-3 sm:min-w-36">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Opportunity
            </p>
            <p className="mt-1 text-4xl font-black text-pine">
              {opportunity.opportunityScore}
            </p>
            <p className="mt-1 text-xs font-bold text-ink/52">{opportunity.scoreLabel}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
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

        <p className="mt-5 rounded-2xl border border-line/80 bg-surface p-4 text-sm font-medium leading-7 text-ink/68">
          {opportunity.rankingSummary}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line/80 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Entry range
            </p>
            <p className="mt-2 text-sm font-black leading-5 text-ink">
              {opportunity.entryRange}
            </p>
          </div>
          <div className="rounded-2xl border border-line/80 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Target
            </p>
            <p className="mt-2 text-sm font-black text-pine">{opportunity.targetPrice}</p>
          </div>
          <div className="rounded-2xl border border-line/80 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Stop loss
            </p>
            <p className="mt-2 text-sm font-black text-coral">{opportunity.stopLoss}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <MetricPill
            label="Potential gain"
            value={opportunity.potentialGain}
            tone={scoreTone(opportunity.opportunityScore)}
          />
          <MetricPill label="Potential loss" value={opportunity.potentialLoss} tone="risk" />
          <MetricPill label="Buy window" value={opportunity.estimatedBuyWindow} tone="neutral" />
          <MetricPill label="Est. sell" value={opportunity.estimatedSellWindow} tone="caution" />
        </div>

        <Link
          href={`/opportunities/${opportunity.symbol}`}
          className="mt-5 rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white shadow-[0_16px_36px_rgba(7,20,24,0.18)] hover:bg-pine"
        >
          View full analysis
        </Link>
      </div>
    </article>
  );
}
