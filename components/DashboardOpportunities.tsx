"use client";

import { useEffect, useMemo, useState } from "react";
import { OpportunityCard } from "@/components/OpportunityCard";
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
    window.addEventListener("tradepilot-opportunities-updated", refresh);
    window.addEventListener("tradepilot-customer-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("tradepilot-opportunities-updated", refresh);
      window.removeEventListener("tradepilot-customer-updated", refresh);
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
      <div className="motion-card mt-6 rounded-xl border border-line bg-panel p-5 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-bold text-ink">
              {customer ? `${customer.fullName || customer.email}'s picks today` : "Daily picks"}
            </p>
          <p className="mt-1 text-sm leading-6 text-ink/60">
              {customer
                ? `Showing ${dailyPicks.length} personalized picks from ${opportunities.length} agent-ranked opportunities. ${personalized.directMatchCount} directly match your confidence and risk settings${
                    personalized.closestFitCount > 0
                      ? "; the rest are the closest high-quality fits so your list stays useful."
                      : "."
                  }`
                : `Showing ${dailyPicks.length} agent-ranked opportunities.`}
          </p>
          {dataSource === "empty" ? (
            <p className="mt-2 rounded-md bg-coral/15 px-3 py-2 text-sm font-bold text-ink/70">
              No live picks are available yet{fallbackReason ? `: ${fallbackReason}` : "."}
            </p>
          ) : dataSource === "agent-preview" ? (
            <p className="mt-2 rounded-md bg-sky px-3 py-2 text-sm font-bold text-ink/70">
              Live agent preview is showing because saved Supabase picks are not active yet.
              {fallbackReason ? ` ${fallbackReason}` : ""}
            </p>
          ) : (
            <p className="mt-2 rounded-md bg-mint px-3 py-2 text-sm font-bold text-pine">
              Live Supabase data is active. These picks are loaded from persisted agent results.
            </p>
          )}
        </div>
          <div className="rounded-lg bg-surface px-3 py-2 text-sm font-bold text-ink/70">
            Min confidence {customer?.minimumConfidence ?? 0} / Max risk{" "}
            {customer?.maxRiskScore ?? 100}
          </div>
        </div>
      </div>

      {dailyPicks.length > 0 ? (
        <div
          className={`mt-5 grid gap-3 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-5 ${
            ready ? "opacity-100" : "opacity-70"
          }`}
        >
          <div className="motion-card rounded-xl border border-line bg-panel p-4 shadow-[0_10px_30px_rgba(7,20,24,0.05)] [animation-delay:40ms]">
            <p className="text-xs font-black uppercase tracking-normal text-ink/55">
              List strength
            </p>
            <p className={`mt-2 text-3xl font-black ${summary.strength.tone}`}>
              {summary.strength.label}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">
              {summary.strength.description}
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-normal text-ink/45">
              Avg score {summary.avgOpportunity}/100
            </p>
          </div>
          <div className="motion-card rounded-xl border border-line bg-panel p-4 shadow-[0_10px_30px_rgba(7,20,24,0.05)] [animation-delay:80ms]">
            <p className="text-xs font-black uppercase tracking-normal text-ink/55">
              Cleaner setups
            </p>
            <p className="mt-2 text-3xl font-black text-pine">{summary.highQualityCount}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">
              Picks scoring 75+ out of 100.
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-normal text-ink/45">
              {summary.watchlistCount} watchlist-quality ideas
            </p>
          </div>
          <div className="motion-card rounded-xl border border-line bg-panel p-4 shadow-[0_10px_30px_rgba(7,20,24,0.05)] [animation-delay:120ms]">
            <p className="text-xs font-black uppercase tracking-normal text-ink/55">
              Lower-risk ideas
            </p>
            <p className="mt-2 text-3xl font-black text-pine">{summary.lowerRiskCount}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">
              Picks with risk scores below 45.
            </p>
          </div>
          <div className="motion-card rounded-xl border border-line bg-panel p-4 shadow-[0_10px_30px_rgba(7,20,24,0.05)] [animation-delay:160ms]">
            <p className="text-xs font-black uppercase tracking-normal text-ink/55">
              Avg upside
            </p>
            <p className="mt-2 text-3xl font-black text-pine">
              +{summary.avgGain.toFixed(1)}%
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">
              Average upside to target.
            </p>
          </div>
          <div className="motion-card rounded-xl border border-line bg-panel p-4 shadow-[0_10px_30px_rgba(7,20,24,0.05)] [animation-delay:200ms]">
            <p className="text-xs font-black uppercase tracking-normal text-ink/55">
              Avg downside
            </p>
            <p className="mt-2 text-3xl font-black text-coral">
              -{summary.avgLoss.toFixed(1)}%
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">
              Average planned downside to stop.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
          <div className="rounded-xl border border-line bg-panel p-6 shadow-soft md:col-span-2 xl:col-span-3">
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
    </>
  );
}
