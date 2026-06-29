"use client";

import Link from "next/link";
import { useState } from "react";
import { ToastNotice, type ToastTone } from "@/components/ToastNotice";
import { trackAnalyticsEvent } from "@/lib/client-analytics";
import type { BillingPlanKey } from "@/lib/stripe/config";
import { getCurrentCustomer } from "@/lib/customer-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type BillingCheckoutButtonProps = {
  disabled?: boolean;
  disabledMessage?: string;
  planKey: BillingPlanKey;
  label: string;
  highlighted?: boolean;
};

export function BillingCheckoutButton({
  disabled = false,
  disabledMessage = "Checkout is not ready yet.",
  planKey,
  label,
  highlighted = false,
}: BillingCheckoutButtonProps) {
  const [notice, setNotice] = useState<{
    message: string;
    showAccountLinks?: boolean;
    tone: ToastTone;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    if (disabled) {
      setNotice({ message: disabledMessage, tone: "info" });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const customer = getCurrentCustomer();
      if (!customer) {
        setNotice({
          message: "Create an account or log in before starting your free trial.",
          showAccountLinks: true,
          tone: "info",
        });
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = data.session?.access_token;

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
        setNotice({
          message: payload.nextStep ?? payload.error ?? "Checkout is not ready yet.",
          tone: payload.error ? "error" : "info",
        });
        return;
      }

      trackAnalyticsEvent("begin_checkout", {
        currency: "USD",
        plan_key: planKey,
        value: 0,
      });

      window.location.href = payload.url;
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Checkout failed.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void startCheckout()}
        data-locked={disabled}
        disabled={loading}
        className={
          highlighted
            ? "w-full rounded-lg bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine data-[locked=true]:cursor-not-allowed data-[locked=true]:opacity-60 disabled:cursor-not-allowed disabled:opacity-60"
            : "w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm font-bold text-ink hover:border-pine data-[locked=true]:cursor-not-allowed data-[locked=true]:opacity-60 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {loading ? "Checking..." : label}
      </button>
      {notice ? (
        <ToastNotice className="mt-3" tone={notice.tone}>
          <span>{notice.message}</span>
          {notice.showAccountLinks ? (
            <span className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/signup?plan=${planKey}`}
                className="rounded-xl bg-ink px-3 py-2 text-center text-xs font-black text-white hover:bg-pine"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-line bg-white/70 px-3 py-2 text-center text-xs font-black text-ink hover:border-pine"
              >
                Log in
              </Link>
            </span>
          ) : null}
        </ToastNotice>
      ) : null}
    </div>
  );
}
