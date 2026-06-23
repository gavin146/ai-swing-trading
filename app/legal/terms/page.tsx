import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-xl border border-line bg-panel p-6 shadow-soft">
        <BrandMark />
        <p className="mt-8 text-sm font-bold uppercase tracking-normal text-pine">
          Terms
        </p>
        <h1 className="mt-3 text-4xl font-bold text-ink">Terms of use</h1>
        <div className="mt-6 grid gap-4 text-sm leading-7 text-ink/70">
          <p>
            SwingFi is a software and research tool for reviewing market
            opportunities. You agree not to treat rankings, alerts, or explanations as
            guaranteed outcomes or personalized investment advice.
          </p>
          <p>
            You are responsible for confirming data accuracy, reviewing risk, complying
            with laws and brokerage rules, and deciding whether any trade fits your
            financial situation.
          </p>
          <p>
            The service may be unavailable, delayed, incomplete, or incorrect. We may
            update scoring logic, calibration rules, data providers, alert schedules, and
            supported assets over time.
          </p>
          <p>
            Before accepting payments, these terms should be finalized with refund,
            cancellation, subscription, arbitration, and jurisdiction language.
          </p>
        </div>
        <Link href="/dashboard" className="mt-8 inline-flex font-bold text-pine">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
