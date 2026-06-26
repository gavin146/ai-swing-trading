"use client";

import Link from "next/link";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { OpportunityCard } from "@/components/OpportunityCard";
import { ScoreGuide } from "@/components/ScoreGuide";
import { SummaryTile } from "@/components/SummaryTile";
import {
  getAccessState,
  getCurrentCustomer,
  getCustomerDailyPickLimit,
  restoreAuthenticatedCustomerSession,
  type CustomerProfile,
} from "@/lib/customer-store";
import { opportunityFromRow, type Opportunity } from "@/lib/opportunities";
import type { OpportunityRow } from "@/lib/database.types";
import type {
  OpportunityDataSource,
  OpportunityTrustPanel,
  OpportunityTrustStatus,
} from "@/lib/repositories/opportunities";

type DashboardOpportunitiesProps = {
  dataSource: OpportunityDataSource;
  fallbackReason?: string;
  initialOpportunities: Opportunity[];
};

type DashboardView = "top" | "watchlist" | "higher-risk";

type DashboardOpportunitiesPayload = {
  reason?: string;
  rows?: OpportunityRow[];
  source?: OpportunityDataSource;
  trust?: OpportunityTrustPanel | null;
};

const dashboardActionStorageKey = "swingfi-dashboard-actions";
const dashboardOpportunityCacheKey = "swingfi-dashboard-opportunities-cache-v1";
const walkthroughStorageKey = "swingfi-first-login-walkthrough-v1";
const dashboardOpportunityCacheTtlMs = 60 * 1000;
let dashboardOpportunitiesRequest: Promise<DashboardOpportunitiesPayload | null> | null = null;

function readDashboardOpportunityCache() {
  try {
    const stored = window.sessionStorage.getItem(dashboardOpportunityCacheKey);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as {
      expiresAt?: number;
      payload?: DashboardOpportunitiesPayload;
    };

    if (!parsed.expiresAt || parsed.expiresAt <= Date.now() || !parsed.payload?.rows?.length) {
      window.sessionStorage.removeItem(dashboardOpportunityCacheKey);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(dashboardOpportunityCacheKey);
    return null;
  }
}

function writeDashboardOpportunityCache(payload: DashboardOpportunitiesPayload) {
  if (!payload.rows?.length) return;

  try {
    window.sessionStorage.setItem(
      dashboardOpportunityCacheKey,
      JSON.stringify({
        expiresAt: Date.now() + dashboardOpportunityCacheTtlMs,
        payload,
      }),
    );
  } catch {
    window.sessionStorage.removeItem(dashboardOpportunityCacheKey);
  }
}

async function fetchDashboardOpportunities() {
  if (!dashboardOpportunitiesRequest) {
    dashboardOpportunitiesRequest = fetch("/api/opportunities", {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | DashboardOpportunitiesPayload
          | null;

        if (!response.ok) {
          return {
            reason: payload?.reason ?? "Rankings could not be loaded.",
            source: "empty" as OpportunityDataSource,
          };
        }

        return payload;
      })
      .finally(() => {
        dashboardOpportunitiesRequest = null;
      });
  }

  return dashboardOpportunitiesRequest;
}

function applyDashboardPayload(
  payload: DashboardOpportunitiesPayload | null,
  setters: {
    setCurrentDataSource: Dispatch<SetStateAction<OpportunityDataSource>>;
    setCurrentFallbackReason: Dispatch<SetStateAction<string | undefined>>;
    setCurrentTrust: Dispatch<SetStateAction<OpportunityTrustPanel | null>>;
    setOpportunities: Dispatch<SetStateAction<Opportunity[]>>;
  },
) {
  if (!payload?.rows) {
    setters.setOpportunities([]);
    setters.setCurrentDataSource("empty");
    setters.setCurrentFallbackReason(payload?.reason ?? "Rankings could not be loaded.");
    return;
  }

  setters.setOpportunities(payload.rows.map(opportunityFromRow));
  setters.setCurrentDataSource(payload.source ?? "supabase");
  setters.setCurrentFallbackReason(payload.reason);
  setters.setCurrentTrust(payload.trust ?? null);
}

function AccessGate({
  customer,
}: {
  customer: CustomerProfile | null;
}) {
  const access = getAccessState(customer);
  const needsEmailVerification = Boolean(customer && !access.isEmailVerified);
  const title = needsEmailVerification
    ? "Confirm your email to unlock analysis"
    : customer
      ? "Your free trial has ended"
      : "Start your free month";
  const body = needsEmailVerification
    ? "SwingFi sent a branded confirmation email when you created your account. Confirm your email to unlock today’s ranked opportunities, trade plans, and morning research links."
    : customer
      ? "SwingFi stock analysis is available during an active trial or subscription. Your saved profile is still here, but live rankings are locked until billing is active."
      : "Create an account to start a 30-day free trial and unlock today’s ranked opportunities, trade plans, score explanations, and morning email links.";
  const primaryHref = needsEmailVerification
    ? `/verify-email?sent=1&email=${encodeURIComponent(customer?.email ?? "")}`
    : customer
      ? "/pricing"
      : "/signup";
  const primaryLabel = needsEmailVerification
    ? "Confirm email"
    : customer
      ? "View subscription options"
      : "Start free month";

  return (
    <section className="motion-card overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
      <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
        <div className="p-6 sm:p-8">
          <div className="signal-line mb-6 h-1.5 max-w-56 rounded-full" />
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Analysis access
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-normal text-ink sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-ink/62">
            {body}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={primaryHref}
              className="rounded-2xl bg-ink px-5 py-3 text-center text-sm font-black text-white shadow-[0_18px_42px_rgba(7,20,24,0.18)] hover:bg-pine"
            >
              {primaryLabel}
            </Link>
            <Link
              href={customer ? "/settings" : "/login"}
              className="rounded-2xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-ink hover:border-pine"
            >
              {customer ? "Review account" : "Log in"}
            </Link>
          </div>
        </div>
        <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white lg:border-l lg:border-t-0">
          <p className="text-xs font-black uppercase tracking-normal text-lime">
            Included in trial
          </p>
          <div className="mt-5 grid gap-3">
            {[
              "Daily ranked swing-trade opportunities",
              "Entry, target, stop loss, and estimated time frame",
              "Plain-English score and risk explanations",
              "Morning email links to today’s analysis",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/14 bg-white/8 p-3 text-sm font-bold text-white/76">
                {item}
              </div>
            ))}
          </div>
          {customer ? (
            <p className="mt-5 text-xs font-semibold leading-5 text-white/48">
              Trial status: {access.trialEndsAt ? `ended ${new Date(access.trialEndsAt).toLocaleDateString()}` : "not available"}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

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

function ActionItem({
  body,
  label,
  title,
  tone = "neutral",
}: {
  body: string;
  label: string;
  title: string;
  tone?: "positive" | "neutral" | "risk";
}) {
  const classes = {
    neutral: "border-line/80 bg-white",
    positive: "border-pine/20 bg-mint",
    risk: "border-coral/25 bg-coral/10",
  };

  return (
    <div className={`rounded-2xl border p-3 ${classes[tone]}`}>
      <p className="text-xs font-black uppercase tracking-normal text-ink/45">{label}</p>
      <h3 className="mt-1 text-base font-black text-ink">{title}</h3>
      <p className="mt-1 text-xs font-semibold leading-5 text-ink/62">{body}</p>
    </div>
  );
}

function getRiskReward(opportunity: Opportunity) {
  const gain = percentNumber(opportunity.potentialGain);
  const loss = Math.abs(percentNumber(opportunity.potentialLoss));

  return loss > 0 ? gain / loss : gain;
}

function TodayActionPlan({
  customer,
  dailyPicks,
}: {
  customer: CustomerProfile | null;
  dailyPicks: Opportunity[];
}) {
  if (dailyPicks.length === 0) return null;

  const reviewFirst = dailyPicks
    .filter((item) => item.opportunityScore >= 70 && item.confidenceScore >= (customer?.minimumConfidence ?? 70))
    .slice(0, 3);
  const highestRisk = [...dailyPicks].sort((a, b) => b.riskScore - a.riskScore)[0];
  const bestRiskReward = [...dailyPicks].sort((a, b) => getRiskReward(b) - getRiskReward(a))[0];
  const calmest = [...dailyPicks].sort((a, b) => a.riskScore - b.riskScore)[0];
  const firstSymbols = (reviewFirst.length ? reviewFirst : dailyPicks.slice(0, 3))
    .map((item) => item.symbol)
    .join(", ");

  return (
    <section className="mt-4 overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_18px_54px_rgba(7,20,24,0.065)]">
      <div className="grid gap-0 2xl:grid-cols-[300px_1fr]">
        <div className="bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-4 text-white sm:p-5">
          <p className="text-xs font-black uppercase tracking-normal text-lime">
            Today&apos;s action plan
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-normal">
            Start here
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/68">
            A quick review order before you open the cards.
          </p>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-4">
          <ActionItem
            label="Review first"
            title={firstSymbols}
            body="These are the first setups to compare because they sit highest in your personalized ranked list."
            tone="positive"
          />
          <ActionItem
            label="Avoid chasing"
            title={`${dailyPicks[0]?.symbol ?? "Top pick"} entry discipline`}
            body={`Do not treat the score as permission to chase far above ${dailyPicks[0]?.entryRange ?? "the entry range"}. The plan changes if price runs away.`}
          />
          <ActionItem
            label="Highest risk"
            title={`${highestRisk.symbol} · ${highestRisk.riskScore}/100 risk`}
            body="Review this one only if the stop loss and position size still fit your comfort level."
            tone="risk"
          />
          <ActionItem
            label="Best balance"
            title={`${bestRiskReward.symbol} reward/risk`}
            body={`${calmest.symbol} is the calmer idea today; ${bestRiskReward.symbol} has one of the better upside/downside profiles.`}
          />
        </div>
      </div>
    </section>
  );
}

function trustTone(status: OpportunityTrustStatus) {
  if (status === "live") return "border-pine/20 bg-mint text-pine";
  if (status === "partial") return "border-amber/30 bg-amber/12 text-ink";
  if (status === "mock") return "border-line bg-surface text-ink/62";
  return "border-coral/25 bg-coral/10 text-coral";
}

function DataTrustPanel({
  dataSource,
  trust,
}: {
  dataSource: OpportunityDataSource;
  trust?: OpportunityTrustPanel | null;
}) {
  if (!trust) return null;

  const coverage = trust.marketCoverage;
  const coverageStatus =
    coverage.status === "healthy"
      ? "live"
      : coverage.status === "thin"
        ? "partial"
        : coverage.status === "blocked"
          ? "missing"
          : "mock";
  const scannedLabel =
    coverage.screenerCount !== null && coverage.requestedUniverseLimit !== null
      ? `${coverage.screenerCount}/${coverage.requestedUniverseLimit}`
      : coverage.detailedCandidateCount !== null
        ? `${coverage.detailedCandidateCount} detailed`
        : "Unknown";
  const deepLabel =
    coverage.detailedCandidateCount !== null && coverage.detailedCandidateTarget !== null
      ? `${coverage.detailedCandidateCount}/${coverage.detailedCandidateTarget}`
      : "Not saved";
  const statusLabel = {
    checked: "Checked",
    active: `${trust.calibrationRuleCount} active rules`,
    not_configured: "Not configured",
  }[trust.calibrationStatus];

  return (
    <section className="mt-5 rounded-3xl border border-line/80 bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)] sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Data used today
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-normal text-ink">
            Trust check for this ranking run
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/60">
            This panel shows what SwingFi used before scores reached your dashboard,
            including market data, filings, news, macro context, AI explanation support,
            and backtest calibration.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-xs font-black uppercase tracking-normal text-ink/42">
            Last run
          </p>
          <p className="mt-1 text-sm font-black text-ink">
            {trust.lastRunAt ? new Date(trust.lastRunAt).toLocaleString() : "Not available"}
          </p>
          <p className="mt-1 text-xs font-semibold text-ink/50">
            {dataSource === "supabase" ? "Saved live ranking" : "Live preview"} · {trust.runSource}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-2xl border p-4 ${trustTone(coverageStatus)}`}>
          <p className="text-xs font-black uppercase tracking-normal opacity-70">
            Market scanned
          </p>
          <p className="mt-2 text-sm font-black">{scannedLabel}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-ink/58">
            Deep analysis: {deepLabel}. Qualified setups:{" "}
            {coverage.qualifiedCandidateCount ?? "not saved"}.
          </p>
        </div>
        {trust.dataFeeds.map((feed) => (
          <div key={feed.label} className={`rounded-2xl border p-4 ${trustTone(feed.status)}`}>
            <p className="text-xs font-black uppercase tracking-normal opacity-70">
              {feed.label}
            </p>
            <p className="mt-2 text-sm font-black capitalize">{feed.status}</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-ink/58">{feed.text}</p>
          </div>
        ))}
        <div className={`rounded-2xl border p-4 ${trustTone(trust.openAiStatus)}`}>
          <p className="text-xs font-black uppercase tracking-normal opacity-70">
            OpenAI explanation
          </p>
          <p className="mt-2 text-sm font-black capitalize">{trust.openAiStatus}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-ink/58">
            {trust.openAiStatus === "live"
              ? "Available for concise plain-English explanations."
              : "Fallback explanations are used until OpenAI is configured."}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-black uppercase tracking-normal text-ink/45">
            Calibration
          </p>
          <p className="mt-2 text-sm font-black text-ink">{statusLabel}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-ink/58">
            Backtest rules are checked before scores reach the customer UI.
          </p>
        </div>
      </div>
      {coverage.warning ? (
        <p className="mt-3 rounded-2xl border border-coral/25 bg-coral/10 px-4 py-3 text-sm font-bold leading-6 text-coral">
          {coverage.warning}
        </p>
      ) : null}
    </section>
  );
}

function FirstLoginWalkthrough({ customer }: { customer: CustomerProfile | null }) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!customer) return;
    const dismissed = window.localStorage.getItem(walkthroughStorageKey);
    setVisible(!dismissed && customer.investingExperience === "beginner");
  }, [customer]);

  if (!visible) return null;

  const steps = [
    ["Score", "Review order. Higher means better overall setup quality."],
    ["Confidence", "Signal agreement. Higher means cleaner data support."],
    ["Risk", "Fragility. Lower is usually easier to manage."],
    ["Entry", "The price area to review. Avoid chasing far above it."],
    ["Target", "The upside area the plan is measuring against."],
    ["Stop", "The line that defines when the setup may be wrong."],
  ];

  return (
    <section className="mb-4 overflow-hidden rounded-3xl border border-pine/20 bg-mint shadow-[0_14px_44px_rgba(7,20,24,0.055)]">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            New to swing trading?
          </p>
          <h2 className="mt-1 text-xl font-black text-ink">Read the list in under a minute</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-ink/62">
            Start with score, then confidence, then risk. Use entry, target, and stop
            to decide whether the setup deserves deeper review.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white transition hover:bg-pine"
          >
            {expanded ? "Hide guide" : "Show guide"}
          </button>
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem(walkthroughStorageKey, "dismissed");
              setVisible(false);
            }}
            className="rounded-2xl border border-pine/20 bg-white/72 px-4 py-3 text-sm font-black text-ink transition hover:bg-white"
          >
            Got it
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="grid gap-3 border-t border-pine/15 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map(([label, text]) => (
            <div key={label} className="rounded-2xl border border-pine/10 bg-white/78 p-4">
              <p className="text-sm font-black text-pine">{label}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-ink/60">{text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DashboardAnalysisSkeleton() {
  return (
    <section
      aria-busy="true"
      className="motion-card overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]"
    >
      <div className="grid gap-0 xl:grid-cols-[1fr_320px]">
        <div className="p-5 sm:p-6">
          <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-28 rounded-full bg-ink/10" />
            <div className="h-6 w-24 rounded-full bg-mint" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-normal text-pine">
            Loading today&apos;s analysis
          </p>
          <h2 className="mt-2 max-w-2xl text-2xl font-black tracking-normal text-ink sm:text-3xl">
            Preparing your ranked list
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-ink/58">
            Pulling the saved morning run and matching it to your risk and confidence
            settings.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="skeleton h-20 rounded-2xl" />
            <div className="skeleton h-20 rounded-2xl" />
            <div className="skeleton h-20 rounded-2xl" />
          </div>
        </div>
        <div className="hidden border-l border-line bg-surface p-5 xl:block">
          <div className="skeleton h-4 w-28 rounded-full" />
          <div className="skeleton mt-5 h-12 rounded-2xl" />
          <div className="skeleton mt-4 h-28 rounded-3xl" />
        </div>
      </div>
      <div className="border-t border-line/70 bg-surface/60 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-2xl border border-line/70 bg-white p-4">
              <div className="skeleton h-4 w-20 rounded-full" />
              <div className="skeleton mt-4 h-7 w-28 rounded-xl" />
              <div className="skeleton mt-4 h-16 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ValueStackPanel({
  customer,
  savedCount,
  trust,
  watchedCount,
}: {
  customer: CustomerProfile | null;
  savedCount: number;
  trust?: OpportunityTrustPanel | null;
  watchedCount: number;
}) {
  const liveFeeds = trust?.dataFeeds.filter((feed) => feed.status === "live").length ?? 0;
  const totalFeeds = trust?.dataFeeds.length ?? 5;
  const marketCoverage = trust?.marketCoverage;
  const scanLabel =
    marketCoverage?.screenerCount && marketCoverage?.requestedUniverseLimit
      ? `${marketCoverage.screenerCount}/${marketCoverage.requestedUniverseLimit}`
      : marketCoverage?.detailedCandidateCount
        ? `${marketCoverage.detailedCandidateCount} analyzed`
        : "Tracking live runs";

  return (
    <section className="mt-5 rounded-3xl border border-line/80 bg-white p-5 shadow-[0_18px_54px_rgba(7,20,24,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            What SwingFi is doing for you
          </p>
          <h2 className="mt-2 text-2xl font-black text-ink">
            Research workflow, not just stock names
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/58">
            The product value comes from ranking, personalization, outcome tracking,
            and a safer handoff into your own brokerage research flow.
          </p>
        </div>
        <Link
          href="/history"
          className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine"
        >
          View performance center
        </Link>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-black uppercase tracking-normal text-ink/42">
            Personalized filters
          </p>
          <p className="mt-2 text-xl font-black text-ink">
            {customer?.riskProfile ?? "Balanced"} · {customer?.minimumConfidence ?? 70}+ conf
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-ink/55">
            Picks are reshaped around your risk, confidence, and account preferences.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-black uppercase tracking-normal text-ink/42">
            Data coverage
          </p>
          <p className="mt-2 text-xl font-black text-ink">{scanLabel}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-ink/55">
            {liveFeeds}/{totalFeeds} research feeds reported live for the latest saved run.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-black uppercase tracking-normal text-ink/42">
            Your research queue
          </p>
          <p className="mt-2 text-xl font-black text-ink">
            {savedCount} saved · {watchedCount} watched
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-ink/55">
            Save or watch ideas to build a review list instead of chasing every ticker.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-black uppercase tracking-normal text-ink/42">
            Brokerage handoff
          </p>
          <p className="mt-2 text-xl font-black text-ink">
            {customer?.preferredBrokerage === "none" ? "Choose broker" : "Ready"}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-ink/55">
            Opportunity pages can open your preferred brokerage without storing login details.
          </p>
        </div>
      </div>
    </section>
  );
}

function percentNumber(value: string) {
  return Number(value.replace("+", "").replace("%", "")) || 0;
}

function customerSafeFallback(reason?: string) {
  if (!reason) {
    return "The morning ranking run has not saved customer-ready picks yet.";
  }

  const lower = reason.toLowerCase();
  const internalSignals = [
    "api_key",
    "env",
    "environment",
    "fmp",
    "service role",
    "supabase",
    "vercel",
  ];

  if (internalSignals.some((signal) => lower.includes(signal))) {
    return "The morning ranking run has not saved customer-ready picks yet.";
  }

  return reason;
}

function preferenceFitScore(opportunity: Opportunity, customer: CustomerProfile) {
  const confidenceGap = Math.max(0, customer.minimumConfidence - opportunity.confidenceScore);
  const riskGap = Math.max(0, opportunity.riskScore - customer.maxRiskScore);
  let penalty = confidenceGap * 1.1 + riskGap * 1.25;
  const severeRiskGap = Math.max(0, opportunity.riskScore - 70);
  const potentialGain = percentNumber(opportunity.potentialGain);

  if (customer.riskProfile === "conservative") {
    penalty += Math.max(0, opportunity.riskScore - 45) * 0.75;
    penalty += severeRiskGap * 1.2;
    penalty -= opportunity.confidenceScore >= 78 && opportunity.riskScore <= 45 ? 5 : 0;
  }

  if (customer.riskProfile === "aggressive") {
    penalty -= opportunity.opportunityScore >= 75 && potentialGain >= 7 ? 4 : 0;
    penalty += opportunity.confidenceScore < 62 ? 6 : 0;
  } else {
    penalty += severeRiskGap * 0.65;
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
    penalty += Math.max(0, opportunity.riskScore - 50) * 0.45;
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

function topViewRiskCeiling(customer: CustomerProfile | null) {
  if (!customer) return 72;
  if (customer.riskProfile === "aggressive" && customer.investingExperience !== "beginner") return 95;
  if (customer.riskProfile === "conservative" || customer.investingExperience === "beginner") {
    return Math.min(customer.maxRiskScore + 8, 62);
  }

  return Math.min(customer.maxRiskScore + 10, 72);
}

export function DashboardOpportunities({
  dataSource,
  fallbackReason,
  initialOpportunities,
}: DashboardOpportunitiesProps) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [currentDataSource, setCurrentDataSource] = useState<OpportunityDataSource>(dataSource);
  const [currentFallbackReason, setCurrentFallbackReason] = useState(fallbackReason);
  const [currentTrust, setCurrentTrust] = useState<OpportunityTrustPanel | null>(null);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>("top");
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [opportunityRefreshToken, setOpportunityRefreshToken] = useState(0);
  const [savedSymbols, setSavedSymbols] = useState<Set<string>>(new Set());
  const [skippedSymbols, setSkippedSymbols] = useState<Set<string>>(new Set());
  const [watchedSymbols, setWatchedSymbols] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(dashboardActionStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        saved?: string[];
        skipped?: string[];
        watched?: string[];
      };

      setSavedSymbols(new Set(parsed.saved ?? []));
      setSkippedSymbols(new Set(parsed.skipped ?? []));
      setWatchedSymbols(new Set(parsed.watched ?? []));
    } catch {
      window.localStorage.removeItem(dashboardActionStorageKey);
    }
  }, []);

  useEffect(() => {
    const refresh = async () => {
      const restored = await restoreAuthenticatedCustomerSession();
      setCustomer(restored);
      setReady(true);
    };

    const refreshOpportunities = () => {
      window.sessionStorage.removeItem(dashboardOpportunityCacheKey);
      setOpportunityRefreshToken(Date.now());
    };

    refresh().catch(() => {
      setCustomer(getCurrentCustomer());
      setReady(true);
    });
    window.addEventListener("storage", refresh);
    window.addEventListener("swingfi-opportunities-updated", refreshOpportunities);
    window.addEventListener("swingfi-customer-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("swingfi-opportunities-updated", refreshOpportunities);
      window.removeEventListener("swingfi-customer-updated", refresh);
    };
  }, [dataSource]);

  useEffect(() => {
    const access = getAccessState(customer);
    if (!ready || !access.canViewAnalysis) return;

    let isActive = true;

    async function loadOpportunities() {
      const cachedPayload = readDashboardOpportunityCache();
      const hasCachedRows = Boolean(cachedPayload?.rows?.length);

      if (cachedPayload) {
        applyDashboardPayload(cachedPayload, {
          setCurrentDataSource,
          setCurrentFallbackReason,
          setCurrentTrust,
          setOpportunities,
        });
      }

      setOpportunitiesLoading(!hasCachedRows);
      const timeoutPromise = new Promise<DashboardOpportunitiesPayload | null>((resolve) => {
        window.setTimeout(
          () =>
            resolve({
              reason: "Rankings are taking longer than expected. Please try again shortly.",
              source: "empty",
            }),
          15_000,
        );
      });

      try {
        const payload = await Promise.race([
          fetchDashboardOpportunities(),
          timeoutPromise,
        ]);

        if (!isActive) return;

        if (!payload?.rows) {
          if (hasCachedRows) return;

          setOpportunities([]);
          setCurrentDataSource("empty");
          setCurrentFallbackReason(payload?.reason ?? "Rankings could not be loaded.");
          return;
        }

        writeDashboardOpportunityCache(payload);
        applyDashboardPayload(payload, {
          setCurrentDataSource,
          setCurrentFallbackReason,
          setCurrentTrust,
          setOpportunities,
        });
      } catch {
        if (!isActive) return;
        if (hasCachedRows) return;
        setOpportunities([]);
        setCurrentDataSource("empty");
        setCurrentFallbackReason("Rankings could not be loaded. Please try again shortly.");
      } finally {
        if (isActive) setOpportunitiesLoading(false);
      }
    }

    loadOpportunities();

    return () => {
      isActive = false;
    };
  }, [customer, opportunityRefreshToken, ready]);

  useEffect(() => {
    if (!ready) return;

    window.localStorage.setItem(
      dashboardActionStorageKey,
      JSON.stringify({
        saved: [...savedSymbols],
        skipped: [...skippedSymbols],
        watched: [...watchedSymbols],
      }),
    );
  }, [ready, savedSymbols, skippedSymbols, watchedSymbols]);

  const personalized = useMemo(() => {
    if (!customer) {
      return {
        closestFitCount: 0,
        dailyPicks: opportunities,
        dailyDirectMatchCount: opportunities.length,
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
      dailyDirectMatchCount: dailyPicks.filter((opportunity) =>
        scored.some((item) => item.opportunity.symbol === opportunity.symbol && item.directMatch),
      ).length,
      directMatchCount,
      limit,
    };
  }, [customer, opportunities]);
  const dailyPicks = personalized.dailyPicks;

  const visiblePicks = useMemo(() => {
    const activePicks = dailyPicks.filter(
      (opportunity) => !skippedSymbols.has(opportunity.symbol),
    );
    const maxRisk = customer?.maxRiskScore ?? 65;
    const minConfidence = customer?.minimumConfidence ?? 70;

    if (activeView === "top") {
      const riskCeiling = topViewRiskCeiling(customer);
      const calmerPicks = activePicks.filter(
        (opportunity) =>
          opportunity.riskScore <= riskCeiling &&
          opportunity.confidenceScore >= Math.max(60, minConfidence - 8),
      );

      return (calmerPicks.length >= 3 ? calmerPicks : activePicks).slice(0, 5);
    }

    if (activeView === "watchlist") {
      const explicitWatchlist = activePicks.filter(
        (opportunity) =>
          watchedSymbols.has(opportunity.symbol) || savedSymbols.has(opportunity.symbol),
      );

      if (explicitWatchlist.length > 0) {
        return explicitWatchlist;
      }

      return activePicks
        .filter(
          (opportunity) =>
            opportunity.opportunityScore >= 60 &&
            percentNumber(opportunity.potentialGain) < 8 &&
            (opportunity.opportunityScore < 75 ||
              opportunity.confidenceScore < minConfidence ||
              opportunity.riskScore > maxRisk),
        );
    }

    return activePicks
      .filter(
        (opportunity) =>
          percentNumber(opportunity.potentialGain) >= 8 ||
          opportunity.riskScore >= Math.max(maxRisk + 5, 60),
      );
  }, [activeView, customer, dailyPicks, savedSymbols, skippedSymbols, watchedSymbols]);

  const viewOptions = useMemo(
    () => {
      const activePicks = dailyPicks.filter((item) => !skippedSymbols.has(item.symbol));
      const maxRisk = customer?.maxRiskScore ?? 65;
      const minConfidence = customer?.minimumConfidence ?? 70;
      const bestFitCount = activePicks.filter(
        (item) =>
          item.riskScore <= topViewRiskCeiling(customer) &&
          item.confidenceScore >= Math.max(60, minConfidence - 8),
      ).length;
      const savedOrWatchedCount = activePicks.filter(
        (item) => savedSymbols.has(item.symbol) || watchedSymbols.has(item.symbol),
      ).length;
      const watchWaitCount =
        savedOrWatchedCount > 0
          ? savedOrWatchedCount
          : activePicks.filter(
              (item) =>
                item.opportunityScore >= 60 &&
                percentNumber(item.potentialGain) < 8 &&
                (item.opportunityScore < 75 ||
                  item.confidenceScore < minConfidence ||
                  item.riskScore > maxRisk),
            ).length;
      const higherUpsideCount = activePicks.filter(
        (item) =>
          percentNumber(item.potentialGain) >= 8 ||
          item.riskScore >= Math.max(maxRisk + 5, 60),
      ).length;

      return [
        {
          count: Math.min(5, bestFitCount || activePicks.length),
          description: "Focused first review for your confidence and risk settings.",
          key: "top" as const,
          label: "Best fit",
        },
        {
          count: watchWaitCount,
          description: "All monitor-worthy ideas to save or revisit near entry.",
          key: "watchlist" as const,
          label: "Watch & wait",
        },
        {
          count: higherUpsideCount,
          description: "All bigger-upside ideas with less forgiving risk.",
          key: "higher-risk" as const,
          label: "Higher upside",
        },
      ];
    },
    [
      customer,
      dailyPicks,
      savedSymbols,
      skippedSymbols,
      watchedSymbols,
    ],
  );

  const toggleSymbol = (symbol: string, setter: Dispatch<SetStateAction<Set<string>>>) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

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
  const activeViewCopy = {
    top: {
      eyebrow: "Best-fit opportunities",
      title: "Start with these profile-friendly setups",
      note: "Best fit is intentionally focused on the first five ideas so the starting point stays manageable.",
    },
    watchlist: {
      eyebrow: "Watch & wait",
      title: "Monitor these before acting",
      note: "Showing every monitor-worthy idea in this mode.",
    },
    "higher-risk": {
      eyebrow: "Higher-upside review",
      title: "Review only if the risk fits your plan",
      note: "Showing every higher-upside idea in this mode.",
    },
  }[activeView];
  const access = getAccessState(customer);

  if (!ready) {
    return (
      <section className="motion-card overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
          <div className="p-6 sm:p-8">
            <div className="signal-line mb-6 h-1.5 max-w-56 rounded-full" />
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              Checking account access
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-normal text-ink sm:text-4xl">
              Loading your SwingFi workspace
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ink/60">
              We&apos;re confirming your trial or subscription before showing today&apos;s
              customer analysis.
            </p>
          </div>
          <div className="border-t border-line bg-surface p-6 lg:border-l lg:border-t-0">
            <div className="skeleton h-4 w-40 rounded-full" />
            <div className="skeleton mt-5 h-12 rounded-2xl" />
            <div className="skeleton mt-4 h-24 rounded-3xl" />
          </div>
        </div>
      </section>
    );
  }

  if (!access.canViewAnalysis) {
    return <AccessGate customer={customer} />;
  }

  if (opportunitiesLoading && opportunities.length === 0) {
    return <DashboardAnalysisSkeleton />;
  }

  return (
    <>
      <div className="motion-card overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_20px_64px_rgba(7,20,24,0.07)]">
        <div className="grid gap-0 lg:grid-cols-[1fr_260px] 2xl:grid-cols-[1fr_300px]">
          <div className="p-5 sm:p-6">
            <div className="signal-line mb-4 h-1.5 max-w-48 rounded-full" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-black uppercase tracking-normal text-white">
                Pre-market list
              </span>
              <span className="rounded-full bg-mint px-3 py-1 text-xs font-black uppercase tracking-normal text-pine">
                {currentDataSource === "supabase" ? "Live data" : "Preview"}
              </span>
              {opportunitiesLoading ? (
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-black uppercase tracking-normal text-ink/50">
                  Refreshing
                </span>
              ) : null}
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-black tracking-normal text-ink sm:text-3xl">
              {customer ? "Ranked around your risk profile" : "Today's ranked opportunities"}
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-ink/62">
              {customer
                ? `Showing ${dailyPicks.length} personalized picks. Start with Best fit, then open any card that fits your entry, target, and stop plan. ${personalized.dailyDirectMatchCount} picks match your confidence and risk settings${
                    personalized.closestFitCount > 0
                      ? `; ${personalized.closestFitCount} are close-fit backups.`
                      : "."
                  }`
                : `Showing ${dailyPicks.length} agent-ranked opportunities. Create a profile to personalize the list by risk, budget, and confidence preference.`}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-line/80 bg-surface p-3">
                <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                  Confidence
                </p>
                <p className="mt-1 text-lg font-black text-ink sm:text-xl">
                  {customer?.minimumConfidence ?? 70}
                  <span className="text-sm text-ink/42">/100</span>
                </p>
              </div>
              <div className="rounded-2xl border border-line/80 bg-surface p-3">
                <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                  Max risk
                </p>
                <p className="mt-1 text-lg font-black text-ink sm:text-xl">
                  {customer?.maxRiskScore ?? 65}
                  <span className="text-sm text-ink/42">/100</span>
                </p>
              </div>
              <div className="rounded-2xl border border-line/80 bg-surface p-3">
                <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                  Review
                </p>
                <p className="mt-1 text-lg font-black text-ink sm:text-xl">8:30 ET</p>
              </div>
            </div>
          </div>
          <div className="hidden border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-4 text-white sm:block lg:border-l lg:border-t-0 2xl:p-5">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Today&apos;s read
            </p>
            <p className={`mt-3 text-3xl font-black 2xl:text-4xl ${summary.strength.tone === "text-coral" ? "text-coral" : "text-white"}`}>
              {summary.strength.label}
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/68">
              {summary.strength.description}
            </p>
            <div className="mt-3 rounded-2xl border border-white/14 bg-white/8 p-3 2xl:mt-4">
              <p className="text-xs font-black uppercase tracking-normal text-white/48">
                List quality
              </p>
              <p className="mt-1 text-3xl font-black text-lime">
                {summary.avgOpportunity}
                <span className="text-base text-white/44">/100</span>
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-white/55">
                Average opportunity score for the picks shown today.
              </p>
            </div>
          </div>
        </div>
        {opportunitiesLoading ? (
          <p className="border-t border-line bg-sky px-6 py-4 text-sm font-bold text-ink/70">
            Loading today&apos;s ranked opportunities...
          </p>
        ) : currentDataSource === "empty" ? (
          <p className="border-t border-line bg-coral/12 px-6 py-4 text-sm font-bold text-ink/70">
            No customer-ready picks are available yet: {customerSafeFallback(currentFallbackReason)}
          </p>
        ) : currentDataSource === "agent-preview" ? (
          <p className="border-t border-line bg-sky px-6 py-4 text-sm font-bold text-ink/70">
            Live agent preview is showing because saved Supabase picks are not active yet.
            {currentFallbackReason ? ` ${currentFallbackReason}` : ""}
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-3xl border border-line/80 bg-surface/88 p-3 shadow-[0_14px_42px_rgba(7,20,24,0.065)] backdrop-blur-2xl">
        <div className="grid gap-3 xl:grid-cols-[300px_1fr] xl:items-stretch">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              Choose your review mode
            </p>
            <p className="mt-1 text-sm font-semibold text-ink/58">
              Start with best fit. Move to watch & wait or higher upside only when
              you want a broader review.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {viewOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveView(option.key)}
                className={`rounded-2xl border px-4 py-3 text-left transition xl:min-h-full ${
                  activeView === option.key
                    ? "border-ink bg-ink text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)]"
                    : "border-line/80 bg-white text-ink hover:border-pine/35"
                }`}
              >
                <span className="flex items-center justify-between gap-3 text-sm font-black">
                  {option.label}
                  <span className={activeView === option.key ? "text-white/58" : "text-ink/42"}>
                    {option.count}
                  </span>
                </span>
                <span
                  className={`mt-1 block text-xs font-semibold leading-5 ${
                    activeView === option.key ? "text-white/62" : "text-ink/52"
                  }`}
                >
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 rounded-2xl border border-line/70 bg-white/68 px-4 py-2.5 text-xs font-semibold leading-5 text-ink/54">
          This changes the list you are reviewing. It does not change SwingFi&apos;s
          original ranking or turn any idea into a buy recommendation.
          {skippedSymbols.size > 0 ? ` ${skippedSymbols.size} skipped ideas are hidden.` : ""}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              {activeViewCopy.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-normal text-ink">
              {activeViewCopy.title}
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-ink/58">
              Showing {visiblePicks.length} ticker analyses. {activeViewCopy.note}
            </p>
          </div>
          {skippedSymbols.size > 0 ? (
            <button
              type="button"
              onClick={() => setSkippedSymbols(new Set())}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-black text-ink/62 transition hover:border-pine/35 hover:text-ink"
            >
              Restore skipped
            </button>
          ) : null}
        </div>
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {dailyPicks.length === 0 ? (
            <div className="rounded-3xl border border-line bg-panel p-6 shadow-soft xl:col-span-2">
              <p className="text-sm font-black uppercase tracking-normal text-pine">
                Waiting for live analysis
              </p>
              <h2 className="mt-3 text-2xl font-black text-ink">
                No ranked opportunities have been saved yet
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
                Today&apos;s customer-ready ranking list has not been saved yet. Please
                check back after the morning analysis run, or open your latest email
                alert when it arrives.
              </p>
            </div>
          ) : visiblePicks.length > 0 ? (
            visiblePicks.map((opportunity, index) => (
              <OpportunityCard
                key={opportunity.symbol}
                compact
                isSaved={savedSymbols.has(opportunity.symbol)}
                isWatched={watchedSymbols.has(opportunity.symbol)}
                opportunity={opportunity}
                rank={index + 1}
                animationDelay={Math.min(index * 35, 360)}
                onSave={() => toggleSymbol(opportunity.symbol, setSavedSymbols)}
                onWatch={() => toggleSymbol(opportunity.symbol, setWatchedSymbols)}
                onSkip={() =>
                  setSkippedSymbols((current) => new Set(current).add(opportunity.symbol))
                }
              />
            ))
          ) : (
            <div className="rounded-3xl border border-line bg-white p-6 shadow-soft xl:col-span-2">
              <p className="text-sm font-black uppercase tracking-normal text-pine">
                Nothing in this view
              </p>
              <h2 className="mt-3 text-2xl font-black text-ink">
                Try another tab or restore skipped picks
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
                This keeps the dashboard focused on the decisions you have not already
                moved past.
              </p>
            </div>
          )}
        </div>
      </div>

      <TodayActionPlan customer={customer} dailyPicks={dailyPicks} />

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[
          [
            "1. Start with rank",
            "Higher-ranked ideas are the first setups to review. A rank is not a buy order.",
          ],
          [
            "2. Check risk",
            "Compare the stop loss and potential loss with your comfort level before focusing on upside.",
          ],
          [
            "3. Use the entry range",
            "If price has moved far past the entry range, the trade plan may no longer be attractive.",
          ],
        ].map(([title, text]) => (
          <div
            key={title}
            className="rounded-2xl border border-line/80 bg-white/78 p-4 shadow-[0_10px_28px_rgba(7,20,24,0.045)]"
          >
            <p className="text-sm font-black text-ink">{title}</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-ink/58">{text}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 border-y border-line/80 py-5">
        <details>
          <summary className="flex cursor-pointer list-none flex-col gap-3 rounded-2xl px-1 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="block text-xs font-black uppercase tracking-normal text-pine">
                Deeper context
              </span>
              <span className="mt-1 block text-xl font-black text-ink">
                Score guide, averages, and data used today
              </span>
              <span className="mt-1 block max-w-3xl text-sm font-semibold leading-6 text-ink/58">
                Open this when you want to understand the list quality, data sources,
                and what each score means.
              </span>
            </span>
            <span className="w-fit rounded-full border border-line bg-white px-4 py-2 text-sm font-black text-ink/62">
              View details
            </span>
          </summary>
          <div className="pt-4">
            <ValueStackPanel
              customer={customer}
              savedCount={savedSymbols.size}
              trust={currentTrust}
              watchedCount={watchedSymbols.size}
            />
            <FirstLoginWalkthrough customer={customer} />
            {dailyPicks.length > 0 ? (
              <div
                className={`grid gap-4 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-5 ${
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
            <DataTrustPanel dataSource={currentDataSource} trust={currentTrust} />
            <div className="mt-5">
              <ScoreGuide />
            </div>
          </div>
        </details>
      </section>
    </>
  );
}
