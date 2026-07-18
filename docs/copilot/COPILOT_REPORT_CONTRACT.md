# SwingFi Copilot Report Contract

SwingFi Copilot reporting is deterministic first and AI-assisted second. The report builder owns ordering, grouping, numbers, severity, and data limitation disclosure. Narrators may only explain the already-built report in clearer language.

## Current Files

- `lib/copilot/reporting.ts`
  - `CopilotReportBuilder`
  - `buildDailyCopilotReport`
  - `DailyCopilotReportInput`
  - `DailyCopilotReportOutline`
  - `CopilotNarrator`
  - `RuleBasedCopilotNarrator`
  - `validateCopilotNarrative`
  - `buildCopilotNarrationPrompt`
- `lib/copilot/openai-narrator.ts`
  - `OpenAICopilotNarrator`
  - `MemoryCopilotNarrationCache`
  - `CopilotOpenAiClient`
- `tests/copilot-reporting.test.ts`

## Inputs

`CopilotReportBuilderInput` accepts normalized, already-computed evidence:

- `reportDate`
- `portfolioDataAsOf`
- `accountSummary`
- `marketRegime`
- `positions`
- `findings`
- `researchOpportunities`
- `sourceHealth`
- optional `snapshot`

The builder does not call Supabase, FMP, OpenAI, email providers, brokerage APIs, or the network.

## Output

`DailyCopilotReportInput` is versioned as `daily-copilot-report.v1` and includes:

- sorted and deduplicated `findings`
- sorted `positions`
- sorted `researchOpportunities`
- source-health records
- explicit `dataLimitations`
- deterministic `outline`
- stable SHA-256 `inputHash`

The hash is based on stable JSON serialization with sorted object keys, so the same evidence produces the same hash even if caller array order changes.

## Deterministic Sections

The generated outline contains these sections:

- `portfolio_snapshot`
- `needs_attention`
- `still_inside_plan`
- `data_limitations`
- `research_watchlist`
- `next_review_checklist`

Findings are sorted by severity first:

1. `high`
2. `attention`
3. `info`

Then by symbol and id for stable ordering.

## AI Boundary

`CopilotNarrator` accepts only `DailyCopilotReportInput`.

AI narration may:

- rewrite supplied evidence into clearer beginner-friendly language
- organize the already-built outline
- disclose data limitations already present in the report

AI narration may not:

- calculate account value
- calculate return
- calculate position size
- calculate reward/risk
- calculate finding severity
- create target prices
- create stop prices
- introduce a ticker not in the input
- introduce a number, percentage, price, or date not in the input
- provide direct trade commands
- promise results

## Rule-Based Fallback

`RuleBasedCopilotNarrator` is the production fallback. It does not require OpenAI and produces a plain-English report from the deterministic outline.

It records:

- `narratorId`
- `model`
- `promptVersion`
- `inputHash`
- `outputStatus`

## OpenAI Adapter

`OpenAICopilotNarrator` is server-only and disabled unless explicitly enabled by option or `COPILOT_AI_NARRATION_ENABLED=true`.

It supports:

- injected OpenAI client for tests
- timeout fallback
- validation fallback
- provider-error fallback
- sanitized error metadata
- cache reuse by `inputHash`

The adapter currently uses the existing `generateOpenAiText` helper. Tests use a mocked client and make no live API calls.

## Acceptance Tests

The current test suite covers:

- deterministic report ordering
- empty portfolio
- high-severity finding priority
- stale and missing data disclosure
- rule-based narration
- mocked OpenAI success
- OpenAI timeout fallback
- OpenAI provider-error fallback
- unsupported ticker rejection
- unsupported number rejection
- banned-language rejection
- input-hash stability
- prompt-version metadata
- disabled OpenAI path with no live API calls

Run:

```bash
npm run test:copilot
```
