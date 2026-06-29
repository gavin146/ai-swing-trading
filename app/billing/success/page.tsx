import Link from "next/link";
import { BillingSuccessAnalytics } from "@/components/BillingSuccessAnalytics";
import { BrandMark } from "@/components/BrandMark";
import { ToastNotice } from "@/components/ToastNotice";
import { syncCheckoutSession } from "@/lib/stripe/subscription-sync";

type BillingSuccessPageProps = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

export default async function BillingSuccessPage({ searchParams }: BillingSuccessPageProps) {
  const params = await searchParams;
  const syncResult = params.session_id
    ? await syncCheckoutSession(params.session_id).catch((error) => ({
        error: error instanceof Error ? error.message : "Subscription sync failed.",
        persisted: false,
      }))
    : null;
  const pendingDetail =
    syncResult && "error" in syncResult && syncResult.error
      ? syncResult.error
      : syncResult && "reason" in syncResult
        ? syncResult.reason
        : "";

  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <BillingSuccessAnalytics
        persisted={Boolean(syncResult?.persisted)}
        sessionId={params.session_id}
      />
      <section className="mx-auto max-w-xl rounded-xl border border-line bg-panel p-6 shadow-soft">
        <BrandMark />
        <p className="mt-8 text-sm font-bold uppercase tracking-normal text-pine">
          Billing
        </p>
        <h1 className="mt-3 text-4xl font-bold text-ink">Checkout complete</h1>
        <p className="mt-4 text-sm leading-7 text-ink/70">
          Stripe returned a successful checkout session. Your subscription access is
          being synced so your SwingFi dashboard can unlock paid analysis.
        </p>
        {syncResult ? (
          <ToastNotice
            className="mt-4"
            tone={syncResult.persisted ? "success" : "warning"}
            title={syncResult.persisted ? "Subscription synced" : "Sync pending"}
          >
            {syncResult.persisted
              ? "Your trial and plan access are ready."
              : `Subscription sync is pending${pendingDetail ? `: ${pendingDetail}` : "."}`}
          </ToastNotice>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard" className="rounded-lg bg-ink px-4 py-3 text-center text-sm font-black text-white">
            Go to dashboard
          </Link>
          <Link href="/settings" className="rounded-lg border border-line px-4 py-3 text-center text-sm font-bold text-ink">
            Account settings
          </Link>
        </div>
      </section>
    </main>
  );
}
