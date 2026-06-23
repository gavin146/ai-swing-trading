import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { unsubscribeEmailAlerts } from "@/lib/persistence";

type UnsubscribePageProps = {
  searchParams: Promise<{
    customerId?: string;
    email?: string;
  }>;
};

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const params = await searchParams;
  const result = await unsubscribeEmailAlerts({
    customerId: params.customerId,
    email: params.email,
  });

  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <section className="mx-auto max-w-xl rounded-xl border border-line bg-panel p-6 shadow-soft">
        <BrandMark />
        <p className="mt-8 text-sm font-bold uppercase tracking-normal text-pine">
          Email preferences
        </p>
        <h1 className="mt-3 text-4xl font-bold text-ink">
          {result.persisted ? "You are unsubscribed" : "Preference update needed"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-ink/70">
          {result.persisted
            ? "Morning email alerts have been turned off for this account."
            : "We could not automatically update this preference. Sign in and update your alert settings, or contact support before launch."}
        </p>
        {result.reason || result.error ? (
          <p className="mt-4 rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink/65">
            {result.reason ?? result.error}
          </p>
        ) : null}
        <Link href="/settings" className="mt-8 inline-flex font-bold text-pine">
          Manage settings
        </Link>
      </section>
    </main>
  );
}
