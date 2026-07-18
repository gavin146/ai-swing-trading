# Handoff 08: Copilot Email

## Summary

Implemented a reusable SwingFi Copilot daily digest email template and an admin-only preview path. No automatic sending, cron schedule, recipient selection, brokerage integration, or trading capability was added.

## Files Changed

- `lib/copilot/email.ts`
- `app/api/admin/copilot/email-preview/route.ts`
- `components/AdminCommunicationsPanel.tsx`
- `tests/copilot-email.test.ts`
- `tests/tsconfig.copilot.json`
- `package.json`
- `docs/copilot/COPILOT_EMAIL_SPEC.md`
- `docs/codex-handoffs/08-copilot-email.md`

## Inspected Paths

- `lib/email-branding.ts`
- `lib/email.ts`
- `lib/alerts.ts`
- `lib/auth/admin.ts`
- `lib/admin-client.ts`
- `lib/portfolio/morning-digest.ts`
- `lib/copilot/ui-view-model.ts`
- `lib/copilot/reporting.ts`
- `components/AdminCommunicationsPanel.tsx`
- `components/AdminWorkspace.tsx`
- `app/api/admin/communications/test/route.ts`
- `app/api/cron/morning-alerts/route.ts`
- `app/api/alerts/email/route.ts`
- `app/api/alerts/morning/route.ts`

No repository-level `AGENTS.md` file was present. Only dependency-level `AGENTS.md` files were found under `node_modules`.

## Behavior Added

- Copilot digest renderer with branded HTML and plain-text fallback.
- Output validation for banned phrases.
- Dark-mode-safe rendering via existing `buildBrandedEmail`.
- Data-as-of and source labels.
- Attention findings, inside-plan findings, data-health rows, and research links.
- Admin-only preview endpoint.
- HTML preview mode with `?format=html`.
- Alert Studio preview section that loads the Copilot digest without sending.

## Verification

Commands run:

```bash
npm run test:copilot
npm run typecheck
npm run lint
npm run verify
```

Result: passed. The production build includes `/api/admin/copilot/email-preview`.

## Safety Notes

- The preview route does not import or call `sendEmail`.
- The preview route does not reference `RESEND_API_KEY`.
- The preview response declares `sent: false`.
- The admin panel button only loads preview content.
- No cron route was added or modified.
- No customer notification path was enabled.

## Future Wiring Point

If approved later, add a separate admin-confirmed test-send path for Copilot digest emails. Do not attach the template to morning cron until customer preferences, unsubscribe handling, delivery monitoring, and legal copy are reviewed.
