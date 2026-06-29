import { NextResponse } from "next/server";
import type { AssetType, TradeStatus } from "@/lib/database.types";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { getFmpCompanyProfile, getFmpStockNews } from "@/lib/providers/fmp";

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

function decisionLabel(trade: {
  currentPrice: number | null;
  entry_price: number;
  opened_at: string | null;
  plannedHoldingDays: number | null;
  status: TradeStatus;
  stop_loss: number;
  target_price: number;
}) {
  if (trade.status === "closed") return "Closed";
  if (trade.status === "cancelled") return "Cancelled";
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
  const [profile, news] = await Promise.all([
    getFmpCompanyProfile(symbol).catch(() => null),
    getFmpStockNews(symbol, 3).catch(() => []),
  ]);
  const currentPrice = parsePositiveNumber(profile?.price);
  const entryPrice = Number(row.entry_price);
  const targetPrice = Number(row.target_price);
  const stopLoss = Number(row.stop_loss);
  const plannedHoldingDays = getPlannedHoldingDays(row.notes);
  const unrealizedReturnPct =
    currentPrice && entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : null;

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
      opened_at: (row.opened_at as string | null) ?? null,
      plannedHoldingDays,
      status: normalizeStatus(row.status),
      stop_loss: stopLoss,
      target_price: targetPrice,
    }),
    plannedHoldingDays,
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

  return NextResponse.json({ trades });
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
  const targetPrice = parsePositiveNumber(body?.targetPrice);
  const stopLoss = parsePositiveNumber(body?.stopLoss);
  const quantity = parsePositiveNumber(body?.quantity) ?? 1;

  if (!symbol) {
    return NextResponse.json({ error: "Add the ticker symbol you bought." }, { status: 400 });
  }

  if (!entryPrice || !targetPrice || !stopLoss) {
    return NextResponse.json(
      { error: "Entry price, target, and stop loss are required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("trade_history")
    .insert({
      asset_type: normalizeAssetType(body?.assetType),
      entry_price: entryPrice,
      exit_price: parsePositiveNumber(body?.exitPrice),
      notes: cleanText(body?.notes) || null,
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
