# SwingFi Copilot Email Spec

The Copilot daily digest email is a reusable preview-only template for the next Copilot product phase. It is not connected to cron delivery, recipient selection, or Resend sending.

## Current Files

- `lib/copilot/email.ts`
  - `buildCopilotDailyDigestEmail`
  - `CopilotDailyDigestEmailArgs`
  - `CopilotDailyDigestEmail`
- `app/api/admin/copilot/email-preview/route.ts`
  - Admin-only deterministic preview endpoint.
  - Returns JSON by default.
  - Returns rendered HTML with `?format=html`.
- `components/AdminCommunicationsPanel.tsx`
  - Adds a Copilot preview section inside Alert Studio.
  - Loads preview only.
  - Does not send through Resend.
- `tests/copilot-email.test.ts`

## Template Input

`buildCopilotDailyDigestEmail` accepts a structured Copilot view model:

- `viewModel`
- `copilotUrl`
- optional `customerName`
- optional `subject`
- optional `unsubscribeUrl`

The template expects deterministic data that has already been validated and calculated by Copilot services. It does not call OpenAI, Supabase, FMP, Resend, Twilio, brokerage providers, or the network.

## Rendered Content

The digest renders:

- report date
- portfolio data-as-of time
- tracked position count
- source label
- portfolio snapshot table
- top Needs Attention findings
- Still Inside Plan findings
- Data Health with stale or missing source warnings
- SwingFi research opportunities to review
- link to `/copilot`
- legal/research disclaimer
- unsubscribe link when supplied

The plain-text fallback mirrors the same major content.

## Language Rules

The template uses research and review framing. It avoids:

- `buy now`
- `sell now`
- `guaranteed`
- `high yield`
- `cannot lose`

The renderer validates the final subject, text, and HTML before returning.

## Admin Preview

The preview endpoint is:

```text
GET /api/admin/copilot/email-preview
GET /api/admin/copilot/email-preview?format=html
```

Authorization uses the existing admin pattern:

- `isAdminApiRequest(request)`
- `getAdminUnauthorizedResponse()`

The preview uses deterministic fixture data from:

- `createCopilotDemoSnapshot`
- `buildCopilotUiViewModel`
- fixture research opportunities

The response includes:

- `email.subject`
- `email.html`
- `email.text`
- `meta.sent: false`
- preview warning
- fixture view model

## No Sending In This Task

This work intentionally does not:

- call `sendEmail`
- import Resend delivery code
- add cron jobs
- edit current morning-alert schedules
- edit recipient selection
- enable customer notifications
- connect any brokerage account
- create trading or order actions

## Future Wiring Point

When ready, the safe next step is to add an explicit admin test-send button for the Copilot digest that reuses `buildCopilotDailyDigestEmail` and calls the existing admin communications test endpoint only after admin confirmation.

Production sending should wait until:

- Copilot is enabled in staging.
- The digest is approved in admin preview.
- Unsubscribe behavior is confirmed.
- Open/stale-data metrics are monitored.
- Legal language is reviewed.
- Recipient preferences include a Copilot digest toggle.

## Test Coverage

Current tests cover:

- complete report
- empty portfolio
- stale-data warning
- long symbol and company-name wrapping
- mobile-friendly email markup
- admin authorization source check
- no Resend/send call in preview route
- no banned language in rendered output

Run:

```bash
npm run test:copilot
```
