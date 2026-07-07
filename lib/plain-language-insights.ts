export type PlainLanguageInsight = {
  evidence: string[];
  headline: string;
  mode: "deterministic" | "openai";
  nextReview: string;
  riskNote: string;
  summary: string;
  symbol: string;
};

export type OpportunityInsightInput = {
  aiExplanation?: string | null;
  confidenceScore: number;
  entryRange: string;
  expectedGainValue: number;
  expectedLossValue: number;
  holdingPeriodDays: number;
  opportunityScore: number;
  rankingSummary?: string | null;
  riskScore: number;
  setupPattern?: string | null;
  stopLoss: string;
  symbol: string;
  targetPrice: string;
};

export type PortfolioInsightInput = {
  currentPrice: number | null;
  daysHeld: number;
  directionRead?: string | null;
  entryPrice: number;
  latestNews?: Array<{ title: string }>;
  liveRead?: string | null;
  nextReview?: string | null;
  planStatus: string;
  plannedHoldingDays: number | null;
  stopLoss: number;
  symbol: string;
  targetPrice: number;
  unrealizedReturnPct: number | null;
};

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

function distancePercent(from: number | null, to: number) {
  if (!from || from <= 0 || !Number.isFinite(to) || to <= 0) return null;
  return ((to - from) / from) * 100;
}

function firstSentence(text: string | null | undefined) {
  const cleaned = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.split(/(?<=\.)\s+/)[0]?.trim() ?? cleaned;
}

function rewardRiskLabel(gain: number, loss: number) {
  const rr = loss > 0 ? gain / loss : 0;
  return `${rr.toFixed(1)}R reward/risk`;
}

export function buildOpportunityPlainInsight(
  opportunity: OpportunityInsightInput,
): PlainLanguageInsight {
  const rewardRisk = rewardRiskLabel(
    opportunity.expectedGainValue,
    opportunity.expectedLossValue,
  );
  const setup = opportunity.setupPattern
    ? `${opportunity.setupPattern.toLowerCase()} setup`
    : "swing setup";
  const scoreRead =
    opportunity.opportunityScore >= 78
      ? "SwingFi ranked this near the top because the upside, risk, and signal quality are lining up better than most names today."
      : opportunity.opportunityScore >= 65
        ? "SwingFi kept this on the review list because the trade plan is usable, but it still needs disciplined entry and risk control."
        : "SwingFi sees a possible setup, but the evidence is not strong enough to treat it as a first-review idea.";
  const confidenceRead =
    opportunity.confidenceScore >= 75
      ? "The confidence score says the available data agrees enough for deeper research."
      : "The confidence score says the data is mixed, so this needs extra confirmation before it deserves more attention.";
  const riskRead =
    opportunity.riskScore >= 65
      ? "Risk is elevated, which means the stop and position size matter more than the upside number."
      : "Risk is not the main warning today, but the stop is still the line that protects the plan.";
  const storedReason = firstSentence(opportunity.aiExplanation || opportunity.rankingSummary);

  return {
    evidence: [
      `${opportunity.expectedGainValue.toFixed(1)}% planned upside to ${opportunity.targetPrice} versus ${opportunity.expectedLossValue.toFixed(1)}% planned downside to ${opportunity.stopLoss}.`,
      `${rewardRisk} if price is reviewed near ${opportunity.entryRange}.`,
      `${confidenceRead} ${riskRead}`,
    ],
    headline:
      opportunity.opportunityScore >= 78
        ? `Why ${opportunity.symbol} is high on today's list`
        : opportunity.riskScore >= 65
          ? `Why ${opportunity.symbol} needs a slower review`
          : `Why ${opportunity.symbol} is on the watchlist`,
    mode: "deterministic",
    nextReview: `First check whether ${opportunity.symbol} is still near ${opportunity.entryRange}. If it has run past that area, the reward/risk math gets worse.`,
    riskNote: `This is research, not a trade command. The idea weakens if price breaks ${opportunity.stopLoss}, if fresh news changes the setup, or if the broader market turns against the ${setup}.`,
    summary: `${scoreRead} ${storedReason || `The current plan is a ${setup} with a ${opportunity.holdingPeriodDays}-day review window.`}`,
    symbol: opportunity.symbol,
  };
}

export function buildPortfolioPlainInsight(
  trade: PortfolioInsightInput,
): PlainLanguageInsight {
  const targetDistance = distancePercent(trade.currentPrice, trade.targetPrice);
  const stopDistance = distancePercent(trade.currentPrice, trade.stopLoss);
  const latestHeadline = trade.latestNews?.find((item) => item.title)?.title;
  const timeRead =
    typeof trade.plannedHoldingDays === "number"
      ? `Day ${trade.daysHeld} of the planned ${trade.plannedHoldingDays}-day swing window.`
      : `Day ${trade.daysHeld} of tracking.`;
  const priceRead = trade.currentPrice
    ? `${trade.symbol} is at ${formatCurrency(trade.currentPrice)}, ${formatPercent(trade.unrealizedReturnPct)} from your tracked entry.`
    : `${trade.symbol} does not have a fresh quote in the latest refresh.`;
  const targetRead =
    targetDistance === null
      ? `Target: ${formatCurrency(trade.targetPrice)}.`
      : `${Math.abs(targetDistance).toFixed(1)}% ${targetDistance >= 0 ? "below" : "above"} the target at ${formatCurrency(trade.targetPrice)}.`;
  const stopRead =
    stopDistance === null
      ? `Stop: ${formatCurrency(trade.stopLoss)}.`
      : stopDistance >= 0
        ? `Latest price is ${Math.abs(stopDistance).toFixed(1)}% below the saved stop at ${formatCurrency(trade.stopLoss)}.`
        : `Saved stop is ${Math.abs(stopDistance).toFixed(1)}% below latest price at ${formatCurrency(trade.stopLoss)}.`;

  return {
    evidence: [
      priceRead,
      `${targetRead} ${stopRead}`,
      latestHeadline ? `Latest headline to review: ${latestHeadline}` : "No fresh headline catalyst was available in the latest refresh.",
    ],
    headline:
      trade.planStatus === "At or above target"
        ? `${trade.symbol}: profit area reached`
        : trade.planStatus === "Below stop" || trade.planStatus === "Near stop"
          ? `${trade.symbol}: risk check needed`
          : trade.planStatus === "Review time window"
            ? `${trade.symbol}: time-window review`
            : `${trade.symbol}: current plan read`,
    mode: "deterministic",
    nextReview:
      trade.nextReview ||
      "Compare the current price against the saved target, stop, latest headline tone, and remaining swing window.",
    riskNote: "SwingFi is not placing trades. Use this as a review checklist and confirm any action inside your brokerage.",
    summary: `${timeRead} ${trade.directionRead || trade.liveRead || "SwingFi is comparing the position against the saved target, stop, and hold window."}`,
    symbol: trade.symbol,
  };
}

export function normalizePlainInsight(
  value: Partial<PlainLanguageInsight> | null | undefined,
  fallback: PlainLanguageInsight,
): PlainLanguageInsight {
  const evidence = Array.isArray(value?.evidence)
    ? value.evidence.filter((item) => typeof item === "string" && item.trim()).slice(0, 3)
    : fallback.evidence;

  return {
    evidence: evidence.length ? evidence : fallback.evidence,
    headline: typeof value?.headline === "string" && value.headline.trim()
      ? value.headline.trim()
      : fallback.headline,
    mode: value?.mode === "openai" ? "openai" : fallback.mode,
    nextReview: typeof value?.nextReview === "string" && value.nextReview.trim()
      ? value.nextReview.trim()
      : fallback.nextReview,
    riskNote: typeof value?.riskNote === "string" && value.riskNote.trim()
      ? value.riskNote.trim()
      : fallback.riskNote,
    summary: typeof value?.summary === "string" && value.summary.trim()
      ? value.summary.trim()
      : fallback.summary,
    symbol: fallback.symbol,
  };
}
