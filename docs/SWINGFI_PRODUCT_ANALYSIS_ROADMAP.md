# SwingFi Product and Analysis Improvement Roadmap

This roadmap separates safe product improvements from ideas that need approval
because they affect compliance, cost, user trust, or brokerage workflows.

## Built Now

- Model readiness profile on every opportunity.
  - Adds a readiness score, reward/risk label, key strengths, watchouts,
    invalidation signals, and follow-up checks.
  - Gives users a structured research checklist instead of only a stock score.
  - Keeps language compliant by positioning rankings as research, not guarantees.

- Dashboard card readiness summary.
  - Shows whether the setup is ready for focused review, watchlist-only, or
    still needs confirmation.
  - Adds reward/risk directly to each card.

- Detail page prediction-quality section.
  - Shows why the setup made the list.
  - Shows what could make the setup weaker.
  - Shows what a beginner should check before acting.

- Sector rotation dashboard.
  - Shows which sectors are leading inside the current ranked opportunity set.
  - Helps users understand why certain stocks are ranked today.

- Market regime banner.
  - Labels the current opportunity set as risk-on, balanced, or defensive.
  - Adjusts customer language and suggested review pace based on market regime.

- Admin outcome heatmap.
  - Shows results by score band, risk band, setup type, and holding window.
  - Keeps the customer-facing version for later, after enough outcomes exist.

- Setup pattern tags.
  - Tags opportunities as breakout, pullback, trend continuation, catalyst,
    relative strength, defensive strength, or high-volatility reversal.
  - Gives users a trading-style lens and gives calibration another dimension.

- Watchlist change alerts.
  - Tells users when a saved or watched ticker improved, weakened, entered
    range, broke below stop, or has new event risk.

- Data freshness scoreboard.
  - Per pick: price freshness, news freshness, filing freshness, earnings risk,
    macro run time, and calibration status.

- Explain score movement.
  - Shows why a score changed since yesterday for saved/watchlisted tickers.
  - Makes SwingFi feel more alive and easier to trust.

- Beginner lesson cards tied to real picks.
  - Short lessons such as why stop loss matters or why chasing entry changes
    reward/risk shown next to the current pick.

- First-version portfolio fit.
  - Uses saved/watched tickers to warn about sector concentration.
  - Real holdings or brokerage-connected portfolio fit remains a later,
    approval-required build.

## Next Safe Builds

1. Persist richer daily snapshots.
   - Save sector, setup pattern, score movement, data freshness, benchmark
     comparison, catalyst quality, and event risk into Supabase for each pick.
   - This turns today's derived UI insights into historical evidence.

2. Add customer filters for setup patterns and sectors.
   - Let users filter by breakout, pullback, relative strength, defensive
     strength, and preferred sector exposure.

3. Add manual holdings.
   - Let users type current positions without connecting a brokerage.
   - Use this to improve portfolio-fit warnings before any Plaid-style work.

4. Add customer-facing performance after enough data exists.
   - Show measured results only after a meaningful sample size is available.
   - Keep early claims conservative until the numbers support stronger language.

## Analysis Improvements That Add Real Value

1. Better universe expansion.
   - Scan a broader liquid US stock universe.
   - Filter by liquidity, price, volume surge, relative strength, event risk, and
     minimum reward/risk before running deeper analysis.
   - Current implementation supports a broad FMP screener pass with liquidity,
     price, volume, relative-strength, and risk filters before deeper ranking.

2. Stronger benchmark comparison.
   - Compare every pick against SPY, QQQ, and sector ETF.
   - Penalize stocks that look good alone but weak versus their market context.
   - Ranking now applies explicit benchmark and sector-relative adjustments
     before calibrated scores reach the UI.

3. Catalyst quality scoring.
   - Separate positive catalysts from noisy headlines.
   - Reward earnings revisions, institutional accumulation, product/business
     catalysts, and sector tailwinds.
   - Ranking now rewards stronger catalyst scores and penalizes event/filing
     risk so noisy names do not float up as easily.

4. Event-risk calendar.
   - Penalize or flag picks with earnings, CPI/FOMC exposure, major filings, or
     known binary events inside the planned holding period.
   - Current ranking applies event-risk and filing-risk penalties. The next
     improvement is storing exact event names and dates per pick.

5. Calibration by setup type.
   - Learn which setup patterns are working recently.
   - Adjust future scores using historical outcomes by pattern, risk band,
     sector, and market regime.
   - Outcome summaries now create setup-pattern calibration rules when enough
     data exists, and the ranking engine can apply those rules forward.

6. Slippage and entry realism.
   - Track whether picks actually enter the buy range.
   - Separate "good idea that never triggered" from "bad prediction."
   - Prediction evaluation already separates no-entry ideas from target/stop
     outcomes and tracks max gain/drawdown.

7. Portfolio fit.
   - Current safe version uses saved/watchlisted tickers to warn about sector
     concentration.
   - Next safe version is manual holdings.
   - Brokerage-connected holdings should wait for compliance/security review.

## Risky Ideas Requiring Approval

1. One-click trade or order routing.
   - High compliance risk. Could make SwingFi look like a broker or adviser.
   - Safer version: "Open in brokerage" links only, with no order placement.

2. Personalized financial advice language.
   - High legal risk. Avoid saying "you should buy" or "best stock to buy."
   - Safer wording: "ranked opportunity to review."

3. Options trading ideas.
   - Higher risk for beginners and more compliance-sensitive.
   - Should wait until stock-only product is stable and disclaimers are reviewed.

4. Autonomous AI agent that trades or texts urgent buy/sell commands.
   - High risk. Alerts should remain research-focused and user-controlled.

5. Expensive alternative data feeds.
   - Could improve edge but may raise monthly cost quickly.
   - Add only after tracking proves the core model creates measurable value.

6. Social sentiment scraping.
   - Can be noisy and may create compliance/data-source issues.
   - Safer version: use reputable news and clearly label sentiment as weak signal.

7. Claims like "predicts the highest winners."
   - Not appropriate until there is significant tracked performance evidence.
   - Use "AI-ranked swing trade opportunities" until outcomes support stronger
     claims.

## Measurement Standard Before Stronger Claims

SwingFi should not claim predictive superiority until it has at least:

- 60 to 90 market days of saved predictions.
- Outcome tracking for entry hit, target hit, stop hit, max gain, max drawdown,
  realized return, and excess return versus SPY/QQQ.
- Performance by score band and setup type.
- Evidence that calibration improves results after penalties/rewards are applied.
- Clear comparison against a simple baseline, such as top relative-strength
  stocks or equal-weight SPY/QQQ alternatives.
