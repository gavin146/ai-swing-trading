"use client";

import { useEffect, useMemo, useState } from "react";
import { OpportunityCard } from "@/components/OpportunityCard";
import { ScoreGuide } from "@/components/ScoreGuide";
import { SummaryTile } from "@/components/SummaryTile";
import {
  getCurrentCustomer,
  getCustomerDailyPickLimit,
  type CustomerProfile,
} from "@/lib/customer-store";
import type { Opportunity } from "@/lib/opportunities";
import type { OpportunityDataSource } from "@/lib/repositories/opportunities";

type DashboardOpportunitiesProps = {
  dataSource: OpportunityDataSource;
  fallbackReason?: string;
  initialOpportunities: Opportunity[];
};

function listStrength(score: number) {
  if (score >= 80) {
    return {
      label: "Strong",
      description: "The displayed list has several cleaner, higher-quality setups.",
      tone: "text-pine",
    };
  }

  if (score >= 65) {
    return {
      label: "Selective",
      description: "There are usable ideas, but entries and risk control matter.",
      tone: "text-pine",
    };
  }

  if (score >= 55) {
    return {
      label: "Cautious",
      description: "Most ideas are watchlist quality, not automatic trade candidates.",
      tone: "text-amber",
    };
  }

  return {
    label: "Wait",
    description: "The list is weak today; patience may be better than forcing trades.",
    tone: "text-coral",
  };
}

function percentNumber(value: string) {
  return Number(value.replace("+", "").replace("%", "")) || 0;
}

function preferenceFitScore(opportunity: Opportunity, customer: CustomerProfile) {
  const confidenceGap = Math.max(0, customer.minimumConfidence - opportunity.confidenceScore);
  const riskGap = Math.max(0, opportunity.riskScore - customer.maxRiskScore);
  let penalty = confidenceGap * 1.1 + riskGap * 1.25;
  const potentialGain = percentNumber(opportunity.potentialGain);

  if (customer.riskProfile === "conservative") {
    penalty += Math.max(0, opportunity.riskScore - 45) * 0.35;
    penalty -= opportunity.confidenceScore >= 78 && opportunity.riskScore <= 45 ? 5 : 0;
  }

  if (customer.riskProfile === "aggressive") {
    penalty -= opportunity.opportunityScore >= 75 && potentialGain >= 7 ? 4 : 0;
    penalty += opportunity.confidenceScore < 62 ? 6 : 0;
  }

  if (customer.positionSizePreference === "small") {
    penalty += Math.max(0, opportunity.riskScore - 55) * 0.3;
  }

  if (customer.positionSizePreference === "aggressive") {
    penalty -= opportunity.opportunityScore >= 72 && potentialGain >= 6 ? 2 : 0;
  }

  if (customer.setupPreference === "steady") {
    penalty += Math.max(0, opportunity.riskScore - 50) * 0.35;
    penalty -= opportunity.confidenceScore >= 75 && opportunity.riskScore <= 50 ? 3 : 0;
  }

  if (customer.setupPreference === "momentum") {
    penalty -= opportunity.opportunityScore >= 75 && potentialGain >= 8 ? 4 : 0;
    penalty += opportunity.confidenceScore < 65 ? 4 : 0;
  }

  if (customer.accountBudget === "under_1000") {
    penalty += Math.max(0, opportunity.riskScore - 50) * 0.25;
  }

  if (customer.accountBudget === "1000_5000") {
    penalty += Math.max(0, opportunity.riskScore - 60) * 0.15;
  }

  return (
    opportunity.opportunityScore * 1.15 +
    opportunity.confidenceScore * 0.3 -
    opportunity.riskScore * 0.22 -
    penalty
  );
}

export function DashboardOpportunities({
  dataSource,
  fallbackReason,
  initialOpportunities,
}: DashboardOpportunitiesProps) {
  const [opportunities] = useState(initialOpportunities);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setCustomer(getCurrentCustomer());
      setReady(true);
    };

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("swingfi-opportunities-updated", refresh);
    window.addEventListener("swingfi-customer-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("swingfi-opportunities-updated", refresh);
      window.removeEventListener("swingfi-customer-updated", refresh);
    };
  }, [dataSource]);

  const personalized = useMemo(() => {
    if (!customer) {
      return {
        closestFitCount: 0,
        dailyPicks: opportunities,
        directMatchCount: opportunities.length,
        limit: opportunities.length,
      };
    }

    const limit = getCustomerDailyPickLimit(customer);
    const scored = opportunities.map((opportunity, index) => {
      const directMatch =
        opportunity.confidenceScore >= customer.minimumConfidence &&
        opportunity.riskScore <= customer.maxRiskScore;

      return {
        directMatch,
        index,
        opportunity,
        score: preferenceFitScore(opportunity, customer),
      };
    });
    const directMatchCount = scored.filter((item) => item.directMatch).length;
    const dailyPicks = scored
      .sort((a, b) => {
        if (a.directMatch !== b.directMatch) return a.directMatch ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      })
      .slice(0, limit)
      .map((item) => item.opportunity);

    return {
      closestFitCount: Math.max(0, dailyPicks.length - Math.min(dailyPicks.length, directMatchCount)),
      dailyPicks,
      directMatchCount,
      limit,
    };
  }, [customer, opportunities]);
  const dailyPicks = personalized.dailyPicks;

  const summary = useMemo(() => {
    const avgOpportunity =
      dailyPicks.length === 0
        ? 0
        : Math.round(
            dailyPicks.reduce(
              (total, opportunity) => total + opportunity.opportunityScore,
              0,
            ) / dailyPicks.length,
          );
    const lowerRiskCount = dailyPicks.filter(
      (opportunity) => opportunity.riskScore < 45,
    ).length;
    const avgGain =
      dailyPicks.length === 0
        ? 0
        : dailyPicks.reduce(
            (total, opportunity) =>
              total + Number(opportunity.potentialGain.replace("+", "").replace("%", "")),
            0,
          ) / dailyPicks.length;
    const avgLoss =
      dailyPicks.length === 0
        ? 0
        : dailyPicks.reduce(
            (total, opportunity) =>
              total + Math.abs(Number(opportunity.potentialLoss.replace("%", ""))),
            0,
          ) / dailyPicks.length;
    const highQualityCount = dailyPicks.filter(
      (opportunity) => opportunity.opportunityScore >= 75,
    ).length;
    const watchlistCount = dailyPicks.filter(
      (opportunity) =>
        opportunity.opportunityScore >= 65 && opportunity.opportunityScore < 75,
    ).length;
    const strength = listStrength(avgOpportunity);

    return {
      avgGain,
      avgLoss,
      avgOpportunity,
      highQualityCount,
      lowerRiskCount,
      strength,
      watchlistCount,
    };
  }, [dailyPicks]);

  return (
    <>
      <div className="motion-card overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
        <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
          <div className="p-6 sm:p-8">
            <div className="signal-line mb-6 h-1.5 max-w-56 rounded-full" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-black uppercase tracking-normal text-white">
                Pre-market list
              </span>
              <span className="rounded-full bg-mint px-3 py-1 text-xs font-black uppercase tracking-normal text-pine">
                {dataSource === "supabase" ? "Live data" : "Preview"}
              </span>
            </div>
            <h2 className="mt-5 max-w-3xl text-3xl font-black tracking-normal text-ink sm:text-4xl">
              {customer ? "Ranked around your risk profile" : "Today's ranked opportunities"}
            </h2>
            <p className="mt-4 max-w-3xl text-sm font-medium leading-7 text-ink/62">
              {customer
                ? `Showing ${dailyPicks.length} personalized picks from ${opportunities.length} agent-ranked opportunities. ${personalized.directMatchCount} directly match your confidence and risk settings${
                    personalized.closestFitCount > 0
                      ? "; the rest are the closest high-quality fits so the list stays useful."
                      : "."
                  }`
                : `Showing ${dailyPicks.length} agent-ranked opportunities. Create a profile to personalize the list by risk, budget, and confidence preference.`}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-line/80 bg-surface p-3 sm:p-4">
                <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                  Confidence
                </p>
                <p className="mt-2 text-xl font-black text-ink sm:text-2xl">
                  {customer?.minimumConfidence ?? 70}
                  <span className="text-sm text-ink/42">/100</span>
                </p>
              </div>
              <div className="rounded-2xl border border-line/80 bg-surface p-3 sm:p-4">
                <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                  Max risk
                </p>
                <p className="mt-2 text-xl font-black text-ink sm:text-2xl">
                  {customer?.maxRiskScore ?? 65}
                  <span className="text-sm text-ink/42">/100</span>
                </p>
              </div>
              <div className="rounded-2xl border border-line/80 bg-surface p-3 sm:p-4">
                <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                  Review
                </p>
                <p className="mt-2 text-xl font-black text-ink sm:text-2xl">8:30 ET</p>
              </div>
            </div>
          </div>
          <div className="hidden border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white sm:block xl:border-l xl:border-t-0">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Today&apos;s read
            </p>
            <p className={`mt-4 text-5xl font-black ${summary.strength.tone === "text-coral" ? "text-coral" : "text-white"}`}>
              {summary.strength.label}
            </p>
            <p className="mt-4 text-sm font-semibold leading-7 text-white/68">
              {summary.strength.description}
            </p>
            <div className="mt-6 rounded-2xl border border-white/14 bg-white/8 p-4">
              <p className="text-xs font-black uppercase tracking-normal text-white/48">
                List quality
              </p>
              <p className="mt-2 text-4xl font-black text-lime">
                {summary.avgOpportunity}
                <span className="text-base text-white/44">/100</span>
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/55">
                Average opportunity score for the picks shown today.
              </p>
            </div>
          </div>
        </div>
        {dataSource === "empty" ? (
          <p className="border-t border-line bg-coral/12 px-6 py-4 text-sm font-bold text-ink/70">
            No live picks are available yet{fallbackReason ? `: ${fallbackReason}` : "."}
          </p>
        ) : dataSource === "agent-preview" ? (
          <p className="border-t border-line bg-sky px-6 py-4 text-sm font-bold text-ink/70">
            Live agent preview is showing because saved Supabase picks are not active yet.
            {fallbackReason ? ` ${fallbackReason}` : ""}
          </p>
        ) : null}
      </div>

      <div className="mt-7 flex flex-col gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Ranked opportunities
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-normal text-ink">
            Analyst-style cards with the full trade plan visible
          </h2>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {dailyPicks.length > 0 ? (
            dailyPicks.map((opportunity, index) => (
              <OpportunityCard
                key={opportunity.symbol}
                opportunity={opportunity}
                rank={index + 1}
                animationDelay={Math.min(index * 35, 360)}
              />
            ))
          ) : (
            <div className="rounded-3xl border border-line bg-panel p-6 shadow-soft xl:col-span-2">
              <p className="text-sm font-black uppercase tracking-normal text-pine">
                Waiting for live analysis
              </p>
              <h2 className="mt-3 text-2xl font-black text-ink">
                No ranked opportunities have been saved yet
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
                Connect Supabase in Vercel, run the database schema, and make sure
                `FMP_API_KEY` is configured. Until then, the dashboard cannot load saved
                rankings or generate a live preview.
              </p>
            </div>
          )}
        </div>
      </div>

      {dailyPicks.length > 0 ? (
        <div
          className={`mt-7 grid gap-4 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-5 ${
            ready ? "opacity-100" : "opacity-70"
          }`}
        >
          <SummaryTile
            label="Cleaner setups"
            value={summary.highQualityCount}
            description="Picks scoring 75+ out of 100."
            tone="positive"
          />
          <SummaryTile
            label="Watchlist"
            value={summary.watchlistCount}
            description="Ideas that need disciplined entries."
            tone="neutral"
          />
          <SummaryTile
            label="Lower risk"
            value={summary.lowerRiskCount}
            description="Picks with risk scores below 45."
            tone="positive"
          />
          <SummaryTile
            label="Avg upside"
            value={`+${summary.avgGain.toFixed(1)}%`}
            description="Average upside to target."
            tone="positive"
          />
          <SummaryTile
            label="Avg downside"
            value={`-${summary.avgLoss.toFixed(1)}%`}
            description="Average planned downside."
            tone="risk"
          />
        </div>
      ) : null}

      <div className="mt-7">
        <ScoreGuide />
      </div>
    </>
  );
}
