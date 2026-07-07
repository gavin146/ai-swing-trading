"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { OpportunityCard } from "@/components/OpportunityCard";
import { ScoreGuide } from "@/components/ScoreGuide";
import { SummaryTile } from "@/components/SummaryTile";
import {
  getAccessState,
  getCurrentCustomer,
  getCustomerPlanLabel,
  restoreAuthenticatedCustomerSession,
  type CustomerProfile,
} from "@/lib/customer-store";
import { loginHref, signupHref } from "@/lib/customer-flow";
import { getPersonalizedDailyPicks } from "@/lib/customer-picks";
import { opportunityFromRow, type Opportunity } from "@/lib/opportunities";
import {
  buildOpportunityPlainInsight,
  type PlainLanguageInsight,
} from "@/lib/plain-language-insights";
import { getBeginnerTradeGuide } from "@/lib/trade-guidance";
import type { OpportunityRow } from "@/lib/database.types";
import {
  buildSectorRotation,
  getMarketRegimeSummary,
  type MarketRegimeSummary,
  type SectorRotationItem,
} from "@/lib/market-intelligence";
import type {
  OpportunityDataSource,
  OpportunityTrustPanel,
  OpportunityTrustStatus,
} from "@/lib/repositories/opportunities";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DashboardOpportunitiesProps = {
  dataSource: OpportunityDataSource;
  fallbackReason?: string;
  initialOpportunities: Opportunity[];
};

type DashboardView = "top" | "watchlist" | "higher-risk";
type DashboardDisplayMode = "guided" | "cards";
type TradeTimeWindow = "open" | "midday" | "afternoon" | "after_hours";

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

async function getCustomerAuthHeaders() {
  const supabase = createSupabaseBrowserClient();
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;

  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function fetchDashboardOpportunities(headers?: HeadersInit) {
  if (!dashboardOpportunitiesRequest) {
    dashboardOpportunitiesRequest = fetch("/api/opportunities", {
      cache: "no-store",
      headers,
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
      .catch(() => ({
        reason: "Rankings could not be loaded because the local connection was interrupted. Refresh the page and try again.",
        source: "empty" as OpportunityDataSource,
      }))
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
    ? `/verify-email?sent=1&email=${encodeURIComponent(customer?.email ?? "")}&next=%2Fdashboard`
    : customer
      ? "/pricing"
      : signupHref({ nextPath: "/dashboard" });
  const primaryLabel = needsEmailVerification
    ? "Confirm email"
    : customer
      ? "View subscription options"
      : "Start free month";
  const statusText = needsEmailVerification
    ? "Email confirmation is still required before analysis unlocks."
    : access.isTrialActive
      ? `Trial ends ${access.trialEndsAt ? new Date(access.trialEndsAt).toLocaleDateString() : "soon"}.`
      : access.trialEndsAt
        ? `Trial ended ${new Date(access.trialEndsAt).toLocaleDateString()}.`
        : "Trial status is not available.";

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
              href={customer ? "/settings" : loginHref("/dashboard")}
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
              {statusText}
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
    <div className={`rounded-2xl border px-3 py-2.5 ${classes[tone]}`}>
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

const tradeTimeWindowLabels: Record<TradeTimeWindow, { label: string; helper: string }> = {
  after_hours: {
    helper: "After the regular market session.",
    label: "After hours",
  },
  afternoon: {
    helper: "Later in the session, near the close.",
    label: "Afternoon",
  },
  midday: {
    helper: "Around the middle of the trading day.",
    label: "Midday",
  },
  open: {
    helper: "Near the first part of the session.",
    label: "Near open",
  },
};

function portfolioHrefForTrade(
  opportunity: Opportunity,
  date: string,
  timeWindow: TradeTimeWindow,
) {
  const params = new URLSearchParams({
    assetType: opportunity.assetType === "ETF" ? "etf" : opportunity.assetType === "Crypto" ? "crypto" : "stock",
    entryDate: date,
    entryHigh: String(opportunity.entryHigh),
    entryLow: String(opportunity.entryLow),
    entryTimeWindow: timeWindow,
    holdingPeriodDays: String(opportunity.holdingPeriodDays),
    opportunityId: opportunity.id,
    source: "dashboard_track_trade",
    stopLoss: String(opportunity.stopLossValue),
    symbol: opportunity.symbol,
    targetPrice: String(opportunity.targetPriceValue),
  });

  return `/portfolio?${params.toString()}`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function opportunityInsightPayload(opportunity: Opportunity) {
  return {
    aiExplanation: opportunity.aiExplanation,
    confidenceScore: opportunity.confidenceScore,
    entryRange: opportunity.entryRange,
    expectedGainValue: opportunity.expectedGainValue,
    expectedLossValue: opportunity.expectedLossValue,
    holdingPeriodDays: opportunity.holdingPeriodDays,
    opportunityScore: opportunity.opportunityScore,
    rankingSummary: opportunity.rankingSummary,
    riskScore: opportunity.riskScore,
    setupPattern: opportunity.setupPattern,
    stopLoss: opportunity.stopLoss,
    symbol: opportunity.symbol,
    targetPrice: opportunity.targetPrice,
  };
}

function GuidedMiniScore({
  label,
  score,
  tone = "text-ink",
}: {
  label: string;
  score: number;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-line/80 bg-surface px-3 py-3">
      <p className="text-[11px] font-black uppercase tracking-normal text-ink/42">
        {label}
      </p>
      <p className={`mt-1 text-xl font-black ${tone}`}>
        {score}
        <span className="text-xs text-ink/38">/100</span>
      </p>
    </div>
  );
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
    <section className="mt-4 rounded-3xl border border-line/80 bg-white p-3 shadow-[0_14px_42px_rgba(7,20,24,0.055)] sm:p-4">
      <div className="grid gap-3 xl:grid-cols-[230px_1fr] xl:items-start">
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Today&apos;s action plan
          </p>
          <h2 className="mt-1 text-xl font-black tracking-normal text-ink">
            Start here
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-ink/56">
            A quick order before opening individual analyses.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
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

function TrackTradeModal({
  onClose,
  onConfirm,
  opportunity,
}: {
  onClose: () => void;
  onConfirm: (date: string, timeWindow: TradeTimeWindow) => void;
  opportunity: Opportunity;
}) {
  const [date, setDate] = useState(todayIsoDate());
  const [timeWindow, setTimeWindow] = useState<TradeTimeWindow>("open");

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/45 px-3 py-3 backdrop-blur-sm sm:place-items-center sm:p-6">
      <section className="w-full max-w-xl overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_30px_90px_rgba(7,20,24,0.22)]">
        <div className="bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-normal text-lime">
                Track trade
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-normal">
                Add {opportunity.symbol} to Portfolio
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/68">
                Tell SwingFi roughly when you bought it. Portfolio will estimate the
                entry price, then carry over the target, stop, and swing countdown.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black text-white/72 hover:bg-white/15"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-5">
          <div className="grid gap-3 rounded-3xl border border-line bg-surface p-4 sm:grid-cols-3">
            <MiniTradeStat label="Swing plan" value={`${opportunity.holdingPeriodDays} days`} />
            <MiniTradeStat label="Target" value={opportunity.targetPrice} tone="text-pine" />
            <MiniTradeStat label="Stop" value={opportunity.stopLoss} tone="text-coral" />
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-normal text-ink/44">
              Buy date
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
            />
          </label>

          <div className="grid gap-2">
            <p className="text-xs font-black uppercase tracking-normal text-ink/44">
              Rough buy time
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(tradeTimeWindowLabels) as TradeTimeWindow[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTimeWindow(value)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    timeWindow === value
                      ? "border-pine bg-mint text-pine"
                      : "border-line bg-surface text-ink hover:border-pine/35"
                  }`}
                >
                  <span className="block text-sm font-black">
                    {tradeTimeWindowLabels[value].label}
                  </span>
                  <span className="mt-1 block text-xs font-semibold leading-5 opacity-65">
                    {tradeTimeWindowLabels[value].helper}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-xs font-semibold leading-5 text-ink/55">
            SwingFi will estimate the entry price from market data. You can still
            edit it against your broker fill before saving the position.
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <button
              type="button"
              onClick={() => onConfirm(date, timeWindow)}
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(7,20,24,0.18)] transition hover:bg-pine"
            >
              Continue to Portfolio
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-black text-ink/58 transition hover:border-pine hover:text-pine"
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniTradeStat({
  label,
  tone = "text-ink",
  value,
}: {
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <p className="text-xs font-black uppercase tracking-normal text-ink/42">{label}</p>
      <p className={`mt-1 text-sm font-black ${tone}`}>{value}</p>
    </div>
  );
}

function GuidedOpportunityList({
  insightsBySymbol = {},
  onSave,
  onSkip,
  onTrackTrade,
  onWatch,
  picks,
  savedSymbols,
  watchedSymbols,
}: {
  insightsBySymbol?: Record<string, PlainLanguageInsight>;
  onSave: (symbol: string) => void;
  onSkip: (symbol: string) => void;
  onTrackTrade: (opportunity: Opportunity) => void;
  onWatch: (symbol: string) => void;
  picks: Opportunity[];
  savedSymbols: Set<string>;
  watchedSymbols: Set<string>;
}) {
  return (
    <div className="grid gap-3">
      {picks.map((opportunity, index) => {
        const beginnerGuide = getBeginnerTradeGuide(opportunity);
        const plainInsight = insightsBySymbol[opportunity.symbol];
        const guideTone =
          beginnerGuide.tone === "positive"
            ? "border-pine/15 bg-mint/70"
            : beginnerGuide.tone === "caution"
              ? "border-coral/20 bg-coral/10"
              : "border-amber/30 bg-amber/15";

        return (
          <article
            key={opportunity.symbol}
            className="motion-card rounded-3xl border border-line/80 bg-white p-4 shadow-[0_14px_42px_rgba(7,20,24,0.055)] transition hover:border-pine/35 hover:shadow-lift sm:p-5"
            style={{ animationDelay: `${Math.min(index * 35, 280)}ms` }}
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ink px-3 py-1 text-xs font-black text-white">
                    #{index + 1}
                  </span>
                  <span className="text-2xl font-black text-ink">{opportunity.symbol}</span>
                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink/55 ring-1 ring-line">
                    {opportunity.assetType}
                  </span>
                  <span className="rounded-full bg-mint px-3 py-1 text-xs font-black text-pine">
                    {opportunity.tradeQuality}
                  </span>
                </div>
                <div className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-normal text-pine">
                    Plain-English read
                  </p>
                  <p className="mt-1 text-sm font-black leading-5 text-ink">
                    {plainInsight?.headline ?? "Why this ticker is ranked"}
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-ink/62">
                    {plainInsight?.summary ?? opportunity.rankingSummary}
                  </p>
                  {plainInsight?.evidence?.length ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      {plainInsight.evidence.slice(0, 3).map((item) => (
                        <p
                          key={item}
                          className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold leading-5 text-ink/62"
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className={`mt-3 rounded-2xl border px-4 py-3 ${guideTone}`}>
                  <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                    What to review next
                  </p>
                  <p className="mt-1 text-sm font-black leading-5 text-ink">
                    {beginnerGuide.headline}
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-ink/62">
                    {plainInsight?.nextReview ?? beginnerGuide.plainEnglish}
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {beginnerGuide.steps.map((step, stepIndex) => (
                      <p
                        key={step}
                        className="rounded-xl border border-line bg-white/85 px-3 py-2 text-xs font-bold leading-5 text-ink/62"
                      >
                        <span className="mr-1 text-ink">{stepIndex + 1}.</span>{" "}
                        {step}
                      </p>
                    ))}
                  </div>
                </div>
                <p className="mt-2 rounded-2xl border border-line bg-surface px-4 py-2 text-xs font-bold leading-5 text-ink/58">
                  Risk note: {plainInsight?.riskNote ?? `price near ${opportunity.entryRange}, target ${opportunity.targetPrice}, stop ${opportunity.stopLoss}.`}
                </p>
              </div>

              <div className="grid content-start gap-3">
                <div className="grid grid-cols-3 gap-2">
                  <GuidedMiniScore label="Score" score={opportunity.opportunityScore} tone="text-pine" />
                  <GuidedMiniScore label="Confidence" score={opportunity.confidenceScore} />
                  <GuidedMiniScore label="Risk" score={opportunity.riskScore} tone="text-coral" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/opportunities/${opportunity.symbol}`}
                    className="rounded-2xl bg-ink px-3 py-3 text-center text-sm font-black text-white shadow-[0_12px_28px_rgba(7,20,24,0.14)] hover:bg-pine"
                  >
                    Review
                  </Link>
                  <button
                    type="button"
                    onClick={() => onTrackTrade(opportunity)}
                    className="rounded-2xl border border-pine/25 bg-mint px-3 py-3 text-sm font-black text-pine transition hover:border-pine hover:bg-white"
                  >
                    Track trade
                  </button>
                  <button
                    type="button"
                    onClick={() => onSave(opportunity.symbol)}
                    className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                      savedSymbols.has(opportunity.symbol)
                        ? "border-pine bg-mint text-pine"
                        : "border-line bg-surface text-ink/66 hover:border-pine/35 hover:text-ink"
                    }`}
                  >
                    {savedSymbols.has(opportunity.symbol) ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onWatch(opportunity.symbol)}
                    className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                      watchedSymbols.has(opportunity.symbol)
                        ? "border-amber bg-amber/12 text-ink"
                        : "border-line bg-surface text-ink/66 hover:border-amber/45 hover:text-ink"
                    }`}
                  >
                    {watchedSymbols.has(opportunity.symbol) ? "Watching" : "Watch"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onSkip(opportunity.symbol)}
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-black text-ink/52 transition hover:border-coral/35 hover:text-coral"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MarketRegimeBanner({
  regime,
}: {
  regime: MarketRegimeSummary;
}) {
  const tone = {
    balanced: "border-amber/30 bg-amber/12 text-ink",
    defensive: "border-coral/25 bg-coral/10 text-coral",
    "risk-on": "border-pine/20 bg-mint text-pine",
  }[regime.label];

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_18px_54px_rgba(7,20,24,0.065)]">
      <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
        <div className="bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-5 text-white">
          <p className="text-xs font-black uppercase tracking-normal text-lime">
            Market regime
          </p>
          <h2 className="mt-2 text-3xl font-black capitalize tracking-normal">
            {regime.label.replace("-", " ")}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/62">
            Morning score: {regime.score}/100
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_260px] sm:p-5">
          <div>
            <p className="text-sm font-bold leading-6 text-ink/66">{regime.description}</p>
            <p className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-black leading-6 text-ink">
              Suggested pace: {regime.pace}
            </p>
          </div>
          <div className={`rounded-2xl border p-4 ${tone}`}>
            <p className="text-xs font-black uppercase tracking-normal opacity-70">
              How to use it
            </p>
            <p className="mt-2 text-sm font-bold leading-6">
              This adjusts how aggressive the review should feel. It does not change
              the need for entry, target, and stop discipline.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectorRotationDashboard({
  sectors,
}: {
  sectors: SectorRotationItem[];
}) {
  if (sectors.length === 0) return null;

  return (
    <section className="mt-5 rounded-3xl border border-line/80 bg-white p-5 shadow-[0_18px_54px_rgba(7,20,24,0.06)] sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Sector rotation
          </p>
          <h2 className="mt-2 text-2xl font-black text-ink">
            Which groups are leading today&apos;s ranked list
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/58">
            SwingFi compares the current opportunity list against broad-market and
            sector context so users understand why several picks may cluster in one
            area.
          </p>
        </div>
        <span className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-black text-ink">
          Leader: {sectors[0]?.label}
        </span>
      </div>
      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        {sectors.slice(0, 6).map((sector) => (
          <div key={sector.label} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-ink">{sector.label}</p>
                <p className="mt-1 text-xs font-semibold text-ink/52">
                  {sector.count} picks · top: {sector.topSymbol}
                </p>
              </div>
              <p className="rounded-full bg-white px-3 py-1 text-sm font-black text-pine ring-1 ring-line">
                {sector.leadershipScore}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div>
                <p className="text-[11px] font-black uppercase text-ink/38">Score</p>
                <p className="text-sm font-black text-ink">{sector.averageScore}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase text-ink/38">Conf</p>
                <p className="text-sm font-black text-ink">{sector.averageConfidence}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase text-ink/38">Risk</p>
                <p className="text-sm font-black text-ink">{sector.averageRisk}</p>
              </div>
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-ink/58">
              {sector.benchmarkNote}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WatchlistChangeAlerts({
  picks,
  savedSymbols,
  watchedSymbols,
}: {
  picks: Opportunity[];
  savedSymbols: Set<string>;
  watchedSymbols: Set<string>;
}) {
  const watched = picks.filter(
    (pick) => savedSymbols.has(pick.symbol) || watchedSymbols.has(pick.symbol),
  );

  if (watched.length === 0) return null;

  return (
    <section className="mt-5 rounded-3xl border border-line/80 bg-white p-5 shadow-[0_18px_54px_rgba(7,20,24,0.06)] sm:p-6">
      <p className="text-xs font-black uppercase tracking-normal text-pine">
        Watchlist change alerts
      </p>
      <h2 className="mt-2 text-2xl font-black text-ink">
        Saved tickers that changed enough to recheck
      </h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {watched.slice(0, 6).map((pick) => (
          <Link
            key={pick.symbol}
            href={`/opportunities/${pick.symbol}`}
            className="rounded-2xl border border-line bg-surface p-4 transition hover:border-pine/35 hover:bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-black text-ink">{pick.symbol}</p>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-ink ring-1 ring-line">
                {pick.scoreMovement.label}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/62">
              {pick.scoreMovement.reason}
            </p>
            <p className="mt-2 text-xs font-bold text-ink/45">
              Freshness: {pick.dataFreshness.status} · Pattern: {pick.setupPattern}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function BeginnerLessonCards({ picks }: { picks: Opportunity[] }) {
  const lessons = picks
    .slice(0, 4)
    .map((pick) => ({ ...pick.beginnerLesson, symbol: pick.symbol }))
    .filter((lesson, index, list) => list.findIndex((item) => item.title === lesson.title) === index);

  if (lessons.length === 0) return null;

  return (
    <section className="mt-5 rounded-3xl border border-line/80 bg-white p-5 shadow-[0_18px_54px_rgba(7,20,24,0.06)] sm:p-6">
      <p className="text-xs font-black uppercase tracking-normal text-pine">
        Beginner lessons from today&apos;s picks
      </p>
      <h2 className="mt-2 text-2xl font-black text-ink">
        Learn the decision behind the ranking
      </h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {lessons.map((lesson) => (
          <div key={lesson.title} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              {lesson.symbol}
            </p>
            <h3 className="mt-2 text-base font-black text-ink">{lesson.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/62">{lesson.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PortfolioFitPanel({
  picks,
  savedSymbols,
  watchedSymbols,
}: {
  picks: Opportunity[];
  savedSymbols: Set<string>;
  watchedSymbols: Set<string>;
}) {
  const queue = picks.filter(
    (pick) => savedSymbols.has(pick.symbol) || watchedSymbols.has(pick.symbol),
  );
  const source = queue.length > 0 ? queue : picks.slice(0, 8);
  const sectorCounts = source.reduce<Record<string, number>>((totals, pick) => {
    totals[pick.sector] = (totals[pick.sector] ?? 0) + 1;
    return totals;
  }, {});
  const [topSector, topCount] =
    Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0] ?? ["None", 0];
  const concentration = source.length ? Math.round((topCount / source.length) * 100) : 0;
  const message =
    concentration >= 50
      ? `${topSector} is dominating your review queue. Consider whether you are taking the same sector risk repeatedly.`
      : "Your current review queue is not overly concentrated in one sector.";

  if (source.length === 0) return null;

  return (
    <section className="mt-5 rounded-3xl border border-line/80 bg-white p-5 shadow-[0_18px_54px_rgba(7,20,24,0.06)] sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Portfolio fit
          </p>
          <h2 className="mt-2 text-2xl font-black text-ink">
            Avoid stacking the same kind of risk
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/58">
            This first version uses saved and watched ideas as a proxy for your review
            queue. Later we can add manual holdings or brokerage-connected holdings.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-xs font-black uppercase tracking-normal text-ink/42">
            Top exposure
          </p>
          <p className="mt-1 text-xl font-black text-ink">{topSector}</p>
          <p className="mt-1 text-xs font-bold text-ink/48">{concentration}% of queue</p>
        </div>
      </div>
      <p className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold leading-6 text-ink/62">
        {message}
      </p>
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
          <p className="mt-3 max-w-2xl rounded-2xl border border-line bg-surface px-4 py-3 text-xs font-bold leading-5 text-ink/55">
            If this does not load shortly, SwingFi will show a reconnect prompt
            instead of leaving you stuck.
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

function needsResearchSessionReconnect(reason?: string) {
  const lower = reason?.toLowerCase() ?? "";

  return (
    lower.includes("valid swingfi login session") ||
    lower.includes("login session") ||
    lower.includes("sign in to start") ||
    lower.includes("session could not be verified")
  );
}

function DashboardSessionReconnect({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <section className="motion-card overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
      <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
        <div className="p-6 sm:p-8">
          <div className="signal-line mb-6 h-1.5 max-w-56 rounded-full" />
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Secure research session
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-normal text-ink sm:text-4xl">
            Log in again to load today&apos;s rankings
          </h2>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-ink/62">
            Your local SwingFi profile is still saved, but today&apos;s live analysis
            needs a verified account session before we can show protected stock
            research, saved picks, or opportunity details.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={loginHref("/dashboard")}
              className="rounded-2xl bg-ink px-5 py-3 text-center text-sm font-black text-white shadow-[0_18px_42px_rgba(7,20,24,0.18)] hover:bg-pine"
            >
              Log in again
            </Link>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-2xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-ink hover:border-pine disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Checking..." : "Try again"}
            </button>
          </div>
        </div>
        <div className="border-t border-line bg-surface p-6 lg:border-l lg:border-t-0">
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Why this matters
          </p>
          <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-ink/62">
            <p className="rounded-2xl border border-line bg-white p-4">
              Rankings are private account research, not a public ticker feed.
            </p>
            <p className="rounded-2xl border border-line bg-white p-4">
              Re-authentication protects your saved picks, portfolio notes, and
              preference filters.
            </p>
          </div>
        </div>
      </div>
    </section>
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
  const router = useRouter();
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [currentDataSource, setCurrentDataSource] = useState<OpportunityDataSource>(dataSource);
  const [currentFallbackReason, setCurrentFallbackReason] = useState(fallbackReason);
  const [currentTrust, setCurrentTrust] = useState<OpportunityTrustPanel | null>(null);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>("top");
  const [displayMode, setDisplayMode] = useState<DashboardDisplayMode>("guided");
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [opportunityRefreshToken, setOpportunityRefreshToken] = useState(0);
  const [savedSymbols, setSavedSymbols] = useState<Set<string>>(new Set());
  const [skippedSymbols, setSkippedSymbols] = useState<Set<string>>(new Set());
  const [trackingOpportunity, setTrackingOpportunity] = useState<Opportunity | null>(null);
  const [watchedSymbols, setWatchedSymbols] = useState<Set<string>>(new Set());
  const [insightsBySymbol, setInsightsBySymbol] = useState<Record<string, PlainLanguageInsight>>(
    {},
  );

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
        const authHeaders = await getCustomerAuthHeaders();

        if (!authHeaders && !access.isAdmin) {
          setOpportunities([]);
          setCurrentDataSource("empty");
          setCurrentFallbackReason("A valid SwingFi login session is required.");
          return;
        }

        const payload = await Promise.race([
          fetchDashboardOpportunities(authHeaders),
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

  const personalized = useMemo(
    () => getPersonalizedDailyPicks(customer, opportunities),
    [customer, opportunities],
  );
  const dailyPicks = personalized.dailyPicks;
  const planLabel = customer ? getCustomerPlanLabel(customer) : "Guest preview";

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

  useEffect(() => {
    if (!ready || !dailyPicks.length) {
      setInsightsBySymbol({});
      return;
    }

    let isActive = true;
    const fallbackInsights = Object.fromEntries(
      dailyPicks.map((opportunity) => [
        opportunity.symbol,
        buildOpportunityPlainInsight(opportunityInsightPayload(opportunity)),
      ]),
    );

    setInsightsBySymbol(fallbackInsights);

    async function loadInsights() {
      const authHeaders = await getCustomerAuthHeaders();

      if (!authHeaders && !getAccessState(customer).isAdmin) return;

      const response = await fetch("/api/insights/opportunities", {
        body: JSON.stringify({
          opportunities: dailyPicks.map(opportunityInsightPayload),
        }),
        headers: {
          ...(authHeaders ?? {}),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        insights?: Record<string, PlainLanguageInsight>;
      } | null;

      if (!isActive || !payload?.insights) return;

      setInsightsBySymbol((current) => ({
        ...current,
        ...payload.insights,
      }));
    }

    loadInsights().catch(() => {
      if (isActive) setInsightsBySymbol(fallbackInsights);
    });

    return () => {
      isActive = false;
    };
  }, [customer, dailyPicks, ready]);

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
          description: "The calm first list, filtered around your confidence and risk settings.",
          key: "top" as const,
          label: "Start here",
        },
        {
          count: watchWaitCount,
          description: "Ideas to save, watch, or revisit only if the entry improves.",
          key: "watchlist" as const,
          label: "Monitor",
        },
        {
          count: higherUpsideCount,
          description: "More upside potential, usually with less forgiving risk.",
          key: "higher-risk" as const,
          label: "Bigger upside",
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

  const confirmTrackTrade = (opportunity: Opportunity, date: string, timeWindow: TradeTimeWindow) => {
    setTrackingOpportunity(null);
    router.push(portfolioHrefForTrade(opportunity, date, timeWindow));
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
  const marketRegime = useMemo(() => getMarketRegimeSummary(dailyPicks), [dailyPicks]);
  const sectorRotation = useMemo(() => buildSectorRotation(dailyPicks), [dailyPicks]);
  const activeViewCopy = {
    top: {
      eyebrow: "Start here",
      title: "Review these profile-friendly setups first",
      note: "Start here is intentionally capped at five ideas so the first screen stays manageable.",
    },
    watchlist: {
      eyebrow: "Monitor",
      title: "Save or revisit these before acting",
      note: "Monitor shows every idea that may be useful later but is not the cleanest first review.",
    },
    "higher-risk": {
      eyebrow: "Bigger-upside review",
      title: "Review only if the risk fits your plan",
      note: "Bigger upside shows every idea where potential return or risk is higher than your calm starting list.",
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

  if (
    customer &&
    currentDataSource === "empty" &&
    opportunities.length === 0 &&
    needsResearchSessionReconnect(currentFallbackReason)
  ) {
    return (
      <DashboardSessionReconnect
        refreshing={opportunitiesLoading}
        onRefresh={() => {
          window.sessionStorage.removeItem(dashboardOpportunityCacheKey);
          setOpportunityRefreshToken(Date.now());
        }}
      />
    );
  }

  return (
    <>
      {trackingOpportunity ? (
        <TrackTradeModal
          opportunity={trackingOpportunity}
          onClose={() => setTrackingOpportunity(null)}
          onConfirm={(date, timeWindow) =>
            confirmTrackTrade(trackingOpportunity, date, timeWindow)
          }
        />
      ) : null}
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
              {customer ? (
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-black uppercase tracking-normal text-ink/56">
                  {planLabel}
                </span>
              ) : null}
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
                ? `${planLabel} is showing ${dailyPicks.length} personalized picks from today's ranked scan. Begin in the Start here path, then open any card that fits your entry, target, and stop plan. ${personalized.dailyDirectMatchCount} picks match your confidence and risk settings${
                    personalized.closestFitCount > 0
                      ? `; ${personalized.closestFitCount} are close-fit backups.`
                      : "."
                  }`
                : `Showing ${dailyPicks.length} agent-ranked opportunities. Create a profile to personalize the list by risk, budget, and confidence preference.`}
            </p>
            <div className="mt-4 rounded-2xl border border-pine/15 bg-mint px-4 py-3">
              <p className="text-xs font-black uppercase tracking-normal text-pine">
                Beginner takeaway
              </p>
              <p className="mt-1 text-sm font-bold leading-6 text-ink/68">
                Pick one to three ideas to review. Do not act unless price is still near
                the entry range, the stop loss fits your risk, and the ranking reason
                makes sense to you.
              </p>
            </div>
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

      <FirstLoginWalkthrough customer={customer} />

      <TodayActionPlan customer={customer} dailyPicks={dailyPicks} />

      <section className="mt-5 overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_20px_64px_rgba(7,20,24,0.07)]">
        <div className="border-b border-line bg-surface/90 p-4 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-normal text-pine">
                Review queue
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-normal text-ink">
                {activeViewCopy.title}
              </h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-ink/58">
                Showing {visiblePicks.length} ticker analyses. {activeViewCopy.note}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
              <div className="grid grid-cols-2 rounded-2xl border border-line bg-white p-1 shadow-[0_10px_28px_rgba(7,20,24,0.045)]">
                {[
                  ["guided", "Simple list"],
                  ["cards", "Full cards"],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDisplayMode(mode as DashboardDisplayMode)}
                    className={`rounded-xl px-3 py-2 text-sm font-black transition ${
                      displayMode === mode
                        ? "bg-ink text-white"
                        : "text-ink/58 hover:bg-surface hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {skippedSymbols.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setSkippedSymbols(new Set())}
                  className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-black text-ink/62 transition hover:border-pine/35 hover:text-ink"
                >
                  Restore skipped
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {viewOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveView(option.key)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
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

          <p className="mt-3 rounded-2xl border border-line/70 bg-white/72 px-4 py-2.5 text-xs font-semibold leading-5 text-ink/54">
            Start with the first path, then open one to three ideas. The path counts
            reflect available analyses after skipped picks are removed.
            {skippedSymbols.size > 0 ? ` ${skippedSymbols.size} skipped ideas are hidden.` : ""}
          </p>
        </div>

        <div className="grid gap-4 p-3 sm:p-4">
        {displayMode === "guided" && visiblePicks.length > 0 ? (
          <GuidedOpportunityList
            insightsBySymbol={insightsBySymbol}
            picks={visiblePicks}
            savedSymbols={savedSymbols}
            watchedSymbols={watchedSymbols}
            onSave={(symbol) => toggleSymbol(symbol, setSavedSymbols)}
            onTrackTrade={(opportunity) => setTrackingOpportunity(opportunity)}
            onWatch={(symbol) => toggleSymbol(symbol, setWatchedSymbols)}
            onSkip={(symbol) =>
              setSkippedSymbols((current) => new Set(current).add(symbol))
            }
          />
        ) : null}
        <div className={`grid gap-4 xl:grid-cols-2 2xl:grid-cols-3 ${
          displayMode === "guided" && visiblePicks.length > 0 ? "hidden" : ""
        }`}>
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
                plainInsight={insightsBySymbol[opportunity.symbol]}
                rank={index + 1}
                animationDelay={Math.min(index * 35, 360)}
                onSave={() => toggleSymbol(opportunity.symbol, setSavedSymbols)}
                onTrackTrade={() => setTrackingOpportunity(opportunity)}
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
      </section>

      <WatchlistChangeAlerts
        picks={dailyPicks}
        savedSymbols={savedSymbols}
        watchedSymbols={watchedSymbols}
      />

      <BeginnerLessonCards picks={dailyPicks} />

      <PortfolioFitPanel
        picks={dailyPicks}
        savedSymbols={savedSymbols}
        watchedSymbols={watchedSymbols}
      />

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
            <MarketRegimeBanner regime={marketRegime} />
            <SectorRotationDashboard sectors={sectorRotation} />
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
