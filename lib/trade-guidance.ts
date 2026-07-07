import type { Opportunity } from "@/lib/opportunities";

export type BeginnerTradeGuide = {
  avoid: string;
  headline: string;
  plainEnglish: string;
  steps: string[];
  tone: "positive" | "neutral" | "caution";
};

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
