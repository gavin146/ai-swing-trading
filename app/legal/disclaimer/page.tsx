import { LegalSection, LegalShell } from "@/components/LegalShell";

export default function DisclaimerPage() {
  return (
    <LegalShell eyebrow="Important risk notice" title="Not Financial Advice">
      <LegalSection title="Research Software Only">
        <p>
          SwingFi provides market research software, rankings, educational explanations,
          modeled trade plans, and alerting tools. SwingFi does not provide personalized
          investment, legal, tax, accounting, or financial planning advice.
        </p>
        <p>
          SwingFi is not a broker-dealer, investment adviser, exchange, custodian, or
          brokerage account. The service does not place trades, execute orders, custody
          assets, manage accounts, or make investment decisions for customers.
        </p>
      </LegalSection>

      <LegalSection title="Trading Risk">
        <p>
          Stocks, ETFs, and cryptocurrencies can lose value quickly. Swing trading can be
          especially sensitive to market gaps, news, liquidity, volatility, earnings
          events, interest rates, and broad market conditions. You can lose some or all of
          the capital you choose to risk.
        </p>
        <p>
          Opportunity scores, confidence scores, risk scores, entry ranges, targets, stop
          losses, estimated holding periods, AI explanations, backtests, and historical
          performance are estimates. They may be delayed, incomplete, inaccurate, or wrong.
        </p>
      </LegalSection>

      <LegalSection title="Your Responsibility">
        <p>
          You are responsible for confirming data accuracy, reviewing company and market
          news, checking earnings and SEC filings, choosing position size, placing orders,
          managing risk, and deciding whether any trade fits your financial situation.
        </p>
        <p>
          Past performance, simulated results, backtests, calibration tables, and
          historical win rates do not guarantee future returns. No ranking or alert should
          be interpreted as a guarantee, promise, or instruction to buy, sell, or hold.
        </p>
      </LegalSection>

      <LegalSection title="AI Limitations">
        <p>
          AI-generated explanations may summarize data incorrectly, miss important
          context, or overstate the importance of a signal. Use the explanations as a
          starting point for review, not as a substitute for your own judgment or a
          qualified professional.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
