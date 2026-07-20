export type PortfolioNewsItem = {
  publishedDate?: string | null;
  site?: string | null;
  title: string;
  url?: string | null;
};

export type TradeIntelligenceInput = {
  currentPrice: number | null;
  daysHeld?: number | null;
  exitReview?: {
    actionLabel: string;
    beginnerMeaning: string;
    headline: string;
    metrics: {
      fadeFromPeakPct: number | null;
      maxGainPct: number | null;
      progressToTargetPct: number | null;
      remainingUpsidePct: number | null;
      riskToStopPct: number | null;
    };
    nextReview: string;
    status: string;
    tone: "positive" | "neutral" | "caution";
  } | null;
  entryPrice: number;
  latestNews?: PortfolioNewsItem[];
  plannedHoldingDays?: number | null;
  planStatus?: string | null;
  stopLoss: number;
  symbol: string;
  targetPrice: number;
  unrealizedReturnPct?: number | null;
};

const positiveNewsKeywords = [
  "beat",
  "beats",
  "upgrade",
  "raises",
  "raised",
  "growth",
  "record",
  "approval",
  "expands",
  "partnership",
  "launch",
  "surge",
];

const negativeNewsKeywords = [
  "miss",
  "misses",
  "downgrade",
  "cuts",
  "cut",
  "lawsuit",
  "probe",
  "investigation",
  "recall",
  "warning",
  "falls",
  "drop",
  "slump",
];

const eventNewsKeywords = [
  "earnings",
  "guidance",
  "sec",
  "filing",
  "fomc",
  "cpi",
  "fed",
  "dividend",
  "split",
  "merger",
];

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "not available";

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "not available";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function percentFromPrice(current: number | null, level: number) {
  if (!current || current <= 0 || !Number.isFinite(level) || level <= 0) return null;
  return ((level - current) / current) * 100;
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function getNewsIntelligence(news: PortfolioNewsItem[] = []) {
  const scored = news.slice(0, 5).map((item) => {
    const text = item.title.toLowerCase();
    const positive = containsAny(text, positiveNewsKeywords);
    const negative = containsAny(text, negativeNewsKeywords);
    const event = containsAny(text, eventNewsKeywords);

    return {
      ...item,
      event,
      tone: negative ? "risk" : positive ? "constructive" : event ? "event" : "neutral",
    };
  });
  const riskCount = scored.filter((item) => item.tone === "risk").length;
  const constructiveCount = scored.filter((item) => item.tone === "constructive").length;
  const eventCount = scored.filter((item) => item.event).length;

  if (!scored.length) {
    return {
      label: "No fresh headlines",
      summary: "SwingFi did not receive fresh FMP headlines for this ticker in the latest refresh.",
      tone: "neutral" as const,
      items: scored,
    };
  }

  if (riskCount > 0) {
    return {
      label: "Headline risk present",
      summary: `${riskCount} of the latest ${scored.length} headline${scored.length === 1 ? "" : "s"} contains risk language. Read those headlines before giving the plan more room.`,
      tone: "caution" as const,
      items: scored,
    };
  }

  if (constructiveCount > 0) {
    return {
      label: "Constructive headline tone",
      summary: `${constructiveCount} of the latest ${scored.length} headline${scored.length === 1 ? "" : "s"} has constructive language. Still confirm price is respecting the plan.`,
      tone: "positive" as const,
      items: scored,
    };
  }

  if (eventCount > 0) {
    return {
      label: "Event context to review",
      summary: "Recent headlines mention event-sensitive topics, so review whether the swing plan still fits the upcoming catalyst risk.",
      tone: "neutral" as const,
      items: scored,
    };
  }

  return {
    label: "Neutral headline tone",
    summary: "Recent headlines do not show an obvious positive or negative catalyst in the quick title scan.",
    tone: "neutral" as const,
    items: scored,
  };
}

export function getTradeLiveIntelligence(trade: TradeIntelligenceInput) {
  const current = trade.currentPrice;
  const entry = Number(trade.entryPrice);
  const target = Number(trade.targetPrice);
  const stop = Number(trade.stopLoss);
  const targetDistance = percentFromPrice(current, target);
  const stopDistance = percentFromPrice(current, stop);
  const openReturn =
    typeof trade.unrealizedReturnPct === "number" && Number.isFinite(trade.unrealizedReturnPct)
      ? trade.unrealizedReturnPct
      : current && entry > 0
        ? ((current - entry) / entry) * 100
        : null;
  const news = getNewsIntelligence(trade.latestNews);
  const daysLeft =
    typeof trade.plannedHoldingDays === "number" && typeof trade.daysHeld === "number"
      ? trade.plannedHoldingDays - trade.daysHeld
      : null;

  if (trade.exitReview) {
    const review = trade.exitReview;
    const priceFacts = current
      ? [
          `Latest: ${formatCurrency(current)}`,
          `Open return: ${formatPercent(openReturn)}`,
          review.metrics.maxGainPct === null
            ? "Best gain seen: unavailable"
            : `Best gain seen: ${formatPercent(review.metrics.maxGainPct)}`,
          review.metrics.fadeFromPeakPct === null
            ? "Fade from peak: unavailable"
            : `Fade from peak: ${review.metrics.fadeFromPeakPct.toFixed(1)}%`,
        ]
      : [
          `Entry: ${formatCurrency(entry)}`,
          `Target: ${formatCurrency(target)}`,
          `Stop: ${formatCurrency(stop)}`,
        ];

    if (review.status === "peak_fading" || review.status === "profit_protection") {
      return {
        decisionZone: review.actionLabel,
        directionRead: review.headline,
        liveRead: review.beginnerMeaning,
        news,
        nextReview: review.nextReview,
        priceFacts,
        tone: "neutral" as const,
      };
    }

    if (review.status === "below_stop" || review.status === "near_stop" || review.status === "needs_manual_review") {
      return {
        decisionZone: review.actionLabel,
        directionRead: review.headline,
        liveRead: review.beginnerMeaning,
        news,
        nextReview: review.nextReview,
        priceFacts,
        tone: "caution" as const,
      };
    }
  }

  if (!current) {
    return {
      decisionZone: "Quote unavailable",
      directionRead: "SwingFi cannot judge the current direction until the latest quote refreshes.",
      liveRead: "Latest price is unavailable, so the saved target, stop, and time window are the active reference points.",
      news,
      nextReview: "Refresh the portfolio or check your brokerage quote before making a plan decision.",
      priceFacts: [
        `Entry: ${formatCurrency(entry)}`,
        `Target: ${formatCurrency(target)}`,
        `Stop: ${formatCurrency(stop)}`,
      ],
      tone: "neutral" as const,
    };
  }

  const priceFacts = [
    `Latest: ${formatCurrency(current)}`,
    `Open return: ${formatPercent(openReturn)}`,
    targetDistance === null
      ? `Target: ${formatCurrency(target)}`
      : targetDistance >= 0
        ? `Target buffer: ${Math.abs(targetDistance).toFixed(1)}% below ${formatCurrency(target)}`
        : `Target passed by ${Math.abs(targetDistance).toFixed(1)}%`,
    stopDistance === null
      ? `Stop: ${formatCurrency(stop)}`
      : stopDistance >= 0
        ? `Stop broken by ${Math.abs(stopDistance).toFixed(1)}%`
        : `Stop buffer: ${Math.abs(stopDistance).toFixed(1)}% above ${formatCurrency(stop)}`,
  ];

  if (current <= stop) {
    return {
      decisionZone: "Below saved stop",
      directionRead: `${trade.symbol} is trading at ${formatCurrency(current)}, below the saved stop at ${formatCurrency(stop)}. That means the original risk line has been crossed.`,
      liveRead: "SwingFi flagged this because the price moved through the downside level saved in your plan. In plain English: the trade is no longer following the original risk plan.",
      news,
      nextReview: "Review your original stop rule, current quote in your brokerage, and latest headline context before giving the trade more time.",
      priceFacts,
      tone: "caution" as const,
    };
  }

  if (current >= target) {
    return {
      decisionZone: "Profit-review zone",
      directionRead: `${trade.symbol} is trading at ${formatCurrency(current)}, at or above the saved target at ${formatCurrency(target)}.`,
      liveRead: "The planned reward area is available. The key question is whether momentum still justifies extra time or whether the plan has done its job.",
      news,
      nextReview: "Review the target, latest headline tone, and whether holding longer would require a new written plan.",
      priceFacts,
      tone: "neutral" as const,
    };
  }

  if (stopDistance !== null && stopDistance < 0 && Math.abs(stopDistance) < 3) {
    return {
      decisionZone: "Close to saved stop",
      directionRead: `${trade.symbol} is trading at ${formatCurrency(current)}, only ${Math.abs(stopDistance).toFixed(1)}% above your saved stop at ${formatCurrency(stop)}.`,
      liveRead: "SwingFi flagged this because the remaining downside buffer is small. In plain English: the trade has not failed yet, but it is close enough to the saved risk line that you should review the plan before emotion makes the decision for you.",
      news,
      nextReview: "Check whether price is still holding above the saved stop, whether the latest headline tone adds risk, and whether the possible loss still fits your plan.",
      priceFacts,
      tone: "caution" as const,
    };
  }

  if (targetDistance !== null && targetDistance < 3) {
    return {
      decisionZone: "Target watch",
      directionRead: `${trade.symbol} is within ${Math.abs(targetDistance).toFixed(1)}% of the saved target, so the profit plan matters more than finding new upside.`,
      liveRead: "The setup is progressing toward the planned reward area.",
      news,
      nextReview: "Review whether the move is still supported by price action and headlines before extending the hold window.",
      priceFacts,
      tone: "neutral" as const,
    };
  }

  if (openReturn !== null && openReturn > 0) {
    return {
      decisionZone: "Inside plan",
      directionRead: `${trade.symbol} is trading ${formatPercent(openReturn)} from your tracked entry and still between the saved stop and target.`,
      liveRead:
        daysLeft !== null && daysLeft <= 2
          ? "The trade is profitable but the planned swing window is nearly finished, so the next review should be time-based as well as price-based."
          : "The setup is constructive while price remains above entry and continues moving toward the target.",
      news,
      nextReview: "Compare distance to target versus distance to stop, then check if headline tone still supports the setup.",
      priceFacts,
      tone: news.tone === "caution" ? "neutral" : "positive" as const,
    };
  }

  return {
    decisionZone: "Hold plan; do not add yet",
    directionRead: `${trade.symbol} is trading ${formatPercent(openReturn)} from your tracked entry and remains between the stop and target.`,
    liveRead: "The setup has not failed, but the price has not moved enough in your favor to justify getting more aggressive.",
    news,
    nextReview: "Keep the stop visible. Wait for price to move back above your entry or closer to the target before treating the trade as stronger.",
    priceFacts,
    tone: news.tone === "caution" ? "caution" : "neutral" as const,
  };
}
