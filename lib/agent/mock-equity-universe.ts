import type { EquityCandidate, Sector } from "./types";

type StockSeed = {
  symbol: string;
  companyName: string;
  sector: Sector;
  basePrice: number;
  marketCapBillions: number;
  averageVolume: number;
  qualityBias: number;
};

const stockSeeds: StockSeed[] = [
  { symbol: "NVDA", companyName: "NVIDIA Corp.", sector: "Information Technology", basePrice: 144.2, marketCapBillions: 3600, averageVolume: 185000000, qualityBias: 14 },
  { symbol: "MSFT", companyName: "Microsoft Corp.", sector: "Information Technology", basePrice: 477.1, marketCapBillions: 3550, averageVolume: 23000000, qualityBias: 12 },
  { symbol: "AAPL", companyName: "Apple Inc.", sector: "Information Technology", basePrice: 214.4, marketCapBillions: 3300, averageVolume: 62000000, qualityBias: 7 },
  { symbol: "AMZN", companyName: "Amazon.com Inc.", sector: "Consumer Discretionary", basePrice: 189.7, marketCapBillions: 1980, averageVolume: 43000000, qualityBias: 9 },
  { symbol: "META", companyName: "Meta Platforms Inc.", sector: "Communication Services", basePrice: 505.3, marketCapBillions: 1280, averageVolume: 15000000, qualityBias: 10 },
  { symbol: "GOOGL", companyName: "Alphabet Inc.", sector: "Communication Services", basePrice: 176.9, marketCapBillions: 2150, averageVolume: 28000000, qualityBias: 8 },
  { symbol: "AVGO", companyName: "Broadcom Inc.", sector: "Information Technology", basePrice: 181.6, marketCapBillions: 845, averageVolume: 33000000, qualityBias: 11 },
  { symbol: "AMD", companyName: "Advanced Micro Devices Inc.", sector: "Information Technology", basePrice: 162.7, marketCapBillions: 263, averageVolume: 52000000, qualityBias: 8 },
  { symbol: "TSLA", companyName: "Tesla Inc.", sector: "Consumer Discretionary", basePrice: 181.5, marketCapBillions: 585, averageVolume: 89000000, qualityBias: 1 },
  { symbol: "LLY", companyName: "Eli Lilly and Co.", sector: "Health Care", basePrice: 884.6, marketCapBillions: 840, averageVolume: 3100000, qualityBias: 12 },
  { symbol: "UNH", companyName: "UnitedHealth Group Inc.", sector: "Health Care", basePrice: 517.8, marketCapBillions: 476, averageVolume: 4200000, qualityBias: 4 },
  { symbol: "JPM", companyName: "JPMorgan Chase & Co.", sector: "Financials", basePrice: 202.1, marketCapBillions: 582, averageVolume: 9500000, qualityBias: 6 },
  { symbol: "V", companyName: "Visa Inc.", sector: "Financials", basePrice: 276.3, marketCapBillions: 540, averageVolume: 6100000, qualityBias: 8 },
  { symbol: "MA", companyName: "Mastercard Inc.", sector: "Financials", basePrice: 456.5, marketCapBillions: 425, averageVolume: 2600000, qualityBias: 8 },
  { symbol: "COST", companyName: "Costco Wholesale Corp.", sector: "Consumer Staples", basePrice: 858.4, marketCapBillions: 380, averageVolume: 1800000, qualityBias: 9 },
  { symbol: "WMT", companyName: "Walmart Inc.", sector: "Consumer Staples", basePrice: 68.5, marketCapBillions: 552, averageVolume: 17000000, qualityBias: 6 },
  { symbol: "HD", companyName: "Home Depot Inc.", sector: "Consumer Discretionary", basePrice: 343.8, marketCapBillions: 341, averageVolume: 3900000, qualityBias: 3 },
  { symbol: "NFLX", companyName: "Netflix Inc.", sector: "Communication Services", basePrice: 685.7, marketCapBillions: 295, averageVolume: 3600000, qualityBias: 7 },
  { symbol: "ADBE", companyName: "Adobe Inc.", sector: "Information Technology", basePrice: 522.6, marketCapBillions: 231, averageVolume: 3400000, qualityBias: 5 },
  { symbol: "CRM", companyName: "Salesforce Inc.", sector: "Information Technology", basePrice: 244.3, marketCapBillions: 236, averageVolume: 6800000, qualityBias: 4 },
  { symbol: "NOW", companyName: "ServiceNow Inc.", sector: "Information Technology", basePrice: 742.8, marketCapBillions: 153, averageVolume: 1300000, qualityBias: 9 },
  { symbol: "ORCL", companyName: "Oracle Corp.", sector: "Information Technology", basePrice: 139.2, marketCapBillions: 384, averageVolume: 9800000, qualityBias: 5 },
  { symbol: "PANW", companyName: "Palo Alto Networks Inc.", sector: "Information Technology", basePrice: 319.1, marketCapBillions: 104, averageVolume: 5100000, qualityBias: 8 },
  { symbol: "CRWD", companyName: "CrowdStrike Holdings Inc.", sector: "Information Technology", basePrice: 371.4, marketCapBillions: 91, averageVolume: 3800000, qualityBias: 7 },
  { symbol: "CAT", companyName: "Caterpillar Inc.", sector: "Industrials", basePrice: 334.2, marketCapBillions: 163, averageVolume: 3000000, qualityBias: 4 },
  { symbol: "GE", companyName: "GE Aerospace", sector: "Industrials", basePrice: 163.9, marketCapBillions: 178, averageVolume: 6900000, qualityBias: 6 },
  { symbol: "BA", companyName: "Boeing Co.", sector: "Industrials", basePrice: 181.4, marketCapBillions: 112, averageVolume: 8200000, qualityBias: -3 },
  { symbol: "XOM", companyName: "Exxon Mobil Corp.", sector: "Energy", basePrice: 113.8, marketCapBillions: 504, averageVolume: 15000000, qualityBias: 2 },
  { symbol: "CVX", companyName: "Chevron Corp.", sector: "Energy", basePrice: 156.2, marketCapBillions: 287, averageVolume: 7800000, qualityBias: 2 },
  { symbol: "COP", companyName: "ConocoPhillips", sector: "Energy", basePrice: 113.4, marketCapBillions: 132, averageVolume: 6200000, qualityBias: 3 },
  { symbol: "FCX", companyName: "Freeport-McMoRan Inc.", sector: "Materials", basePrice: 49.7, marketCapBillions: 71, averageVolume: 12600000, qualityBias: 3 },
  { symbol: "LIN", companyName: "Linde plc", sector: "Materials", basePrice: 437.1, marketCapBillions: 211, averageVolume: 1900000, qualityBias: 7 },
  { symbol: "NEE", companyName: "NextEra Energy Inc.", sector: "Utilities", basePrice: 73.4, marketCapBillions: 151, averageVolume: 10500000, qualityBias: 1 },
  { symbol: "PLD", companyName: "Prologis Inc.", sector: "Real Estate", basePrice: 112.8, marketCapBillions: 104, averageVolume: 4200000, qualityBias: 1 },
  { symbol: "SBUX", companyName: "Starbucks Corp.", sector: "Consumer Discretionary", basePrice: 79.8, marketCapBillions: 90, averageVolume: 10200000, qualityBias: -1 },
  { symbol: "MCD", companyName: "McDonald's Corp.", sector: "Consumer Discretionary", basePrice: 256.7, marketCapBillions: 185, averageVolume: 3600000, qualityBias: 4 },
  { symbol: "TMO", companyName: "Thermo Fisher Scientific Inc.", sector: "Health Care", basePrice: 568.4, marketCapBillions: 217, averageVolume: 1600000, qualityBias: 5 },
  { symbol: "ISRG", companyName: "Intuitive Surgical Inc.", sector: "Health Care", basePrice: 431.8, marketCapBillions: 153, averageVolume: 1700000, qualityBias: 8 },
  { symbol: "PGR", companyName: "Progressive Corp.", sector: "Financials", basePrice: 212.2, marketCapBillions: 124, averageVolume: 2800000, qualityBias: 7 },
  { symbol: "UBER", companyName: "Uber Technologies Inc.", sector: "Industrials", basePrice: 70.9, marketCapBillions: 148, averageVolume: 18500000, qualityBias: 6 },
];

function hash(value: string) {
  return Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function wave(seed: number, min: number, max: number) {
  const normalized = (Math.sin(seed * 12.9898) + 1) / 2;
  return min + normalized * (max - min);
}

function sectorMacroBias(sector: Sector) {
  const biases: Record<Sector, number> = {
    "Communication Services": 5,
    "Consumer Discretionary": 0,
    "Consumer Staples": 3,
    Energy: -2,
    Financials: 2,
    "Health Care": 4,
    Industrials: 3,
    "Information Technology": 8,
    Materials: 1,
    "Real Estate": -4,
    Utilities: -1,
  };

  return biases[sector];
}

export function getMockEquityUniverse(asOf: Date = new Date()): EquityCandidate[] {
  const dateSeed = hash(asOf.toISOString().slice(0, 10));

  return stockSeeds.map((stock, index) => {
    const seed = hash(stock.symbol) + dateSeed + index * 17;
    const quality = stock.qualityBias;
    const trend = wave(seed, -4, 11) + quality * 0.45;
    const price = Number((stock.basePrice * (1 + trend / 100)).toFixed(2));
    const atrPercent = Number(wave(seed + 3, 1.8, 7.8).toFixed(1));
    const support = Number((price * (1 - wave(seed + 5, 0.025, 0.07))).toFixed(2));
    const resistance = Number((price * (1 + wave(seed + 6, 0.05, 0.18))).toFixed(2));
    const marketRegimeScore = 66 + wave(dateSeed, -8, 9);
    const sectorTrendScore = 58 + sectorMacroBias(stock.sector) + wave(seed + 11, -12, 14);

    return {
      symbol: stock.symbol,
      companyName: stock.companyName,
      sector: stock.sector,
      averageVolume: stock.averageVolume,
      marketCapBillions: stock.marketCapBillions,
      technical: {
        price,
        sma20: Number((price * (1 - wave(seed + 1, -0.018, 0.035))).toFixed(2)),
        sma50: Number((price * (1 - wave(seed + 2, -0.025, 0.055))).toFixed(2)),
        sma200: Number((price * (1 - wave(seed + 4, -0.04, 0.09))).toFixed(2)),
        rsi14: Number(wave(seed + 7, 42, 72).toFixed(1)),
        atrPercent,
        relativeStrength90d: Math.round(wave(seed + 8, 46, 94) + quality * 0.7),
        support,
        resistance,
        volumeTrend: Number(wave(seed + 9, -8, 28).toFixed(1)),
      },
      financials: {
        revenueGrowth: Number((wave(seed + 13, -4, 28) + quality * 0.55).toFixed(1)),
        earningsGrowth: Number((wave(seed + 14, -8, 34) + quality * 0.7).toFixed(1)),
        freeCashFlowYield: Number(wave(seed + 15, 1.2, 6.8).toFixed(1)),
        debtToEquity: Number(wave(seed + 16, 0.1, 2.6).toFixed(2)),
        marginTrend: Number((wave(seed + 17, -5, 11) + quality * 0.2).toFixed(1)),
        revisionScore: Math.round(wave(seed + 18, 42, 88) + quality * 0.6),
        valuationScore: Math.round(wave(seed + 19, 38, 84) - Math.max(quality - 8, 0)),
      },
      news: {
        sentimentScore: Math.round(wave(seed + 21, 42, 88) + quality * 0.5),
        catalystScore: Math.round(wave(seed + 22, 35, 92) + quality * 0.45),
        headlineCount: Math.round(wave(seed + 23, 3, 22)),
        riskFlagCount: Math.max(0, Math.round(wave(seed + 24, -1, 4) - quality / 8)),
        summary: `${stock.companyName} has a mock catalyst/news profile driven by earnings revisions, product momentum, sector tone, and recent headline sentiment.`,
      },
      market: {
        marketRegimeScore: Math.round(marketRegimeScore),
        sectorTrendScore: Math.round(sectorTrendScore),
        economicSurpriseScore: Math.round(58 + wave(dateSeed + 25, -10, 12)),
        ratesPressureScore: Math.round(47 + wave(dateSeed + 26, -9, 13)),
        breadthScore: Math.round(61 + wave(dateSeed + 27, -11, 11)),
        govDataSummary:
          "Mock macro inputs reflect labor, inflation, rates, liquidity, and sector-sensitive government data placeholders.",
      },
    };
  });
}
