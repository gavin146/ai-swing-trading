import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-xl border border-line bg-panel p-6 shadow-soft">
        <BrandMark />
        <p className="mt-8 text-sm font-bold uppercase tracking-normal text-pine">
          Privacy
        </p>
        <h1 className="mt-3 text-4xl font-bold text-ink">Privacy policy</h1>
        <div className="mt-6 grid gap-4 text-sm leading-7 text-ink/70">
          <p>
            TradePilot AI collects account details, alert preferences, usage events,
            email delivery records, and clicked analysis links so the service can provide
            daily picks and improve product quality.
          </p>
          <p>
            Market data, score inputs, generated rankings, backtest results, and
            calibration rules may be stored to audit and improve the ranking system.
          </p>
          <p>
            We do not sell customer personal information. Production providers may
            process data for authentication, database storage, email delivery, analytics,
            monitoring, and AI-generated explanations.
          </p>
          <p>
            Customers should be able to update alert preferences and unsubscribe from
            morning emails. Before launch, this policy should be reviewed and expanded
            for your actual vendors, retention periods, and customer rights.
          </p>
        </div>
        <Link href="/dashboard" className="mt-8 inline-flex font-bold text-pine">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
