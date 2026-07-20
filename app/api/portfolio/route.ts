import { NextResponse } from "next/server";
import type { AssetType, TradeStatus } from "@/lib/database.types";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { buildExitReview, type ExitReview } from "@/lib/portfolio/exit-intelligence";
import { buildPortfolioExitPlan } from "@/lib/portfolio/exit-plan";
import { getFmpCompanyProfile, getFmpHistoricalCandles, getFmpStockNews } from "@/lib/providers/fmp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TradeBody = {
  assetType?: AssetType;
  entryPrice?: number | string;
  exitPrice?: number | string | null;
  notes?: string;
  openedAt?: string;
  opportunityId?: string | null;
  quantity?: number | string;
  status?: TradeStatus;
  stopLoss?: number | string;
  symbol?: string;
  targetPrice?: number | string;
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

function normalizeAssetType(value: unknown): AssetType {
  return value === "etf" || value === "crypto" ? value : "stock";
}

function normalizeStatus(value: unknown): TradeStatus {
  return value === "planned" || value === "closed" || value === "cancelled" ? value : "open";
}

function toIsoDate(value: unknown) {
  const parsed = new Date(cleanText(value));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
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

function statusFromExitReview(review: ExitReview) {
  if (review.status === "below_stop") return "Below stop";
  if (review.status === "near_stop") return "Near stop";
  if (review.status === "target_reached") return "At or above target";
  if (review.status === "peak_fading") return "Peak fade";
  if (review.status === "profit_protection") return "Profit protection";
  if (review.status === "time_window_expired") return "Review time window";
  if (review.status === "time_window_soon") return "Review soon";
  if (review.status === "quote_unavailable") return "Tracking plan";
  if (review.status === "needs_manual_review") return "Needs plan review";
  return "Inside plan";
}

function decisionLabel(trade: {
  currentPrice: number | null;
  entry_price: number;
  exitReview?: ExitReview | null;
  opened_at: string | null;
  plannedHoldingDays: number | null;
  status: TradeStatus;
  stop_loss: number;
  target_price: number;
}) {
  if (trade.status === "closed") return "Closed";
  if (trade.status === "cancelled") return "Cancelled";
  if (trade.exitReview) return statusFromExitReview(trade.exitReview);
  if (!trade.currentPrice) return "Tracking plan";
  if (trade.currentPrice <= trade.stop_loss) return "Below stop";
  if (trade.currentPrice >= trade.target_price) return "At or above target";

  const targetDistance = (trade.target_price - trade.currentPrice) / trade.target_price;
  const stopDistance = (trade.currentPrice - trade.stop_loss) / trade.entry_price;

  if (targetDistance <= 0.02) return "Near target";
  if (stopDistance <= 0.02) return "Near stop";
  if (trade.plannedHoldingDays && daysBetween(trade.opened_at) >= trade.plannedHoldingDays) {
    return "Review time window";
  }

  return "Inside plan";
}

async function enrichTrade(row: Record<string, unknown>) {
  const symbol = normalizeSymbol(row.symbol);
  const status = normalizeStatus(row.status);
  const shouldBuildExitReview = status === "open" || status === "planned";
  const [profile, news, candles] = await Promise.all([
    getFmpCompanyProfile(symbol).catch(() => null),
    getFmpStockNews(symbol, 3).catch(() => []),
    shouldBuildExitReview
      ? getFmpHistoricalCandles(symbol, dateDaysAgo(120), new Date().toISOString().slice(0, 10)).catch(() => [])
      : Promise.resolve([]),
  ]);
  const currentPrice = await getLatestPortfolioPrice(symbol, profile?.price);
  const entryPrice = Number(row.entry_price);
  const targetPrice = Number(row.target_price);
  const stopLoss = Number(row.stop_loss);
  const plannedHoldingDays = getPlannedHoldingDays(row.notes);
  const unrealizedReturnPct =
    currentPrice && entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : null;
  const exitReview = shouldBuildExitReview
    ? buildExitReview({
        candles,
        currentPrice,
        daysHeld: daysBetween(row.opened_at as string | null),
        entryPrice,
        openedAt: (row.opened_at as string | null) ?? null,
        plannedHoldingDays,
        stopLoss,
        symbol,
        targetPrice,
      })
    : null;

  return {
    ...row,
    currentPrice,
    daysHeld: daysBetween(row.opened_at as string | null),
    latestNews: news
      .filter((item) => item.title)
      .slice(0, 3)
      .map((item) => ({
        publishedDate: item.publishedDate ?? null,
        site: item.site ?? item.publisher ?? null,
        title: item.title ?? "",
        url: item.url ?? null,
      })),
    planStatus: decisionLabel({
      currentPrice,
      entry_price: entryPrice,
      exitReview,
      opened_at: (row.opened_at as string | null) ?? null,
      plannedHoldingDays,
      status,
      stop_loss: stopLoss,
      target_price: targetPrice,
    }),
    plannedHoldingDays,
    exitReview,
    unrealizedReturnPct,
  };
}

export async function GET(request: Request) {
  const session = await resolveCustomerSession(request);
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  const supabase = session.supabase!;
  const user = session.user!;

  const { data, error } = await supabase
    .from("trade_history")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  const trades = await Promise.all((data ?? []).map((row) => enrichTrade(row)));

  return NextResponse.json({ refreshedAt: new Date().toISOString(), trades });
}

export async function POST(request: Request) {
  const session = await resolveCustomerSession(request);
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  const supabase = session.supabase!;
  const user = session.user!;

  const body = (await request.json().catch(() => null)) as TradeBody | null;
  const symbol = normalizeSymbol(body?.symbol);
  const entryPrice = parsePositiveNumber(body?.entryPrice);
  let targetPrice = parsePositiveNumber(body?.targetPrice);
  let stopLoss = parsePositiveNumber(body?.stopLoss);
  const quantity = parsePositiveNumber(body?.quantity) ?? 1;
  let notes = cleanText(body?.notes);

  if (!symbol) {
    return NextResponse.json({ error: "Add the ticker symbol you bought." }, { status: 400 });
  }

  if (!entryPrice) {
    return NextResponse.json(
      { error: "Add the price you paid for the trade." },
      { status: 400 },
    );
  }

  if (!targetPrice || !stopLoss) {
    try {
      const exitPlan = await buildPortfolioExitPlan({ entryPrice, symbol });
      targetPrice = targetPrice ?? exitPlan.targetPrice;
      stopLoss = stopLoss ?? exitPlan.stopLoss;
      const planSource =
        exitPlan.source === "swingfi_daily_analysis"
          ? "latest SwingFi daily analysis"
          : "market-structure estimate";
      const hasPlannedHold = /planned hold:\s*\d+\s*days/i.test(notes);
      const autoPlanNote = [
        hasPlannedHold ? "" : `Planned hold: ${exitPlan.holdingPeriodDays} days.`,
        `SwingFi exit plan: ${exitPlan.actionLabel}. Target zone ${exitPlan.takeProfitZoneLow}-${exitPlan.takeProfitZoneHigh}, trail protection near ${exitPlan.trailingStop}, reward/risk ${exitPlan.rewardRiskRatio}R. ${exitPlan.explanation} Source: ${planSource}.`,
      ]
        .filter(Boolean)
        .join("\n\n");
      notes = [notes, autoPlanNote].filter(Boolean).join("\n\n");
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "SwingFi could not build an exit plan for this trade.",
        },
        { status: 503 },
      );
    }
  }

  if (!targetPrice || !stopLoss) {
    return NextResponse.json(
      { error: "SwingFi could not build a complete target and stop for this trade." },
      { status: 503 },
    );
  }

  if (targetPrice <= entryPrice) {
    return NextResponse.json(
      { error: "For long trades, the target price must be above the entry price." },
      { status: 400 },
    );
  }

  if (stopLoss >= entryPrice) {
    return NextResponse.json(
      { error: "For long trades, the stop loss must be below the entry price." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("trade_history")
    .insert({
      asset_type: normalizeAssetType(body?.assetType),
      entry_price: entryPrice,
      exit_price: parsePositiveNumber(body?.exitPrice),
      notes: notes || null,
      opened_at: toIsoDate(body?.openedAt),
      opportunity_id: cleanText(body?.opportunityId) || null,
      quantity,
      status: normalizeStatus(body?.status),
      stop_loss: stopLoss,
      symbol,
      target_price: targetPrice,
      user_id: user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not save this trade." },
      { status: 503 },
    );
  }

  return NextResponse.json({ trade: await enrichTrade(data) }, { status: 201 });
}
