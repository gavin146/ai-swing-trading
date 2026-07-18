# SwingFi Copilot Portfolio Finding Rules

Last updated: 2026-07-17

The `PortfolioAnalyzer` in `lib/copilot/portfolio-analyzer.ts` is pure and deterministic. It accepts normalized portfolio snapshots and optional structured evidence. It does not call OpenAI, FMP, Supabase, brokerage APIs, or the network.

The analyzer uses review-oriented language only. It must not output direct trade commands, guaranteed-return language, or order-placement instructions.

## Default Thresholds

| Threshold | Default |
| --- | ---: |
| Quote stale after | 20 minutes |
| Near stop | 3% above stop |
| Near target | 3% below target |
| Profit review gain | 5% open gain |
| Holding window expiring | 2 days left |
| Position concentration | 35% of known portfolio value |
| Sector concentration | 45% of known portfolio value |
| Event risk lookahead | 7 days |
| Weak remaining reward/risk | below 1.2R |

All thresholds must be finite and greater than zero.

## Rule Matrix

| Finding | Formula / Condition | Required Inputs | Severity | Conflict Behavior | Limitation |
| --- | --- | --- | --- | --- | --- |
| `DATA_STALE` | `quote.status = stale` or fresh quote age exceeds `quoteStaleAfterMinutes` | quote status, quote `dataAsOf`, injected clock | attention | Suppresses price-based findings for that position | Does not infer freshness if no timestamp is supplied |
| `QUOTE_UNAVAILABLE` | current price is missing/invalid or quote status is `missing`/`error` | current price, quote status | attention | Suppresses price-based findings for that position | Does not estimate price |
| `NO_ACTIVE_SWINGFI_PLAN` | entry, target, or stop is missing/invalid | original plan | attention | Suppresses plan comparison findings | Manual trades without complete plans cannot be price-reviewed |
| `BELOW_OR_AT_STOP` | `currentPrice <= originalStop` | fresh quote, stop | high | Suppresses `NEAR_STOP`, `INSIDE_ORIGINAL_PLAN`, weak reward/risk | Long-trade logic only |
| `NEAR_STOP` | `((currentPrice - stop) / currentPrice) * 100 <= nearStopPct` and price is above stop | fresh quote, stop | high | Suppressed by `BELOW_OR_AT_STOP` or stale/unavailable quote | Uses current price as denominator |
| `AT_OR_ABOVE_TARGET` | `currentPrice >= originalTarget` | fresh quote, target | attention | Suppresses `NEAR_TARGET`, `PROFIT_REVIEW_ZONE`, `INSIDE_ORIGINAL_PLAN` | Does not decide whether to exit |
| `NEAR_TARGET` | `((target - currentPrice) / currentPrice) * 100 <= nearTargetPct` and price is below target | fresh quote, target | attention | Suppressed by `AT_OR_ABOVE_TARGET` or stale/unavailable quote | Uses current price as denominator |
| `PROFIT_REVIEW_ZONE` | `((currentPrice - entry) / entry) * 100 >= profitReviewGainPct` and price is below target | fresh quote, entry, target | info | Suppressed by `AT_OR_ABOVE_TARGET`, stale/unavailable quote | Does not calculate tax or account impact |
| `HOLDING_WINDOW_EXPIRING` | `holdingPeriodDays - daysHeld <= holdingWindowExpiringDays` and not expired | opened date, holding window, injected clock | attention | Suppressed by `HOLDING_WINDOW_EXPIRED` | Requires a valid opened date |
| `HOLDING_WINDOW_EXPIRED` | `daysHeld > holdingPeriodDays` | opened date, holding window, injected clock | attention | Suppresses `HOLDING_WINDOW_EXPIRING` | Calendar-day based |
| `POSITION_CONCENTRATION` | `(positionMarketValue / knownPortfolioValue) * 100 >= positionConcentrationPct` | known total value, position market value | attention or high | None | Does not run when total value is unknown |
| `SECTOR_CONCENTRATION` | `sum(known sector market values) / knownPortfolioValue >= sectorConcentrationPct` | known total value, sector evidence, market values | attention or high | None | Ignores positions missing sector or value |
| `EARNINGS_OR_EVENT_RISK` | supplied risk flag from earnings/event calendar within lookahead window | structured event evidence | high | None | Does not fetch calendars itself |
| `FILING_OR_HEADLINE_RISK` | supplied risk flag from filing/news evidence | structured risk evidence | attention | None | Does not classify raw news text itself |
| `TREND_WEAKENING` | supplied `trendQuality = weakening`, `relativeStrengthTrend = weakening`, or `sma20Relationship = below` | technical evidence | attention | Takes priority over `MOMENTUM_IMPROVING` for same evidence set | Only uses supplied precomputed evidence |
| `MOMENTUM_IMPROVING` | supplied `trendQuality = improving`, `relativeStrengthTrend = improving`, or `volumeTrend = rising` | technical evidence | info | Suppressed when weakening evidence is present | Does not compute indicators |
| `REMAINING_REWARD_RISK_WEAK` | `(target - currentPrice) / (currentPrice - stop) < remainingRewardRiskWeakBelow` | fresh quote, target, stop | attention | Suppressed by stale/unavailable quote, stop breach, or missing plan | Avoids divide-by-zero and ignores prices beyond target/stop |
| `INSIDE_ORIGINAL_PLAN` | price is between stop and target, not near either side, and remaining reward/risk is acceptable | fresh quote, target, stop | info | Suppressed by stale/unavailable quote, stop/target findings, weak reward/risk | A status finding, not advice |

## Example Input And Output

Input:

```json
{
  "clock": "2026-07-17T13:30:00.000Z",
  "knownPortfolioValue": 1000,
  "position": {
    "symbol": "AMZN",
    "currentPrice": 97.8,
    "marketValue": 391.2,
    "openedAt": "2026-07-09T13:30:00.000Z",
    "originalPlan": {
      "entryPrice": 100,
      "targetPrice": 110,
      "stopLoss": 95,
      "holdingPeriodDays": 10
    },
    "quote": {
      "status": "fresh",
      "source": "fixture_quote",
      "dataAsOf": "2026-07-17T13:25:00.000Z"
    }
  }
}
```

Output shape:

```json
{
  "id": "portfolio-analyzer.v1:NEAR_STOP:position-1",
  "type": "NEAR_STOP",
  "severity": "high",
  "symbol": "AMZN",
  "title": "Approaching original stop",
  "message": "AMZN is 2.86% above the original stop. Review the plan before the position gets closer to the saved risk line.",
  "ruleVersion": "portfolio-analyzer.v1",
  "dataCompleteness": "Complete for this rule.",
  "evidence": [
    {
      "metric": "stop_buffer_pct",
      "value": "2.86%",
      "source": "PortfolioAnalyzer",
      "asOf": "2026-07-17T13:25:00.000Z"
    }
  ]
}
```

## Deduplication And Ordering

Deduplication uses deterministic finding ids:

```text
portfolio-analyzer.v1:<TYPE>:<position/account/symbol/portfolio-ref>
```

Priority:

1. `high`
2. `attention`
3. `info`
4. rule priority
5. stable id sort

Conflicts suppress lower-value findings for the same position. Examples:

- `DATA_STALE` suppresses target/stop/reward-risk/inside-plan findings.
- `QUOTE_UNAVAILABLE` suppresses target/stop/reward-risk/inside-plan findings.
- `BELOW_OR_AT_STOP` suppresses `NEAR_STOP`.
- `AT_OR_ABOVE_TARGET` suppresses `NEAR_TARGET` and `PROFIT_REVIEW_ZONE`.
- `HOLDING_WINDOW_EXPIRED` suppresses `HOLDING_WINDOW_EXPIRING`.

## Limitations

- The analyzer is not a recommendation engine and does not decide trades for users.
- It does not fetch current prices, news, filings, earnings, macro data, or brokerage data.
- It assumes long swing-trade plans because current SwingFi tracked trades store one target and one stop for long setups.
- It only calculates concentration when a trusted known total portfolio value is supplied.
- It only calculates sector concentration when sector and market value are both supplied.
- It cannot judge raw headline text. Upstream services must provide structured risk flags.
- AI narration, if added later, must explain these findings rather than recalculate or invent values.
