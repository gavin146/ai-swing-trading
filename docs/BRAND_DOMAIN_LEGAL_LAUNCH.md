# SwingFi Brand, Domain, and Legal Launch Notes

Last updated: June 23, 2026

## Brand

Product name: SwingFi

Positioning: daily swing trade intelligence for beginner investors who want ranked ideas, understandable risk, and a clear trade plan before they review any ticker.

Short description:

SwingFi ranks high-quality swing trade opportunities and explains the entry range, target, stop loss, confidence, risk, and estimated holding period.

Required risk sentence:

SwingFi is research software, not financial advice, and does not place trades or manage brokerage accounts.

## Domain Recommendation

`swingfi.com` appears to be a premium domain, so do not assume it will be cheap. A good launch path is:

1. Try to buy a practical branded domain such as `getswingfi.com`, `swingfi.ai`, or `swingfi.app`.
2. Use that domain for the web app and email sender.
3. Upgrade to `swingfi.com` later only if customer traction justifies the cost.

## Vercel Domain Steps

After buying a domain:

1. In Vercel, open the SwingFi project.
2. Go to Settings > Domains.
3. Add the domain, for example `getswingfi.com`.
4. Add the DNS records Vercel shows at the registrar.
5. Set production environment variable:

```txt
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

6. Redeploy production.
7. Confirm these URLs load:
   - `https://your-domain.com`
   - `https://your-domain.com/dashboard`
   - `https://your-domain.com/legal`
   - `https://your-domain.com/sitemap.xml`
   - `https://your-domain.com/robots.txt`

## Resend Email Domain Steps

After buying the domain:

1. In Resend, add and verify the domain.
2. Add the DNS records Resend provides.
3. Change production environment variable:

```txt
ALERT_FROM_EMAIL=SwingFi <alerts@your-domain.com>
```

4. Redeploy production.
5. Send a test email from the admin communications panel.

Current temporary sender is not ideal for launch because it is not a SwingFi-branded domain.

## Supabase Auth Redirects

After the custom domain works:

1. In Supabase, open Authentication settings.
2. Set site URL to `https://your-domain.com`.
3. Add redirect URLs:
   - `https://your-domain.com/login`
   - `https://your-domain.com/signup`
   - `https://your-domain.com/dashboard`

## Legal Review Before Charging

The app now includes stronger public legal pages:

- `/legal`
- `/legal/disclaimer`
- `/legal/privacy`
- `/legal/terms`

Before paid launch, a lawyer should review and finalize:

- Investment adviser / broker-dealer risk
- Subscription billing terms
- Refund and cancellation policy
- Jurisdiction and governing law
- Arbitration/class-action waiver, if desired
- Privacy policy for actual vendors and retention periods
- AI disclosure language
- Risk disclosures for stocks, ETFs, and cryptocurrencies

## Launch Blockers

The product can run technically on the current Vercel domain, but a public launch should wait for:

1. Branded domain connected to Vercel.
2. Branded email domain verified in Resend.
3. Supabase auth redirect URLs updated to the branded domain.
4. Legal pages reviewed by counsel before paid subscriptions.
5. Stripe pricing and checkout enabled only after pricing is final.
