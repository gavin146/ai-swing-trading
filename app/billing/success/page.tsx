import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

type BillingSuccessPageProps = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

export default async function BillingSuccessPage({ searchParams }: BillingSuccessPageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <section className="mx-auto max-w-xl rounded-xl border border-line bg-panel p-6 shadow-soft">
        <BrandMark />
        <p className="mt-8 text-sm font-bold uppercase tracking-normal text-pine">
          Billing
        </p>
        <h1 className="mt-3 text-4xl font-bold text-ink">Checkout complete</h1>
        <p className="mt-4 text-sm leading-7 text-ink/70">
          Stripe returned a successful checkout session. Once webhooks are connected,
          the subscription record will update automatically in Supabase.
        </p>
        {params.session_id ? (
          <p className="mt-4 break-all rounded-md bg-surface px-3 py-2 text-xs font-semibold text-ink/60">
            Session: {params.session_id}
          </p>
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
