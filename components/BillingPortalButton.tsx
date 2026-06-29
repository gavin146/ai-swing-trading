"use client";

import { useState } from "react";
import { ToastNotice, type ToastTone } from "@/components/ToastNotice";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type BillingPortalButtonProps = {
  stripeCustomerId?: string | null;
};

export function BillingPortalButton({ stripeCustomerId }: BillingPortalButtonProps) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: ToastTone; title: string } | null>(
    null,
  );

  async function openPortal() {
    setLoading(true);
    setNotice(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = data.session?.access_token;
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ stripeCustomerId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        nextStep?: string;
        url?: string;
      };

      if (!response.ok || !payload.url) {
        setNotice({
          message:
            payload.nextStep ??
            payload.error ??
            "Billing management is not ready for this account yet.",
          title: "Billing portal unavailable",
          tone: response.status === 404 ? "info" : "warning",
        });
        return;
      }

      window.location.href = payload.url;
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Could not open billing portal.",
        title: "Billing portal unavailable",
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
        onClick={() => void openPortal()}
        disabled={loading}
        className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-black text-ink transition hover:border-pine hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Opening..." : "Manage billing"}
      </button>
      {notice ? (
        <ToastNotice className="mt-3" tone={notice.tone} title={notice.title}>
          {notice.message}
        </ToastNotice>
      ) : null}
    </div>
  );
}
