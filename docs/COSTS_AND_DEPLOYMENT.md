# SwingFi Agent Costs And Deployment

## Current State

The app supports mock-provider mode and an FMP-backed live-data mode. Mock mode runs the daily ranking agent with deterministic sample data, local customer profiles, local daily picks, and email/SMS-ready alert endpoints. FMP mode calls Financial Modeling Prep when `FMP_API_KEY` is configured and the agent source is set to `fmp`.

## Low-Cost Agent Strategy

1. Fetch structured data in bulk.
2. Score stocks with deterministic TypeScript math.
3. Run LLM summarization only after the top 30 are selected.
4. Cache the daily agent run once per market day.
5. Reuse the same ranked opportunity set for all customers.
6. Personalize customer dashboards with filters, not another expensive agent run.
7. Send concise email alerts first, with SMS reserved for a later paid opt-in channel.
8. Use OpenAI only for final explanations and summaries, not score calculation.

## Estimated Daily Variable Cost

The in-app estimate assumes:

- GPT-5.4 mini for final explanation generation.
- About 8,500 base input tokens plus 350 input tokens per selected opportunity.
- About 900 base output tokens plus 120 output tokens per selected opportunity.
- 6 broad web-search calls per daily run.
- 1 SMS segment per customer alert.

With 30 selected stocks and one SMS customer, the estimate is roughly:

- OpenAI model tokens: about $0.0345 per run.
- OpenAI web search: about $0.0600 per run.
- Twilio US SMS: about $0.0083 per customer alert segment.
- Total: about $0.1028 for the shared daily run plus one customer SMS.

The expensive part at customer scale is SMS, not the analysis, as long as the analysis is cached once per day. Email should be the first alert channel because it is cheaper and has a lighter compliance burden than SMS.

## Pricing Sources To Recheck Before Production

- OpenAI API pricing: https://openai.com/api/pricing/
- Twilio US SMS pricing: https://www.twilio.com/en-us/sms/pricing/us
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs

Prices change. Recheck these pages before launch and before committing to customer pricing.

## Production Data Providers

Recommended staged rollout:

1. Market prices and technicals: Financial Modeling Prep daily candles first.
2. Company fundamentals: Financial Modeling Prep statements, ratios, and key metrics first.
3. Government data: free/public sources where possible, cached daily or weekly.
4. News: one provider with symbol and market-wide queries, capped by plan.
5. AI model: use LLM only for final explanations and morning summaries.

## Required Production Work

- Replace local customer storage with Supabase Auth and PostgreSQL.
- Store `agent_runs`, `opportunities`, `opportunity_rankings`, `daily_picks`, and `alert_logs`.
- Add real data-provider implementations behind the current agent interfaces.
- Add opt-in and compliance copy for SMS alerts.
- Add billing/subscriptions before accepting paying customers.
- Add market-data disclaimers and clarify that picks are not financial advice.
