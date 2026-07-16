"use client";

import Link from "next/link";
import type { Opportunity } from "@/lib/opportunities";
import type { PlainLanguageInsight } from "@/lib/plain-language-insights";
import { getCoachVerdict } from "@/lib/trade-guidance";
import { MetricPill } from "./MetricPill";
import { ScoreMeter } from "./ScoreMeter";

type OpportunityCardProps = {
  animationDelay?: number;
  compact?: boolean;
  isSaved?: boolean;
  isWatched?: boolean;
  onSave?: () => void;
  onSkip?: () => void;
  onTrackTrade?: () => void;
  onWatch?: () => void;
  opportunity: Opportunity;
  plainInsight?: PlainLanguageInsight;
  rank: number;
};

function scoreTone(score: number) {
  if (score >= 85) return "positive";
  if (score >= 70) return "neutral";
  return "caution";
}

function MiniScore({
  label,
  score,
  tone = "text-ink",
}: {
  label: string;
  score: number;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-line/80 bg-surface px-3 py-3 2xl:px-2.5 2xl:py-2.5">
      <p className="text-xs font-black uppercase tracking-normal text-ink/42">{label}</p>
      <p className={`mt-1 text-2xl font-black 2xl:text-xl ${tone}`}>
        {score}
        <span className="text-xs text-ink/38">/100</span>
      </p>
    </div>
  );
}

export function OpportunityCard({
  animationDelay = 0,
  compact = false,
  isSaved = false,
  isWatched = false,
  onSave,
  onSkip,
  onTrackTrade,
  onWatch,
  opportunity,
  plainInsight,
  rank,
}: OpportunityCardProps) {
  const coach = getCoachVerdict(opportunity);
  const verdictTone =
    coach.badgeTone === "positive"
      ? "border-pine/15 bg-mint/75 text-pine"
      : coach.badgeTone === "caution"
        ? "border-coral/20 bg-coral/10 text-coral"
        : "border-amber/30 bg-amber/15 text-ink";

  return (
    <article
      className={`motion-card flex h-full flex-col overflow-hidden border border-line/80 bg-white shadow-[0_20px_70px_rgba(7,20,24,0.075)] transition will-change-transform hover:-translate-y-1 hover:border-pine/35 hover:shadow-lift ${
        compact ? "rounded-2xl" : "rounded-3xl"
      }`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="signal-line h-1.5" />
      <div className={`flex flex-1 flex-col ${compact ? "p-4 2xl:p-4" : "p-5 sm:p-6"}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-black text-white">
                Rank #{rank}
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink/58 ring-1 ring-line/70">
                {opportunity.assetType}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${verdictTone}`}>
                {coach.actionLabel}
              </span>
              <span className="rounded-full bg-sky px-3 py-1 text-xs font-bold text-ink/64 ring-1 ring-line/60">
                {opportunity.setupPattern}
              </span>
            </div>
            <h2 className={`mt-4 font-black tracking-normal text-ink ${compact ? "text-2xl 2xl:text-xl" : "text-3xl"}`}>
              {opportunity.symbol}
            </h2>
            <p className="mt-1 text-sm font-semibold text-ink/55">{opportunity.name}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface px-4 py-3 sm:min-w-32 2xl:min-w-28">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Opportunity
            </p>
            <p className={`mt-1 font-black text-pine ${compact ? "text-3xl 2xl:text-2xl" : "text-4xl"}`}>
              {opportunity.opportunityScore}
            </p>
            <p className="mt-1 text-xs font-bold text-ink/52">{opportunity.scoreLabel}</p>
          </div>
        </div>

        {compact ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniScore label="Score" score={opportunity.opportunityScore} tone="text-pine" />
            <MiniScore label="Confidence" score={opportunity.confidenceScore} />
            <MiniScore label="Risk" score={opportunity.riskScore} tone="text-coral" />
          </div>
        ) : (
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
        )}

        <div className={`mt-5 rounded-2xl border ${verdictTone} text-sm font-medium leading-7 ${
          compact ? "p-3 2xl:mt-4 2xl:leading-6" : "p-4"
        }`}>
          <p className="text-xs font-black uppercase tracking-normal opacity-70">
            SwingFi verdict
          </p>
          <p className="mt-2 text-lg font-black leading-6 text-ink">
            {coach.actionText}
          </p>
          <p className="mt-2 font-bold leading-6 text-ink/70">
            {coach.directionText}
          </p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <MetricPill label="Expected" value={coach.direction} tone={coach.badgeTone === "caution" ? "risk" : "positive"} />
          <MetricPill label="Gain / risk" value={`${opportunity.potentialGain} / ${opportunity.potentialLoss}`} tone="neutral" />
          <MetricPill label="Forecast range" value={coach.forecastRange} tone="positive" />
        </div>

        <div className={`mt-3 rounded-2xl border border-line/80 bg-surface ${compact ? "p-3" : "p-4"}`}>
          <p className="text-xs font-black uppercase tracking-normal text-pine/70">
            Why it matters
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/68 2xl:text-xs 2xl:leading-5">
            {coach.reason}
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-ink/58">
            {coach.guardrail}
          </p>
        </div>

        <div className={`mt-3 rounded-2xl border border-line bg-white ${compact ? "p-3" : "p-4"}`}>
          <p className="text-xs font-black uppercase tracking-normal opacity-70">
            Data behind the verdict
          </p>
          <p className="mt-2 text-base font-black leading-tight text-ink">
            {plainInsight?.headline ?? "Why this ticker is ranked"}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/66 2xl:text-xs 2xl:leading-5">
            {plainInsight?.summary ?? opportunity.rankingSummary}
          </p>
          {plainInsight?.evidence?.length ? (
          <div className="mt-3 hidden gap-2 sm:grid">
            {plainInsight.evidence.slice(0, 3).map((item) => (
              <p
                key={item}
                className="rounded-xl border border-line bg-white/85 px-3 py-2 text-xs font-bold leading-5 text-ink/64"
              >
                {item}
              </p>
            ))}
          </div>
          ) : null}
          <p className="mt-3 rounded-xl border border-line bg-white/75 px-3 py-2 text-xs font-bold leading-5 text-ink/56">
            {plainInsight?.riskNote ?? coach.riskText}
          </p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="rounded-2xl border border-line/80 bg-white p-3">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Model readiness
            </p>
            <p className="mt-1 text-sm font-black text-ink">
              {opportunity.analysisProfile.readinessLabel}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-ink/58">
              {opportunity.analysisProfile.summary}
            </p>
          </div>
          <div className="rounded-2xl border border-line/80 bg-surface p-3 sm:w-28">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              R/R
            </p>
            <p className="mt-1 text-2xl font-black text-pine">
              {opportunity.analysisProfile.rewardRiskLabel}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-line/80 bg-surface p-3">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Sector
            </p>
            <p className="mt-1 text-sm font-black text-ink">{opportunity.sector}</p>
          </div>
          <div className="rounded-2xl border border-line/80 bg-surface p-3">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Movement
            </p>
            <p className="mt-1 text-sm font-black text-ink">{opportunity.scoreMovement.label}</p>
          </div>
          <div className="rounded-2xl border border-line/80 bg-surface p-3">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Freshness
            </p>
            <p className="mt-1 text-sm font-black capitalize text-ink">{opportunity.dataFreshness.status}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3 2xl:mt-4 2xl:gap-2">
          <div className="rounded-2xl border border-line/80 bg-white p-4 2xl:p-3">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Entry range
            </p>
            <p className="mt-2 text-sm font-black leading-5 text-ink">
              {opportunity.entryRange}
            </p>
          </div>
          <div className="rounded-2xl border border-line/80 bg-white p-4 2xl:p-3">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Target
            </p>
            <p className="mt-2 text-sm font-black text-pine">{opportunity.targetPrice}</p>
          </div>
          <div className="rounded-2xl border border-line/80 bg-white p-4 2xl:p-3">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Stop loss
            </p>
            <p className="mt-2 text-sm font-black text-coral">{opportunity.stopLoss}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-4 2xl:grid-cols-2 2xl:gap-2">
          <MetricPill
            label="Potential gain"
            value={opportunity.potentialGain}
            tone={scoreTone(opportunity.opportunityScore)}
          />
          <MetricPill label="Potential loss" value={opportunity.potentialLoss} tone="risk" />
          <MetricPill label="Entry window" value={opportunity.estimatedBuyWindow} tone="neutral" />
          <MetricPill label="Est. sell" value={opportunity.estimatedSellWindow} tone="caution" />
        </div>

        {compact ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-[1.1fr_1fr_0.8fr_0.8fr_0.8fr]">
            <Link
              href={`/opportunities/${opportunity.symbol}`}
              className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white shadow-[0_16px_36px_rgba(7,20,24,0.18)] hover:bg-pine"
            >
              Review
            </Link>
            <button
              type="button"
              onClick={onTrackTrade}
              className="rounded-2xl border border-pine/25 bg-mint px-4 py-3 text-sm font-black text-pine transition hover:border-pine hover:bg-white"
            >
              Track trade
            </button>
            <button
              type="button"
              onClick={onSave}
              className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                isSaved
                  ? "border-pine bg-mint text-pine"
                  : "border-line bg-white text-ink/66 hover:border-pine/35 hover:text-ink"
              }`}
            >
              {isSaved ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              onClick={onWatch}
              className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                isWatched
                  ? "border-amber bg-amber/12 text-ink"
                  : "border-line bg-white text-ink/66 hover:border-amber/45 hover:text-ink"
              }`}
            >
              {isWatched ? "Watching" : "Watch"}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-black text-ink/56 transition hover:border-coral/35 hover:text-coral"
            >
              Skip
            </button>
          </div>
        ) : (
          <Link
            href={`/opportunities/${opportunity.symbol}`}
            className="mt-5 rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white shadow-[0_16px_36px_rgba(7,20,24,0.18)] hover:bg-pine"
          >
            View full analysis
          </Link>
        )}
      </div>
    </article>
  );
}
