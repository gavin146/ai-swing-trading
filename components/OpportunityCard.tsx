import Link from "next/link";
import type { Opportunity } from "@/lib/opportunities";
import { MetricPill } from "./MetricPill";

type OpportunityCardProps = {
  opportunity: Opportunity;
  rank: number;
};

function scoreTone(score: number) {
  if (score >= 85) return "positive";
  if (score >= 70) return "neutral";
  return "caution";
}

export function OpportunityCard({ opportunity, rank }: OpportunityCardProps) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-line bg-panel p-5 shadow-soft transition hover:-translate-y-1 hover:border-pine/35 hover:shadow-lift">
      <div className="signal-line mb-4 h-1 rounded-full" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-ink px-2 py-1 text-xs font-black text-white">
              #{rank}
            </span>
            <span className="rounded-md bg-surface px-2 py-1 text-xs font-semibold text-ink/65">
              {opportunity.assetType}
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-ink">{opportunity.symbol}</h2>
          <p className="mt-1 text-sm font-medium text-ink/60">{opportunity.name}</p>
          <p className="mt-3 rounded-lg bg-sky/80 px-3 py-2 text-sm font-bold text-ink">
            {opportunity.scoreLabel}
          </p>
        </div>
        <div className="min-w-20 rounded-lg border border-line bg-surface p-3 text-center">
          <p className="text-[11px] font-black uppercase tracking-normal text-ink/55">
            Score
          </p>
          <p className="mt-1 text-2xl font-black text-pine">
            {opportunity.opportunityScore}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MetricPill
          label="Confidence"
          value={`${opportunity.confidenceScore}/100`}
          tone={scoreTone(opportunity.confidenceScore)}
        />
        <MetricPill
          label="Risk"
          value={`${opportunity.riskScore}/100`}
          tone={opportunity.riskScore >= 55 ? "risk" : "positive"}
        />
      </div>

      <p className="mt-4 text-sm leading-6 text-ink/65">{opportunity.rankingSummary}</p>

      <dl className="mt-5 grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
          <dt className="font-semibold text-ink/55">Entry range</dt>
          <dd className="text-right font-bold text-ink">{opportunity.entryRange}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
          <dt className="font-semibold text-ink/55">Target price</dt>
          <dd className="font-bold text-pine">{opportunity.targetPrice}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
          <dt className="font-semibold text-ink/55">Stop loss</dt>
          <dd className="font-bold text-coral">{opportunity.stopLoss}</dd>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <dt className="font-semibold text-ink/55">Buy window</dt>
            <dd className="mt-1 font-bold text-ink">{opportunity.estimatedBuyWindow}</dd>
          </div>
          <div className="text-right">
            <dt className="font-semibold text-ink/55">Est. sell</dt>
            <dd className="mt-1 font-bold text-pine">{opportunity.estimatedSellWindow}</dd>
          </div>
        </div>
      </dl>

      <Link
        href={`/opportunities/${opportunity.symbol}`}
        className="mt-auto rounded-lg bg-ink px-4 py-3 text-center text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine"
      >
        View analysis
      </Link>
    </article>
  );
}
