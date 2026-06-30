import { NextResponse } from "next/server";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import {
  getFmpHistoricalCandles,
  getFmpIntradayCandles,
  type FmpHistoricalCandle,
} from "@/lib/providers/fmp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EntryPriceBody = {
  date?: string;
  symbol?: string;
  timeWindow?: "open" | "midday" | "afternoon" | "after_hours";
};

const targetTimes: Record<NonNullable<EntryPriceBody["timeWindow"]>, string> = {
  after_hours: "16:30:00",
  afternoon: "15:00:00",
  midday: "12:30:00",
  open: "09:45:00",
};

function cleanDate(value: unknown) {
  const date = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function normalizeSymbol(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function normalizeWindow(value: unknown): NonNullable<EntryPriceBody["timeWindow"]> {
  return value === "midday" || value === "afternoon" || value === "after_hours"
    ? value
    : "open";
}

function priceFromCandle(candle: FmpHistoricalCandle) {
  const close = Number(candle.close);
  const open = Number(candle.open);

  if (Number.isFinite(close) && close > 0) return close;
  if (Number.isFinite(open) && open > 0) return open;
  return null;
}

function nearestIntradayCandle(
  candles: FmpHistoricalCandle[],
  date: string,
  timeWindow: NonNullable<EntryPriceBody["timeWindow"]>,
) {
  const target = new Date(`${date}T${targetTimes[timeWindow]}`).getTime();

  return candles
    .filter((candle) => String(candle.date ?? "").startsWith(date))
    .map((candle) => ({
      candle,
      distance: Math.abs(new Date(String(candle.date).replace(" ", "T")).getTime() - target),
    }))
    .filter((item) => Number.isFinite(item.distance))
    .sort((a, b) => a.distance - b.distance)[0]?.candle ?? null;
}

function dailyEstimate(
  candle: FmpHistoricalCandle,
  timeWindow: NonNullable<EntryPriceBody["timeWindow"]>,
) {
  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);

  if (timeWindow === "open" && Number.isFinite(open) && open > 0) return open;
  if (
    timeWindow === "midday" &&
    Number.isFinite(high) &&
    Number.isFinite(low) &&
    high > 0 &&
    low > 0
  ) {
    return (high + low) / 2;
  }
  if (Number.isFinite(close) && close > 0) return close;
  return priceFromCandle(candle);
}

export async function POST(request: Request) {
  const session = await resolveCustomerSession(request);
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const body = (await request.json().catch(() => null)) as EntryPriceBody | null;
  const symbol = normalizeSymbol(body?.symbol);
  const date = cleanDate(body?.date);
  const timeWindow = normalizeWindow(body?.timeWindow);

  if (!symbol) {
    return NextResponse.json({ error: "Choose a ticker first." }, { status: 400 });
  }

  if (!date) {
    return NextResponse.json({ error: "Choose the date you bought the trade." }, { status: 400 });
  }

  try {
    const intraday = await getFmpIntradayCandles(symbol, "5min", date, date).catch(() => []);
    const nearest = nearestIntradayCandle(intraday, date, timeWindow);
    const intradayPrice = nearest ? priceFromCandle(nearest) : null;

    if (intradayPrice) {
      return NextResponse.json({
        confidence: "higher",
        estimatedPrice: Number(intradayPrice.toFixed(2)),
        message: `Estimated from the closest 5-minute FMP candle to ${targetTimes[timeWindow]}.`,
        source: "fmp_intraday",
        sourceTime: nearest?.date ?? null,
      });
    }

    const daily = await getFmpHistoricalCandles(symbol, date, date);
    const day = daily.find((candle) => String(candle.date).startsWith(date)) ?? daily[0];
    const estimate = day ? dailyEstimate(day, timeWindow) : null;

    if (estimate) {
      return NextResponse.json({
        confidence: "estimate",
        estimatedPrice: Number(estimate.toFixed(2)),
        message:
          "Intraday data was not available, so SwingFi estimated from the daily open/high/low/close. Edit it if your broker fill differs.",
        source: "fmp_daily_estimate",
        sourceTime: day.date ?? date,
      });
    }

    return NextResponse.json(
      { error: "SwingFi could not estimate that entry price. Enter your broker fill manually." },
      { status: 404 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Entry price estimate failed." },
      { status: 503 },
    );
  }
}
