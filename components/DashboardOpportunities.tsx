"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ScoreGuide } from "@/components/ScoreGuide";
import { SummaryTile } from "@/components/SummaryTile";
import {
  getAccessState,
  getCurrentCustomer,
  restoreAuthenticatedCustomerSession,
  type CustomerProfile,
} from "@/lib/customer-store";
import { loginHref, signupHref } from "@/lib/customer-flow";
import { getPersonalizedDailyPicks } from "@/lib/customer-picks";
import { opportunityFromRow, type Opportunity } from "@/lib/opportunities";
import { getCoachVerdict } from "@/lib/trade-guidance";
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

type DashboardView = "top" | "higher-risk" | "all";
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
const dashboardAutoRefreshMs = 5 * 60 * 1000;
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
    <div className="rounded-2xl border border-line bg-white p-2.5 sm:p-3">
      <p className="text-xs font-black uppercase tracking-normal text-ink/42">{label}</p>
      <p className={`mt-1 text-sm font-black ${tone}`}>{value}</p>
    </div>
  );
}

function ConfidenceMeter({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const tone =
    normalizedScore >= 78
      ? "text-pine"
      : normalizedScore >= 62
        ? "text-ink"
        : "text-coral";
  const bar =
    normalizedScore >= 78
      ? "bg-pine"
      : normalizedScore >= 62
        ? "bg-amber"
        : "bg-coral";

  return (
    <div className="rounded-2xl border border-line bg-white p-2.5 sm:p-3">
      <div className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-xs font-black uppercase tracking-normal text-ink/42">
            Confidence
          </span>
          <span className={`mt-1 block text-sm font-black ${tone}`}>{label}</span>
        </span>
        <span className={`rounded-full bg-surface px-2.5 py-1 text-sm font-black ${tone} ring-1 ring-line`}>
          {normalizedScore}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${normalizedScore}%` }} />
      </div>
    </div>
  );
}

function OutlookReadout({
  buyUnder,
  direction,
  tone,
}: {
  buyUnder: string;
  direction: "Likely up" | "Mixed" | "Likely down";
  tone: string;
}) {
  const copy = {
    "Likely down": {
      label: "Skip today; this is not one of the cleaner setups.",
    },
    "Likely up": {
      label: `Worth reviewing if price stays under ${buyUnder}.`,
    },
    Mixed: {
      label: `Only works if price is under ${buyUnder}.`,
    },
  }[direction];

  return (
    <div className="rounded-2xl border border-line bg-white p-2.5 sm:p-3">
      <p className="text-xs font-black uppercase tracking-normal text-ink/42">
        Outlook
      </p>
      <p className={`mt-2 text-sm font-black leading-5 ${tone}`}>{copy.label}</p>
    </div>
  );
}

function formatPositivePercentText(value: string) {
  const parsed = percentNumber(value);
  return Number.isFinite(parsed) ? `${Math.abs(parsed).toFixed(1)}%` : value.replace(/^-/, "");
}

function formatGuardrailPrice(value: number) {
  return `$${value.toFixed(value >= 1000 ? 0 : 2)}`;
}

function GuidedOpportunityList({
  onSave,
  onSkip,
  onTrackTrade,
  onWatch,
  picks,
  savedSymbols,
  watchedSymbols,
}: {
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
        const coach = getCoachVerdict(opportunity);
        const verdictTone =
          coach.badgeTone === "positive"
            ? "border-pine/15 bg-mint/70"
            : coach.badgeTone === "caution"
              ? "border-coral/20 bg-coral/10"
              : "border-amber/30 bg-amber/15";
        const verdictTextTone =
          coach.badgeTone === "positive"
            ? "text-pine"
            : coach.badgeTone === "caution"
              ? "text-coral"
              : "text-ink";
        const badgeClasses =
          coach.badgeTone === "positive"
            ? "border-pine/15 bg-mint text-pine"
            : coach.badgeTone === "caution"
              ? "border-coral/20 bg-coral/10 text-coral"
              : "border-amber/30 bg-amber/15 text-ink";

        return (
          <article
            key={opportunity.symbol}
            className="motion-card overflow-hidden rounded-[24px] border border-line/80 bg-white shadow-[0_14px_42px_rgba(7,20,24,0.055)] transition hover:border-pine/35 hover:shadow-lift sm:rounded-3xl"
            style={{ animationDelay: `${Math.min(index * 35, 280)}ms` }}
          >
            <div className={`h-1.5 ${coach.badgeTone === "positive" ? "bg-pine" : coach.badgeTone === "caution" ? "bg-coral" : "bg-amber"}`} />
            <div className="grid gap-3 p-3 sm:gap-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-ink px-3 py-1 text-xs font-black text-white">
                        #{index + 1}
                      </span>
                      <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink/55 ring-1 ring-line">
                        {opportunity.assetType}
                      </span>
                    </div>
                    <h3 className="mt-3 text-2xl font-black leading-none tracking-normal text-ink sm:text-3xl">
                      {opportunity.symbol}
                    </h3>
                    <p className="mt-1 truncate text-sm font-bold text-ink/52">
                      {opportunity.name}
                    </p>
                  </div>
                  <div className={`w-fit rounded-2xl border px-3 py-2 text-sm font-black shadow-[0_10px_24px_rgba(7,20,24,0.045)] ${badgeClasses}`}>
                    {coach.actionLabel}
                  </div>
                </div>

                <div className={`mt-4 rounded-3xl border px-4 py-4 ${verdictTone}`}>
                  <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                    SwingFi verdict
                  </p>
                  <p className={`mt-1 text-xl font-black leading-7 ${verdictTextTone}`}>
                    {coach.actionText}
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-ink/72">
                    {coach.directionText}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MiniTradeStat label="Possible gain" value={opportunity.potentialGain} tone="text-pine" />
                  <MiniTradeStat label="Downside risk" value={formatPositivePercentText(opportunity.potentialLoss)} tone="text-coral" />
                  <MiniTradeStat label="Do not buy above" value={formatGuardrailPrice(opportunity.entryHigh)} tone="text-coral" />
                  <MiniTradeStat label="Forecast" value={coach.forecastRange} tone="text-pine" />
                </div>

                <div className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                    Why this ranked
                  </p>
                  <p className="mt-1 text-sm font-black leading-5 text-ink">
                    {coach.reason}
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-ink/62">
                    {coach.guardrail}
                  </p>
                </div>
              </div>

              <div className="grid content-start gap-2 sm:gap-3">
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                  <OutlookReadout
                    buyUnder={formatGuardrailPrice(opportunity.entryHigh)}
                    direction={coach.direction}
                    tone={verdictTextTone}
                  />
                  <ConfidenceMeter label={coach.confidenceText} score={opportunity.confidenceScore} />
                </div>
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                  <Link
                    href={`/opportunities/${opportunity.symbol}`}
                    className="rounded-2xl bg-ink px-3 py-2.5 text-center text-sm font-black text-white shadow-[0_12px_28px_rgba(7,20,24,0.14)] hover:bg-pine sm:py-3"
                  >
                    View plan
                  </Link>
                  <button
                    type="button"
                    onClick={() => onTrackTrade(opportunity)}
                    className="rounded-2xl border border-pine/25 bg-mint px-3 py-2.5 text-sm font-black text-pine transition hover:border-pine hover:bg-white sm:py-3"
                  >
                    Track if bought
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => onSave(opportunity.symbol)}
                    className={`rounded-2xl border px-3 py-2.5 text-sm font-black transition sm:py-3 ${
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
                    className={`rounded-2xl border px-3 py-2.5 text-sm font-black transition sm:py-3 ${
                      watchedSymbols.has(opportunity.symbol)
                        ? "border-amber bg-amber/12 text-ink"
                        : "border-line bg-surface text-ink/66 hover:border-amber/45 hover:text-ink"
                    }`}
                  >
                    {watchedSymbols.has(opportunity.symbol) ? "Watching" : "Watch"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSkip(opportunity.symbol)}
                    className="rounded-2xl border border-line bg-white px-3 py-2.5 text-sm font-black text-ink/52 transition hover:border-coral/35 hover:text-coral sm:py-3"
                  >
                    Skip
                  </button>
                </div>
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

function formatCheckedAt(value: string | null) {
  if (!value) return "Not checked yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not checked yet";

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [opportunityRefreshToken, setOpportunityRefreshToken] = useState(0);
  const [savedSymbols, setSavedSymbols] = useState<Set<string>>(new Set());
  const [skippedSymbols, setSkippedSymbols] = useState<Set<string>>(new Set());
  const [trackingOpportunity, setTrackingOpportunity] = useState<Opportunity | null>(null);
  const [watchedSymbols, setWatchedSymbols] = useState<Set<string>>(new Set());

  const refreshSavedDashboardRankings = useCallback(() => {
    window.sessionStorage.removeItem(dashboardOpportunityCacheKey);
    setOpportunityRefreshToken(Date.now());
  }, []);

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

    refresh().catch(() => {
      setCustomer(getCurrentCustomer());
      setReady(true);
    });
    window.addEventListener("storage", refresh);
    window.addEventListener("swingfi-opportunities-updated", refreshSavedDashboardRankings);
    window.addEventListener("swingfi-customer-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("swingfi-opportunities-updated", refreshSavedDashboardRankings);
      window.removeEventListener("swingfi-customer-updated", refresh);
    };
  }, [dataSource, refreshSavedDashboardRankings]);

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
        if (isActive) {
          setLastCheckedAt(new Date().toISOString());
          setOpportunitiesLoading(false);
        }
      }
    }

    loadOpportunities();

    return () => {
      isActive = false;
    };
  }, [customer, opportunityRefreshToken, ready]);

  useEffect(() => {
    const access = getAccessState(customer);
    if (!ready || !access.canViewAnalysis) return;

    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      window.sessionStorage.removeItem(dashboardOpportunityCacheKey);
      setOpportunityRefreshToken(Date.now());
    };

    const interval = window.setInterval(refreshIfVisible, dashboardAutoRefreshMs);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [customer, ready]);

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

    if (activeView === "higher-risk") {
      return activePicks
        .filter(
          (opportunity) =>
            percentNumber(opportunity.potentialGain) >= 8 ||
            opportunity.riskScore >= Math.max(maxRisk + 5, 60),
        );
    }

    return activePicks;
  }, [activeView, customer, dailyPicks, skippedSymbols]);

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
      const higherUpsideCount = activePicks.filter(
        (item) =>
          percentNumber(item.potentialGain) >= 8 ||
          item.riskScore >= Math.max(maxRisk + 5, 60),
      ).length;

      return [
        {
          count: Math.min(5, bestFitCount || activePicks.length),
          description: "Best first review",
          key: "top" as const,
          label: "Made for you",
        },
        {
          count: higherUpsideCount,
          description: "More risk/reward",
          key: "higher-risk" as const,
          label: "A little riskier",
        },
        {
          count: activePicks.length,
          description: "Everything ranked",
          key: "all" as const,
          label: "All rankings",
        },
      ];
    },
    [customer, dailyPicks, skippedSymbols],
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
      eyebrow: "Made for you",
      title: "Review the picks that best fit your profile",
      note: "Made for you is intentionally capped at five ideas so the first screen stays manageable.",
    },
    "higher-risk": {
      eyebrow: "A little riskier",
      title: "Review these only if the extra risk fits",
      note: "A little riskier shows ideas where potential return or risk is higher than your calmer starting list.",
    },
    all: {
      eyebrow: "All rankings",
      title: "See every ranked setup from today",
      note: "All rankings shows every available customer-ready idea after skipped picks are removed.",
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
      <div className="motion-card overflow-hidden rounded-[24px] border border-line/80 bg-white shadow-[0_20px_64px_rgba(7,20,24,0.07)] sm:rounded-3xl">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-black uppercase tracking-normal text-white">
                Morning brief
              </span>
              <span className="rounded-full bg-mint px-3 py-1 text-xs font-black uppercase tracking-normal text-pine">
                {currentDataSource === "supabase" ? "Live picks" : "Preview"}
              </span>
              {opportunitiesLoading ? (
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-black uppercase tracking-normal text-ink/50">
                  Refreshing
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
              <div className="min-w-0">
                <h2 className="max-w-3xl text-2xl font-black tracking-normal text-ink sm:text-3xl">
                  {customer ? "Your best-fit swing ideas are ready" : "Today&apos;s ranked swing ideas are ready"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/60">
                  {customer
                    ? `${dailyPicks.length} ranked picks are matched to your risk profile. Start with Made for you, then only open cards where the current price is still under the buy limit.`
                    : `${dailyPicks.length} ranked picks are available. Create a profile to tune the list around your risk, budget, and confidence preference.`}
                </p>
              </div>

              <div className="rounded-[22px] border border-line bg-surface p-3">
                <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                  Today&apos;s read
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className={`text-2xl font-black ${summary.strength.tone}`}>
                    {summary.strength.label}
                  </p>
                  <p className="rounded-full bg-white px-3 py-1 text-sm font-black text-pine ring-1 ring-line">
                    {summary.avgOpportunity}/100
                  </p>
                </div>
                <p className="mt-2 text-xs font-bold leading-5 text-ink/56">
                  {summary.strength.description}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="rounded-2xl border border-pine/15 bg-mint px-3 py-2.5 sm:px-4 sm:py-3">
                <p className="text-xs font-black uppercase tracking-normal text-pine">
                  How to use this list
                </p>
                <p className="mt-1 text-sm font-bold leading-6 text-ink/68">
                  Read the verdict first. If price is above the buy limit, skip it today.
                  If it fits, open the full plan and check target, stop, and risk.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 lg:w-[320px]">
                <div className="rounded-2xl border border-line/80 bg-white px-3 py-2 ring-1 ring-line/40">
                  <p className="text-[11px] font-black uppercase tracking-normal text-ink/38">
                    Picks
                  </p>
                  <p className="mt-1 text-lg font-black text-ink">{dailyPicks.length}</p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white px-3 py-2 ring-1 ring-line/40">
                  <p className="text-[11px] font-black uppercase tracking-normal text-ink/38">
                    Best fits
                  </p>
                  <p className="mt-1 text-lg font-black text-ink">
                    {customer ? personalized.dailyDirectMatchCount : summary.highQualityCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white px-3 py-2 ring-1 ring-line/40">
                  <p className="text-[11px] font-black uppercase tracking-normal text-ink/38">
                    Review
                  </p>
                  <p className="mt-1 text-lg font-black text-ink">8:30 ET</p>
                </div>
              </div>
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

      <div className="hidden sm:block">
        <FirstLoginWalkthrough customer={customer} />
      </div>

      <section className="mt-4 overflow-hidden rounded-[28px] border border-line/80 bg-white shadow-[0_24px_74px_rgba(7,20,24,0.08)] sm:mt-5 sm:rounded-[32px]">
        <div className="border-b border-line bg-[linear-gradient(135deg,#ffffff_0%,#f4faf6_54%,#edf6f8_100%)] p-3 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-stretch">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-normal text-pine">
                Coach queue
              </p>
              <h2 className="mt-1 text-xl font-black tracking-normal text-ink sm:mt-2 sm:text-2xl">
                {activeViewCopy.title}
              </h2>
              <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-ink/58 sm:text-sm sm:leading-6">
                Showing {visiblePicks.length} coach verdicts. Start with the action label,
                then only open the plans where the current price still fits the guardrail.
              </p>
              {skippedSymbols.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setSkippedSymbols(new Set())}
                  className="mt-3 rounded-2xl border border-line bg-white/86 px-4 py-2 text-sm font-black text-ink/62 shadow-[0_10px_24px_rgba(7,20,24,0.05)] transition hover:border-pine/35 hover:text-ink"
                >
                  Restore skipped
                </button>
              ) : null}
            </div>
            <div className="rounded-[22px] border border-line/80 bg-white/90 p-3 shadow-[0_18px_44px_rgba(7,20,24,0.08)] backdrop-blur sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-[11px] font-black uppercase tracking-normal text-ink/42">
                    Latest saved scan
                  </span>
                  <span className="mt-1 block text-sm font-black text-ink">
                    {opportunitiesLoading
                      ? "Checking for updates..."
                      : lastCheckedAt
                        ? `Checked ${formatCheckedAt(lastCheckedAt)}`
                        : "Waiting for first check"}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-normal ${
                    currentDataSource === "supabase"
                      ? "bg-mint text-pine"
                      : "bg-amber/14 text-amber"
                  }`}
                >
                  {currentDataSource === "supabase" ? "Live" : "Preview"}
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-ink/56">
                Auto-checks every 5 min while this page is open. Full AI ranking runs
                stay on the scheduled morning workflow or admin trigger.
              </p>
              <button
                type="button"
                onClick={refreshSavedDashboardRankings}
                disabled={opportunitiesLoading}
                className="mt-3 w-full rounded-2xl bg-ink px-4 py-2.5 text-sm font-black text-white shadow-[0_14px_30px_rgba(7,20,24,0.16)] transition hover:bg-pine disabled:cursor-not-allowed disabled:opacity-60"
              >
                {opportunitiesLoading ? "Refreshing..." : "Refresh now"}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-line/80 bg-white/88 p-2 shadow-[0_12px_34px_rgba(7,20,24,0.06)]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 sm:px-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-normal text-pine">
                  Filter list
                </p>
                <p className="text-xs font-semibold text-ink/50">
                  Tap a view to change which rankings are shown.
                </p>
              </div>
              <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-black uppercase tracking-normal text-ink/48">
                Showing {visiblePicks.length}
              </span>
            </div>
            <div className="-mx-2 overflow-x-auto px-2 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
              <div className="inline-flex min-w-max gap-1.5 rounded-[20px] bg-surface p-1 ring-1 ring-line/80 sm:grid sm:w-full sm:min-w-0 sm:grid-cols-3">
                {viewOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={activeView === option.key}
                    onClick={() => setActiveView(option.key)}
                    className={`group relative w-36 shrink-0 rounded-2xl px-3 py-2.5 text-left transition sm:w-auto sm:px-4 sm:py-3 ${
                      activeView === option.key
                        ? "bg-ink text-white shadow-[0_14px_30px_rgba(7,20,24,0.18)]"
                        : "bg-white text-ink ring-1 ring-line/80 hover:bg-mint hover:ring-pine/25"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black">{option.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                          activeView === option.key
                            ? "bg-white/14 text-white"
                            : "bg-surface text-ink/50 group-hover:bg-white"
                        }`}
                      >
                        {option.count}
                      </span>
                    </span>
                    <span
                      className={`mt-1 block truncate text-xs font-semibold ${
                        activeView === option.key ? "text-white/62" : "text-ink/52"
                      }`}
                    >
                    {option.description}
                    </span>
                    {activeView === option.key ? (
                      <span className="absolute inset-x-4 -bottom-1 h-1 rounded-full bg-lime" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 bg-surface/55 p-2.5 sm:gap-4 sm:p-4">
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
            <GuidedOpportunityList
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
      </section>

      <div className="hidden sm:block">
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
