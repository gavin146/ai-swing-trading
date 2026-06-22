type TreasuryExchangeRate = {
  country_currency_desc?: string;
  exchange_rate?: string;
  record_date?: string;
};

type TreasuryResponse = {
  data?: TreasuryExchangeRate[];
};

export type TreasuryMacroContext = {
  isLive: boolean;
  ratesPressureAdjustment: number;
  economicSurpriseAdjustment: number;
  summary: string;
  notes: string[];
};

const treasuryBaseUrl = "https://api.fiscaldata.treasury.gov";

function clamp(value: number, min = -12, max = 12) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentChange(current: number | undefined, old: number | undefined) {
  if (!Number.isFinite(current) || !Number.isFinite(old) || old === 0) {
    return 0;
  }

  return ((Number(current) - Number(old)) / Math.abs(Number(old))) * 100;
}

function latestByCurrency(rows: TreasuryExchangeRate[]) {
  const byCurrency = new Map<string, TreasuryExchangeRate[]>();

  rows.forEach((row) => {
    if (!row.country_currency_desc) return;
    const existing = byCurrency.get(row.country_currency_desc) ?? [];
    existing.push(row);
    byCurrency.set(row.country_currency_desc, existing);
  });

  return Array.from(byCurrency.entries()).map(([currency, currencyRows]) => {
    const sorted = currencyRows
      .filter((row) => Number.isFinite(Number(row.exchange_rate)) && row.record_date)
      .sort((a, b) => new Date(a.record_date ?? "").getTime() - new Date(b.record_date ?? "").getTime());
    const latest = sorted.at(-1);
    const yearAgo =
      sorted.find((row) => {
        if (!latest?.record_date || !row.record_date) return false;
        const days =
          (new Date(latest.record_date).getTime() - new Date(row.record_date).getTime()) /
          (24 * 60 * 60 * 1000);
        return days >= 330;
      }) ?? sorted[0];

    return {
      currency,
      latestRate: Number(latest?.exchange_rate),
      yearAgoRate: Number(yearAgo?.exchange_rate),
      latestDate: latest?.record_date,
    };
  });
}

async function getTreasuryExchangeRates() {
  const url = new URL(
    "/services/api/fiscal_service/v1/accounting/od/rates_of_exchange",
    treasuryBaseUrl,
  );
  url.searchParams.set("fields", "country_currency_desc,exchange_rate,record_date");
  url.searchParams.set(
    "filter",
    "country_currency_desc:in:(Canada-Dollar,Mexico-Peso),record_date:gte:2024-01-01",
  );
  url.searchParams.set("sort", "-record_date");
  url.searchParams.set("page[size]", "500");

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Treasury Fiscal Data request failed with ${response.status}${message ? `: ${message.slice(0, 140)}` : ""}`,
    );
  }

  const payload = (await response.json()) as TreasuryResponse;
  return payload.data ?? [];
}

export function getNeutralTreasuryMacroContext(
  reason = "Treasury Fiscal Data was not available.",
) {
  return {
    isLive: false,
    ratesPressureAdjustment: 0,
    economicSurpriseAdjustment: 0,
    summary: "Treasury currency context is neutral because live Treasury data was not available.",
    notes: [reason],
  } satisfies TreasuryMacroContext;
}

export async function getTreasuryMacroContext() {
  try {
    const rows = await getTreasuryExchangeRates();
    const currencies = latestByCurrency(rows).filter(
      (item) => Number.isFinite(item.latestRate) && Number.isFinite(item.yearAgoRate),
    );

    if (currencies.length === 0) {
      return getNeutralTreasuryMacroContext("Treasury returned no usable exchange-rate rows.");
    }

    const dollarTrend =
      currencies.reduce(
        (total, item) => total + percentChange(item.latestRate, item.yearAgoRate),
        0,
      ) / currencies.length;
    const weakDollarInflationPressure = clamp(Math.max(0, -dollarTrend) * 0.65, 0, 8);
    const strongDollarGrowthDrag = clamp(Math.max(0, dollarTrend - 3) * -0.35, -6, 0);
    const stableCurrencySupport = Math.abs(dollarTrend) <= 2 ? 1 : 0;

    return {
      isLive: true,
      ratesPressureAdjustment: round(weakDollarInflationPressure),
      economicSurpriseAdjustment: round(strongDollarGrowthDrag + stableCurrencySupport),
      summary: `Treasury Fiscal Data shows the USD basket versus Canada-Dollar and Mexico-Peso changed ${round(dollarTrend)}% year over year, using ${currencies.length} exchange-rate series.`,
      notes: [
        "Live Treasury Fiscal Data is connected for exchange-rate pressure using the public rates_of_exchange API.",
      ],
    } satisfies TreasuryMacroContext;
  } catch (error) {
    return getNeutralTreasuryMacroContext(
      error instanceof Error ? error.message : "Treasury Fiscal Data request failed.",
    );
  }
}
