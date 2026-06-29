# SwingFi Production Readiness

## Hosting

The app is configured for Vercel. Vercel Cron is defined in `vercel.json`:

- `/api/cron/daily-rankings` runs at `12:15 UTC` weekdays.
- `/api/cron/morning-alerts` runs at `12:30 UTC` weekdays.

During US daylight saving time, that is 8:15 AM and 8:30 AM Eastern.

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
- `FRED_API_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`
- `AGENT_DATA_SOURCE=fmp`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_CHECKOUT_ENABLED=false`

Optional:

- `ALERT_CUSTOMER_EMAILS` for pre-Supabase testing only.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` if using
  Supabase's newer key names. The app accepts both old and new naming styles.
- `FMP_UNIVERSE_LIMIT`
- `FMP_DETAILED_LIMIT`
- `FMP_ENRICHMENT_LIMIT`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_PREMIUM_PRICE_ID`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

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
6. Test `/api/admin/status` on the deployed URL.
7. Trigger `/api/cron/daily-rankings` manually with the `CRON_SECRET` bearer token.

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

## Still Required Before Charging Customers

- Verify the branded sender domain in Resend and send a production test email.
- Confirm Stripe live-mode products/prices for Starter, Pro, and Premium.
- Confirm the Stripe live webhook endpoint receives subscription created,
  updated, deleted, and checkout completed events.
- Configure the Stripe Customer Portal in live mode so customers can manage
  payment methods, invoices, cancellations, and renewals from Settings.
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
