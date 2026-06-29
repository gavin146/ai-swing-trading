import { LegalSection, LegalShell } from "@/components/LegalShell";

export default function TermsPage() {
  return (
    <LegalShell eyebrow="Terms" title="Terms of Use">
      <LegalSection title="Acceptance">
        <p>
          By creating an account, viewing rankings, opening alert links, or using SwingFi,
          you agree to these terms. If you do not agree, do not use the service.
        </p>
      </LegalSection>

      <LegalSection title="Use Of The Service">
        <p>
          SwingFi is a software platform for reviewing market research, modeled swing
          trade opportunities, educational explanations, backtests, and alerts. You agree
          not to treat rankings, alerts, explanations, or score outputs as guaranteed
          outcomes or personalized investment advice.
        </p>
        <p>
          You are responsible for your own account security, trading decisions, brokerage
          execution, tax treatment, compliance obligations, and risk management.
        </p>
      </LegalSection>

      <LegalSection title="No Regulated Financial Service">
        <p>
          SwingFi does not provide brokerage, custody, investment advisory, portfolio
          management, tax, legal, or accounting services. SwingFi does not recommend that
          any specific customer buy, sell, or hold any security or crypto asset.
        </p>
      </LegalSection>

      <LegalSection title="Data And Availability">
        <p>
          Market data, government data, corporate event data, SEC filing data, news
          signals, AI output, and technical indicators may be delayed, incomplete,
          inaccurate, or unavailable. We may change scoring logic, providers, supported
          tickers, alert schedules, calibration rules, and product features at any time.
        </p>
        <p>
          SwingFi may be unavailable due to maintenance, provider outages, API limits,
          deployment failures, market-data issues, or other circumstances outside our
          control.
        </p>
      </LegalSection>

      <LegalSection title="Email And SMS Alerts">
        <p>
          Customers may opt into SwingFi alerts in account settings. Email and SMS alerts
          may include account notices, daily trade-research links, and market-analysis
          summaries. SMS message frequency varies, usually one pre-market alert per
          trading day when enabled. Message and data rates may apply.
        </p>
        <p>
          Providing a phone number during signup does not by itself opt you into SMS
          alerts. If you enable SMS alerts, you can reply STOP to unsubscribe or HELP for
          help.
        </p>
      </LegalSection>

      <LegalSection title="Customer Conduct">
        <p>
          You agree not to misuse the service, scrape protected parts of the app, attempt
          to bypass admin or account restrictions, reverse engineer scoring systems,
          overload APIs, share access credentials, or use SwingFi for unlawful activity.
        </p>
      </LegalSection>

      <LegalSection title="Trials, Subscriptions, And Billing">
        <p>
          SwingFi may offer free trials, monthly subscriptions, coupons, or launch
          pricing. Plan limits, trial length, included features, renewal price, and
          billing timing are shown before checkout. Unless canceled before the trial ends,
          a trial subscription may renew automatically at the selected plan price.
        </p>
        <p>
          Billing is processed by Stripe. You are responsible for keeping payment details
          current and canceling before renewal if you do not want continued access. Refunds
          are not guaranteed and may be reviewed case by case unless required by law.
        </p>
      </LegalSection>

      <LegalSection title="Limitation Of Liability">
        <p>
          To the fullest extent permitted by law, SwingFi is provided as-is and as
          available. We are not liable for trading losses, missed opportunities, inaccurate
          analysis, delayed alerts, provider failures, lost data, indirect damages, or
          decisions made based on the service.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update these terms as the product changes. Continued use of SwingFi after
          an update means you accept the updated terms.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
