import type { FmpSecFiling } from "./fmp";

type SecSubmissionsResponse = {
  cik?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      acceptanceDateTime?: string[];
      form?: string[];
      primaryDocument?: string[];
      primaryDocDescription?: string[];
    };
  };
  tickers?: string[];
};

function normalizeCik(cik: string | number | undefined | null) {
  if (cik === undefined || cik === null || cik === "") {
    return null;
  }

  return String(cik).replace(/\D/g, "").padStart(10, "0");
}
function getSecUserAgent() {
  return (
    process.env.SEC_USER_AGENT ??
    "SwingFi/1.0 contact=tradestockswithai@gmail.com"
  );
}

function buildArchiveLink(cik: string, accessionNumber: string, primaryDocument?: string) {
  const compactAccession = accessionNumber.replace(/-/g, "");
  const cikNoLeadingZeros = String(Number(cik));

  if (!primaryDocument) {
    return `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${compactAccession}/`;
  }

  return `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${compactAccession}/${primaryDocument}`;
}

export async function getSecSubmissionsByCik(cik: string | number | undefined | null) {
  const normalizedCik = normalizeCik(cik);

  if (!normalizedCik) {
    return [];
  }

  const response = await fetch(
    `https://data.sec.gov/submissions/CIK${normalizedCik}.json`,
    {
      headers: {
        "User-Agent": getSecUserAgent(),
        Accept: "application/json",
      },
      next: { revalidate: 60 * 60 * 12 },
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `SEC EDGAR request failed with ${response.status}${message ? `: ${message.slice(0, 140)}` : ""}`,
    );
  }

  const payload = (await response.json()) as SecSubmissionsResponse;
  const recent = payload.filings?.recent;

  if (!recent?.form || recent.form.length === 0) {
    return [];
  }

  return recent.form.slice(0, 40).map((formType, index) => {
    const accessionNumber = recent.accessionNumber?.[index] ?? "";
    const primaryDocument = recent.primaryDocument?.[index];
    const link = accessionNumber
      ? buildArchiveLink(normalizedCik, accessionNumber, primaryDocument)
      : undefined;

    return {
      symbol: payload.tickers?.[0],
      cik: normalizedCik,
      filingDate: recent.filingDate?.[index],
      acceptedDate: recent.acceptanceDateTime?.[index],
      formType,
      hasFinancials: ["10-K", "10-Q", "20-F", "40-F"].includes(formType),
      link,
      finalLink: link,
    } satisfies FmpSecFiling;
  });
}
