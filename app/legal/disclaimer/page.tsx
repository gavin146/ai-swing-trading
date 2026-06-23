import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-xl border border-line bg-panel p-6 shadow-soft">
        <BrandMark />
        <p className="mt-8 text-sm font-bold uppercase tracking-normal text-pine">
          Important risk notice
        </p>
        <h1 className="mt-3 text-4xl font-bold text-ink">Not financial advice</h1>
        <div className="mt-6 grid gap-4 text-sm leading-7 text-ink/70">
          <p>
            TradePilot AI provides research, ranking tools, educational explanations,
            and modeled trade plans for review. The service does not provide
            personalized investment, legal, tax, or financial advice.
          </p>
          <p>
            Trading stocks, ETFs, and cryptocurrencies involves risk, including possible
            loss of principal. Scores, targets, stop losses, holding periods, and AI
            explanations are estimates and may be wrong.
          </p>
          <p>
            You are responsible for your own trading decisions, position sizing,
            brokerage execution, and risk management. Past performance, backtests, and
            historical simulations do not guarantee future results.
          </p>
        </div>
        <Link href="/dashboard" className="mt-8 inline-flex font-bold text-pine">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
