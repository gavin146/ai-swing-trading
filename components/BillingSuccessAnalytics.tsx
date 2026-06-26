"use client";

import { useEffect } from "react";
import { trackOnce } from "@/lib/client-analytics";

type BillingSuccessAnalyticsProps = {
  persisted: boolean;
  sessionId?: string;
};

export function BillingSuccessAnalytics({
  persisted,
  sessionId,
}: BillingSuccessAnalyticsProps) {
  useEffect(() => {
    if (!sessionId) return;

    trackOnce(`swingfi-checkout-complete-${sessionId}`, "trial_checkout_complete", {
      currency: "USD",
      persisted,
      transaction_id: sessionId,
      value: 0,
    });

    if (persisted) {
      trackOnce(`swingfi-purchase-${sessionId}`, "purchase", {
        currency: "USD",
        transaction_id: sessionId,
        value: 0,
      });
    }
  }, [persisted, sessionId]);

  return null;
}
