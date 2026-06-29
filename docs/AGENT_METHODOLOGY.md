# SwingFi Ranking Methodology

The daily agent ranks stocks with a weighted scoring system. It now supports mock mode for demos and FMP mode for the first live market-data slice.

## Data Modes

- Mock mode uses a deterministic sample universe and does not call paid APIs.
- FMP mode uses Financial Modeling Prep daily candles, company profiles, income statements, ratios, key metrics, stock news, earnings data, and SEC filing metadata where available. Direct SEC EDGAR submissions are used as a free fallback when a company CIK is available and FMP filings are missing. When `FRED_API_KEY` is configured, it also uses FRED rates, inflation, unemployment, yield-curve, and broad-market trend data. It also calls the BLS public API for CPI, unemployment, hourly earnings, and supplemental labor/consumer series. U.S. Treasury Fiscal Data is used for keyless exchange-rate pressure signals.
- To reduce cost and rate-limit failures, FMP mode first runs a broad live-price technical scan, then enriches the strongest candidates with fundamentals, news, earnings, and SEC checks. Tune this with `FMP_UNIVERSE_LIMIT`, `FMP_DETAILED_LIMIT`, and `FMP_ENRICHMENT_LIMIT`.

Run FMP mode locally with `FMP_API_KEY=your_key npm run dev`, then use the
admin operations panel or an admin-authenticated request to
`/api/admin/run-agent`. Legacy agent and alert utility routes are intentionally
admin-protected so public visitors cannot trigger FMP scans, OpenAI
explanations, emails, or SMS sends.

For the scheduled Vercel job, set `AGENT_DATA_SOURCE=fmp` and `FMP_API_KEY=your_key`. Set `FRED_API_KEY=your_key` to enable FRED macro scoring. `BLS_API_KEY` is optional; keyless BLS requests work but have lower limits.

News and earnings/corporate event risk are connected through FMP. SEC filing checks use FMP first and direct SEC EDGAR as a fallback.

## Score Inputs

- Technical score: moving-average stack, RSI, 90-day relative strength, volume trend.
- Financial score: revenue growth, earnings growth, free-cash-flow yield, debt-to-equity, margin trend, revisions, valuation.
- News score: sentiment, catalyst strength, headline volume, risk flags.
- Macro score: market regime, sector trend, breadth, rates pressure, economic surprise.
- Liquidity score: average volume and market capitalization.
- Risk score: volatility, support distance, debt, news risk flags, overbought/oversold risk.

## Composite Score

The current composite score weights are:

- Technical: 36%
- Financial: 23%
- News/catalysts: 16%
- Macro/government data: 13%
- Liquidity: 7%
- Risk adjustment: 5%

## Confidence Score

Confidence is based on agreement across the major categories plus a risk adjustment. A stock with one excellent signal but several weak signals should not receive a high confidence score.

## Cost Control

The production plan is to use deterministic scoring for all structured inputs and reserve AI calls for final summaries and beginner-friendly explanations. OpenAI is not used to calculate raw scores. This keeps the expensive model work small and predictable.

## Current Limitations

- Mock data is not investment-grade.
- FMP mode has live price, partial live fundamental data, live FRED macro data when configured, and live BLS government data, but the strategy is not fully market-verified until backtesting and forward outcome tracking are connected.
- Live filings, news, corporate events, and non-FRED government series are not connected yet.
- The app does not provide financial advice.
- Production should include data freshness checks, provider fallbacks, audit logs, and customer-facing disclaimers.
