"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrokerageLaunchPanel } from "@/components/BrokerageLaunchPanel";
import { MetricPill } from "@/components/MetricPill";
import { ScoreMeter } from "@/components/ScoreMeter";
import { TradeStatGrid } from "@/components/TradeStatGrid";
import {
  getAccessState,
  getCurrentCustomer,
  getCustomerPlanLabel,
  restoreAuthenticatedCustomerSession,
  type CustomerProfile,
} from "@/lib/customer-store";
import { loginHref, signupHref } from "@/lib/customer-flow";
import { getPersonalizedDailyPicks } from "@/lib/customer-picks";
import type { OpportunityRow } from "@/lib/database.types";
import { opportunityFromRow, type Opportunity } from "@/lib/opportunities";
import type { OpportunityDataSource } from "@/lib/repositories/opportunities";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getCoachVerdict } from "@/lib/trade-guidance";

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

function needsResearchSessionReconnect(reason?: string) {
  const lower = reason?.toLowerCase() ?? "";

  return (
    lower.includes("valid swingfi login session") ||
    lower.includes("login session") ||
    lower.includes("sign in to start") ||
    lower.includes("session could not be verified")
  );
}

function OpportunitySessionReconnect({ symbol }: { symbol: string }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
      <div className="grid lg:grid-cols-[1fr_340px]">
        <div className="p-6 sm:p-8">
          <Link
            href="/dashboard"
            className="inline-flex rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink hover:border-pine hover:shadow-soft"
          >
            Back to dashboard
          </Link>
          <p className="mt-6 text-xs font-black uppercase tracking-normal text-pine">
            Secure research session
          </p>
          <h2 className="mt-3 text-3xl font-black text-ink">
            Log in again to open {symbol.toUpperCase()}
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-ink/65">
            Your local SwingFi profile is still saved, but the full stock analysis
            requires a verified account session before we can show protected research,
            saved picks, targets, stops, and explanations.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/login?next=${encodeURIComponent(`/opportunities/${symbol.toUpperCase()}`)}`}
              className="rounded-2xl bg-ink px-5 py-3 text-center text-sm font-black text-white hover:bg-pine"
            >
              Log in again
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-ink hover:border-pine"
            >
              Review dashboard
            </Link>
          </div>
        </div>
        <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white lg:border-l lg:border-t-0">
          <p className="text-xs font-black uppercase tracking-normal text-lime">
            Protected analysis
          </p>
          <p className="mt-4 text-5xl font-black">{symbol.toUpperCase()}</p>
          <p className="mt-3 text-sm font-semibold leading-7 text-white/62">
            Re-authentication keeps your saved research, portfolio notes, and
            daily-pick access private.
          </p>
        </div>
      </div>
    </section>
  );
}

function percentNumber(value: string) {
  return Number(value.replace("+", "").replace("%", "")) || 0;
}

function getRewardRisk(opportunity: Opportunity) {
  const gain = percentNumber(opportunity.potentialGain);
  const loss = Math.abs(percentNumber(opportunity.potentialLoss));

  return loss > 0 ? gain / loss : gain;
}

function portfolioHref(opportunity: Opportunity) {
  const params = new URLSearchParams({
    assetType: opportunity.assetType === "ETF" ? "etf" : opportunity.assetType === "Crypto" ? "crypto" : "stock",
    entryHigh: String(opportunity.entryHigh),
    entryLow: String(opportunity.entryLow),
    holdingPeriodDays: String(opportunity.holdingPeriodDays),
    opportunityId: opportunity.id,
    stopLoss: String(opportunity.stopLossValue),
    symbol: opportunity.symbol,
    targetPrice: String(opportunity.targetPriceValue),
  });

  return `/portfolio?${params.toString()}`;
}

async function getCustomerAuthHeaders() {
  const supabase = createSupabaseBrowserClient();
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;

  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function checklistTone(status: "pass" | "review" | "caution") {
  if (status === "pass") return "border-pine/20 bg-mint text-pine";
  if (status === "caution") return "border-coral/25 bg-coral/10 text-coral";
  return "border-amber/30 bg-amber/12 text-ink";
}

function coachToneClasses(tone: "positive" | "neutral" | "caution") {
  if (tone === "positive") return "border-pine/15 bg-mint text-pine";
  if (tone === "caution") return "border-coral/20 bg-coral/10 text-coral";
  return "border-amber/30 bg-amber/15 text-ink";
}

function DecisionChecklist({
  customer,
  opportunity,
}: {
  customer: CustomerProfile | null;
  opportunity: Opportunity;
}) {
  const rewardRisk = getRewardRisk(opportunity);
  const confidenceFits = customer
    ? opportunity.confidenceScore >= customer.minimumConfidence
    : opportunity.confidenceScore >= 70;
  const riskFits = customer
    ? opportunity.riskScore <= customer.maxRiskScore
    : opportunity.riskScore <= 65;
  const rewardFits = rewardRisk >= 2;
  const profileLabel = customer
    ? `${customer.riskProfile} profile, ${customer.minimumConfidence}+ confidence, ${customer.maxRiskScore}/100 max risk`
    : "Default balanced beginner profile";
  const items = [
    {
      body: confidenceFits
        ? "The data support is at or above your preferred confidence threshold."
        : "The confidence score is below your preference, so treat this as a watchlist idea until signals improve.",
      label: "Confidence fit",
      status: confidenceFits ? "pass" : "review",
      value: `${opportunity.confidenceScore}/100`,
    },
    {
      body: riskFits
        ? "The risk score fits your current comfort range."
        : "This is riskier than your preference. Reduce position size or skip it if the stop feels uncomfortable.",
      label: "Risk fit",
      status: riskFits ? "pass" : "caution",
      value: `${opportunity.riskScore}/100`,
    },
    {
      body: rewardFits
        ? "The planned upside is at least twice the planned downside."
        : "Reward versus risk is tighter, so entry discipline matters more.",
      label: "Reward/risk",
      status: rewardFits ? "pass" : "review",
      value: `${rewardRisk.toFixed(1)}R`,
    },
    {
      body: "Only review the setup if price is near the entry range. Chasing above the planned range changes the trade math.",
      label: "Entry discipline",
      status: "review",
      value: opportunity.entryRange,
    },
  ] satisfies Array<{
    body: string;
    label: string;
    status: "pass" | "review" | "caution";
    value: string;
  }>;

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Decision checklist
          </p>
          <h2 className="mt-2 text-2xl font-black text-ink">
            Does this fit your plan?
          </h2>
        </div>
        <p className="max-w-sm text-sm font-bold leading-6 text-ink/54 sm:text-right">
          {profileLabel}
        </p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`rounded-2xl border p-4 ${checklistTone(item.status)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-normal opacity-70">
                {item.label}
              </p>
              <p className="text-sm font-black">{item.value}</p>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-ink/64">
              {item.body}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-xs font-semibold leading-5 text-ink/56">
        Use this as a research checklist. SwingFi does not place trades, manage
        brokerage accounts, or guarantee returns.
      </p>
    </section>
  );
}

function ModelReadinessPanel({ opportunity }: { opportunity: Opportunity }) {
  const toneClasses = {
    caution: "border-coral/25 bg-coral/10 text-coral",
    neutral: "border-amber/30 bg-amber/12 text-ink",
    positive: "border-pine/20 bg-mint text-pine",
  };
  const groups = [
    {
      items: opportunity.analysisProfile.keyStrengths,
      label: "Why it made the list",
    },
    {
      items: opportunity.analysisProfile.watchouts,
      label: "What to watch",
    },
    {
      items: opportunity.analysisProfile.invalidationSignals,
      label: "Setup is weaker if",
    },
    {
      items: opportunity.analysisProfile.followUpChecks,
      label: "Before acting",
    },
  ];

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Model readiness
          </p>
          <h2 className="mt-2 text-2xl font-black text-ink">
            What would make this prediction useful or wrong?
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-ink/60">
            This turns the score into a checklist. A high rank is not a trade signal by
            itself; it is a structured reason to review the setup.
          </p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 ${toneClasses[opportunity.analysisProfile.readinessTone]}`}>
          <p className="text-xs font-black uppercase tracking-normal opacity-70">
            Readiness
          </p>
          <p className="mt-1 text-2xl font-black">
            {opportunity.analysisProfile.readinessScore}/100
          </p>
          <p className="mt-1 text-xs font-bold">{opportunity.analysisProfile.readinessLabel}</p>
        </div>
      </div>
      <p className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold leading-6 text-ink/62">
        Reward/risk: {opportunity.analysisProfile.rewardRiskLabel}.{" "}
        {opportunity.analysisProfile.summary}
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              {group.label}
            </p>
            <ul className="mt-3 grid gap-2">
              {group.items.map((item) => (
                <li key={item} className="text-sm font-semibold leading-6 text-ink/64">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function DataFreshnessScoreboard({ opportunity }: { opportunity: Opportunity }) {
  const freshnessItems = [
    ["Price", opportunity.dataFreshness.priceFreshness],
    ["News", opportunity.dataFreshness.newsFreshness],
    ["Filings", opportunity.dataFreshness.filingFreshness],
    ["Earnings", opportunity.dataFreshness.earningsRisk],
    ["Macro", opportunity.dataFreshness.macroFreshness],
    ["Calibration", opportunity.dataFreshness.calibration],
  ];
  const statusTone =
    opportunity.dataFreshness.status === "fresh"
      ? "border-pine/20 bg-mint text-pine"
      : opportunity.dataFreshness.status === "aging"
        ? "border-amber/30 bg-amber/12 text-ink"
        : "border-coral/25 bg-coral/10 text-coral";

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Data freshness
          </p>
          <h2 className="mt-2 text-2xl font-black text-ink">
            What data should be rechecked?
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">
            Freshness is based on the saved ranking run. Recheck live price, news,
            and filings before acting.
          </p>
        </div>
        <span className={`w-fit rounded-full border px-4 py-2 text-sm font-black capitalize ${statusTone}`}>
          {opportunity.dataFreshness.status}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {freshnessItems.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              {label}
            </p>
            <p className="mt-2 text-sm font-black leading-6 text-ink">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OpportunityDetailView({
  dataSource,
  fallbackReason,
  initialOpportunity,
  symbol,
}: OpportunityDetailViewProps) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [opportunity, setOpportunity] = useState<Opportunity | undefined>(initialOpportunity);
  const [currentDataSource, setCurrentDataSource] = useState<OpportunityDataSource>(dataSource);
  const [currentFallbackReason, setCurrentFallbackReason] = useState(fallbackReason);
  const [loadingOpportunity, setLoadingOpportunity] = useState(false);
  const [planLimitExceeded, setPlanLimitExceeded] = useState(false);
  const message = statusMessage(currentDataSource, currentFallbackReason);

  useEffect(() => {
    let active = true;

    restoreAuthenticatedCustomerSession()
      .then((restored) => {
        if (!active) return;
        setCustomer(restored);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setCustomer(getCurrentCustomer());
        setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const access = getAccessState(customer);
  const opportunityPath = `/opportunities/${symbol.toUpperCase()}`;

  useEffect(() => {
    if (!ready || !access.canViewAnalysis) return;

    let active = true;

    async function loadOpportunity() {
      setLoadingOpportunity(true);
      setPlanLimitExceeded(false);

      try {
        const authHeaders = await getCustomerAuthHeaders();

        if (!authHeaders && !access.isAdmin) {
          setOpportunity(undefined);
          setCurrentDataSource("empty");
          setCurrentFallbackReason("A valid SwingFi login session is required.");
          return;
        }

        const response = await fetch(`/api/opportunities/${encodeURIComponent(symbol)}`, {
          cache: "no-store",
          headers: authHeaders,
        });
        const payload = (await response.json().catch(() => null)) as {
          reason?: string;
          rows?: OpportunityRow[];
          source?: OpportunityDataSource;
        } | null;

        if (!active) return;

        if (!response.ok || !payload?.rows?.[0]) {
          setOpportunity(undefined);
          setCurrentDataSource("empty");
          setCurrentFallbackReason(payload?.reason ?? "Analysis could not be loaded.");
          return;
        }

        const loadedOpportunity = opportunityFromRow(payload.rows[0]);

        if (customer && !access.isAdmin) {
          const planResponse = await fetch("/api/opportunities", {
            cache: "no-store",
            headers: authHeaders,
          });
          const planPayload = (await planResponse.json().catch(() => null)) as {
            rows?: OpportunityRow[];
          } | null;

          if (!active) return;

          const dailyPicks = getPersonalizedDailyPicks(
            customer,
            (planPayload?.rows ?? []).map(opportunityFromRow),
          ).dailyPicks;
          const allowed = dailyPicks.some(
            (item) => item.symbol.toUpperCase() === loadedOpportunity.symbol.toUpperCase(),
          );

          if (!allowed) {
            setOpportunity(loadedOpportunity);
            setPlanLimitExceeded(true);
            setCurrentDataSource(payload.source ?? "supabase");
            setCurrentFallbackReason(payload.reason);
            return;
          }
        }

        setOpportunity(loadedOpportunity);
        setCurrentDataSource(payload.source ?? "supabase");
        setCurrentFallbackReason(payload.reason);
      } catch {
        if (!active) return;
        setOpportunity(undefined);
        setCurrentDataSource("empty");
        setCurrentFallbackReason("Analysis could not be loaded. Please try again shortly.");
      } finally {
        if (active) setLoadingOpportunity(false);
      }
    }

    loadOpportunity();

    return () => {
      active = false;
    };
  }, [access.canViewAnalysis, access.isAdmin, customer, ready, symbol]);

  if (!ready) {
    return (
      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_24px_80px_rgba(7,20,24,0.08)] sm:p-8">
        <div className="skeleton h-4 w-36 rounded-full" />
        <div className="skeleton mt-5 h-12 max-w-md rounded-2xl" />
        <div className="skeleton mt-5 h-40 rounded-3xl" />
      </section>
    );
  }

  if (ready && !access.canViewAnalysis) {
    const needsEmailVerification = Boolean(customer && !access.isEmailVerified);
    return (
      <section className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
        <div className="grid lg:grid-cols-[1fr_340px]">
          <div className="p-6 sm:p-8">
            <Link
              href="/dashboard"
              className="inline-flex rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink hover:border-pine hover:shadow-soft"
            >
              Back to dashboard
            </Link>
            <p className="mt-6 text-xs font-black uppercase tracking-normal text-pine">
              Analysis access
            </p>
            <h2 className="mt-3 text-3xl font-black text-ink">
              {needsEmailVerification
                ? "Confirm your email to unlock this stock analysis"
                : customer
                  ? "Subscribe to unlock this stock analysis"
                  : "Start your free month to unlock analysis"}
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-ink/65">
              {needsEmailVerification
                ? "Open the branded SwingFi confirmation email, then return here to review the full trade plan."
                : "SwingFi opportunity details are available with an active 30-day free trial, active subscription, or admin access."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={
	                  needsEmailVerification
	                    ? `/verify-email?sent=1&email=${encodeURIComponent(customer?.email ?? "")}&next=${encodeURIComponent(opportunityPath)}`
	                    : customer
	                      ? "/pricing"
	                      : signupHref({ nextPath: opportunityPath })
                }
                className="rounded-2xl bg-ink px-5 py-3 text-center text-sm font-black text-white hover:bg-pine"
              >
                {needsEmailVerification
                  ? "Confirm email"
                  : customer
                    ? "View subscription options"
                    : "Start free month"}
              </Link>
              <Link
                href={customer ? "/settings" : loginHref(opportunityPath)}
                className="rounded-2xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-ink hover:border-pine"
              >
                {customer ? "Account settings" : "Log in"}
              </Link>
            </div>
          </div>
          <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white lg:border-l lg:border-t-0">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Locked preview
            </p>
            <p className="mt-4 text-5xl font-black">{symbol.toUpperCase()}</p>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/62">
              Unlock the full trade plan, explanation, risk score, target, stop loss,
              and swing-trade time frame.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (ready && planLimitExceeded) {
    const planLabel = getCustomerPlanLabel(customer);

    return (
      <section className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
        <div className="grid lg:grid-cols-[1fr_340px]">
          <div className="p-6 sm:p-8">
            <Link
              href="/dashboard"
              className="inline-flex rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink hover:border-pine hover:shadow-soft"
            >
              Back to today&apos;s picks
            </Link>
            <p className="mt-6 text-xs font-black uppercase tracking-normal text-pine">
              Plan access
            </p>
            <h2 className="mt-3 text-3xl font-black text-ink">
              This analysis is outside your current daily view
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-ink/65">
              Your {planLabel.toLowerCase()} shows the ranked opportunities included in
              your daily plan. Upgrade to review a wider scan, or return to your dashboard
              to focus on the picks already matched to your risk and confidence settings.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/pricing"
                className="rounded-2xl bg-ink px-5 py-3 text-center text-sm font-black text-white hover:bg-pine"
              >
                Compare plans
              </Link>
              <Link
                href="/dashboard"
                className="rounded-2xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-ink hover:border-pine"
              >
                Review my picks
              </Link>
            </div>
          </div>
          <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white lg:border-l lg:border-t-0">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Current plan
            </p>
            <p className="mt-4 text-4xl font-black">{planLabel}</p>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/62">
              Plan limits keep the dashboard calmer for beginners while still preserving
              upgrade paths for users who want a wider scan.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (loadingOpportunity) {
    return (
      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_24px_80px_rgba(7,20,24,0.08)] sm:p-8">
        <div className="skeleton h-4 w-36 rounded-full" />
        <div className="skeleton mt-5 h-12 max-w-md rounded-2xl" />
        <div className="skeleton mt-5 h-40 rounded-3xl" />
      </section>
    );
  }

  if (!opportunity && needsResearchSessionReconnect(currentFallbackReason)) {
    return <OpportunitySessionReconnect symbol={symbol} />;
  }

  if (!opportunity) {
    return (
      <section className="rounded-3xl border border-line bg-white p-6 shadow-soft">
        <Link
          href="/dashboard"
          className="inline-flex rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink hover:border-pine hover:shadow-soft"
        >
          Back to dashboard
        </Link>
        <h2 className="mt-6 text-3xl font-black text-ink">Opportunity not found</h2>
        <p className="mt-3 leading-7 text-ink/65">
          No saved opportunity is available for {symbol.toUpperCase()}.
          {currentFallbackReason ? ` ${currentFallbackReason}` : ""}
        </p>
      </section>
    );
  }

  const coach = getCoachVerdict(opportunity);
  const trackTradeHref = portfolioHref(opportunity);

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
              <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${coachToneClasses(coach.badgeTone)}`}>
                {coach.actionLabel}
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink/55 ring-1 ring-line">
                {opportunity.timeHorizon}
              </span>
              <span className="rounded-full bg-sky px-3 py-1 text-xs font-bold text-ink/60 ring-1 ring-line">
                {opportunity.sector}
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink/55 ring-1 ring-line">
                {opportunity.setupPattern}
              </span>
            </div>
            <h2 className="mt-5 text-5xl font-black tracking-normal text-ink">
              {opportunity.symbol}
            </h2>
            <p className="mt-2 text-base font-semibold text-ink/58">{opportunity.name}</p>
            <div className={`mt-5 rounded-3xl border p-4 sm:p-5 ${coachToneClasses(coach.badgeTone)}`}>
              <p className="text-xs font-black uppercase tracking-normal opacity-70">
                SwingFi research verdict
              </p>
              <h3 className="mt-2 text-2xl font-black leading-tight text-ink">
                {coach.actionText}
              </h3>
              <p className="mt-3 text-sm font-bold leading-6 text-ink/72">
                {coach.directionText}
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                  Expected direction
                </p>
                <p className="mt-2 text-base font-black text-ink">
                  {coach.direction}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/58">
                  {coach.reason}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                  Gain vs risk
                </p>
                <p className="mt-2 text-base font-black text-ink">
                  {opportunity.potentialGain} / {opportunity.potentialLoss}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/58">
                  {coach.riskText}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                  Price forecast
                </p>
                <p className="mt-2 text-base font-black text-ink">
                  {coach.forecastRange}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/58">
                  {coach.guardrail}
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white lg:border-l lg:border-t-0">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Coach summary
            </p>
            <p className="mt-4 text-3xl font-black leading-tight text-lime">
              {coach.oneLine}
            </p>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/68">
              {coach.percentageText} {coach.confidenceText}. Research only; you make the final trade decision.
            </p>
            <div className="mt-5 rounded-2xl border border-white/14 bg-white/8 p-4">
              <p className="text-xs font-black uppercase tracking-normal text-white/48">
                Opportunity score
              </p>
              <p className="mt-2 text-4xl font-black text-white">
                {opportunity.opportunityScore}
                <span className="text-base text-white/42">/100</span>
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/58">
                Score is still shown for comparison, but the verdict above is the beginner-first read.
              </p>
            </div>
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
              <MetricPill label="Entry window" value={opportunity.estimatedBuyWindow} />
              <MetricPill label="Estimated sell window" value={opportunity.estimatedSellWindow} tone="caution" />
            </div>
          </section>

          <DecisionChecklist customer={customer} opportunity={opportunity} />

          <ModelReadinessPanel opportunity={opportunity} />

          <DataFreshnessScoreboard opportunity={opportunity} />

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

          <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              Took this trade?
            </p>
            <h2 className="mt-2 text-xl font-black text-ink">Save it to your Swing Portfolio</h2>
            <p className="mt-3 text-sm font-medium leading-7 text-ink/64">
              If you decide to buy, save the entry price and rough time so this plan stays
              visible after the next ranking refresh.
            </p>
            <Link
              href={trackTradeHref}
              className="mt-4 inline-flex w-full justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(7,20,24,0.18)] hover:bg-pine"
            >
              Add to Swing Portfolio
            </Link>
          </section>

          <BrokerageLaunchPanel
            opportunity={opportunity}
            preferredBrokerage={customer?.preferredBrokerage}
          />
        </aside>
      </div>
    </section>
  );
}
