import type { TradeHistoryRow, TradeStatus } from "@/lib/database.types";
import { getFmpCompanyProfile, getFmpHistoricalCandles, getFmpStockNews } from "@/lib/providers/fmp";
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/server";

export type MorningPortfolioNewsItem = {
  publishedDate: string | null;
  site: string | null;
  title: string;
  url: string | null;
};

export type MorningPortfolioPosition = {
  currentPrice: number | null;
  daysHeld: number;
  nextReview: string;
  openedAt: string | null;
  planStatus: string;
  plannedHoldingDays: number | null;
  stopLoss: number;
  symbol: string;
  targetPrice: number;
  unrealizedReturnPct: number | null;
  watchItems: string[];
  latestNews: MorningPortfolioNewsItem[];
};

export type MorningPortfolioDigest = {
  generatedAt: string;
  needsReviewCount: number;
  openCount: number;
  positions: MorningPortfolioPosition[];
  source: "supabase" | "unavailable";
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeSymbol(value: unknown) {
  return cleanText(value).toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function parsePositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeStatus(value: unknown): TradeStatus {
  return value === "planned" || value === "closed" || value === "cancelled" ? value : "open";
}

function daysBetween(start: string | null, end = new Date()) {
  if (!start) return 0;
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, Math.floor((end.getTime() - parsed.getTime()) / 86_400_000));
}

function getPlannedHoldingDays(notes: unknown) {
  const text = cleanText(notes);
  const match =
    text.match(/planned hold:\s*(\d+)\s*days/i) ??
    text.match(/estimated a\s*(\d+)-day holding window/i);
  const parsed = Number(match?.[1]);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function getLatestPortfolioPrice(symbol: string, profilePrice: unknown) {
  const currentPrice = parsePositiveNumber(profilePrice);

  if (currentPrice !== null) return currentPrice;

  const candles = await getFmpHistoricalCandles(symbol, dateDaysAgo(14), new Date().toISOString().slice(0, 10))
    .catch(() => []);
  const latestClose = [...candles]
    .filter((candle) => parsePositiveNumber(candle.close) !== null)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.close;

  return parsePositiveNumber(latestClose);
}

function buildPositionPlan(trade: {
  currentPrice: number | null;
  daysHeld: number;
  entryPrice: number;
  plannedHoldingDays: number | null;
  status: TradeStatus;
  stopLoss: number;
  targetPrice: number;
}) {
  if (trade.status === "planned") {
    return {
      planStatus: "Planned",
      nextReview: "Confirm the setup still fits before entering the trade.",
      watchItems: ["Price entering the planned buy range", "Any new catalyst or event risk"],
      priority: 3,
    };
  }

  if (!trade.currentPrice) {
    return {
      planStatus: "Tracking plan",
      nextReview: "Latest price was unavailable, so review the position in your brokerage.",
      watchItems: ["Broker quote", "Target and stop still matching your risk plan"],
      priority: 4,
    };
  }

  if (trade.currentPrice <= trade.stopLoss) {
    return {
      planStatus: "Below stop",
      nextReview: "Price is below the saved stop area. Review whether the original setup is invalid.",
      watchItems: ["Stop discipline", "Whether news changed the original thesis"],
      priority: 1,
    };
  }

  if (trade.currentPrice >= trade.targetPrice) {
    return {
      planStatus: "At or above target",
      nextReview: "Target area is available. Review profit protection before the move fades.",
      watchItems: ["Volume holding up", "Reversal candles near the target zone"],
      priority: 1,
    };
  }

  const targetDistance = (trade.targetPrice - trade.currentPrice) / trade.targetPrice;
  const stopDistance = (trade.currentPrice - trade.stopLoss) / trade.entryPrice;
  const daysRemaining =
    trade.plannedHoldingDays === null ? null : trade.plannedHoldingDays - trade.daysHeld;

  if (targetDistance <= 0.02) {
    return {
      planStatus: "Near target",
      nextReview: "Price is close to the target. Review whether to protect gains if momentum slows.",
      watchItems: ["Target-zone rejection", "Open gain versus remaining upside"],
      priority: 2,
    };
  }

  if (stopDistance <= 0.02) {
    return {
      planStatus: "Near stop",
      nextReview: "Price is close to the stop. Review risk before giving the trade more room.",
      watchItems: ["Stop area break", "Weak relative strength versus SPY or QQQ"],
      priority: 2,
    };
  }

  if (daysRemaining !== null && daysRemaining <= 0) {
    return {
      planStatus: "Time window ending",
      nextReview: "The planned swing window is ending. Review whether the setup still deserves capital.",
      watchItems: ["Stalling price action", "Newer opportunities with cleaner reward/risk"],
      priority: 2,
    };
  }

  if (daysRemaining !== null && daysRemaining <= 2) {
    return {
      planStatus: "Review soon",
      nextReview: "The swing window is getting close. Check if price is moving toward target or losing momentum.",
      watchItems: ["Distance to target", "Distance to stop", "Recent news tone"],
      priority: 3,
    };
  }

  return {
    planStatus: "Inside plan",
    nextReview: "No urgent exit signal from the saved plan. Keep watching target, stop, and new headlines.",
    watchItems: ["Target progress", "Stop area", "Fresh catalyst changes"],
    priority: 5,
  };
}

async function enrichPosition(row: TradeHistoryRow) {
  const symbol = normalizeSymbol(row.symbol);
  const [profile, news] = await Promise.all([
    getFmpCompanyProfile(symbol).catch(() => null),
    getFmpStockNews(symbol, 2).catch(() => []),
  ]);
  const currentPrice = await getLatestPortfolioPrice(symbol, profile?.price);
  const entryPrice = Number(row.entry_price);
  const targetPrice = Number(row.target_price);
  const stopLoss = Number(row.stop_loss);
  const daysHeld = daysBetween(row.opened_at);
  const plannedHoldingDays = getPlannedHoldingDays(row.notes);
  const unrealizedReturnPct =
    currentPrice && entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : null;
  const plan = buildPositionPlan({
    currentPrice,
    daysHeld,
    entryPrice,
    plannedHoldingDays,
    status: normalizeStatus(row.status),
    stopLoss,
    targetPrice,
  });

  return {
    currentPrice,
    daysHeld,
    latestNews: news
      .filter((item) => item.title)
      .slice(0, 2)
      .map((item) => ({
        publishedDate: item.publishedDate ?? null,
        site: item.site ?? item.publisher ?? null,
        title: item.title ?? "",
        url: item.url ?? null,
      })),
    nextReview: plan.nextReview,
    openedAt: row.opened_at,
    planStatus: plan.planStatus,
    plannedHoldingDays,
    priority: plan.priority,
    stopLoss,
    symbol,
    targetPrice,
    unrealizedReturnPct,
    watchItems: plan.watchItems,
  };
}

export async function getMorningPortfolioDigest(userId?: string | null) {
  if (!userId || !hasSupabaseAdminConfig()) {
    return null;
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("trade_history")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["open", "planned"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data?.length) {
    return null;
  }

  const enriched = await Promise.all((data as TradeHistoryRow[]).map((row) => enrichPosition(row)));
  const sorted = enriched.sort((a, b) => a.priority - b.priority).slice(0, 5);
  const needsReviewCount = enriched.filter((item) => item.priority <= 2).length;

  return {
    generatedAt: new Date().toISOString(),
    needsReviewCount,
    openCount: enriched.length,
    positions: sorted.map(({ priority: _priority, ...position }) => position),
    source: "supabase" as const,
  } satisfies MorningPortfolioDigest;
}
