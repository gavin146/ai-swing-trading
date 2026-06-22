"use client";

import { useEffect, useMemo, useState } from "react";
import { OpportunityCard } from "@/components/OpportunityCard";
import {
  getCurrentCustomer,
  getCustomerDailyPickLimit,
  type CustomerProfile,
} from "@/lib/customer-store";
import type { Opportunity } from "@/lib/opportunities";
import { getStoredOpportunities } from "@/lib/opportunity-store";

type DashboardOpportunitiesProps = {
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

export function DashboardOpportunities({
  initialOpportunities,
}: DashboardOpportunitiesProps) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    const refresh = () => {
      setOpportunities(getStoredOpportunities());
      setCustomer(getCurrentCustomer());
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
  }, []);

  const dailyPicks = useMemo(() => {
    if (!customer) {
      return opportunities;
    }

    const filtered = opportunities.filter((opportunity) => {
      return (
        opportunity.confidenceScore >= customer.minimumConfidence &&
        opportunity.riskScore <= customer.maxRiskScore
      );
    });
    const limit = getCustomerDailyPickLimit(customer);

    return (filtered.length > 0 ? filtered : opportunities).slice(0, limit);
  }, [customer, opportunities]);

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
      <div className="mt-6 rounded-xl border border-line bg-panel p-5 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-bold text-ink">
              {customer ? `${customer.fullName || customer.email}'s picks today` : "Daily picks"}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink/60">
              Showing {dailyPicks.length} profile-matched picks from {opportunities.length}
              {" "}agent-ranked opportunities.
            </p>
          </div>
          <div className="rounded-lg bg-surface px-3 py-2 text-sm font-bold text-ink/70">
            Min confidence {customer?.minimumConfidence ?? 0} / Max risk{" "}
            {customer?.maxRiskScore ?? 100}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-line bg-panel p-4 shadow-[0_10px_30px_rgba(7,20,24,0.05)]">
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
        <div className="rounded-xl border border-line bg-panel p-4 shadow-[0_10px_30px_rgba(7,20,24,0.05)]">
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
        <div className="rounded-xl border border-line bg-panel p-4 shadow-[0_10px_30px_rgba(7,20,24,0.05)]">
          <p className="text-xs font-black uppercase tracking-normal text-ink/55">
            Lower-risk ideas
          </p>
          <p className="mt-2 text-3xl font-black text-pine">{summary.lowerRiskCount}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">
            Picks with risk scores below 45.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 shadow-[0_10px_30px_rgba(7,20,24,0.05)]">
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
        <div className="rounded-xl border border-line bg-panel p-4 shadow-[0_10px_30px_rgba(7,20,24,0.05)]">
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

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {dailyPicks.map((opportunity, index) => (
          <OpportunityCard
            key={opportunity.symbol}
            opportunity={opportunity}
            rank={index + 1}
          />
        ))}
      </div>
    </>
  );
}
