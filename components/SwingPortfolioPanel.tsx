"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loginHref, signupHref } from "@/lib/customer-flow";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getCurrentCustomer,
  restoreAuthenticatedCustomerSession,
  type CustomerProfile,
} from "@/lib/customer-store";
import {
  buildPortfolioPlainInsight,
  type PlainLanguageInsight,
} from "@/lib/plain-language-insights";
import { getTradeLiveIntelligence } from "@/lib/portfolio/intelligence";
import type { AssetType, TradeStatus } from "@/lib/database.types";

type PortfolioTrade = {
  id: string;
  user_id: string;
  opportunity_id: string | null;
  symbol: string;
  asset_type: AssetType;
  entry_price: number;
  exit_price: number | null;
  target_price: number;
  stop_loss: number;
  quantity: number;
  status: TradeStatus;
  opened_at: string | null;
  closed_at: string | null;
  realized_gain: number | null;
  realized_loss: number | null;
  notes: string | null;
  created_at: string;
  currentPrice: number | null;
  daysHeld: number;
  latestNews: Array<{
    publishedDate: string | null;
    site: string | null;
    title: string;
    url: string | null;
  }>;
  planStatus: string;
  plannedHoldingDays: number | null;
  unrealizedReturnPct: number | null;
};

type InitialTrade = {
  assetType?: string;
  entryDate?: string;
  entryHigh?: string;
  entryLow?: string;
  entryTimeWindow?: string;
  holdingPeriodDays?: string;
  opportunityId?: string;
  stopLoss?: string;
  symbol?: string;
  targetPrice?: string;
};

type TickerSuggestion = {
  currency: string;
  exchange: string;
  name: string;
  symbol: string;
};

type EntryPriceEstimate = {
  confidence: "higher" | "estimate";
  estimatedPrice: number;
  message: string;
  source: "fmp_intraday" | "fmp_daily_estimate";
  sourceTime: string | null;
};

type ExitPlan = {
  actionLabel: string;
  actionTone: "positive" | "neutral" | "caution";
  checklist: string[];
  confidence: "higher" | "estimate";
  currentPrice: number | null;
  dataQuality: "daily_analysis" | "live_structure" | "limited_structure";
  explanation: string;
  holdingPeriodDays: number;
  invalidationSignals: string[];
  rewardRiskRatio: number;
  source: "swingfi_daily_analysis" | "market_structure_estimate";
  stopLoss: number;
  takeProfitZoneHigh: number;
  takeProfitZoneLow: number;
  targetPrice: number;
  trailingStop: number;
  trendState: "uptrend" | "sideways" | "downtrend" | "unknown";
};

type PortfolioCoachNote = {
  mode: "deterministic" | "openai";
  text: string;
};

type FormState = {
  assetType: AssetType;
  entryDate: string;
  entryPrice: string;
  entryTimeWindow: "open" | "midday" | "afternoon" | "after_hours";
  holdingPeriodDays: string;
  notes: string;
  opportunityId: string;
  quantity: string;
  stopLoss: string;
  symbol: string;
  targetPrice: string;
};

const initialForm: FormState = {
  assetType: "stock",
  entryDate: new Date().toISOString().slice(0, 10),
  entryPrice: "",
  entryTimeWindow: "open",
  holdingPeriodDays: "10",
  notes: "",
  opportunityId: "",
  quantity: "1",
  stopLoss: "",
  symbol: "",
  targetPrice: "",
};

const assetLabels: Record<AssetType, string> = {
  crypto: "Crypto",
  etf: "ETF",
  stock: "US stock",
};

const timeWindowLabels: Record<FormState["entryTimeWindow"], string> = {
  after_hours: "After hours",
  afternoon: "Afternoon",
  midday: "Midday",
  open: "Near open",
};

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatTime(value: string | null) {
  if (!value) return "Not refreshed yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not refreshed yet";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function validateTradePlan(form: FormState) {
  const symbol = form.symbol.trim();
  const entryPrice = toNumber(form.entryPrice);
  const targetPrice = toNumber(form.targetPrice);
  const stopLoss = toNumber(form.stopLoss);
  const quantity = toNumber(form.quantity);

  if (!symbol) return "Add the ticker symbol you bought.";
  if (!entryPrice) return "Add the price you paid for the trade.";
  if (!quantity) return "Add how many shares or units you bought.";
  if (targetPrice && targetPrice <= entryPrice) return "For long trades, the target should be above your entry price.";
  if (stopLoss && stopLoss >= entryPrice) return "For long trades, the stop loss should be below your entry price.";

  return "";
}

function mapAssetType(value: string | undefined): AssetType {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "crypto") return "crypto";
  if (normalized === "etf") return "etf";
  return "stock";
}

function buildOpenedAt(date: string, window: FormState["entryTimeWindow"]) {
  const time = {
    after_hours: "16:30:00",
    afternoon: "15:00:00",
    midday: "12:30:00",
    open: "09:45:00",
  }[window];

  return new Date(`${date}T${time}`).toISOString();
}

function cleanInitialEntryDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : initialForm.entryDate;
}

function cleanInitialTimeWindow(value: string | undefined): FormState["entryTimeWindow"] {
  return value === "midday" || value === "afternoon" || value === "after_hours"
    ? value
    : "open";
}

function formFromInitialTrade(initialTrade?: InitialTrade): FormState {
  if (!initialTrade?.symbol) return initialForm;

  const entryLow = toNumber(initialTrade.entryLow);
  const entryHigh = toNumber(initialTrade.entryHigh);
  const midpoint = entryLow && entryHigh ? ((entryLow + entryHigh) / 2).toFixed(2) : "";
  const holdingDays = toNumber(initialTrade.holdingPeriodDays);

  return {
    ...initialForm,
    assetType: mapAssetType(initialTrade.assetType),
    entryDate: cleanInitialEntryDate(initialTrade.entryDate),
    entryPrice: midpoint,
    entryTimeWindow: cleanInitialTimeWindow(initialTrade.entryTimeWindow),
    holdingPeriodDays: holdingDays ? String(holdingDays) : initialForm.holdingPeriodDays,
    notes: holdingDays
      ? `Original SwingFi plan estimated a ${holdingDays}-day holding window. Added from dashboard after the user chose a rough buy time.`
      : "Added from SwingFi dashboard after the user chose a rough buy time.",
    opportunityId: initialTrade.opportunityId ?? "",
    stopLoss: initialTrade.stopLoss ?? "",
    symbol: initialTrade.symbol.toUpperCase(),
    targetPrice: initialTrade.targetPrice ?? "",
  };
}

function statusTone(status: string) {
  if (status === "At or above target" || status === "Near target" || status === "Inside plan") {
    return "border-pine/25 bg-mint text-pine";
  }

  if (status === "Below stop" || status === "Near stop") {
    return "border-coral/25 bg-coral/10 text-coral";
  }

  return "border-amber/25 bg-amber/15 text-ink";
}

function planStatusLabel(status: string) {
  if (status === "Near stop") return "Close to saved stop";
  if (status === "Below stop") return "Below saved stop";
  if (status === "Near target") return "Close to target";
  if (status === "At or above target") return "Target reached";
  if (status === "Review time window") return "Time to review";
  if (status === "Inside plan") return "Inside plan";
  return status;
}

function reviewCountdown(trade: PortfolioTrade) {
  if (!trade.plannedHoldingDays) {
    return {
      label: "SwingFi monitoring",
      detail: "No review countdown was saved for this trade.",
      progress: 0,
      urgency: "neutral",
    };
  }

  const daysLeft = trade.plannedHoldingDays - trade.daysHeld;
  const progress = Math.min(Math.max((trade.daysHeld / trade.plannedHoldingDays) * 100, 0), 100);

  if (daysLeft <= 0) {
    return {
      label: "Review sell plan now",
      detail: `${trade.plannedHoldingDays}-day swing window has arrived.`,
      progress: 100,
      urgency: "high",
    };
  }

  if (daysLeft <= 2) {
    return {
      label: `${daysLeft} day${daysLeft === 1 ? "" : "s"} to review`,
      detail: "Prepare to review the target, stop, news, and current trend.",
      progress,
      urgency: "watch",
    };
  }

  return {
    label: `${daysLeft} days left`,
    detail: `${trade.daysHeld} of ${trade.plannedHoldingDays} planned swing days complete.`,
    progress,
    urgency: "calm",
  };
}

function countdownTone(urgency: string) {
  if (urgency === "high") return "border-coral/25 bg-coral/10 text-coral";
  if (urgency === "watch") return "border-amber/25 bg-amber/15 text-ink";
  return "border-pine/15 bg-mint text-pine";
}

function exitPlanTone(tone: ExitPlan["actionTone"]) {
  if (tone === "positive") return "border-pine/20 bg-mint text-pine";
  if (tone === "caution") return "border-coral/25 bg-coral/10 text-coral";
  return "border-amber/30 bg-amber/15 text-ink";
}

function dataQualityLabel(value: ExitPlan["dataQuality"]) {
  if (value === "daily_analysis") return "Daily ranking plan";
  if (value === "live_structure") return "Live structure estimate";
  return "Limited structure estimate";
}

function rewardRiskForTrade(trade: PortfolioTrade) {
  const entry = Number(trade.entry_price);
  const target = Number(trade.target_price);
  const stop = Number(trade.stop_loss);
  const reward = target - entry;
  const risk = entry - stop;

  return risk > 0 ? reward / risk : 0;
}

function percentDistance(from: number | null, to: number) {
  if (!from || !Number.isFinite(from) || from <= 0 || !Number.isFinite(to) || to <= 0) return null;

  return ((to - from) / from) * 100;
}

function getTradeReview(trade: PortfolioTrade) {
  const countdown = reviewCountdown(trade);
  const rewardRisk = rewardRiskForTrade(trade);
  const targetDistance = percentDistance(trade.currentPrice, Number(trade.target_price));
  const stopDistance = percentDistance(trade.currentPrice, Number(trade.stop_loss));
  const lossFromEntry = trade.unrealizedReturnPct !== null && trade.unrealizedReturnPct < 0;
  const hasFreshNews = trade.latestNews.length > 0;
  const nearTarget = trade.planStatus === "At or above target" || trade.planStatus === "Near target";
  const nearStop = trade.planStatus === "Below stop" || trade.planStatus === "Near stop";
  const timeReview = trade.planStatus === "Review time window" || countdown.urgency === "high";
  const priority =
    nearStop ? 100 : nearTarget ? 90 : timeReview ? 80 : countdown.urgency === "watch" ? 66 : lossFromEntry ? 52 : 35;
  const tone =
    nearStop ? "caution" : nearTarget || timeReview || countdown.urgency === "watch" ? "neutral" : "positive";
  const label =
    nearStop
      ? "Protect capital"
      : nearTarget
        ? "Plan profit-taking"
        : timeReview
          ? "Review the hold window"
          : countdown.urgency === "watch"
            ? "Prepare a decision"
            : lossFromEntry
              ? "Watch support closely"
              : "Plan is still intact";
  const nextStep =
    nearStop
      ? "Check whether the stop has triggered and avoid widening risk without a fresh reason."
      : nearTarget
        ? "Decide before the target zone whether to sell, trim, or trail the stop."
        : timeReview
          ? "Review current trend, latest news, and whether the original swing window still makes sense."
          : countdown.urgency === "watch"
            ? "Start planning the exit decision before the countdown reaches zero."
            : lossFromEntry
              ? "Compare the current price to the stop and make sure the downside still fits your account."
              : "Keep monitoring price, news, and the countdown; no urgent change is flagged.";
  const evidence = [
    `Status: ${trade.planStatus}.`,
    `Reward/risk from entry is about ${rewardRisk.toFixed(1)}R.`,
    targetDistance === null
      ? "Target distance unavailable."
      : targetDistance >= 0
        ? `Saved target is ${Math.abs(targetDistance).toFixed(1)}% above latest price.`
        : `Latest price is ${Math.abs(targetDistance).toFixed(1)}% above the saved target.`,
    stopDistance === null
      ? "Stop distance unavailable."
      : stopDistance >= 0
        ? `Latest price is ${Math.abs(stopDistance).toFixed(1)}% below the saved stop.`
        : `Saved stop is ${Math.abs(stopDistance).toFixed(1)}% below latest price.`,
    hasFreshNews ? "Fresh headlines are available to review." : "No fresh FMP headlines are available.",
  ];

  return {
    evidence,
    label,
    nextStep,
    priority,
    rewardRisk,
    tone,
  };
}

function getExitDecisionGuide(trade: PortfolioTrade) {
  const current = trade.currentPrice;
  const entry = Number(trade.entry_price);
  const target = Number(trade.target_price);
  const stop = Number(trade.stop_loss);
  const countdown = reviewCountdown(trade);
  const targetDistance = percentDistance(current, target);
  const stopDistance = percentDistance(current, stop);
  const rewardRisk = rewardRiskForTrade(trade);
  const gainPct = current && entry > 0 ? ((current - entry) / entry) * 100 : null;
  const daysLeft = trade.plannedHoldingDays ? trade.plannedHoldingDays - trade.daysHeld : null;
  const inDecisionWindow =
    trade.planStatus === "Review time window" ||
    trade.planStatus === "Near target" ||
    trade.planStatus === "At or above target" ||
    trade.planStatus === "Near stop" ||
    trade.planStatus === "Below stop" ||
    countdown.urgency === "watch" ||
    countdown.urgency === "high";

  if (trade.planStatus === "Below stop") {
    return {
      actions: [
        "Check whether price traded through the saved stop.",
        "If the stop was triggered, review closing or reducing risk instead of hoping it recovers.",
        "Only keep tracking if you have a new, written setup reason.",
      ],
      avoidAction: "Do not widen the stop or average down just because the trade is uncomfortable.",
      beginnerMeaning: "The saved risk line is not holding. In beginner terms, the priority is protecting your account, not proving the trade right.",
      decisionChoices: [
        "Close or reduce if your broker shows the stop was triggered.",
        "Keep it only if you can write a new setup reason and new risk line.",
        "Skip averaging down unless you have a separate, planned strategy.",
      ],
      headline: "Stop area is breached",
      helper: "The original risk line is no longer holding. The main beginner mistake here is moving the stop lower without a fresh plan.",
      holdCondition: "Only keep the trade on watch if you can write a new setup reason and a new risk line before acting.",
      primaryAction: "Review closing or reducing risk from your brokerage if the stop has triggered.",
      secondaryAction: "If the quote recovered above the stop, wait for support to hold before giving it more time.",
      status: "Protect capital first",
      tone: "caution" as const,
      watch: [
        `Saved stop: ${formatCurrency(stop)}`,
        current ? `Latest price: ${formatCurrency(current)}` : "Latest price unavailable",
        "Do not average down just because the trade is red.",
      ],
    };
  }

  if (trade.planStatus === "Near stop") {
    return {
      actions: [
        "Look at the latest price and compare it with the saved stop before making any new decision.",
        "Check whether the latest headline tone or broader market weakness explains the pressure.",
        "Keep the original stop visible; changing it should require a new written reason.",
      ],
      avoidAction: "Avoid moving the stop lower just because the trade is uncomfortable.",
      beginnerMeaning: "This means the price is getting close to the risk line you saved when the trade was created. It is not an automatic sell signal, but it is a warning to review the plan before the stop is reached.",
      decisionChoices: [
        "If price stays above the stop and the reason for the trade still makes sense, keep monitoring.",
        "If the possible loss now feels too large, review reducing risk from your brokerage.",
        "If price reaches or breaks the saved stop, compare that with the exit rule you chose when entering.",
      ],
      headline: `${trade.symbol} is close to your saved stop`,
      helper: "SwingFi is flagging risk because the price buffer above your stop is small. The question is whether the original trade reason still holds.",
      holdCondition: "Giving the trade more time only makes sense if price remains above the saved stop and the latest news or market context does not add new risk.",
      primaryAction: "Review your risk line before price reaches the stop.",
      secondaryAction: "Check the latest price, saved stop, news tone, and market weakness before giving the plan more time.",
      status: "Risk review",
      tone: "caution" as const,
      watch: [
        stopDistance === null ? "Stop distance unavailable" : `${Math.abs(stopDistance).toFixed(1)}% from stop`,
        "Weak close below support",
        "Negative news or market weakness",
      ],
    };
  }

  if (trade.planStatus === "At or above target") {
    return {
      actions: [
        "Review taking profit or closing the trade while the target is available.",
        "If you keep part of the trade, consider moving the stop up to protect gains.",
        "Write down why you are holding longer before changing the plan.",
      ],
      avoidAction: "Avoid turning a planned swing win into an open-ended hold because the move feels exciting.",
      beginnerMeaning: "The trade reached the area SwingFi planned for profit. This is when you review taking gains, trimming, or protecting the win.",
      decisionChoices: [
        "Take profit or close if the original plan is complete.",
        "Trim part and protect the rest if momentum still looks strong.",
        "Trail a stop only if you understand where you will exit if price reverses.",
      ],
      headline: "Target area is available",
      helper: "The planned reward has arrived. For beginners, this is where discipline matters: have a reason to keep holding, not just excitement.",
      holdCondition: "Holding longer should require strong momentum plus a protected stop above your original risk zone.",
      primaryAction: "Review taking profit, trimming, or closing while the planned target is available.",
      secondaryAction: "If you keep part of it, review moving protection higher so a winner does not become a loss.",
      status: "Profit decision now",
      tone: "neutral" as const,
      watch: [
        `Target: ${formatCurrency(target)}`,
        gainPct === null ? "Gain unavailable" : `Open gain: ${formatPercent(gainPct)}`,
        "Large reversal candle or fading volume",
      ],
    };
  }

  if (trade.planStatus === "Near target") {
    return {
      actions: [
        "Decide your exit plan before price touches the target.",
        "Consider whether you would rather close, trim some, or trail a stop if momentum is still strong.",
        "Avoid adding new shares near the target unless the reward/risk still improves.",
      ],
      avoidAction: "Avoid buying more near the target unless the new entry still has a clean reward/risk profile.",
      beginnerMeaning: "You are close to the planned profit area. The best move is to decide the exit plan before emotion kicks in.",
      decisionChoices: [
        "Prepare to take profit if price reaches the target.",
        "Choose whether you would trim, close, or trail before it gets there.",
        "Avoid adding new shares unless the new entry still has enough upside.",
      ],
      headline: "Close to the target zone",
      helper: "This is the moment to plan the exit before emotion shows up. A good swing trade can still become messy if you chase the last few percent.",
      holdCondition: "Holding through the target zone needs strong volume, no reversal, and a clear trailing-stop plan.",
      primaryAction: "Choose your profit plan before price reaches target: close, trim, or trail.",
      secondaryAction: "Watch for rejection near resistance and be ready to protect gains if momentum fades.",
      status: "Prepare profit plan",
      tone: "neutral" as const,
      watch: [
        targetDistance === null ? "Target distance unavailable" : `${Math.abs(targetDistance).toFixed(1)}% from target`,
        "Volume fade near resistance",
        "Price rejection near the target area",
      ],
    };
  }

  if (trade.planStatus === "Review time window" || countdown.urgency === "high") {
    return {
      actions: [
        "Re-read the original reason for the trade and check if it is still true.",
        "If price is not progressing, consider tightening the stop or closing the trade from your brokerage.",
        "If trend and news are still supportive, define a new review date before holding longer.",
      ],
      avoidAction: "Avoid letting a planned swing trade become a long-term hold by accident.",
      beginnerMeaning: "The planned swing window is ending. That does not mean automatic sell, but it does mean the trade needs a fresh decision.",
      decisionChoices: [
        "Close if the setup failed or has not progressed.",
        "Tighten risk if price is drifting but not broken.",
        "Set a new review date only if trend, news, and market context still support it.",
      ],
      headline: "Planned swing window is ending",
      helper: "The countdown does not mean automatic sell. It means the trade needs a fresh decision instead of drifting into a long-term hold by accident.",
      holdCondition: "Holding longer should require price progress, supportive news, and a new review date.",
      primaryAction: "Review whether to close, tighten the stop, or set a new written review date.",
      secondaryAction: "Compare this trade with today's cleaner opportunities before keeping capital tied up.",
      status: "Decision required",
      tone: "neutral" as const,
      watch: [
        trade.plannedHoldingDays ? `${trade.plannedHoldingDays}-day plan reached` : "Plan window reached",
        gainPct === null ? "Open gain unavailable" : `Open return: ${formatPercent(gainPct)}`,
        "No progress after the planned hold window",
      ],
    };
  }

  if (countdown.urgency === "watch") {
    return {
      actions: [
        "Start deciding what would make you close, trim, or keep holding.",
        "Check whether price is moving toward target faster than it is moving toward stop.",
        "Review news and the broader market before the countdown reaches zero.",
      ],
      avoidAction: "Avoid waiting until the last review day to think through the exit.",
      beginnerMeaning: "The exit review is coming soon. You still have time, but you should know what would make you close, trim, or keep holding.",
      decisionChoices: [
        "Keep holding while price stays above stop and moves toward target.",
        "Plan your profit response before the final review day.",
        "Review news and market direction once per day.",
      ],
      headline: "Exit decision is coming soon",
      helper: "You do not need to act immediately, but you should know what you will do before the final review day arrives.",
      holdCondition: "Holding is reasonable while the setup remains above stop and keeps moving toward target.",
      primaryAction: "Write your exit rule now: what price, news, or day would make you close or trim?",
      secondaryAction: "Use the countdown to prepare instead of reacting emotionally later.",
      status: "Plan ahead",
      tone: "neutral" as const,
      watch: [
        daysLeft === null ? "Review date unavailable" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
        `Reward/risk: ${rewardRisk.toFixed(1)}R`,
        "Target, stop, latest news, and market direction",
      ],
    };
  }

  return {
    actions: [
      "Keep the trade only while price stays above the stop and the setup still makes sense.",
      "Review target and stop once per day; avoid checking so often that you react emotionally.",
      "If you change the plan, write down the reason before acting.",
    ],
    avoidAction: "Avoid changing the target, stop, or hold window without writing down the new reason.",
    beginnerMeaning: "Nothing urgent is flagged right now. The job is to follow the plan, not constantly react to every small price move.",
    decisionChoices: [
      "Keep monitoring if price remains above the stop.",
      "Let the target and time window guide your review.",
      "Update the plan only when new price action or news changes the setup.",
    ],
    headline: "No exit pressure right now",
    helper: inDecisionWindow
      ? "A review flag is active, so slow down and compare the trade against the saved plan."
      : "The plan is still active. The job is to let the trade work while keeping the exit rules visible.",
    holdCondition: "Keep tracking while price stays above stop, the setup remains intact, and no new event risk changes the plan.",
    primaryAction: "Hold the plan for now, but keep target and stop visible before making any new decision.",
    secondaryAction: "Review once daily instead of reacting to every small price move.",
    status: "Hold while valid",
    tone: "positive" as const,
    watch: [
      targetDistance === null ? "Target distance unavailable" : `${Math.abs(targetDistance).toFixed(1)}% from target`,
      stopDistance === null ? "Stop distance unavailable" : `${Math.abs(stopDistance).toFixed(1)}% from stop`,
      "Any new event risk or headline that changes the setup",
    ],
  };
}

function tradeRiskDollars(trade: PortfolioTrade) {
  return Math.max(0, (Number(trade.entry_price) - Number(trade.stop_loss)) * Number(trade.quantity));
}

function tradeUpsideDollars(trade: PortfolioTrade) {
  return Math.max(0, (Number(trade.target_price) - Number(trade.entry_price)) * Number(trade.quantity));
}

function reviewTone(tone: ReturnType<typeof getTradeReview>["tone"]) {
  if (tone === "positive") return "border-pine/20 bg-mint text-pine";
  if (tone === "caution") return "border-coral/25 bg-coral/10 text-coral";
  return "border-amber/30 bg-amber/15 text-ink";
}

function isEntryPriceEstimate(value: unknown): value is EntryPriceEstimate {
  const estimate = value as Partial<EntryPriceEstimate>;

  return (
    typeof estimate.estimatedPrice === "number" &&
    typeof estimate.message === "string" &&
    (estimate.source === "fmp_intraday" || estimate.source === "fmp_daily_estimate")
  );
}

function isExitPlan(value: unknown): value is ExitPlan {
  const plan = value as Partial<ExitPlan>;

  return (
    typeof plan.targetPrice === "number" &&
    typeof plan.stopLoss === "number" &&
    typeof plan.holdingPeriodDays === "number" &&
    typeof plan.explanation === "string" &&
    (plan.source === "swingfi_daily_analysis" || plan.source === "market_structure_estimate")
  );
}

function PortfolioSessionReconnect() {
  return (
    <section className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
      <div className="grid lg:grid-cols-[1fr_360px]">
        <div className="p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Secure portfolio session
          </p>
          <h2 className="mt-3 text-3xl font-black text-ink">
            Log in again to save and track trades
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ink/62">
            Your SwingFi profile is still saved in this browser, but portfolio
            tracking needs a verified account session before we can load, save,
            close, or update your trade plans.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={loginHref("/portfolio")}
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
            Why this matters
          </p>
          <p className="mt-4 text-sm font-semibold leading-7 text-white/68">
            Portfolio entries can include position size, notes, targets, stops,
            and outcomes. Re-authentication keeps that information private and
            tied to the right account.
          </p>
        </div>
      </div>
    </section>
  );
}

function getSessionToken() {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return Promise.resolve("");

  return supabase.auth.getSession().then(({ data }) => data.session?.access_token ?? "");
}

export function SwingPortfolioPanel({ initialTrade }: { initialTrade?: InitialTrade }) {
  const autoEstimatedInitialTrade = useRef(false);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [form, setForm] = useState<FormState>(() => formFromInitialTrade(initialTrade));
  const [trades, setTrades] = useState<PortfolioTrade[]>([]);
  const [positionFilter, setPositionFilter] = useState<"all" | "attention" | "inside_plan">("all");
  const [loading, setLoading] = useState(true);
  const [requiresSessionReconnect, setRequiresSessionReconnect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(Boolean(initialTrade?.symbol));
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingTradeIds, setDeletingTradeIds] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(
    initialTrade?.symbol
      ? { tone: "info", text: `${initialTrade.symbol.toUpperCase()} is ready to save to your Swing Portfolio.` }
      : null,
  );
  const [closePrices, setClosePrices] = useState<Record<string, string>>({});
  const [tickerSuggestions, setTickerSuggestions] = useState<TickerSuggestion[]>([]);
  const [tickerSearchLoading, setTickerSearchLoading] = useState(false);
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const [entryEstimate, setEntryEstimate] = useState<EntryPriceEstimate | null>(null);
  const [estimatingEntryPrice, setEstimatingEntryPrice] = useState(false);
  const [exitPlan, setExitPlan] = useState<ExitPlan | null>(null);
  const [buildingExitPlan, setBuildingExitPlan] = useState(false);
  const [coachNote, setCoachNote] = useState<PortfolioCoachNote | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [portfolioInsightsBySymbol, setPortfolioInsightsBySymbol] = useState<
    Record<string, PlainLanguageInsight>
  >({});

  const openTrades = useMemo(
    () => trades.filter((trade) => trade.status === "open" || trade.status === "planned"),
    [trades],
  );
  const closedTrades = useMemo(
    () => trades.filter((trade) => trade.status === "closed" || trade.status === "cancelled"),
    [trades],
  );
  const tradeReviews = useMemo(() => {
    const reviews = new Map<string, ReturnType<typeof getTradeReview>>();
    openTrades.forEach((trade) => reviews.set(trade.id, getTradeReview(trade)));
    return reviews;
  }, [openTrades]);
  const attentionTrades = useMemo(
    () =>
      openTrades
        .filter((trade) => (tradeReviews.get(trade.id)?.priority ?? 0) >= 66)
        .sort((a, b) => (tradeReviews.get(b.id)?.priority ?? 0) - (tradeReviews.get(a.id)?.priority ?? 0)),
    [openTrades, tradeReviews],
  );
  const visibleOpenTrades = useMemo(() => {
    if (positionFilter === "attention") return attentionTrades;
    if (positionFilter === "inside_plan") {
      return openTrades.filter((trade) => (tradeReviews.get(trade.id)?.priority ?? 0) < 66);
    }

    return [...openTrades].sort(
      (a, b) => (tradeReviews.get(b.id)?.priority ?? 0) - (tradeReviews.get(a.id)?.priority ?? 0),
    );
  }, [attentionTrades, openTrades, positionFilter, tradeReviews]);

  useEffect(() => {
    if (!openTrades.length) {
      setPortfolioInsightsBySymbol({});
      return;
    }

    let isActive = true;
    const tradePayloads = openTrades.map((trade) => {
      const liveIntelligence = getTradeLiveIntelligence({
        currentPrice: trade.currentPrice,
        daysHeld: trade.daysHeld,
        entryPrice: Number(trade.entry_price),
        latestNews: trade.latestNews,
        plannedHoldingDays: trade.plannedHoldingDays,
        planStatus: trade.planStatus,
        stopLoss: Number(trade.stop_loss),
        symbol: trade.symbol,
        targetPrice: Number(trade.target_price),
        unrealizedReturnPct: trade.unrealizedReturnPct,
      });

      return {
        currentPrice: trade.currentPrice,
        daysHeld: trade.daysHeld,
        directionRead: liveIntelligence.directionRead,
        entryPrice: Number(trade.entry_price),
        latestNews: trade.latestNews.map((item) => ({ title: item.title })),
        liveRead: liveIntelligence.liveRead,
        nextReview: liveIntelligence.nextReview,
        planStatus: trade.planStatus,
        plannedHoldingDays: trade.plannedHoldingDays,
        stopLoss: Number(trade.stop_loss),
        symbol: trade.symbol,
        targetPrice: Number(trade.target_price),
        unrealizedReturnPct: trade.unrealizedReturnPct,
      };
    });
    const fallbackInsights = Object.fromEntries(
      tradePayloads.map((trade) => [trade.symbol, buildPortfolioPlainInsight(trade)]),
    );

    setPortfolioInsightsBySymbol(fallbackInsights);

    async function loadPortfolioInsights() {
      const token = await getSessionToken();
      if (!token) return;

      const response = await fetch("/api/insights/portfolio", {
        body: JSON.stringify({ trades: tradePayloads }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        insights?: Record<string, PlainLanguageInsight>;
      } | null;

      if (!isActive || !payload?.insights) return;

      setPortfolioInsightsBySymbol((current) => ({
        ...current,
        ...payload.insights,
      }));
    }

    loadPortfolioInsights().catch(() => {
      if (isActive) setPortfolioInsightsBySymbol(fallbackInsights);
    });

    return () => {
      isActive = false;
    };
  }, [openTrades]);

  const portfolioStats = useMemo(() => {
    const invested = openTrades.reduce(
      (total, trade) => total + Number(trade.entry_price) * Number(trade.quantity),
      0,
    );
    const openReturn = openTrades.reduce((total, trade) => {
      if (!trade.currentPrice) return total;
      return total + (trade.currentPrice - Number(trade.entry_price)) * Number(trade.quantity);
    }, 0);
    const needsReview = openTrades.filter((trade) =>
      ["Below stop", "Near stop", "At or above target", "Review time window"].includes(trade.planStatus),
    ).length;
    const riskAtStop = openTrades.reduce((total, trade) => total + tradeRiskDollars(trade), 0);
    const targetUpside = openTrades.reduce((total, trade) => total + tradeUpsideDollars(trade), 0);
    const averageRewardRisk = openTrades.length
      ? openTrades.reduce((total, trade) => total + rewardRiskForTrade(trade), 0) / openTrades.length
      : 0;
    const riskPercentOfInvested = invested > 0 ? (riskAtStop / invested) * 100 : 0;
    const healthScore = Math.round(
      clamp(
        86 -
          attentionTrades.length * 12 -
          Math.max(0, riskPercentOfInvested - 7) * 2 +
          Math.min(averageRewardRisk, 3) * 4,
        0,
        100,
      ),
    );

    return {
      averageRewardRisk,
      healthScore,
      invested,
      needsReview,
      openReturn,
      riskAtStop,
      riskPercentOfInvested,
      targetUpside,
    };
  }, [attentionTrades.length, openTrades]);
  const portfolioBriefing = useMemo(() => {
    if (!openTrades.length) {
      return {
        body: "Add a trade after you decide to act on a SwingFi idea or an outside ticker. SwingFi will generate the sell plan and keep the countdown visible.",
        cta: "Add your first trade",
        headline: "Your portfolio is ready for tracking",
        tone: "neutral" as const,
      };
    }

    const urgent = attentionTrades[0];
    const urgentReview = urgent ? tradeReviews.get(urgent.id) : null;

    if (urgent && urgentReview) {
      const positionNoun = attentionTrades.length === 1 ? "position needs" : "positions need";
      return {
        body: `${urgent.symbol}: ${urgentReview.nextStep}`,
        cta: "Review attention list",
        headline: `${attentionTrades.length} ${positionNoun} a decision check`,
        tone: urgentReview.tone,
      };
    }

    return {
      body: "Open positions are inside their plans. Keep the stop visible, avoid adding without a fresh setup, and let the countdown guide the next review.",
      cta: "Review all positions",
      headline: "No urgent portfolio actions right now",
      tone: "positive" as const,
    };
  }, [attentionTrades, openTrades.length, tradeReviews]);
  const localCoachNote = useMemo(() => {
    if (!openTrades.length) {
      return {
        mode: "deterministic",
        text: "No open trades are being tracked yet. Add only trades you actually decide to take, then SwingFi can keep the target, stop, countdown, and review status visible after daily rankings refresh.",
      } satisfies PortfolioCoachNote;
    }

    const riskLine =
      portfolioStats.riskPercentOfInvested > 10
        ? "Risk at stop is elevated versus tracked entry value, so review position sizes before adding more exposure."
        : "Risk at stop looks controlled relative to tracked entry value.";
    const attentionLine = attentionTrades.length
      ? `${attentionTrades.length} position${attentionTrades.length === 1 ? " needs" : "s need"} a closer review before new trades.`
      : "No open position is currently near target, stop, or the end of its swing window.";
    const rewardLine =
      portfolioStats.averageRewardRisk >= 2
        ? `Average reward/risk is about ${portfolioStats.averageRewardRisk.toFixed(1)}R, which gives the plans room to work if entries and stops are respected.`
        : `Average reward/risk is about ${portfolioStats.averageRewardRisk.toFixed(1)}R, so avoid chasing entries and be quicker to reject weak setups.`;

    return {
      mode: "deterministic",
      text: `${attentionLine} ${riskLine} ${rewardLine}`,
    } satisfies PortfolioCoachNote;
  }, [attentionTrades.length, openTrades.length, portfolioStats.averageRewardRisk, portfolioStats.riskPercentOfInvested]);
  const draftPlanMath = useMemo(() => {
    const entryPrice = toNumber(form.entryPrice);
    const targetPrice = toNumber(form.targetPrice);
    const stopLoss = toNumber(form.stopLoss);
    const quantity = toNumber(form.quantity) ?? 1;

    if (!entryPrice || !targetPrice || !stopLoss) {
      return null;
    }

    const plannedUpside = ((targetPrice - entryPrice) / entryPrice) * 100;
    const plannedDownside = ((entryPrice - stopLoss) / entryPrice) * 100;
    const dollarsAtTarget = (targetPrice - entryPrice) * quantity;
    const dollarsAtStop = (entryPrice - stopLoss) * quantity;
    const rewardRisk = dollarsAtStop > 0 ? dollarsAtTarget / dollarsAtStop : null;
    const isValidLongPlan = plannedUpside > 0 && plannedDownside > 0;

    return {
      dollarsAtStop,
      dollarsAtTarget,
      isValidLongPlan,
      plannedDownside,
      plannedUpside,
      rewardRisk,
    };
  }, [form.entryPrice, form.quantity, form.stopLoss, form.targetPrice]);

  async function generateCoachNote() {
    setCoachLoading(true);
    setMessage(null);

    try {
      const token = await getSessionToken();
      if (!token) {
        setRequiresSessionReconnect(true);
        return;
      }

      const response = await fetch("/api/portfolio/coach", {
        body: JSON.stringify({
          attentionCount: attentionTrades.length,
          averageRewardRisk: portfolioStats.averageRewardRisk,
          invested: portfolioStats.invested,
          openReturn: portfolioStats.openReturn,
          riskAtStop: portfolioStats.riskAtStop,
          targetUpside: portfolioStats.targetUpside,
          trades: openTrades.slice(0, 12).map((trade) => ({
            daysHeld: trade.daysHeld,
            planStatus: trade.planStatus,
            rewardRisk: rewardRiskForTrade(trade),
            symbol: trade.symbol,
            unrealizedReturnPct: trade.unrealizedReturnPct,
          })),
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; text?: string };

      if (!response.ok || !payload.text) {
        setCoachNote(localCoachNote);
        setMessage({
          tone: "info",
          text: payload.error
            ? `Using SwingFi's built-in portfolio coach because AI coach is unavailable: ${payload.error}`
            : "Using SwingFi's built-in portfolio coach because AI coach is unavailable.",
        });
        return;
      }

      setCoachNote({ mode: "openai", text: payload.text });
    } finally {
      setCoachLoading(false);
    }
  }

  useEffect(() => {
    const query = form.symbol.trim();
    let active = true;

    if (query.length < 1 || initialTrade?.symbol) {
      setTickerSuggestions([]);
      setTickerSearchLoading(false);
      return;
    }

    setTickerSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const token = await getSessionToken();
        if (!token) {
          if (active) {
            setTickerSuggestions([]);
            setTickerSearchLoading(false);
          }
          return;
        }

        const response = await fetch(`/api/portfolio/symbol-search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json().catch(() => ({}))) as {
          results?: TickerSuggestion[];
        };

        if (!active) return;
        setTickerSuggestions(response.ok ? payload.results ?? [] : []);
      } catch {
        if (active) setTickerSuggestions([]);
      } finally {
        if (active) setTickerSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.symbol, initialTrade?.symbol]);

  function selectTickerSuggestion(suggestion: TickerSuggestion) {
    setForm((current) => ({
      ...current,
      assetType: suggestion.exchange.toUpperCase().includes("ETF") ? "etf" : "stock",
      symbol: suggestion.symbol,
    }));
    setEntryEstimate(null);
    setExitPlan(null);
    setShowTickerSuggestions(false);
  }

  const estimateEntryPrice = useCallback(async () => {
    const symbol = form.symbol.trim();
    if (!symbol) {
      setMessage({ tone: "error", text: "Choose the ticker before estimating the entry price." });
      return;
    }

    setEstimatingEntryPrice(true);
    setEntryEstimate(null);
    setMessage(null);

    try {
      const token = await getSessionToken();
      if (!token) {
        setRequiresSessionReconnect(true);
        return;
      }

      const response = await fetch("/api/portfolio/entry-price", {
        body: JSON.stringify({
          date: form.entryDate,
          symbol,
          timeWindow: form.entryTimeWindow,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as
        | EntryPriceEstimate
        | { error?: string };

      if (!response.ok || !isEntryPriceEstimate(payload)) {
        setMessage({
          tone: "error",
          text:
            "error" in payload && payload.error
              ? payload.error
              : "SwingFi could not estimate the entry price.",
        });
        return;
      }

      setEntryEstimate(payload);
      setExitPlan(null);
      setForm((current) => ({
        ...current,
        entryPrice: payload.estimatedPrice.toFixed(2),
      }));
      setMessage({
        tone: "info",
        text: `Entry price estimated at ${formatCurrency(payload.estimatedPrice)}. Check your broker fill and edit if needed.`,
      });
    } finally {
      setEstimatingEntryPrice(false);
    }
  }, [form.entryDate, form.entryTimeWindow, form.symbol]);

  useEffect(() => {
    if (
      autoEstimatedInitialTrade.current ||
      !initialTrade?.symbol ||
      !initialTrade.entryDate ||
      !initialTrade.entryTimeWindow
    ) {
      return;
    }

    autoEstimatedInitialTrade.current = true;
    void estimateEntryPrice();
  }, [estimateEntryPrice, initialTrade?.entryDate, initialTrade?.entryTimeWindow, initialTrade?.symbol]);

  useEffect(() => {
    const symbol = form.symbol.trim();
    const entryPrice = toNumber(form.entryPrice);
    let active = true;

    if (!symbol || !entryPrice) {
      setExitPlan(null);
      setBuildingExitPlan(false);
      return;
    }

    setBuildingExitPlan(true);
    const timer = window.setTimeout(async () => {
      try {
        const token = await getSessionToken();
        if (!token) {
          if (active) setBuildingExitPlan(false);
          return;
        }

        const response = await fetch("/api/portfolio/exit-plan", {
          body: JSON.stringify({
            entryPrice,
            symbol,
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = (await response.json().catch(() => ({}))) as ExitPlan | { error?: string };

        if (!active) return;

        if (response.ok && isExitPlan(payload)) {
          setExitPlan(payload);
          setForm((current) => ({
            ...current,
            holdingPeriodDays: String(payload.holdingPeriodDays),
            stopLoss: payload.stopLoss.toFixed(2),
            targetPrice: payload.targetPrice.toFixed(2),
          }));
        } else {
          setExitPlan(null);
        }
      } catch {
        if (active) setExitPlan(null);
      } finally {
        if (active) setBuildingExitPlan(false);
      }
    }, 650);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.entryPrice, form.symbol]);

  async function loadPortfolio(options: { quiet?: boolean } = {}) {
    if (options.quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setMessage((current) => current?.tone === "info" ? current : null);

    try {
      const restored = await restoreAuthenticatedCustomerSession();
      setCustomer(restored ?? getCurrentCustomer());
      const token = await getSessionToken();

      if (!token) {
        if (!options.quiet) setTrades([]);
        setMessage(null);
        setRequiresSessionReconnect(true);
        return;
      }

      setRequiresSessionReconnect(false);
      const response = await fetch("/api/portfolio", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; refreshedAt?: string; trades?: PortfolioTrade[] }
        | null;

      if (!response.ok) {
        if (!options.quiet) {
          setTrades([]);
          setMessage({ tone: "error", text: payload?.error ?? "Portfolio could not be loaded." });
        }
        return;
      }

      setTrades(payload?.trades ?? []);
      setLastUpdatedAt(payload?.refreshedAt ?? new Date().toISOString());
    } catch {
      if (!options.quiet) {
        setTrades([]);
        setMessage({ tone: "error", text: "Portfolio could not be loaded. Try again shortly." });
      }
    } finally {
      if (options.quiet) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadPortfolio();
  }, []);

  useEffect(() => {
    if (!customer || requiresSessionReconnect) return;

    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void loadPortfolio({ quiet: true });
    };
    const interval = window.setInterval(refresh, 5 * 60 * 1000);

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [customer, requiresSessionReconnect]);

  async function saveTrade() {
    const validation = validateTradePlan(form);
    if (validation) {
      setMessage({ tone: "error", text: validation });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const token = await getSessionToken();
      if (!token) {
        setRequiresSessionReconnect(true);
        setMessage(null);
        return;
      }

      const holdWindow = toNumber(form.holdingPeriodDays);
      const hasCompleteEnteredPlan = Boolean(toNumber(form.targetPrice) && toNumber(form.stopLoss));
      const shouldSendHoldWindow = Boolean(
        holdWindow && (exitPlan || hasCompleteEnteredPlan || form.holdingPeriodDays !== initialForm.holdingPeriodDays),
      );
      const planNotes = [
        shouldSendHoldWindow ? `Planned hold: ${holdWindow} days.` : "",
        form.notes,
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await fetch("/api/portfolio", {
        body: JSON.stringify({
          assetType: form.assetType,
          entryPrice: form.entryPrice,
          notes: planNotes,
          openedAt: buildOpenedAt(form.entryDate, form.entryTimeWindow),
          opportunityId: form.opportunityId || null,
          quantity: form.quantity || "1",
          status: "open",
          stopLoss: form.stopLoss,
          symbol: form.symbol,
          targetPrice: form.targetPrice,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; trade?: PortfolioTrade }
        | null;

      if (!response.ok || !payload?.trade) {
        setMessage({ tone: "error", text: payload?.error ?? "Trade could not be saved." });
        return;
      }

      setTrades((current) => [payload.trade as PortfolioTrade, ...current]);
      setForm(initialForm);
      setEntryEstimate(null);
      setExitPlan(null);
      setShowAddTrade(false);
      setMessage({ tone: "success", text: `${payload.trade.symbol} was added to your Swing Portfolio.` });
    } finally {
      setSaving(false);
    }
  }

  async function closeTrade(trade: PortfolioTrade) {
    const exitPrice = closePrices[trade.id];
    if (!toNumber(exitPrice)) {
      setMessage({ tone: "error", text: `Add a valid exit price before closing ${trade.symbol}.` });
      return;
    }

    const token = await getSessionToken();

    if (!token) {
      setRequiresSessionReconnect(true);
      setMessage(null);
      return;
    }

    const response = await fetch(`/api/portfolio/${trade.id}`, {
      body: JSON.stringify({
        exitPrice,
        status: "closed",
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; trade?: PortfolioTrade }
      | null;

    if (!response.ok || !payload?.trade) {
      setMessage({ tone: "error", text: payload?.error ?? "Trade could not be closed." });
      return;
    }

    setTrades((current) => current.map((item) => (item.id === trade.id ? payload.trade as PortfolioTrade : item)));
    setClosePrices((current) => ({ ...current, [trade.id]: "" }));
    setMessage({ tone: "success", text: `${trade.symbol} was moved to closed trades.` });
  }

  async function deleteTrade(trade: PortfolioTrade) {
    if (pendingDeleteId !== trade.id) {
      setPendingDeleteId(trade.id);
      setMessage({ tone: "info", text: `Confirm remove ${trade.symbol} if you no longer want to track it.` });
      return;
    }

    const token = await getSessionToken();

    if (!token) {
      setRequiresSessionReconnect(true);
      setMessage(null);
      return;
    }

    setDeletingTradeIds((current) => ({ ...current, [trade.id]: true }));

    try {
      const response = await fetch(`/api/portfolio/${trade.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Trade could not be removed." });
        return;
      }

      setTrades((current) => current.filter((item) => item.id !== trade.id));
      setClosePrices((current) => {
        const next = { ...current };
        delete next[trade.id];
        return next;
      });
      setPendingDeleteId(null);
      setMessage({ tone: "success", text: `${trade.symbol} was removed from your portfolio.` });
    } finally {
      setDeletingTradeIds((current) => {
        const next = { ...current };
        delete next[trade.id];
        return next;
      });
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
        <div className="skeleton h-4 w-36 rounded-full" />
        <div className="skeleton mt-5 h-12 max-w-lg rounded-2xl" />
        <div className="skeleton mt-6 h-64 rounded-3xl" />
      </section>
    );
  }

  if (!customer) {
    return (
      <section className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
        <div className="grid lg:grid-cols-[1fr_360px]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              Swing Portfolio
            </p>
            <h2 className="mt-3 text-3xl font-black text-ink">
              Log in to track trades you decide to make
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ink/62">
              Save the entry, target, stop, and timing you used so your plan does not disappear
              when the next rankings refresh.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={signupHref({ nextPath: "/portfolio" })}
                className="rounded-2xl bg-ink px-5 py-3 text-center text-sm font-black text-white hover:bg-pine"
              >
                Create free account
              </Link>
              <Link
                href={loginHref("/portfolio")}
                className="rounded-2xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-ink hover:border-pine"
              >
                Log in
              </Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["1", "Create account"],
                ["2", "Add a trade"],
                ["3", "Track the sell plan"],
              ].map(([number, label]) => (
                <div key={number} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="text-xs font-black text-pine">Step {number}</p>
                  <p className="mt-1 text-sm font-black text-ink">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white lg:border-l lg:border-t-0">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Why it matters
            </p>
            <p className="mt-4 text-sm font-semibold leading-7 text-white/68">
              Swing trades need follow-through. Portfolio tracking keeps your target, stop,
              news, and current status in one place.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (requiresSessionReconnect) {
    return <PortfolioSessionReconnect />;
  }

  return (
    <section className="grid gap-6">
      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            message.tone === "success"
              ? "border-pine/20 bg-mint text-pine"
              : message.tone === "info"
                ? "border-line bg-sky text-ink/70"
                : "border-coral/25 bg-coral/10 text-coral"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {!showAddTrade ? (
      <div className="grid gap-4">
        <div className={`rounded-3xl border p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)] ${reviewTone(portfolioBriefing.tone)}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-normal opacity-70">
                Today&apos;s portfolio briefing
              </p>
              <h2 className="mt-2 text-2xl font-black">{portfolioBriefing.headline}</h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 opacity-75">
                {portfolioBriefing.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!openTrades.length) {
                  setShowAddTrade(true);
                  return;
                }
                setPositionFilter(attentionTrades.length ? "attention" : "all");
              }}
              className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-black text-ink ring-1 ring-line transition hover:bg-white"
            >
              {portfolioBriefing.cta}
            </button>
          </div>
        </div>
        <details className="rounded-3xl border border-line bg-white p-4 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
          <summary className="cursor-pointer text-sm font-black text-ink">
            Portfolio health details
          </summary>
          <p className="mt-2 text-xs font-semibold leading-5 text-ink/50">
            Open this when you want the math, AI coach, and portfolio-level risk view.
          </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <p className="text-xs font-black uppercase tracking-normal text-pine">Open trades</p>
            <p className="mt-2 text-4xl font-black text-ink">{openTrades.length}</p>
            <p className="mt-2 text-sm font-semibold text-ink/55">
              Current swing plans saved from SwingFi rankings or added manually.
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <p className="text-xs font-black uppercase tracking-normal text-pine">Open P/L estimate</p>
            <p className={`mt-2 text-4xl font-black ${portfolioStats.openReturn >= 0 ? "text-pine" : "text-coral"}`}>
              {formatCurrency(portfolioStats.openReturn)}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink/55">
              Refreshes every 5 minutes while this page is open; broker balances remain separate.
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <p className="text-xs font-black uppercase tracking-normal text-pine">Needs review</p>
            <p className="mt-2 text-4xl font-black text-ink">{attentionTrades.length}</p>
            <p className="mt-2 text-sm font-semibold text-ink/55">
              Near target, near stop, below stop, or close to the review window.
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <p className="text-xs font-black uppercase tracking-normal text-pine">Plan health</p>
            <p className={`mt-2 text-4xl font-black ${portfolioStats.healthScore >= 75 ? "text-pine" : portfolioStats.healthScore >= 55 ? "text-ink" : "text-coral"}`}>
              {portfolioStats.healthScore}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink/55">
              Combines attention items, stop risk, and reward/risk quality.
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <p className="text-xs font-black uppercase tracking-normal text-pine">Risk at stops</p>
            <p className="mt-2 text-4xl font-black text-coral">{formatCurrency(portfolioStats.riskAtStop)}</p>
            <p className="mt-2 text-sm font-semibold text-ink/55">
              About {portfolioStats.riskPercentOfInvested.toFixed(1)}% of tracked entry value if every stop hit.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-pine">AI portfolio coach</p>
                <h2 className="mt-2 text-2xl font-black text-ink">
                  {coachNote?.mode === "openai" ? "AI review generated" : "SwingFi built-in review"}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-7 text-ink/62">
                  {(coachNote ?? localCoachNote).text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void generateCoachNote()}
                disabled={coachLoading}
                className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(7,20,24,0.14)] transition hover:bg-pine disabled:cursor-not-allowed disabled:opacity-55"
              >
                {coachLoading ? "Reviewing..." : "Ask AI coach"}
              </button>
            </div>
            <p className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-xs font-semibold leading-5 text-ink/50">
              AI coaching is for research review only. SwingFi does not place trades,
              manage accounts, or tell you what to buy or sell.
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
            <p className="text-xs font-black uppercase tracking-normal text-pine">Plan math</p>
            <div className="mt-4 grid gap-3">
              <MiniStat label="Target upside" value={formatCurrency(portfolioStats.targetUpside)} tone="text-pine" />
              <MiniStat label="Average reward/risk" value={`${portfolioStats.averageRewardRisk.toFixed(1)}R`} />
              <MiniStat label="Tracked entry value" value={formatCurrency(portfolioStats.invested)} />
            </div>
          </div>
        </div>
        </details>
      </div>
      ) : null}

      <div className={showAddTrade ? "mx-auto grid w-full max-w-3xl gap-6" : "grid gap-6"}>
        {showAddTrade ? (
        <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-normal text-pine">
                Add trade
              </p>
              <h2 className="mt-2 text-3xl font-black text-ink">
                Add a position to track
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAddTrade(false)}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-black text-ink/58 transition hover:border-pine hover:text-pine"
            >
              Back
            </button>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-ink/58">
            Add what you bought and roughly when you bought it. SwingFi automatically
            builds the target, stop, and sell-review countdown before the trade is saved.
          </p>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-normal text-ink/44">
                Ticker or company
              </span>
              <input
                value={form.symbol}
                onChange={(event) => {
                  setForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }));
                  setEntryEstimate(null);
                  setExitPlan(null);
                  setShowTickerSuggestions(true);
                }}
                onFocus={() => setShowTickerSuggestions(true)}
                placeholder="AAPL or Apple"
                className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
              />
              <span className="text-xs font-semibold leading-5 text-ink/45">
                Start typing and choose the matching ticker. You can add a trade from
                today&apos;s rankings or one you bought on your own.
              </span>
            </label>

            {showTickerSuggestions && (tickerSuggestions.length > 0 || tickerSearchLoading) ? (
              <div className="rounded-3xl border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-3 px-1">
                  <p className="text-xs font-black uppercase tracking-normal text-pine">
                    Ticker matches
                  </p>
                  {tickerSearchLoading ? (
                    <p className="text-xs font-bold text-ink/45">Searching...</p>
                  ) : null}
                </div>
                <div className="mt-2 grid gap-2">
                  {tickerSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.symbol}-${suggestion.exchange}`}
                      type="button"
                      onClick={() => selectTickerSuggestion(suggestion)}
                      className="rounded-2xl border border-line bg-white p-3 text-left transition hover:border-pine/35 hover:bg-mint/60"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-sm font-black text-ink">
                            {suggestion.symbol}
                          </span>
                          <span className="mt-1 block text-xs font-semibold leading-5 text-ink/56">
                            {suggestion.name}
                          </span>
                        </span>
                        <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-black text-ink/48 ring-1 ring-line">
                          {suggestion.exchange}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              {(["stock", "etf", "crypto"] as AssetType[]).map((assetType) => (
                <button
                  key={assetType}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, assetType }))}
                  className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                    form.assetType === assetType
                      ? "border-pine bg-mint text-pine"
                      : "border-line bg-surface text-ink/58 hover:border-pine/35"
                  }`}
                >
                  {assetLabels[assetType]}
                </button>
              ))}
            </div>

            <div className="rounded-3xl border border-line bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-normal text-pine">
                When did you buy?
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-ink/55">
                Choose the date and rough time of day, then SwingFi can estimate the entry
                price from FMP market data. You can still edit the price before saving.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-normal text-ink/44">Buy date</span>
                  <input
                    type="date"
                    value={form.entryDate}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, entryDate: event.target.value }));
                      setEntryEstimate(null);
                    }}
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
                  />
                </label>
                <div className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-normal text-ink/44">Approx. time</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(timeWindowLabels) as Array<FormState["entryTimeWindow"]>).map((window) => (
                      <button
                        key={window}
                        type="button"
                        onClick={() => {
                          setForm((current) => ({ ...current, entryTimeWindow: window }));
                          setEntryEstimate(null);
                        }}
                        className={`rounded-xl border px-2 py-2 text-xs font-black transition ${
                          form.entryTimeWindow === window
                            ? "border-pine bg-mint text-pine"
                            : "border-line bg-white text-ink/56 hover:border-pine/35"
                        }`}
                      >
                        {timeWindowLabels[window]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void estimateEntryPrice()}
                disabled={estimatingEntryPrice || !form.symbol.trim()}
                className="mt-4 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.14)] transition hover:bg-pine disabled:cursor-not-allowed disabled:opacity-55"
              >
                {estimatingEntryPrice ? "Estimating price..." : "Estimate entry price from buy time"}
              </button>
              {entryEstimate ? (
                <p className="mt-3 rounded-2xl border border-pine/15 bg-mint px-4 py-3 text-xs font-bold leading-5 text-pine">
                  {entryEstimate.message} Source time: {entryEstimate.sourceTime ?? "not available"}.
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-ink/44">Entry price</span>
                <input
                  inputMode="decimal"
                  value={form.entryPrice}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, entryPrice: event.target.value }));
                    setExitPlan(null);
                  }}
                  placeholder="125.50"
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
                />
                <span className="text-xs font-semibold leading-5 text-ink/45">
                  Use the estimate or replace it with your exact broker fill.
                </span>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-ink/44">Shares/units</span>
                <input
                  inputMode="decimal"
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                  placeholder="1"
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
                />
              </label>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-4">
              <div>
                <div>
                  <p className="text-xs font-black uppercase tracking-normal text-pine">
                    SwingFi sell plan
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-ink/55">
                    Generated automatically from the latest daily analysis when available.
                    For manual trades, SwingFi estimates from recent price structure.
                  </p>
                </div>
              </div>
              {exitPlan ? (
                <div className={`mt-4 rounded-2xl border p-4 ${exitPlanTone(exitPlan.actionTone)}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-normal opacity-70">
                        SwingFi action
                      </p>
                      <p className="mt-1 text-lg font-black">{exitPlan.actionLabel}</p>
                      <p className="mt-1 text-xs font-bold leading-5 opacity-75">
                        {dataQualityLabel(exitPlan.dataQuality)} · Trend: {exitPlan.trendState}
                      </p>
                    </div>
                    {exitPlan.currentPrice ? (
                      <div className="rounded-2xl bg-white/75 px-4 py-3 text-left ring-1 ring-line sm:text-right">
                        <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                          Last price
                        </p>
                        <p className="mt-1 text-sm font-black text-ink">
                          {formatCurrency(exitPlan.currentPrice)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <MiniStat label="Review target" value={formatCurrency(exitPlan.targetPrice)} tone="text-pine" />
                    <MiniStat label="Risk stop" value={formatCurrency(exitPlan.stopLoss)} tone="text-coral" />
                    <MiniStat label="Reward/risk" value={`${exitPlan.rewardRiskRatio.toFixed(1)}R`} />
                    <MiniStat
                      label="Take-profit zone"
                      value={`${formatCurrency(exitPlan.takeProfitZoneLow)} - ${formatCurrency(exitPlan.takeProfitZoneHigh)}`}
                      tone="text-pine"
                    />
                    <MiniStat label="Trail protection" value={formatCurrency(exitPlan.trailingStop)} tone="text-coral" />
                    <MiniStat label="Review window" value={`${exitPlan.holdingPeriodDays} days`} />
                  </div>
                  <p className="mt-3 text-xs font-bold leading-5 opacity-80">
                    {exitPlan.explanation}
                  </p>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-line bg-white/80 p-3 text-ink">
                      <p className="text-xs font-black uppercase tracking-normal text-pine">
                        Before holding
                      </p>
                      <ul className="mt-2 grid gap-2 text-xs font-semibold leading-5 text-ink/62">
                        {exitPlan.checklist.slice(0, 3).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-line bg-white/80 p-3 text-ink">
                      <p className="text-xs font-black uppercase tracking-normal text-coral">
                        Recheck or exit if
                      </p>
                      <ul className="mt-2 grid gap-2 text-xs font-semibold leading-5 text-ink/62">
                        {exitPlan.invalidationSignals.slice(0, 3).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : buildingExitPlan ? (
                <div className="mt-4 rounded-2xl border border-line bg-white p-4">
                  <div className="skeleton h-4 w-32 rounded-full" />
                  <div className="skeleton mt-3 h-12 rounded-2xl" />
                  <p className="mt-3 text-xs font-bold leading-5 text-ink/50">
                    SwingFi is building the sell plan from your ticker and entry price.
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-line bg-white px-4 py-3 text-xs font-bold leading-5 text-ink/50">
                  Enter a ticker and entry price. SwingFi will generate the target, stop,
                  and countdown automatically.
                </p>
              )}
            </div>

            {draftPlanMath ? (
              <div
                className={`rounded-3xl border p-4 ${
                  draftPlanMath.isValidLongPlan
                    ? "border-pine/20 bg-mint"
                    : "border-coral/25 bg-coral/10"
                }`}
              >
                <p
                  className={`text-xs font-black uppercase tracking-normal ${
                    draftPlanMath.isValidLongPlan ? "text-pine" : "text-coral"
                  }`}
                >
                  Plan preview
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniStat
                    label="Upside"
                    value={`${draftPlanMath.plannedUpside >= 0 ? "+" : ""}${draftPlanMath.plannedUpside.toFixed(1)}%`}
                    tone={draftPlanMath.plannedUpside > 0 ? "text-pine" : "text-coral"}
                  />
                  <MiniStat
                    label="Downside"
                    value={`-${Math.abs(draftPlanMath.plannedDownside).toFixed(1)}%`}
                    tone={draftPlanMath.plannedDownside > 0 ? "text-coral" : "text-ink"}
                  />
                  <MiniStat
                    label="Reward/risk"
                    value={
                      draftPlanMath.rewardRisk && Number.isFinite(draftPlanMath.rewardRisk)
                        ? `${draftPlanMath.rewardRisk.toFixed(1)}R`
                        : "Check plan"
                    }
                    tone={
                      draftPlanMath.rewardRisk && draftPlanMath.rewardRisk >= 2
                        ? "text-pine"
                        : "text-ink"
                    }
                  />
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-ink/60">
                  {draftPlanMath.isValidLongPlan
                    ? `At your entered size, this plan risks about ${formatCurrency(draftPlanMath.dollarsAtStop)} to pursue about ${formatCurrency(draftPlanMath.dollarsAtTarget)}.`
                    : "For a long swing trade, the target should be above entry and the stop should be below entry."}
                </p>
              </div>
            ) : null}

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-normal text-ink/44">Plan notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                rows={4}
                placeholder="Why did you take this trade? What would make you exit early?"
                className="resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold leading-6 text-ink outline-none transition focus:border-pine focus:bg-white"
              />
            </label>

            <button
              type="button"
              onClick={saveTrade}
              disabled={saving}
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-[0_18px_42px_rgba(7,20,24,0.18)] transition hover:bg-pine disabled:cursor-not-allowed disabled:opacity-55"
            >
              {saving ? "Saving trade..." : "Add to Swing Portfolio"}
            </button>
          </div>
        </section>
        ) : null}

        {!showAddTrade ? (
        <section className="order-1 grid gap-5">
          <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-pine">Current positions</p>
                <h2 className="mt-2 text-2xl font-black text-ink">Your open swing plans</h2>
                <p className="mt-2 text-xs font-bold leading-5 text-ink/48">
                  Current price, status, latest headlines, and countdown refresh every 5 minutes while the page is open.
                  Last updated {formatTime(lastUpdatedAt)}.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowAddTrade((current) => !current)}
                  className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white shadow-[0_12px_30px_rgba(7,20,24,0.14)] transition hover:bg-pine"
                >
                  {showAddTrade ? "Hide add trade" : "Add trade"}
                </button>
                <button
                  type="button"
                  onClick={() => void loadPortfolio({ quiet: true })}
                  disabled={refreshing}
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-center text-sm font-black text-ink transition hover:border-pine disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {refreshing ? "Refreshing..." : "Refresh now"}
                </button>
                <Link
                  href="/dashboard"
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-black text-ink hover:border-pine"
                >
                  Review rankings
                </Link>
              </div>
            </div>

            {openTrades.length ? (
              <div className="mt-5 grid gap-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["all", `All open (${openTrades.length})`],
                    ["attention", `Needs attention (${attentionTrades.length})`],
                    ["inside_plan", `Inside plan (${Math.max(openTrades.length - attentionTrades.length, 0)})`],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPositionFilter(value as typeof positionFilter)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                        positionFilter === value
                          ? "border-pine bg-mint text-pine"
                          : "border-line bg-surface text-ink/58 hover:border-pine/35"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {visibleOpenTrades.length ? visibleOpenTrades.map((trade) => {
                  const countdown = reviewCountdown(trade);
                  const decisionGuide = getExitDecisionGuide(trade);
                  const review = tradeReviews.get(trade.id) ?? getTradeReview(trade);
                  const decisionTone = reviewTone(decisionGuide.tone);
                  const liveIntelligence = getTradeLiveIntelligence({
                    currentPrice: trade.currentPrice,
                    daysHeld: trade.daysHeld,
                    entryPrice: Number(trade.entry_price),
                    latestNews: trade.latestNews,
                    plannedHoldingDays: trade.plannedHoldingDays,
                    planStatus: trade.planStatus,
                    stopLoss: Number(trade.stop_loss),
                    symbol: trade.symbol,
                    targetPrice: Number(trade.target_price),
                    unrealizedReturnPct: trade.unrealizedReturnPct,
                  });
                  const liveTone =
                    liveIntelligence.tone === "positive"
                      ? "border-pine/20 bg-mint text-pine"
                      : liveIntelligence.tone === "caution"
                        ? "border-coral/25 bg-coral/10 text-coral"
                        : "border-amber/30 bg-amber/15 text-ink";
                  const plainInsight =
                    portfolioInsightsBySymbol[trade.symbol] ??
                    buildPortfolioPlainInsight({
                      currentPrice: trade.currentPrice,
                      daysHeld: trade.daysHeld,
                      directionRead: liveIntelligence.directionRead,
                      entryPrice: Number(trade.entry_price),
                      latestNews: trade.latestNews.map((item) => ({ title: item.title })),
                      liveRead: liveIntelligence.liveRead,
                      nextReview: liveIntelligence.nextReview,
                      planStatus: trade.planStatus,
                      plannedHoldingDays: trade.plannedHoldingDays,
                      stopLoss: Number(trade.stop_loss),
                      symbol: trade.symbol,
                      targetPrice: Number(trade.target_price),
                      unrealizedReturnPct: trade.unrealizedReturnPct,
                    });
                  const priorityLabel =
                    review.priority >= 90
                      ? "Review now"
                      : review.priority >= 66
                        ? "Plan today"
                        : "Monitor";

                  return (
                    <article
                      key={trade.id}
                      className="overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_18px_60px_rgba(7,20,24,0.06)]"
                    >
                      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
                        <div className="min-w-0 p-4 sm:p-5">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-ink px-3 py-1 text-xs font-black text-white">
                                  {trade.symbol}
                                </span>
                                <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(trade.planStatus)}`}>
                                  {planStatusLabel(trade.planStatus)}
                                </span>
                                <span className={`rounded-full border px-3 py-1 text-xs font-black ${countdownTone(countdown.urgency)}`}>
                                  {priorityLabel}
                                </span>
                              </div>
                              <h3 className="mt-4 text-2xl font-black leading-tight text-ink">
                                {decisionGuide.headline}
                              </h3>
                              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/62">
                                {decisionGuide.helper}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:min-w-[360px] xl:hidden">
                              <MiniStat label="Current" value={formatCurrency(trade.currentPrice)} />
                              <MiniStat label="Open P/L" value={formatPercent(trade.unrealizedReturnPct)} tone={(trade.unrealizedReturnPct ?? 0) >= 0 ? "text-pine" : "text-coral"} />
                              <MiniStat label="Target" value={formatCurrency(Number(trade.target_price))} tone="text-pine" />
                              <MiniStat label="Stop" value={formatCurrency(Number(trade.stop_loss))} tone="text-coral" />
                            </div>
                          </div>

                          <div className={`mt-5 rounded-3xl border p-4 sm:p-5 ${liveTone}`}>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-normal opacity-70">
                                  Why SwingFi flagged this
                                </p>
                                <h4 className="mt-2 text-xl font-black leading-tight">
                                  {liveIntelligence.decisionZone}
                                </h4>
                                <p className="mt-2 text-sm font-bold leading-6 opacity-78">
                                  {liveIntelligence.directionRead}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-white/75 px-4 py-3 text-left ring-1 ring-line lg:min-w-44 lg:text-right">
                                <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                                  News read
                                </p>
                                <p className="mt-1 text-sm font-black text-ink">
                                  {liveIntelligence.news.label}
                                </p>
                              </div>
                            </div>
                            <p className="mt-4 rounded-2xl border border-line bg-white/85 px-4 py-3 text-sm font-bold leading-6 text-ink/66">
                              {liveIntelligence.liveRead}
                            </p>
                            <p className="mt-3 rounded-2xl border border-line bg-white/85 px-4 py-3 text-xs font-bold leading-5 text-ink/58">
                              Data behind the flag: SwingFi compares your latest refreshed price
                              against the target, stop, open return, plan countdown, and latest
                              headline tone. The flag changes when those inputs change.
                            </p>
                            <div className="mt-3 rounded-2xl border border-line bg-white/90 p-4 text-ink">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-normal text-pine">
                                    Plain-English position read
                                  </p>
                                  <h4 className="mt-1 text-lg font-black leading-tight">
                                    {plainInsight.headline}
                                  </h4>
                                </div>
                                <span className="w-fit rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-black uppercase tracking-normal text-ink/45">
                                  {plainInsight.mode === "openai" ? "AI explained" : "SwingFi read"}
                                </span>
                              </div>
                              <p className="mt-3 text-sm font-bold leading-6 text-ink/66">
                                {plainInsight.summary}
                              </p>
                              <div className="mt-3 grid gap-2 md:grid-cols-3">
                                {plainInsight.evidence.slice(0, 3).map((item) => (
                                  <p
                                    key={item}
                                    className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold leading-5 text-ink/62"
                                  >
                                    {item}
                                  </p>
                                ))}
                              </div>
                              <p className="mt-3 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold leading-5 text-ink/58">
                                Next: {plainInsight.nextReview}
                              </p>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              {liveIntelligence.priceFacts.map((fact) => (
                                <p
                                  key={fact}
                                  className="rounded-xl border border-line bg-white/80 px-3 py-2 text-xs font-black leading-5 text-ink/58"
                                >
                                  {fact}
                                </p>
                              ))}
                            </div>
                            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
                              <p className="rounded-2xl border border-line bg-white/80 px-4 py-3 text-xs font-bold leading-5 text-ink/60">
                                <span className="block text-[11px] font-black uppercase tracking-normal text-ink/42">
                                  Next review
                                </span>
                                <span className="mt-1 block">{liveIntelligence.nextReview}</span>
                              </p>
                              <p className="rounded-2xl border border-line bg-white/80 px-4 py-3 text-xs font-bold leading-5 text-ink/60">
                                <span className="block text-[11px] font-black uppercase tracking-normal text-ink/42">
                                  Headline context
                                </span>
                                <span className="mt-1 block">{liveIntelligence.news.summary}</span>
                              </p>
                            </div>
                          </div>

                          <div className={`mt-5 rounded-3xl border p-4 sm:p-5 ${decisionTone}`}>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="text-xs font-black uppercase tracking-normal opacity-70">
                                  SwingFi decision path
                                </p>
                                <p className="mt-2 text-xl font-black leading-tight">
                                  {decisionGuide.primaryAction}
                                </p>
                                <p className="mt-2 text-sm font-bold leading-6 opacity-75">
                                  {decisionGuide.secondaryAction}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-white/75 px-4 py-3 text-left ring-1 ring-line lg:min-w-36 lg:text-right">
                                <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                                  Current read
                                </p>
                                <p className="mt-1 text-sm font-black text-ink">
                                  {decisionGuide.status}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-line bg-white/85 p-4 text-ink">
                              <p className="text-xs font-black uppercase tracking-normal text-pine">
                                In beginner terms
                              </p>
                              <p className="mt-2 text-sm font-bold leading-6 text-ink/66">
                                {decisionGuide.beginnerMeaning}
                              </p>
                              <div className="mt-3 grid gap-2 md:grid-cols-3">
                                {decisionGuide.decisionChoices.map((choice, choiceIndex) => (
                                  <p
                                    key={choice}
                                    className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold leading-5 text-ink/62"
                                  >
                                    <span className="mr-1 text-ink">{choiceIndex + 1}.</span>{" "}
                                    {choice}
                                  </p>
                                ))}
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 lg:grid-cols-3">
                              <div className="rounded-2xl border border-line bg-white/80 p-3 text-ink">
                                <p className="text-xs font-black uppercase tracking-normal text-pine">
                                  If holding longer
                                </p>
                                <p className="mt-2 text-xs font-bold leading-5 text-ink/64">
                                  {decisionGuide.holdCondition}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-line bg-white/80 p-3 text-ink">
                                <p className="text-xs font-black uppercase tracking-normal text-coral">
                                  Avoid this
                                </p>
                                <p className="mt-2 text-xs font-bold leading-5 text-ink/64">
                                  {decisionGuide.avoidAction}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-line bg-white/80 p-3 text-ink">
                                <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                                  Plan countdown
                                </p>
                                <p className="mt-2 text-sm font-black text-ink">{countdown.label}</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-ink/52">
                                  {countdown.detail}
                                </p>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
                                  <div
                                    className="h-full rounded-full bg-pine transition-all"
                                    style={{ width: `${countdown.progress}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.8fr]">
                            <div className="rounded-2xl border border-line bg-surface p-4">
                              <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                                What to check before acting
                              </p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {decisionGuide.actions.slice(0, 4).map((item) => (
                                  <p
                                    key={item}
                                    className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold leading-5 text-ink/62"
                                  >
                                    {item}
                                  </p>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-line bg-surface p-4">
                              <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                                Watch signals
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {decisionGuide.watch.map((item) => (
                                  <span
                                    key={item}
                                    className="rounded-full border border-line bg-white px-3 py-2 text-xs font-black text-ink/58"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <details className="mt-4 rounded-2xl border border-line bg-surface p-4">
                            <summary className="cursor-pointer text-sm font-black text-ink">
                              News, notes, and manage position
                            </summary>
                            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_280px]">
                              <div className="grid gap-3">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                                    Latest context
                                  </p>
                                  <div className="mt-2 grid gap-2">
                                    {trade.latestNews.length ? (
                                      trade.latestNews.map((item) => (
                                        <a
                                          key={`${trade.id}-${item.title}`}
                                          href={item.url ?? "#"}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="rounded-2xl border border-line bg-white p-3 text-sm font-bold leading-6 text-ink transition hover:border-pine"
                                        >
                                          {item.title}
                                          {item.site ? (
                                            <span className="mt-1 block text-xs font-semibold text-ink/45">
                                              {item.site}
                                            </span>
                                          ) : null}
                                        </a>
                                      ))
                                    ) : (
                                      <p className="rounded-2xl border border-line bg-white p-3 text-sm font-semibold text-ink/55">
                                        No fresh headlines were available from FMP for this ticker.
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {trade.notes ? (
                                  <div className="rounded-2xl border border-line bg-white p-3">
                                    <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                                      Saved plan notes
                                    </p>
                                    <p className="mt-2 text-sm font-semibold leading-6 text-ink/62">
                                      {trade.notes}
                                    </p>
                                  </div>
                                ) : null}

                                <div className="grid gap-2 sm:grid-cols-2">
                                  {review.evidence.slice(0, 4).map((item) => (
                                    <p
                                      key={item}
                                      className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold leading-5 text-ink/58"
                                    >
                                      {item}
                                    </p>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-line bg-white p-3">
                                <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                                  Close trade
                                </p>
                                <input
                                  inputMode="decimal"
                                  value={closePrices[trade.id] ?? ""}
                                  onChange={(event) =>
                                    setClosePrices((current) => ({ ...current, [trade.id]: event.target.value }))
                                  }
                                  placeholder="Exit price"
                                  className="mt-3 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink outline-none focus:border-pine focus:bg-white"
                                />
                                {trade.currentPrice ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setClosePrices((current) => ({
                                        ...current,
                                        [trade.id]: String(trade.currentPrice?.toFixed(2) ?? ""),
                                      }))
                                    }
                                    className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-2 text-sm font-black text-ink/62 transition hover:border-pine hover:text-pine"
                                  >
                                    Use latest price {formatCurrency(trade.currentPrice)}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => closeTrade(trade)}
                                  className="mt-3 w-full rounded-xl bg-ink px-4 py-2 text-sm font-black text-white hover:bg-pine"
                                >
                                  Mark closed
                                </button>
                                <p className="mt-3 text-xs font-semibold leading-5 text-ink/45">
                                  SwingFi records the result for your review. It does not place trades.
                                </p>
                                <div className="mt-4 border-t border-line pt-3">
                                  <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                                    Remove position
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => void deleteTrade(trade)}
                                    disabled={Boolean(deletingTradeIds[trade.id])}
                                    className={`mt-3 w-full rounded-xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${
                                      pendingDeleteId === trade.id
                                        ? "border-coral/30 bg-coral/10 text-coral hover:bg-coral/15"
                                        : "border-line bg-surface text-ink/62 hover:border-coral/30 hover:text-coral"
                                    }`}
                                  >
                                    {deletingTradeIds[trade.id]
                                      ? "Removing..."
                                      : pendingDeleteId === trade.id
                                        ? "Confirm remove"
                                        : "Remove from portfolio"}
                                  </button>
                                  {pendingDeleteId === trade.id ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPendingDeleteId(null);
                                        setMessage(null);
                                      }}
                                      className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm font-black text-ink/55 transition hover:border-pine hover:text-pine"
                                    >
                                      Keep tracking
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </details>
                        </div>

                        <aside className="grid gap-2 border-t border-line bg-surface p-4 xl:border-l xl:border-t-0">
                          <MiniStat label="Current" value={formatCurrency(trade.currentPrice)} />
                          <MiniStat label="Open P/L" value={formatPercent(trade.unrealizedReturnPct)} tone={(trade.unrealizedReturnPct ?? 0) >= 0 ? "text-pine" : "text-coral"} />
                          <MiniStat label="Entry" value={formatCurrency(Number(trade.entry_price))} />
                          <MiniStat label="Target" value={formatCurrency(Number(trade.target_price))} tone="text-pine" />
                          <MiniStat label="Stop" value={formatCurrency(Number(trade.stop_loss))} tone="text-coral" />
                          <MiniStat label="Reward/risk" value={`${rewardRiskForTrade(trade).toFixed(1)}R`} />
                          <p className="rounded-2xl border border-line bg-white px-3 py-2 text-xs font-semibold leading-5 text-ink/50">
                            Research only. Final trade decisions happen in your brokerage account.
                          </p>
                        </aside>
                      </div>
                    </article>
                  );
                }) : (
                  <div className="rounded-3xl border border-line bg-surface p-5">
                    <p className="text-sm font-black text-ink">No positions match this filter.</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-ink/55">
                      Switch to all open positions or add another trade to track.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-line bg-surface p-6">
                <p className="text-sm font-black uppercase tracking-normal text-pine">
                  Portfolio is ready
                </p>
                <h3 className="mt-2 text-xl font-black text-ink">
                  Save only trades you actually decide to make
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/56">
                  When you act on a ranked idea, save it here so the plan, target, stop,
                  and follow-up context stay visible after the daily rankings refresh.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    "Record entry and size",
                    "Keep target and stop visible",
                    "Review status after the time window",
                  ].map((item) => (
                    <p
                      key={item}
                      className="rounded-2xl border border-line bg-white px-3 py-2 text-xs font-black text-ink/62"
                    >
                      {item}
                    </p>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setShowAddTrade(true)}
                    className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white hover:bg-pine"
                  >
                    Add your first trade
                  </button>
                  <Link
                    href="/dashboard"
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:border-pine"
                  >
                    Review today&apos;s rankings
                  </Link>
                </div>
              </div>
            )}
          </div>

          {closedTrades.length ? (
            <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)] sm:p-6">
              <p className="text-xs font-black uppercase tracking-normal text-pine">Closed history</p>
              <div className="mt-4 grid gap-3">
                {closedTrades.slice(0, 8).map((trade) => (
                  <div key={trade.id} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div>
                      <p className="text-base font-black text-ink">{trade.symbol}</p>
                      <p className="text-sm font-semibold text-ink/52">
                        Entry {formatCurrency(Number(trade.entry_price))} to exit {formatCurrency(trade.exit_price)}
                      </p>
                    </div>
                    <p className="text-sm font-black text-pine">
                      Gain {formatCurrency(trade.realized_gain)}
                    </p>
                    <p className="text-sm font-black text-coral">
                      Loss {formatCurrency(trade.realized_loss)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        ) : null}
      </div>
    </section>
  );
}

function MiniStat({
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
