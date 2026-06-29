import { LegalSection, LegalShell } from "@/components/LegalShell";

export default function PrivacyPage() {
  return (
    <LegalShell eyebrow="Privacy" title="Privacy Policy">
      <LegalSection title="Information We Collect">
        <p>
          SwingFi may collect account details such as name, email address, phone number,
          authentication identifiers, alert preferences, risk profile answers, budget
          ranges, and account settings.
        </p>
        <p>
          The service may also collect usage records such as login activity, saved picks,
          clicked email links, alert delivery events, admin actions, error logs, browser
          metadata, and product analytics needed to operate and improve the app.
        </p>
      </LegalSection>

      <LegalSection title="Market And Analysis Data">
        <p>
          SwingFi stores market-data snapshots, rankings, opportunity records, score
          inputs, backtest results, calibration rules, AI explanations, and daily pick
          history so customers can review prior analysis and so the ranking system can be
          audited and improved.
        </p>
      </LegalSection>

      <LegalSection title="How We Use Information">
        <p>
          We use information to create accounts, personalize daily picks, send morning
          alerts, provide customer support, secure admin tools, measure email engagement,
          debug failures, improve ranking quality, and comply with legal obligations.
        </p>
        <p>
          We do not sell customer personal information. We may share data with service
          providers that help operate the product, including hosting, database,
          authentication, email delivery, payment processing, analytics,
          monitoring, market-data providers, and AI infrastructure.
        </p>
      </LegalSection>

      <LegalSection title="Vendors And Integrations">
        <p>
          The current production stack may use Vercel for hosting, Supabase for database
          and authentication, Resend for email, OpenAI for AI-assisted explanations,
          Financial Modeling Prep and public government data sources for market inputs,
          and Stripe for billing.
        </p>
      </LegalSection>

      <LegalSection title="Choices And Retention">
        <p>
          Customers can update alert preferences in account settings and unsubscribe from
          morning emails. We retain account, alert, ranking, and audit records as long as
          needed to operate the product, improve the model, troubleshoot issues, comply
          with law, and protect the service.
        </p>
        <p>
          If SMS alerts are enabled, SwingFi uses the phone number on the customer
          profile to send account alerts and daily trade-research notifications. Providing
          a phone number during signup does not by itself opt a customer into SMS. SMS
          users can reply STOP to unsubscribe or HELP for help. Message and data rates
          may apply.
        </p>
        <p>
          You may contact us to request access, correction, or deletion of personal
          information. Some records may be retained when required for security, legal,
          financial, fraud-prevention, backup, or audit purposes.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We use technical and organizational safeguards designed to protect customer
          information, including restricted admin routes, role-based access controls,
          row-level security policies, encrypted provider secrets, and production logging.
          No internet service can be guaranteed perfectly secure.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
