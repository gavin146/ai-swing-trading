import {
  getCustomerDailyPickLimit,
  type CustomerProfile,
} from "@/lib/customer-store";
import type { Opportunity } from "@/lib/opportunities";

function percentNumber(value: string) {
  return Number(value.replace("+", "").replace("%", "")) || 0;
}

export function preferenceFitScore(opportunity: Opportunity, customer: CustomerProfile) {
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

export function getPersonalizedDailyPicks(
  customer: CustomerProfile | null,
  opportunities: Opportunity[],
) {
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
}
