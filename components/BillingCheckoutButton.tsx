"use client";

import { useState } from "react";
import type { BillingPlanKey } from "@/lib/stripe/config";
import { getCurrentCustomer } from "@/lib/customer-store";

type BillingCheckoutButtonProps = {
  planKey: BillingPlanKey;
  label: string;
  highlighted?: boolean;
};

export function BillingCheckoutButton({
  planKey,
  label,
  highlighted = false,
}: BillingCheckoutButtonProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    setMessage("");

    try {
      const customer = getCurrentCustomer();
      if (!customer) {
        setMessage("Create an account or log in before testing checkout.");
        return;
      }

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey,
          customerId: customer.id,
          email: customer.email,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        nextStep?: string;
        url?: string;
      };

      if (!response.ok || !payload.url) {
        setMessage(payload.nextStep ?? payload.error ?? "Checkout is not ready yet.");
        return;
      }

      window.location.href = payload.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void startCheckout()}
        disabled={loading}
        className={
          highlighted
            ? "w-full rounded-lg bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine disabled:cursor-not-allowed disabled:opacity-60"
            : "w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm font-bold text-ink hover:border-pine disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {loading ? "Checking..." : label}
      </button>
      {message ? (
        <p className="mt-3 rounded-md bg-surface px-3 py-2 text-xs font-semibold leading-5 text-ink/65">
          {message}
        </p>
      ) : null}
    </div>
  );
}
