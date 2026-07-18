# SwingFi Copilot UI States

SwingFi Copilot is a feature-flagged, logged-in research surface at `/copilot`.

## Feature Flags

- `COPILOT_ENABLED=false` by default.
  - Server-side route gate.
  - When false, `/copilot` uses the app's not-found behavior.
- `NEXT_PUBLIC_COPILOT_ENABLED=false` by default.
  - Optional client-side navigation visibility flag.
  - This only controls whether the shell shows the Copilot nav item.
- `COPILOT_FIXTURE_MODE=false` by default.
  - Local-only demo mode.
  - Ignored in production.
  - Used only for deterministic UI preview data.

## Route And Data Flow

- `app/copilot/page.tsx`
  - Checks `COPILOT_ENABLED`.
  - Renders the app shell and `CopilotPanel`.
- `components/CopilotPanel.tsx`
  - Restores the browser Supabase session.
  - Sends the access token to `/api/copilot/report`.
  - Shows login, loading, error, empty, fixture, stale-data, and ready states.
- `app/api/copilot/report/route.ts`
  - Checks `COPILOT_ENABLED`.
  - Resolves the authenticated customer from the bearer token.
  - Never accepts `user_id` from the browser.
  - Uses server-only manual portfolio provider services.
  - Returns a sanitized Copilot view model.
- `lib/copilot/ui-view-model.ts`
  - Converts normalized portfolio snapshots and findings into UI-ready sections.
  - Creates deterministic fixture data only for safe local preview.

## UI Sections

The Copilot page includes:

- Header: "Your portfolio research copilot"
- Portfolio snapshot card with source and data-as-of labels
- Needs Attention, ordered by severity
- Positions cards with symbol, plan status, current price, entry, target, stop, days held, remaining window, source, and freshness
- Still Inside Plan
- What Changed
- Research Opportunities with links to existing opportunity detail pages
- Data Health/Freshness
- Daily Summary preview from deterministic report copy
- Empty state for no tracked positions
- Degraded state for stale or missing quotes
- Disabled brokerage connection placeholder

## Beginner-Friendly Language

The page uses review-oriented wording:

- "Review first"
- "Needs attention"
- "Inside saved plan"
- "Risk line"
- "Target area"
- "Data health"
- "Research opportunities to review"

The page avoids direct trade commands and guaranteed-return language.

## Fixture State

Fixture mode is clearly labeled:

- Source label says `Demo fixture`.
- A warning states that fixture data is not live account or brokerage data.
- Demo positions include one fresh quote and one stale quote so degraded states can be reviewed.

## Empty State

When no tracked positions exist, Copilot explains that it reviews saved SwingFi plans and links to `/portfolio` so the user can add a tracked trade.

## Data Health

Each source row shows:

- source label
- freshness status
- `data_as_of`
- optional sanitized message

The UI does not rely on color alone; every status includes text.

## Accessibility Notes

- Semantic `section`, `article`, `h1`, `h2`, and `h3` structure.
- Loading state uses skeleton UI without blocking navigation.
- Sign-in and error states have clear text.
- Interactive links have visible focus rings.
- Severity badges include text labels, not color-only signals.

## Not Implemented Yet

The Copilot UI intentionally does not include:

- brokerage SDKs
- real brokerage connection flow
- credential collection
- live trading
- order intents
- paper trading controls
- paid-plan changes
- public marketing claims

Those remain blocked until provider, legal, security, and product decisions are made.
