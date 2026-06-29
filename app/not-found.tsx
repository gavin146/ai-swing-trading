import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fafb_0%,#eef4f6_48%,#f7fafb_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[78vh] max-w-3xl flex-col justify-center">
        <BrandMark />
        <section className="premium-panel mt-8 overflow-hidden rounded-3xl p-6 sm:p-8">
          <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
          <p className="text-sm font-black uppercase tracking-normal text-pine">
            Page not found
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-normal text-ink sm:text-5xl">
            That SwingFi page is not available
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-ink/64">
            The link may be old, mistyped, or tied to a page that moved. Start from the
            dashboard if you are reviewing today&apos;s rankings, or go back to the
            public homepage.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="rounded-2xl bg-ink px-5 py-3 text-center text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] transition hover:bg-pine"
            >
              Go to dashboard
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-ink transition hover:border-pine"
            >
              Home
            </Link>
            <Link
              href="/pricing"
              className="rounded-2xl border border-transparent px-5 py-3 text-center text-sm font-bold text-ink/62 transition hover:bg-white hover:text-ink"
            >
              Pricing
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
