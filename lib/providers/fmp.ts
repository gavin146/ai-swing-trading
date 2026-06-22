export type FmpHistoricalCandle = {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  adjClose?: number;
  volume?: number;
};

export type FmpCompanyProfile = {
  symbol?: string;
  companyName?: string;
  companyNameLong?: string;
  price?: number;
  marketCap?: number;
  sector?: string;
  volAvg?: number;
  avgVolume?: number;
  isEtf?: boolean;
};

export type FmpIncomeStatement = {
  date?: string;
  revenue?: number;
  netIncome?: number;
  grossProfitRatio?: number;
  operatingIncomeRatio?: number;
};

export type FmpRatiosTtm = {
  debtEquityRatioTTM?: number;
  priceEarningsRatioTTM?: number;
  priceToSalesRatioTTM?: number;
  grossProfitMarginTTM?: number;
  netProfitMarginTTM?: number;
};

export type FmpKeyMetricsTtm = {
  freeCashFlowYieldTTM?: number;
  peRatioTTM?: number;
  revenuePerShareTTM?: number;
};

export type FmpStockNews = {
  symbol?: string;
  publishedDate?: string;
  publisher?: string;
  title?: string;
  text?: string;
  url?: string;
  site?: string;
};

export type FmpEarningsEvent = {
  symbol?: string;
  date?: string;
  epsActual?: number | null;
  epsEstimated?: number | null;
  revenueActual?: number | null;
  revenueEstimated?: number | null;
  lastUpdated?: string;
};

export type FmpSecFiling = {
  symbol?: string;
  cik?: string;
  filingDate?: string;
  acceptedDate?: string;
  formType?: string;
  hasFinancials?: boolean;
  link?: string;
  finalLink?: string;
};

type FmpResponseShape<T> = T[] | { historical?: T[] } | { data?: T[] } | { error?: string };

const fmpBaseUrl = "https://financialmodelingprep.com";

function getFmpApiKey() {
  return process.env.FMP_API_KEY ?? process.env.FINANCIAL_DATA_API_KEY ?? "";
}

function normalizeArrayResponse<T>(payload: FmpResponseShape<T>): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if ("historical" in payload && Array.isArray(payload.historical)) {
    return payload.historical;
  }

  if ("data" in payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

function buildUrl(path: string, params: Record<string, string | number | undefined>) {
  const apiKey = getFmpApiKey();

  if (!apiKey) {
    throw new Error("FMP_API_KEY is not configured.");
  }

  const url = new URL(path, fmpBaseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  url.searchParams.set("apikey", apiKey);

  return url;
}

async function getFmpArray<T>(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<T[]> {
  const response = await fetch(buildUrl(path, params), {
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `FMP request failed with ${response.status} for ${path}${message ? `: ${message.slice(0, 140)}` : ""}`,
    );
  }

  const text = await response.text();
  let payload: FmpResponseShape<T>;

  try {
    payload = JSON.parse(text) as FmpResponseShape<T>;
  } catch {
    throw new Error(`FMP returned a non-JSON response for ${path}: ${text.slice(0, 140)}`);
  }

  if (!Array.isArray(payload) && "error" in payload && payload.error) {
    throw new Error(payload.error);
  }

  return normalizeArrayResponse(payload);
}

export function hasFmpCredentials() {
  return getFmpApiKey().length > 0;
}

export async function getFmpHistoricalCandles(symbol: string, from: string, to: string) {
  return getFmpArray<FmpHistoricalCandle>("/stable/historical-price-eod/full", {
    symbol,
    from,
    to,
  });
}

export async function getFmpCompanyProfile(symbol: string) {
  const rows = await getFmpArray<FmpCompanyProfile>("/stable/profile", { symbol });
  return rows[0] ?? null;
}

export async function getFmpIncomeStatements(symbol: string, limit = 4) {
  return getFmpArray<FmpIncomeStatement>("/stable/income-statement", {
    symbol,
    period: "annual",
    limit,
  });
}

export async function getFmpRatiosTtm(symbol: string) {
  const rows = await getFmpArray<FmpRatiosTtm>("/stable/ratios-ttm", { symbol });
  return rows[0] ?? null;
}

export async function getFmpKeyMetricsTtm(symbol: string) {
  const rows = await getFmpArray<FmpKeyMetricsTtm>("/stable/key-metrics-ttm", { symbol });
  return rows[0] ?? null;
}

export async function getFmpStockNews(symbol: string, limit = 8) {
  return getFmpArray<FmpStockNews>("/stable/news/stock", {
    symbols: symbol,
    limit,
  });
}

export async function getFmpEarnings(symbol: string, limit = 8) {
  return getFmpArray<FmpEarningsEvent>("/stable/earnings", {
    symbol,
    limit,
  });
}

export async function getFmpSecFilingsBySymbol(
  symbol: string,
  from: string,
  to: string,
  limit = 12,
) {
  return getFmpArray<FmpSecFiling>("/stable/sec-filings-search/symbol", {
    symbol,
    from,
    to,
    limit,
  });
}
