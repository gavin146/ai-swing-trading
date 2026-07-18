# SwingFi Copilot Narration Safety

Copilot narration exists to make structured evidence easier to understand. It is not allowed to create financial calculations or direct trading instructions.

## Design Rule

Numbers come from deterministic services. Words can come from AI only after validation.

The safe path is:

1. Portfolio provider creates normalized portfolio data.
2. `PortfolioAnalyzer` creates structured findings.
3. `CopilotReportBuilder` creates a deterministic report input and outline.
4. `RuleBasedCopilotNarrator` can produce a complete report without OpenAI.
5. `OpenAICopilotNarrator`, when enabled, rewrites the report using only supplied evidence.
6. `validateCopilotNarrative` rejects unsafe output.
7. Rejected output falls back to rule-based narration.

## Banned Language

The validator rejects narratives containing phrases such as:

- `guaranteed profit`
- `guaranteed winner`
- `guaranteed return`
- `buy now`
- `sell immediately`
- `risk free`
- `cannot lose`

Customer-facing language should use review-oriented wording:

- `review`
- `approaching`
- `inside the original plan`
- `outside the original plan`
- `data unavailable`
- `compare against the saved target and stop`

## Unsupported Ticker Protection

Narration is checked for uppercase ticker-like tokens. Allowed tickers come from:

- portfolio positions
- selected SwingFi research opportunities
- analyzer findings
- benchmark tokens `SPY` and `QQQ`
- known non-ticker abbreviations such as `AI`, `API`, `SEC`, `FMP`, `ETF`, and `USD`

If a narrator introduces an unsupported ticker, the output is rejected and the deterministic fallback is used.

## Unsupported Number Protection

Narration is checked for numeric tokens. Allowed numeric tokens must already exist in the structured report input.

This protects against AI inventing:

- prices
- percentages
- target values
- stop values
- dates
- position counts
- portfolio values

This check is intentionally conservative and feasible, not mathematically perfect. Future structured-output improvements can make the numeric allowlist more precise by field type.

## OpenAI Failure Modes

`OpenAICopilotNarrator` falls back when:

- `COPILOT_AI_NARRATION_ENABLED` is not true
- OpenAI times out
- OpenAI returns an error
- OpenAI returns no text
- OpenAI returns unparseable or unsafe content
- validation finds unsupported numbers, tickers, or banned phrases

Fallback metadata records:

- `narratorId: openai_copilot`
- configured model
- prompt version
- input hash
- `outputStatus: fallback`
- fallback narrator id
- sanitized error

## Caching

OpenAI success responses can be cached by `inputHash`. The cache must only store sanitized narration results and metadata, never raw provider credentials or full user secrets.

The first included cache is `MemoryCopilotNarrationCache`, intended for tests and local runtime use. A persistent cache can be added later if it stores only safe report/narration data and respects user deletion requirements.

## Future Hardening

Recommended next safety improvements:

- Move OpenAI narration behind a production feature flag UI in admin.
- Store prompt versions and validation failures in an operations table.
- Add structured-output JSON schema enforcement if the shared OpenAI helper gains first-class support.
- Add field-aware numeric validation so price, percent, date, and count tokens are checked separately.
- Add admin preview tooling before any AI-written Copilot report reaches customers.
