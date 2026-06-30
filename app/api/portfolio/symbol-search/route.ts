import { NextResponse } from "next/server";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import {
  searchFmpCompanyNames,
  searchFmpSymbols,
  type FmpSymbolSearchResult,
} from "@/lib/providers/fmp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanQuery(value: string | null) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9 .-]/g, "");
}

function normalizeSymbol(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function normalizeExchange(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function isUsefulExchange(row: FmpSymbolSearchResult) {
  const exchange = normalizeExchange(row.exchangeShortName || row.stockExchange);

  return (
    !exchange ||
    exchange.includes("NASDAQ") ||
    exchange.includes("NYSE") ||
    exchange.includes("AMEX") ||
    exchange.includes("ETF") ||
    exchange === "NMS" ||
    exchange === "NYQ" ||
    exchange === "ASE"
  );
}

function normalizeResult(row: FmpSymbolSearchResult) {
  const symbol = normalizeSymbol(row.symbol);

  if (!symbol) return null;

  return {
    currency: row.currency ?? "USD",
    exchange: row.exchangeShortName ?? row.stockExchange ?? "US",
    name: row.name ?? row.companyName ?? symbol,
    symbol,
  };
}

export async function GET(request: Request) {
  const session = await resolveCustomerSession(request);
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const { searchParams } = new URL(request.url);
  const query = cleanQuery(searchParams.get("q"));

  if (query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const [symbolRows, nameRows] = await Promise.all([
      searchFmpSymbols(query, 10).catch(() => []),
      query.length >= 2 ? searchFmpCompanyNames(query, 10).catch(() => []) : Promise.resolve([]),
    ]);
    const seen = new Set<string>();
    const results = [...symbolRows, ...nameRows]
      .filter(isUsefulExchange)
      .map(normalizeResult)
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => {
        if (seen.has(row.symbol)) return false;
        seen.add(row.symbol);
        return true;
      })
      .slice(0, 8);

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ticker search failed." },
      { status: 503 },
    );
  }
}
