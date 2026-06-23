# SwingFi Stock Grading Framework

## Purpose

SwingFi grades stocks for short-to-medium-term swing trading opportunities. The goal is not to predict the market perfectly. The goal is to find trade setups where trend, company quality, risk, liquidity, and market context are aligned enough to give beginner investors a structured opportunity to review.

The score is designed for swing trades, not day trades or long-term buy-and-hold investing.

## Final Opportunity Score

Each stock receives an Opportunity Score from 0 to 100.

The current formula is:

```text
Opportunity Score =
  Technical Score * 36%
+ Financial Score * 23%
+ News/Catalyst Score * 16%
+ Macro Score * 13%
+ Liquidity Score * 7%
+ Risk Adjustment * 5%
```

Higher scores mean the stock has a stronger overall setup based on the current model.

## Score Bands

```text
90-100: Excellent setup
82-89: Strong setup
70-81: Balanced setup
Below 70: Lower-quality or watchlist-only setup
```

A high score does not mean the trade is guaranteed to work. It means the model sees enough positive alignment to surface it for review.

## Technical Score

The Technical Score is the most important part of the model because SwingFi is focused on swing trading.

The model looks for:

- Price above the 20-day moving average
- 20-day moving average above the 50-day moving average
- 50-day moving average above the 200-day moving average
- RSI in a healthy momentum range, usually around 48 to 66
- Strong 90-day relative strength
- Improving volume trend
- Price trading near support, but not breaking down
- Clear resistance level that can be used for a target
- Manageable ATR/volatility

Good technical setups usually show controlled upward momentum, not panic buying or a collapsing chart.

## Financial Score

The Financial Score helps avoid weak companies that only look good on a chart.

The model looks for:

- Revenue growth
- Earnings growth
- Positive or improving free-cash-flow yield
- Reasonable debt-to-equity
- Improving margins
- Positive revision or quality signals
- Reasonable valuation compared with the company profile

For swing trading, fundamentals are not the only driver, but they help filter out risky names with poor business quality.

## News And Catalyst Score

The News/Catalyst Score measures whether there are recent events that could support or damage the trade.

The model is designed to look for:

- Positive company news
- Earnings momentum
- Product launches
- Analyst upgrades or price-target support
- Sector momentum
- Regulatory wins or losses
- Lawsuits, investigations, or negative headlines
- Unusual risk flags
- Upcoming earnings dates

Current status: FMP stock news, earnings data, and SEC filing metadata are connected. The model counts recent headlines, positive/negative catalyst terms, earnings proximity, recent earnings surprise, and selected filing forms as catalyst/risk inputs. Press releases are still unavailable on the current FMP plan.

## Macro Score

The Macro Score measures whether the broader market environment supports the trade.

The model is designed to look for:

- Overall market regime: risk-on, balanced, or defensive
- Sector strength
- Market breadth
- Interest-rate pressure
- Inflation pressure
- Labor-market trend
- Economic surprise data
- Government data trends

Current status: FRED macro data is connected when `FRED_API_KEY` is configured. BLS public API data is also connected for CPI, unemployment, hourly earnings, and the supplemental BLS series provided during setup. Deeper market breadth still needs to be connected.

## Liquidity Score

The Liquidity Score checks whether the stock is easy enough to trade.

The model looks for:

- Average trading volume
- Market capitalization
- Avoiding thinly traded stocks
- Avoiding names where spreads or low volume could hurt execution

Beginner investors should generally avoid illiquid trades because entry and exit prices can be unreliable.

## Risk Score

The Risk Score is separate from the Opportunity Score. Lower risk is better.

The model looks for:

- ATR percent, or how volatile the stock is
- Distance from support
- Debt-to-equity
- News risk flags
- Overbought RSI
- Weak or oversold technical conditions

Risk is scored from 0 to 100:

```text
0-35: Lower risk
36-55: Moderate risk
56-70: Elevated risk
Above 70: High risk
```

A stock can have a high Opportunity Score and still have elevated risk. In that case, the UI should clearly show that the setup may require smaller position sizing, tighter discipline, or confirmation before entry.

## Confidence Score

The Confidence Score measures how much the major signals agree with each other.

The model rewards:

- Technical strength matching financial strength
- Good liquidity
- Low or manageable risk
- Consistent signals across categories

The model penalizes:

- One very strong signal with several weak signals
- High risk
- Major disagreement between technicals and fundamentals

Confidence is not the same as probability of profit. It is a signal-quality score.

## Entry Range

The Entry Range is based on the current price, nearby support, and acceptable pullback area.

The model tries to avoid chasing price too far above support. A good entry range usually means the stock is close enough to a logical support area that the stop loss can be defined clearly.

## Target Price

The Target Price is based on nearby resistance and expected upside from the entry area.

The model avoids unlimited upside assumptions. For beginner investors, the target should be realistic, visible, and tied to chart structure.

## Stop Loss

The Stop Loss is based on support and volatility.

The model places the stop below the support area so the trade has room to move, but not so much room that the downside risk becomes unreasonable.

## Expected Gain

Expected Gain is calculated from the entry area to the target price.

```text
Expected Gain = (Target Price - Entry Low) / Entry Low
```

## Expected Loss

Expected Loss is calculated from the entry area to the stop loss.

```text
Expected Loss = (Entry Low - Stop Loss) / Entry Low
```

## Estimated Holding Period

The model is focused on swing trades, so the expected holding period is usually measured in trading days, not minutes or years.

Current target range:

```text
8-28 trading days
```

Lower-risk setups may have shorter, cleaner windows. Higher-risk setups may need more time or stricter confirmation before entry.

## Estimated Buy Window

The Estimated Buy Window tells the user when the trade setup is most actionable.

Examples:

```text
Today to 3 trading days
Today to 2 trading days
Intraday confirmation only
```

The buy window becomes shorter when risk is higher.

## Estimated Sell Window

The Estimated Sell Window estimates when the trade should be reviewed for exit.

It is based on the holding-period estimate and the setup risk.

This does not mean the user must sell on that exact day. It means the trade should be actively reviewed around that window.

## What Makes A Great SwingFi Setup

A high-quality setup usually has:

- Strong but not overheated technical momentum
- Price above major moving averages
- RSI in a healthy range
- Clear support and resistance
- Upside meaningfully larger than downside
- Strong volume and liquidity
- Solid company fundamentals
- No major near-term event risk
- Favorable sector and market backdrop
- Confidence above 75
- Risk below 50

## What The Model Avoids

The model should avoid or penalize:

- Extremely low-volume stocks
- Stocks far above support
- Stocks with high volatility and unclear stops
- Broken downtrends
- Overbought setups without consolidation
- Weak revenue or earnings trends
- Heavy debt risk
- Major negative news
- Unverified catalyst spikes
- Upcoming earnings risk unless specifically intended

## Current Data Status

Current live-data support:

- FMP daily price candles
- FMP company profiles
- FMP income statements
- FMP ratios
- FMP key metrics
- FMP stock news
- FMP earnings and corporate event data
- FMP SEC filing metadata
- Direct SEC EDGAR submissions fallback
- FRED rates, inflation, unemployment, yield curve, and broad-market trend data
- BLS CPI, unemployment, hourly earnings, and supplemental labor/consumer data
- U.S. Treasury Fiscal Data exchange-rate pressure

Still needs to be connected:

- Press releases, if the data plan is upgraded for that endpoint
- Market breadth data
- Backtesting
- Forward outcome tracking

## Verification Status

The score is currently a structured ranking model, not a fully market-verified trading system.

To become market verified, SwingFi needs:

- Historical backtesting
- Daily pick outcome tracking
- Hit rate by score band
- Average gain and average loss by score band
- Stop-loss rate
- Target-hit rate
- Average holding period
- Drawdown analysis
- Performance by market regime

Only after those are measured should the score be described as validated.

## Plain-English Summary

SwingFi grades stocks by asking:

```text
Is the chart strong?
Is the company financially healthy?
Is there a positive catalyst?
Is the broader market supportive?
Is the stock liquid enough to trade?
Is the downside risk controlled?
Do the signals agree with each other?
```

The best opportunities are not just high-upside trades. They are trades where upside, risk, timing, and confidence are balanced.
