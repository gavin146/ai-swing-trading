# Handoff 06: Copilot Reporting

## Summary

Implemented the SwingFi Copilot reporting layer with deterministic report construction and a safe AI narration boundary.

## Files Changed

- `lib/copilot/reporting.ts`
- `lib/copilot/openai-narrator.ts`
- `tests/copilot-reporting.test.ts`
- `tests/tsconfig.copilot.json`
- `package.json`
- `docs/copilot/COPILOT_REPORT_CONTRACT.md`
- `docs/copilot/COPILOT_NARRATION_SAFETY.md`
- `docs/codex-handoffs/06-copilot-reporting.md`

## Inspected Paths

- `lib/openai.ts`
- `lib/copilot/types.ts`
- `lib/copilot/config.ts`
- `lib/copilot/validation.ts`
- `lib/copilot/server-only.ts`
- `lib/copilot/manual-portfolio-provider.ts`
- `lib/copilot/portfolio-analyzer.ts`
- `lib/portfolio/morning-digest.ts`
- `lib/email-branding.ts`
- `app/api/insights/opportunities/route.ts`
- `app/api/portfolio/coach/route.ts`
- `app/api/assistant/chat/route.ts`
- `tests/copilot-core.test.ts`
- `tests/copilot-manual-provider.test.ts`
- `tests/copilot-portfolio-analyzer.test.ts`
- `package.json`
- `tests/tsconfig.copilot.json`

No repository-level `AGENTS.md` file was present. Only dependency-level `AGENTS.md` files were found under `node_modules`.

## Public Contracts Added

- `CopilotReportBuilderInput`
- `DailyCopilotReportInput`
- `DailyCopilotReportOutline`
- `DailyCopilotReportSection`
- `CopilotNarrator`
- `CopilotNarrationResult`
- `CopilotNarrationMetadata`
- `CopilotNarrationCache`
- `CopilotOpenAiClient`

## Behavior Added

- Deterministic report generation from normalized portfolio, finding, research, and source-health inputs.
- Stable input hashing for cache/reuse.
- High-severity findings ordered before lower-severity findings.
- Explicit stale/missing data limitation disclosure.
- Production-capable rule-based narrator.
- Optional OpenAI narrator, disabled by default.
- OpenAI timeout, provider error, validation error, and disabled-state fallback.
- Validation for unsupported ticker tokens, unsupported numeric tokens, and banned trade-command phrases.
- In-memory narration cache for tests and local use.

## Tests Run

```bash
npm run test:copilot
```

Result: passed.

## Assumptions

- Copilot reports are generated server-side before they are shown or emailed.
- The existing `generateOpenAiText` helper remains the only OpenAI path for now.
- Persistent narration caching, prompt run logs, and admin preview controls will be added in later product work.
- AI narration should not be enabled in production until an admin preview and monitoring surface exists.

## Major Risks

- Numeric-token validation is intentionally conservative but not field-aware yet. It can reject safe text that introduces helpful formatting or accept a supplied number in the wrong semantic context.
- The rule-based fallback currently echoes deterministic report section items. If upstream structured findings contain poor wording, Copilot narration will preserve that wording.
- No database migration was added for persisted Copilot reports, narration logs, or cache entries.

## Recommended First Implementation PR

Build a server route that assembles this flow for the authenticated user:

1. manual portfolio provider
2. portfolio analyzer
3. report builder
4. rule-based narrator

Keep OpenAI narration disabled. Return the deterministic report and narrative to a private customer Copilot preview page before adding email delivery.
