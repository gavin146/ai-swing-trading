import type { Opportunity } from "@/lib/opportunities";

export type BeginnerTradeGuide = {
  avoid: string;
  headline: string;
  plainEnglish: string;
  steps: string[];
  tone: "positive" | "neutral" | "caution";
};

export type CoachVerdict = {
  actionLabel: "Buy now" | "Good buy if under" | "Do not buy above" | "Skip today" | "High risk";
  actionText: string;
  badgeTone: "positive" | "neutral" | "caution";
  confidenceText: string;
  direction: "Likely up" | "Mixed" | "Likely down";
  directionText: string;
  forecastRange: string;
  guardrail: string;
  oneLine: string;
  percentageText: string;
  reason: string;
  riskText: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function rewardRisk(opportunity: Opportunity) {
  return opportunity.expectedLossValue > 0
    ? opportunity.expectedGainValue / opportunity.expectedLossValue
    : opportunity.expectedGainValue;
}

function confidenceWord(confidence: number) {
  if (confidence >= 82) return "Strong";
  if (confidence >= 70) return "Good";
  if (confidence >= 60) return "Mixed";
  return "Weak";
}

export function getCoachVerdict(opportunity: Opportunity): CoachVerdict {
  const ratio = rewardRisk(opportunity);
  const buyUnder = formatCurrency(opportunity.entryHigh);
  const riskLine = formatCurrency(opportunity.stopLossValue);
  const target = formatCurrency(opportunity.targetPriceValue);
  const forecastLow =
    opportunity.riskScore >= 70 || opportunity.confidenceScore < 62
      ? opportunity.stopLossValue
      : opportunity.entryLow;
  const forecastRange = `${formatCurrency(forecastLow)} - ${target}`;
  const percentageText = `Possible gain ${opportunity.potentialGain}; risk if wrong ${opportunity.potentialLoss}.`;
  const confidenceText = `${confidenceWord(opportunity.confidenceScore)} confidence`;

  if (
    opportunity.opportunityScore >= 84 &&
    opportunity.confidenceScore >= 75 &&
    opportunity.riskScore <= 55 &&
    ratio >= 1.8
  ) {
    return {
      actionLabel: "Buy now",
      actionText: `Buy now only if the price is ${buyUnder} or lower.`,
      badgeTone: "positive",
      confidenceText,
      direction: "Likely up",
      directionText: `SwingFi expects ${opportunity.symbol} to rise over the next ${opportunity.timeHorizon}.`,
      forecastRange,
      guardrail: `Do not buy above ${buyUnder}. Above that, the profit potential shrinks and the risk/reward gets worse.`,
      oneLine: `${opportunity.symbol}: Buy now if the price is ${buyUnder} or lower.`,
      percentageText,
      reason: "It ranks near the top today because upside, confidence, and risk are lining up better than most names scanned.",
      riskText: `If it falls below ${riskLine}, the original plan is no longer working.`,
    };
  }

  if (
    opportunity.opportunityScore >= 74 &&
    opportunity.confidenceScore >= 65 &&
    opportunity.riskScore <= 66 &&
    ratio >= 1.35
  ) {
    return {
      actionLabel: "Good buy if under",
      actionText: `Good buy if you can get it at ${buyUnder} or lower.`,
      badgeTone: "positive",
      confidenceText,
      direction: "Likely up",
      directionText: `SwingFi expects upward movement if ${opportunity.symbol} stays near the planned price area.`,
      forecastRange,
      guardrail: `Do not buy above ${buyUnder}. If it is already higher, wait for a better price or review another ticker.`,
      oneLine: `${opportunity.symbol}: Good buy if under ${buyUnder}.`,
      percentageText,
      reason: "It has enough upside to be worth attention, but the buying price matters.",
      riskText: `The risk line is ${riskLine}. Below that, the plan is failing.`,
    };
  }

  if (opportunity.riskScore >= 70 || opportunity.expectedLossValue >= opportunity.expectedGainValue) {
    return {
      actionLabel: "High risk",
      actionText: "High risk. Beginners should slow down or skip unless they fully understand the downside.",
      badgeTone: "caution",
      confidenceText,
      direction: opportunity.confidenceScore >= 72 ? "Mixed" : "Likely down",
      directionText:
        opportunity.confidenceScore >= 72
          ? `SwingFi sees possible upside, but ${opportunity.symbol} can move against you quickly.`
          : `SwingFi does not see a clean enough upward setup for ${opportunity.symbol} today.`,
      forecastRange,
      guardrail: `Do not buy above ${buyUnder}. The risk is already elevated, so chasing makes the setup worse.`,
      oneLine: `${opportunity.symbol}: High risk today.`,
      percentageText,
      reason: "The possible reward is not clean enough compared with the downside risk.",
      riskText: `If price moves toward ${riskLine}, protecting capital matters more than hoping it recovers.`,
    };
  }

  if (opportunity.confidenceScore < 62 || opportunity.opportunityScore < 66) {
    return {
      actionLabel: "Skip today",
      actionText: "Skip today. SwingFi does not see enough clean evidence to make this a strong idea.",
      badgeTone: "caution",
      confidenceText,
      direction: "Likely down",
      directionText: `SwingFi does not expect a strong enough move up from ${opportunity.symbol} right now.`,
      forecastRange,
      guardrail: `Do not buy above ${buyUnder}. There are likely cleaner choices in today's list.`,
      oneLine: `${opportunity.symbol}: Skip today.`,
      percentageText,
      reason: "The setup needs stronger evidence before it deserves attention over higher-ranked choices.",
      riskText: `The plan breaks if price falls below ${riskLine}.`,
    };
  }

  return {
    actionLabel: "Do not buy above",
    actionText: `Do not buy above ${buyUnder}. Under that price, it can stay on your review list.`,
    badgeTone: "neutral",
    confidenceText,
    direction: "Mixed",
    directionText: `SwingFi sees a possible move up, but ${opportunity.symbol} needs the price to stay attractive.`,
    forecastRange,
    guardrail: `If it is above ${buyUnder}, the setup is no longer attractive enough compared with the risk.`,
    oneLine: `${opportunity.symbol}: Do not buy above ${buyUnder}.`,
    percentageText,
    reason: "This is not one of the cleanest ideas today, but it still has a defined price plan.",
    riskText: `Below ${riskLine}, the plan is failing.`,
  };
}

export function getBeginnerTradeGuide(opportunity: Opportunity): BeginnerTradeGuide {
  const highQuality =
    opportunity.opportunityScore >= 80 &&
    opportunity.confidenceScore >= 72 &&
    opportunity.riskScore <= 58;
  const highRisk = opportunity.riskScore >= 70;
  const lowerConfidence = opportunity.confidenceScore < 62;

  if (highQuality) {
    return {
      avoid: `Avoid chasing ${opportunity.symbol} if price has already moved above the entry area. The plan only works if risk still fits.`,
      headline: "Review this first, then check the entry",
      plainEnglish: `${opportunity.symbol} is ranking higher because the current upside, risk, and confidence scores are working together better than most names in today's scan.`,
      steps: [
        `Check that price is still near ${opportunity.entryRange}.`,
        `Compare the planned upside to the stop at ${opportunity.stopLoss}.`,
        "If you take the trade, track it in Portfolio so the exit plan stays visible.",
      ],
      tone: "positive",
    };
  }

  if (highRisk) {
    return {
      avoid: "Avoid using normal position size until you understand why the risk score is elevated.",
      headline: "Higher-risk idea: slow down first",
      plainEnglish: `${opportunity.symbol} may have upside, but the risk score says the trade can move against you quickly. Beginners should treat this as a careful review, not a quick click.`,
      steps: [
        `Read the full analysis before acting on ${opportunity.symbol}.`,
        `Make sure a move to ${opportunity.stopLoss} would be acceptable for your account.`,
        "If the entry is messy or far from the plan, skip it and review another setup.",
      ],
      tone: "caution",
    };
  }

  if (lowerConfidence) {
    return {
      avoid: "Avoid forcing the trade just because the upside looks interesting.",
      headline: "Wait for cleaner confirmation",
      plainEnglish: `${opportunity.symbol} has some pieces of a swing setup, but SwingFi has less confidence in the evidence today.`,
      steps: [
        "Look for stronger price action, volume, or news confirmation.",
        `Only keep reviewing if price respects the entry area around ${opportunity.entryRange}.`,
        "Use Watch instead of Track trade unless you actually enter the position.",
      ],
      tone: "neutral",
    };
  }

  return {
    avoid: "Avoid spending too much time on this if higher-ranked setups are cleaner today.",
    headline: "Useful watchlist candidate",
    plainEnglish: `${opportunity.symbol} has a usable swing plan, but the scores say it should be reviewed after the stronger setups. Treat it as a watchlist idea unless the entry, target, stop, and news all still line up.`,
    steps: [
      `Check entry range: ${opportunity.entryRange}.`,
      `Check target ${opportunity.targetPrice} versus stop ${opportunity.stopLoss}.`,
      "Save it if you want to compare it against tomorrow's ranking.",
    ],
    tone: "neutral",
  };
}
