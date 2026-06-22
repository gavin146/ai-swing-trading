export type FredObservation = {
  date: string;
  value: string;
};

export type FredSeriesId =
  | "DFF"
  | "DGS2"
  | "DGS10"
  | "T10Y2Y"
  | "CPIAUCSL"
  | "UNRATE"
  | "SP500";

export type FredMacroContext = {
  isLive: boolean;
  marketRegimeScore: number;
  economicSurpriseScore: number;
  ratesPressureScore: number;
  breadthScore: number;
  summary: string;
  notes: string[];
};

type FredSeriesResponse = {
  observations?: FredObservation[];
  error_message?: string;
};

const fredBaseUrl = "https://api.stlouisfed.org";

function getFredApiKey() {
  return process.env.FRED_API_KEY ?? "";
}
function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function numericObservations(observations: FredObservation[]) {
  return observations
    .map((observation) => ({
      date: observation.date,
      value: Number(observation.value),
    }))
    .filter((observation) => Number.isFinite(observation.value))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function latest(values: ReturnType<typeof numericObservations>) {
  return values.at(-1)?.value;
}

function previous(values: ReturnType<typeof numericObservations>, periodsBack: number) {
  if (values.length === 0) return undefined;
  return values[Math.max(0, values.length - 1 - periodsBack)]?.value;
}

function percentChange(current: number | undefined, old: number | undefined) {
  if (!Number.isFinite(current) || !Number.isFinite(old) || old === 0) {
    return 0;
  }

  return ((Number(current) - Number(old)) / Math.abs(Number(old))) * 100;
}

function pointsChange(current: number | undefined, old: number | undefined) {
  if (!Number.isFinite(current) || !Number.isFinite(old)) {
    return 0;
  }

  return Number(current) - Number(old);
}

async function getFredSeries(seriesId: FredSeriesId, limit = 36) {
  const apiKey = getFredApiKey();

  if (!apiKey) {
    throw new Error("FRED_API_KEY is not configured.");
  }

  const url = new URL("/fred/series/observations", fredBaseUrl);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `FRED request failed with ${response.status} for ${seriesId}${message ? `: ${message.slice(0, 140)}` : ""}`,
    );
  }

  const payload = (await response.json()) as FredSeriesResponse;

  if (payload.error_message) {
    throw new Error(payload.error_message);
  }

  return numericObservations(payload.observations ?? []);
}

export function hasFredCredentials() {
  return getFredApiKey().length > 0;
}

export function getNeutralFredMacroContext(reason = "FRED macro data is not configured.") {
  return {
    isLive: false,
    marketRegimeScore: 63,
    economicSurpriseScore: 55,
    ratesPressureScore: 52,
    breadthScore: 58,
    summary: "Macro provider is neutral because live FRED data was not available.",
    notes: [reason],
  } satisfies FredMacroContext;
}

export async function getFredMacroContext() {
  if (!hasFredCredentials()) {
    return getNeutralFredMacroContext();
  }

  try {
    const [fedFunds, twoYear, tenYear, yieldCurve, cpi, unemployment, sp500] =
      await Promise.all([
        getFredSeries("DFF", 45),
        getFredSeries("DGS2", 65),
        getFredSeries("DGS10", 65),
        getFredSeries("T10Y2Y", 65),
        getFredSeries("CPIAUCSL", 18),
        getFredSeries("UNRATE", 18),
        getFredSeries("SP500", 90),
      ]);
    const fedFundsRate = latest(fedFunds);
    const twoYearRate = latest(twoYear);
    const tenYearRate = latest(tenYear);
    const curveSpread = latest(yieldCurve) ?? pointsChange(tenYearRate, twoYearRate);
    const cpiNow = latest(cpi);
    const cpiYearAgo = previous(cpi, 12);
    const unemploymentNow = latest(unemployment);
    const unemploymentThreeMonthsAgo = previous(unemployment, 3);
    const sp500Now = latest(sp500);
    const sp500SixtySessionsAgo = previous(sp500, 60);
    const inflationRate = percentChange(cpiNow, cpiYearAgo);
    const unemploymentTrend = pointsChange(unemploymentNow, unemploymentThreeMonthsAgo);
    const sp500Trend = percentChange(sp500Now, sp500SixtySessionsAgo);
    const ratesPressureScore = clamp(
      22 +
        (fedFundsRate ?? 4.5) * 7.5 +
        (tenYearRate ?? 4) * 4 +
        Math.max(0, -Number(curveSpread ?? 0)) * 10 +
        Math.max(0, inflationRate - 2) * 7,
      20,
      90,
    );
    const economicSurpriseScore = clamp(
      62 - Math.max(0, unemploymentTrend) * 34 - Math.max(0, inflationRate - 3) * 4,
      25,
      85,
    );
    const breadthScore = clamp(55 + sp500Trend * 1.4, 25, 85);
    const marketRegimeScore = clamp(
      70 + sp500Trend * 0.75 + economicSurpriseScore * 0.12 - ratesPressureScore * 0.32,
      25,
      88,
    );

    return {
      isLive: true,
      marketRegimeScore: Math.round(marketRegimeScore),
      economicSurpriseScore: Math.round(economicSurpriseScore),
      ratesPressureScore: Math.round(ratesPressureScore),
      breadthScore: Math.round(breadthScore),
      summary: `FRED macro context uses Fed funds ${round(fedFundsRate ?? 0)}%, 10Y ${round(tenYearRate ?? 0)}%, 10Y-2Y spread ${round(curveSpread ?? 0)} pts, CPI inflation ${round(inflationRate)}%, unemployment ${round(unemploymentNow ?? 0)}%, and S&P 500 60-session trend ${round(sp500Trend)}%.`,
      notes: [
        "Live FRED macro data is connected for rates, inflation, unemployment, yield curve, and broad-market trend.",
      ],
    } satisfies FredMacroContext;
  } catch (error) {
    return getNeutralFredMacroContext(
      error instanceof Error ? error.message : "FRED macro request failed.",
    );
  }
}
