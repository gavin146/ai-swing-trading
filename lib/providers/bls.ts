export type BlsObservation = {
  year: string;
  period: string;
  periodName: string;
  value: string;
  latest?: string;
  footnotes?: { code?: string; text?: string }[];
};

export type BlsSeries = {
  seriesID: string;
  data?: BlsObservation[];
};

export type BlsMacroContext = {
  isLive: boolean;
  ratesPressureAdjustment: number;
  economicSurpriseAdjustment: number;
  summary: string;
  notes: string[];
};

type BlsResponse = {
  status?: string;
  message?: string[];
  Results?: {
    series?: BlsSeries[];
  };
};

const blsApiUrl = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const blsSeriesIds = [
  "CFU0000008000",
  "LEU0254555900",
  "CUUR0000SA0",
  "LNS14000000",
  "CES0500000003",
];

function getBlsApiKey() {
  return process.env.BLS_API_KEY ?? "";
}

function clamp(value: number, min = -20, max = 20) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatMaybe(value: number | undefined) {
  return Number.isFinite(value) ? String(round(Number(value))) : "unavailable";
}

function periodNumber(period: string) {
  if (!period.startsWith("M")) return 13;
  return Number(period.slice(1));
}

function numericObservations(series: BlsSeries | undefined) {
  return (series?.data ?? [])
    .filter((observation) => observation.period !== "M13")
    .map((observation) => ({
      year: Number(observation.year),
      period: observation.period,
      periodNumber: periodNumber(observation.period),
      periodName: observation.periodName,
      value: Number(observation.value),
    }))
    .filter((observation) => Number.isFinite(observation.value))
    .sort((a, b) => a.year - b.year || a.periodNumber - b.periodNumber);
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

function getSeries(payload: BlsResponse, seriesId: string) {
  return payload.Results?.series?.find((series) => series.seriesID === seriesId);
}

async function getBlsSeries() {
  const currentYear = new Date().getFullYear();
  const body: Record<string, string | string[]> = {
    seriesid: blsSeriesIds,
    startyear: String(currentYear - 2),
    endyear: String(currentYear),
  };
  const registrationKey = getBlsApiKey();

  if (registrationKey) {
    body.registrationkey = registrationKey;
  }

  const response = await fetch(blsApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `BLS request failed with ${response.status}${message ? `: ${message.slice(0, 140)}` : ""}`,
    );
  }

  const payload = (await response.json()) as BlsResponse;

  if (payload.status && payload.status !== "REQUEST_SUCCEEDED") {
    throw new Error(payload.message?.join(" ") || "BLS request failed.");
  }

  return payload;
}

export function getNeutralBlsMacroContext(reason = "BLS macro data is not configured.") {
  return {
    isLive: false,
    ratesPressureAdjustment: 0,
    economicSurpriseAdjustment: 0,
    summary: "BLS macro provider is neutral because live BLS data was not available.",
    notes: [reason],
  } satisfies BlsMacroContext;
}

export async function getBlsMacroContext() {
  try {
    const payload = await getBlsSeries();
    const cpi = numericObservations(getSeries(payload, "CUUR0000SA0"));
    const unemployment = numericObservations(getSeries(payload, "LNS14000000"));
    const hourlyEarnings = numericObservations(getSeries(payload, "CES0500000003"));
    const consumerExpenditures = numericObservations(getSeries(payload, "CFU0000008000"));
    const weeklyEarnings = numericObservations(getSeries(payload, "LEU0254555900"));
    const cpiYoY = percentChange(latest(cpi), previous(cpi, 12));
    const unemploymentRate = latest(unemployment);
    const unemploymentTrend = pointsChange(latest(unemployment), previous(unemployment, 3));
    const hourlyEarningsYoY = percentChange(latest(hourlyEarnings), previous(hourlyEarnings, 12));
    const weeklyEarningsLatest = latest(weeklyEarnings);
    const consumerExpendituresLatest = latest(consumerExpenditures);
    const ratesPressureAdjustment = clamp(Math.max(0, cpiYoY - 2.5) * 2.5, 0, 12);
    const economicSurpriseAdjustment = clamp(
      hourlyEarningsYoY * 1.4 - Math.max(0, unemploymentTrend) * 28 - Math.max(0, cpiYoY - 3) * 2,
      -15,
      12,
    );

    return {
      isLive: true,
      ratesPressureAdjustment: round(ratesPressureAdjustment),
      economicSurpriseAdjustment: round(economicSurpriseAdjustment),
      summary: `BLS context uses CPI inflation ${round(cpiYoY)}%, unemployment ${formatMaybe(unemploymentRate)}%, 3-month unemployment change ${round(unemploymentTrend)} pts, hourly earnings growth ${round(hourlyEarningsYoY)}%, weekly earnings ${formatMaybe(weeklyEarningsLatest)}, and supplemental consumer expenditure signal ${formatMaybe(consumerExpendituresLatest)}.`,
      notes: [
        "Live BLS data is connected for CPI, unemployment, hourly earnings, and the supplemental series from the provided BLS request.",
      ],
    } satisfies BlsMacroContext;
  } catch (error) {
    return getNeutralBlsMacroContext(
      error instanceof Error ? error.message : "BLS macro request failed.",
    );
  }
}
