export type ExitIntelligenceCandle = {
  close?: number | null;
  date?: string | null;
  high?: number | null;
  low?: number | null;
};

export type ExitIntelligenceInput = {
  candles?: ExitIntelligenceCandle[];
  currentPrice: number | null;
  daysHeld: number;
  entryPrice: number;
  openedAt?: string | null;
  plannedHoldingDays?: number | null;
  stopLoss: number;
  symbol: string;
  targetPrice: number;
};

export type ExitReviewStatus =
  | "quote_unavailable"
  | "below_stop"
  | "near_stop"
  | "target_reached"
  | "peak_fading"
  | "profit_protection"
  | "time_window_expired"
  | "time_window_soon"
  | "inside_plan"
  | "needs_manual_review";

export type ExitReview = {
  actionLabel: string;
  beginnerMeaning: string;
  evidence: string[];
  headline: string;
  metrics: {
    daysLeft: number | null;
    fadeFromPeakPct: number | null;
    maxGainPct: number | null;
    openReturnPct: number | null;
    progressToTargetPct: number | null;
    remainingUpsidePct: number | null;
    riskToStopPct: number | null;
  };
  nextReview: string;
  priority: number;
  profitTrigger: {
    alertLabel: string;
    level: "review_zone" | "mostly_complete" | "target_reached";
    message: string;
    progressPct: number;
    thresholdPct: number;
    triggerPrice: number;
  } | null;
  status: ExitReviewStatus;
  tone: "positive" | "neutral" | "caution";
  watch: string[];
};

function finitePositive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function round(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function formatCurrency(value: number | null) {
  if (value === null) return "unavailable";

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) return "unavailable";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatPlainPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

function pct(from: number | null, to: number | null) {
  if (from === null || to === null || from <= 0 || to <= 0) return null;
  return ((to - from) / from) * 100;
}

function getTradeCandles(input: ExitIntelligenceInput) {
  const openedTime = input.openedAt ? new Date(input.openedAt).getTime() : Number.NaN;
  const hasOpenedTime = Number.isFinite(openedTime);

  return (input.candles ?? [])
    .filter((candle) => {
      const high = finitePositive(candle.high);
      const close = finitePositive(candle.close);
      if (high === null && close === null) return false;
      if (!hasOpenedTime || !candle.date) return true;

      const candleTime = new Date(String(candle.date).replace(" ", "T")).getTime();
      return !Number.isFinite(candleTime) || candleTime >= openedTime - 86_400_000;
    })
    .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
}

function highestSeenPrice(input: ExitIntelligenceInput, current: number | null) {
  const highs = getTradeCandles(input)
    .map((candle) => finitePositive(candle.high) ?? finitePositive(candle.close))
    .filter((value): value is number => value !== null);

  if (current !== null) highs.push(current);
  highs.push(input.entryPrice);

  return highs.length ? Math.max(...highs) : null;
}

function buildMetrics(input: ExitIntelligenceInput) {
  const current = finitePositive(input.currentPrice);
  const entry = finitePositive(input.entryPrice);
  const target = finitePositive(input.targetPrice);
  const stop = finitePositive(input.stopLoss);
  const plannedHoldingDays =
    typeof input.plannedHoldingDays === "number" && Number.isFinite(input.plannedHoldingDays) && input.plannedHoldingDays > 0
      ? input.plannedHoldingDays
      : null;
  const daysLeft = plannedHoldingDays === null ? null : plannedHoldingDays - Math.max(0, input.daysHeld);
  const rewardPath = entry !== null && target !== null ? target - entry : null;
  const openReturnPct = entry !== null && current !== null ? pct(entry, current) : null;
  const remainingUpsidePct = current !== null && target !== null ? pct(current, target) : null;
  const riskToStopPct =
    current !== null && stop !== null ? Math.max(((current - stop) / current) * 100, 0) : null;
  const progressToTargetPct =
    rewardPath !== null && rewardPath > 0 && entry !== null && current !== null
      ? ((current - entry) / rewardPath) * 100
      : null;
  const peak = highestSeenPrice(input, current);
  const maxGainPct = entry !== null && peak !== null ? pct(entry, peak) : null;
  const fadeFromPeakPct =
    current !== null && peak !== null && peak > current ? ((peak - current) / peak) * 100 : 0;

  return {
    daysLeft,
    fadeFromPeakPct: round(fadeFromPeakPct),
    maxGainPct: round(maxGainPct),
    openReturnPct: round(openReturnPct),
    progressToTargetPct: round(progressToTargetPct),
    remainingUpsidePct: round(remainingUpsidePct),
    riskToStopPct: round(riskToStopPct),
  };
}

function buildProfitTrigger(args: {
  entry: number | null;
  peakProgress: number | null;
  progressToTargetPct: number | null;
  symbol: string;
  target: number | null;
}) {
  if (args.entry === null || args.target === null || args.target <= args.entry) return null;

  const bestProgress = Math.max(args.progressToTargetPct ?? 0, args.peakProgress ?? 0);
  const thresholdPct =
    bestProgress >= 100 ? 100 : bestProgress >= 85 ? 85 : bestProgress >= 70 ? 70 : null;

  if (thresholdPct === null) return null;

  const triggerPrice = round(args.entry + (args.target - args.entry) * (thresholdPct / 100), 2) ?? args.target;

  if (thresholdPct >= 100) {
    return {
      alertLabel: "Target trigger",
      level: "target_reached" as const,
      message: `${args.symbol} reached the saved target area. The planned reward is available, so the review is about protecting the move.`,
      progressPct: round(bestProgress) ?? thresholdPct,
      thresholdPct,
      triggerPrice,
    };
  }

  if (thresholdPct >= 85) {
    return {
      alertLabel: "Most of the move is available",
      level: "mostly_complete" as const,
      message: `${args.symbol} has reached at least ${formatPlainPercent(thresholdPct)} of the planned move. Review profit protection before waiting for the exact target.`,
      progressPct: round(bestProgress) ?? thresholdPct,
      thresholdPct,
      triggerPrice,
    };
  }

  return {
    alertLabel: "Profit review zone",
    level: "review_zone" as const,
    message: `${args.symbol} has reached at least ${formatPlainPercent(thresholdPct)} of the planned move. Start planning how you would protect gains if momentum slows.`,
    progressPct: round(bestProgress) ?? thresholdPct,
    thresholdPct,
    triggerPrice,
  };
}

function hasValidLongPlan(input: ExitIntelligenceInput) {
  const entry = finitePositive(input.entryPrice);
  const target = finitePositive(input.targetPrice);
  const stop = finitePositive(input.stopLoss);

  return entry !== null && target !== null && stop !== null && stop < entry && entry < target;
}

export function buildExitReview(input: ExitIntelligenceInput): ExitReview {
  const symbol = input.symbol.trim().toUpperCase();
  const current = finitePositive(input.currentPrice);
  const entry = finitePositive(input.entryPrice);
  const target = finitePositive(input.targetPrice);
  const stop = finitePositive(input.stopLoss);
  const metrics = buildMetrics(input);
  const peakProgress =
    metrics.maxGainPct !== null && entry !== null && target !== null && target > entry
      ? ((entry * (1 + metrics.maxGainPct / 100) - entry) / (target - entry)) * 100
      : null;
  const profitTrigger = buildProfitTrigger({
    entry,
    peakProgress,
    progressToTargetPct: metrics.progressToTargetPct,
    symbol,
    target,
  });
  const evidence = [
    `Entry ${formatCurrency(entry)}.`,
    `Latest price ${formatCurrency(current)}.`,
    `Target ${formatCurrency(target)} and stop ${formatCurrency(stop)}.`,
    `Open return ${formatPercent(metrics.openReturnPct)}.`,
    metrics.maxGainPct === null
      ? "Highest gain during this plan is unavailable."
      : `Best gain seen during this plan was ${formatPercent(metrics.maxGainPct)}.`,
    metrics.fadeFromPeakPct === null
      ? "Fade from recent peak is unavailable."
      : `Price has pulled back ${metrics.fadeFromPeakPct.toFixed(1)}% from the best price SwingFi has seen during this plan.`,
    profitTrigger
      ? `${profitTrigger.alertLabel}: triggered near ${formatCurrency(profitTrigger.triggerPrice)} at ${formatPlainPercent(profitTrigger.thresholdPct)} of the planned move.`
      : "No profit trigger has fired yet.",
  ];

  if (!hasValidLongPlan(input)) {
    return {
      actionLabel: "Rebuild the plan",
      beginnerMeaning:
        "SwingFi cannot trust this plan because the saved entry, target, or stop does not form a valid long swing setup.",
      evidence,
      headline: `${symbol} needs a cleaner saved plan`,
      metrics,
      nextReview: "Check the saved entry, target, and stop before relying on this position card.",
      priority: 92,
      profitTrigger: null,
      status: "needs_manual_review",
      tone: "caution",
      watch: ["Target should be above entry", "Stop should be below entry", "Do not rely on broken plan math"],
    };
  }

  if (current === null) {
    return {
      actionLabel: "Refresh quote first",
      beginnerMeaning:
        "SwingFi needs a current price before it can judge whether the trade is near target, near stop, or fading from a peak.",
      evidence,
      headline: `${symbol} quote is unavailable`,
      metrics,
      nextReview: "Refresh the portfolio or compare the saved plan with your broker quote.",
      priority: 70,
      profitTrigger,
      status: "quote_unavailable",
      tone: "neutral",
      watch: ["Latest quote", "Saved target", "Saved stop"],
    };
  }

  if (stop !== null && current <= stop) {
    return {
      actionLabel: "Risk line is broken",
      beginnerMeaning:
        "The price is at or below the risk line saved in the original plan. That means this trade is no longer behaving like the setup you agreed to track.",
      evidence,
      headline: `${symbol} is below the saved stop`,
      metrics,
      nextReview: "Review closing or reducing risk from your brokerage instead of giving the trade more room without a new written plan.",
      priority: 100,
      profitTrigger,
      status: "below_stop",
      tone: "caution",
      watch: ["Broker quote versus saved stop", "Any news that changed the setup", "Avoid widening risk emotionally"],
    };
  }

  if (target !== null && current >= target) {
    return {
      actionLabel: "Planned reward is available",
      beginnerMeaning:
        "The trade reached the price area SwingFi planned for profit. The question is no longer finding more upside; it is protecting the move you already got.",
      evidence,
      headline: `${symbol} reached the target area`,
      metrics,
      nextReview: "Review taking profit, trimming, or trailing protection from your brokerage while the planned reward is available.",
      priority: 98,
      profitTrigger,
      status: "target_reached",
      tone: "neutral",
      watch: ["Target-zone rejection", "Fast pullback from the high", "Fresh negative headline risk"],
    };
  }

  if (metrics.riskToStopPct !== null && metrics.riskToStopPct <= 3) {
    return {
      actionLabel: "Risk line is close",
      beginnerMeaning:
        "The price is still above the saved stop, but the cushion is small. This is a warning to review the plan before the risk line is hit.",
      evidence,
      headline: `${symbol} is close to the saved stop`,
      metrics,
      nextReview: "Review whether the original reason for the trade still holds before adding time or risk.",
      priority: 86,
      profitTrigger,
      status: "near_stop",
      tone: "caution",
      watch: ["Saved stop", "Market weakness", "Negative headlines"],
    };
  }

  if (
    peakProgress !== null &&
    peakProgress >= 70 &&
    metrics.fadeFromPeakPct !== null &&
    metrics.fadeFromPeakPct >= 2
  ) {
    return {
      actionLabel: "Protect the gain first",
      beginnerMeaning:
        "This trade already gave a large part of the planned move, but price has started giving some of it back. That is exactly when a swing plan needs a profit-protection review.",
      evidence,
      headline: `${symbol} peaked before the plan finished`,
      metrics,
      nextReview: "Review protecting gains or tightening the plan instead of waiting only for the original sell date.",
      priority: 94,
      profitTrigger,
      status: "peak_fading",
      tone: "neutral",
      watch: ["Further pullback from the high", "Volume fading after the move", "Remaining upside versus give-back risk"],
    };
  }

  if (metrics.progressToTargetPct !== null && metrics.progressToTargetPct >= 85) {
    return {
      actionLabel: "Most of the move is available",
      beginnerMeaning:
        "The trade has reached most of the planned upside. Waiting for the exact target may offer less reward than the risk of giving gains back.",
      evidence,
      headline: `${symbol} is near the planned target`,
      metrics,
      nextReview: "Review whether to lock in profit, trail protection, or keep the original target before the move stalls.",
      priority: 90,
      profitTrigger,
      status: "profit_protection",
      tone: "neutral",
      watch: ["Distance left to target", "Fade from the best price", "Whether price keeps making higher highs"],
    };
  }

  if (metrics.progressToTargetPct !== null && metrics.progressToTargetPct >= 70) {
    return {
      actionLabel: "Profit review trigger",
      beginnerMeaning:
        "The trade has reached enough of the planned upside that you should prepare the profit plan before the final target or original sell date.",
      evidence,
      headline: `${symbol} entered the profit review zone`,
      metrics,
      nextReview: "Decide what you want to do if the price reaches the 85% trigger, stalls, or starts fading from the best price.",
      priority: 82,
      profitTrigger,
      status: "profit_protection",
      tone: "neutral",
      watch: ["85% trigger price", "Fade from the best price", "Distance left to target"],
    };
  }

  if (metrics.daysLeft !== null && metrics.daysLeft <= 0) {
    return {
      actionLabel: "Review the time limit",
      beginnerMeaning:
        "The planned swing window has arrived. This does not force an exit, but it does mean the trade needs a new reason to keep taking space in your account.",
      evidence,
      headline: `${symbol} reached its review window`,
      metrics,
      nextReview: "Review whether price progress, news, and market direction still justify holding past the original window.",
      priority: 80,
      profitTrigger,
      status: "time_window_expired",
      tone: "neutral",
      watch: ["No progress after planned window", "Better fresh opportunities", "New review date if held longer"],
    };
  }

  if (metrics.daysLeft !== null && metrics.daysLeft <= 2) {
    return {
      actionLabel: "Prepare the exit review",
      beginnerMeaning:
        "The trade is near the end of its planned swing window. You do not need to react immediately, but you should know what would make you protect gains or cut risk.",
      evidence,
      headline: `${symbol} is near its review date`,
      metrics,
      nextReview: "Write the next decision before the countdown reaches zero: target, trail, close, or give it a new review date.",
      priority: 68,
      profitTrigger,
      status: "time_window_soon",
      tone: "neutral",
      watch: ["Days left", "Remaining upside", "Latest news tone"],
    };
  }

  return {
    actionLabel: "Plan still intact",
    beginnerMeaning:
      "No urgent exit flag is active. The trade is still between the saved stop and target, so the job is to follow the plan and monitor for a better exit signal.",
    evidence,
    headline: `${symbol} is still inside the plan`,
    metrics,
    nextReview: "Review once per day unless price gets close to target, close to stop, or starts fading from a strong peak.",
    priority: 35,
    profitTrigger,
    status: "inside_plan",
    tone: "positive",
    watch: ["Target progress", "Stop cushion", "Peak fade after a strong move"],
  };
}
