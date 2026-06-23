"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trackEmailLinkClick } from "@/lib/customer-analytics";

type EmailLinkTrackerProps = {
  trackingId: string;
};

export function EmailLinkTracker({ trackingId }: EmailLinkTrackerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const symbol = searchParams.get("symbol")?.toUpperCase() ?? "NVDA";
  const customerId = searchParams.get("customerId") ?? "unknown-customer";

  useEffect(() => {
    trackEmailLinkClick({
      customerId,
      symbol,
      trackingId,
    });
    router.replace(`/opportunities/${encodeURIComponent(symbol)}`);
  }, [customerId, router, symbol, trackingId]);

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-line bg-panel p-6 text-center shadow-soft">
        <p className="text-sm font-bold uppercase tracking-normal text-pine">
          Opening analysis
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">{symbol}</h1>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          Tracking your email link open and taking you to today&apos;s stock analysis.
        </p>
      </section>
    </main>
  );
}
