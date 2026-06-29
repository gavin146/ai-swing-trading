"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fafb_0%,#eef4f6_48%,#f7fafb_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[78vh] max-w-3xl flex-col justify-center">
        <BrandMark />
        <section className="premium-panel mt-8 overflow-hidden rounded-3xl p-6 sm:p-8">
          <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
          <p className="text-sm font-black uppercase tracking-normal text-coral">
            Something needs a refresh
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-normal text-ink sm:text-5xl">
            SwingFi had trouble loading this view
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-ink/64">
            Your account and saved research are not affected. Try loading the page again,
            or return to the dashboard while we keep the app steady.
          </p>
          {error.digest ? (
            <p className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-xs font-bold text-ink/54">
              Error reference: {error.digest}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] transition hover:bg-pine"
            >
              Try again
            </button>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-ink transition hover:border-pine"
            >
              Go to dashboard
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-transparent px-5 py-3 text-center text-sm font-bold text-ink/62 transition hover:bg-white hover:text-ink"
            >
              Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
