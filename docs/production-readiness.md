# SwingFi Production Readiness

## Hosting

The app is configured for Vercel. Vercel Cron is defined in `vercel.json`:

- `/api/cron/daily-rankings` runs at `13:00 UTC` weekdays.
- `/api/cron/morning-alerts` runs at `13:20 UTC` weekdays.
- `/api/cron/prediction-evaluation` runs at `22:15 UTC` weekdays.

During US daylight saving time, that is 8:00 AM, 8:20 AM, and 5:15 PM
Central. The morning scan and email alert are both before the 8:30 AM
Central market open.

The local app is now wired to Supabase for persistence. Once the same
environment variables are configured in Vercel, server routes can persist real
agent runs, alert logs, click tracking, backtests, calibration rules, and beta
customer profiles.

## Required Environment Variables

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_API_SECRET`
- `CRON_SECRET`
- `FMP_API_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`
- `AGENT_DATA_SOURCE=fmp`
- `STRIPE_CHECKOUT_ENABLED=false`

Optional:

- `ALERT_CUSTOMER_EMAILS` for pre-Supabase testing only.
- `MORNING_ALERT_REUSE_WINDOW_MINUTES` defaults to `180`. Morning emails reuse
  the latest saved ranking run inside this window before starting a fallback
  live scan, which prevents duplicate market-data and AI usage.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` if using
  Supabase's newer key names. The app accepts both old and new naming styles.
- `FMP_UNIVERSE_LIMIT`
- `FMP_DETAILED_LIMIT`
- `FMP_ENRICHMENT_LIMIT`
- `FMP_MIN_SCREENER_ROWS`
- `FMP_MIN_DETAILED_CANDIDATES`
- `FMP_CANDIDATE_DELAY_MS`
- `FMP_CANDIDATE_CONCURRENCY`
- `FRED_API_KEY`
- `BLS_API_KEY`
- Stripe variables are required before enabling paid checkout:
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`,
  `STRIPE_PRO_PRICE_ID`, `STRIPE_PREMIUM_PRICE_ID`, and
  `STRIPE_PORTAL_CONFIGURATION_ID`.
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `TWILIO_MESSAGING_SERVICE_SID`

## Production Database Steps

1. Create a Supabase project.
2. Run `db/schema.sql` in Supabase SQL editor.
3. Add Supabase env vars to Vercel Project Settings.
4. Run the admin ranking agent once to save the first set of opportunities.
5. Confirm `/api/opportunities` returns `source: "supabase"`.
6. Create the first admin/customer profile. During beta, local signup/login
   syncs profile data into the Supabase `users` table through
   `/api/customers/sync`.

## Vercel Deployment Steps

1. Import or connect the GitHub repo in Vercel.
2. Add all required environment variables in Vercel Project Settings.
3. Confirm `vercel.json` is included in the deployment.
4. Deploy from the production branch.
5. In Vercel, confirm both Cron Jobs are listed under Project Settings.
6. Test `/api/admin/status` on the deployed URL with an approved admin session
   or `ADMIN_API_SECRET` bearer token.
7. Trigger `/api/cron/daily-rankings` manually with the `CRON_SECRET` bearer token.
8. Run `npm run production:surface` against the live domain, or set
   `VERIFY_APP_URL=https://your-preview-url` to verify a preview deployment.
9. Run `npm run production:env` locally with the same variables configured for
   Vercel to catch missing keys before enabling paid access or scheduled alerts.
   The script prints pass/warn/fail status without printing secret values.

## What Is Now Persisted When Supabase Is Configured

- Daily agent runs
- Opportunities
- Opportunity rankings
- Raw versus calibrated score adjustments
- Alert delivery logs
- Email click events
- Backtest runs
- Backtest trade outcomes
- Active calibration rules
- App event logs
- Stripe subscription records
- Customer profile preferences
- Terms/risk acceptance timestamps
- Stripe customer IDs for secure billing portal access
- Session-bound Stripe checkout and billing portal requests, so production
  billing actions resolve the logged-in Supabase user instead of trusting
  browser-supplied customer identifiers.
- Session-bound customer pick history and performance endpoints, so saved
  daily picks are resolved from the authenticated Supabase user instead of an
  email query string.
- Server-side research access checks for opportunity list/detail APIs. Research
  data now requires admin access, an active/trialing subscription, or a verified
  customer inside the 30-day trial.
- Generic password-reset responses, so public reset requests do not reveal
  whether a specific email has a SwingFi account.
- Authenticated welcome-email sending, so public callers cannot use SwingFi as
  an open email sender.
- Auth endpoint hardening: account-status no longer reveals whether an email
  exists, and signup/password-reset/verification helper endpoints include
  lightweight abuse throttling.
- Public SEO hardening: sitemap only lists public pages, app/customer/admin
  surfaces are noindexed, and canonical URLs are page-specific for launch
  pages.
- Domain normalization treats `getswingfi.com` as a secondary alias and keeps
  public metadata, sitemap URLs, alert links, auth links, and billing redirects
  on the primary `https://www.swingfi.trade` domain.

## Still Required Before Charging Customers

- Verify the branded sender domain in Resend and send a production test email.
- Confirm Stripe live-mode products/prices for Starter, Pro, and Premium.
- Confirm the Stripe live webhook endpoint receives subscription created,
  updated, deleted, and checkout completed events.
- Configure the Stripe Customer Portal in live mode so customers can manage
  payment methods, invoices, cancellations, and renewals from Settings.
- Run `node scripts/verify-stripe-readiness.mjs` with live Stripe env vars and
  confirm checkout, webhook, and billing portal checks pass.
- Have privacy, terms, and financial disclaimer reviewed by securities counsel
  before broad paid launch.
- Decide whether the product must register, qualify for an exemption, or change
  language before charging for securities research.
- Add external monitoring/alerting outside the app for failed morning runs.
- Run several real market-day prediction cycles and review outcome accuracy
  before making stronger marketing claims.

## Customer-Facing Compliance Rules

- Say "AI-ranked swing trade research" or "ranked opportunities."
- Do not say "guaranteed winners", "best stocks to buy", or "we predict the
  market."
- Keep risk language near performance language.
- Use "review", "watch", "skip", and "research further" instead of direct trade
  instructions.
- Keep broker handoff as a convenience link only; SwingFi must not place trades,
  prefill orders, custody assets, or manage brokerage accounts without a major
  legal and compliance review.
