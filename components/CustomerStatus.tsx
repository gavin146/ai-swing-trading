"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentCustomer, logoutCustomer, type CustomerProfile } from "@/lib/customer-store";

export function CustomerStatus() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    const refresh = () => setCustomer(getCurrentCustomer());

    refresh();
    window.addEventListener("tradepilot-customer-updated", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("tradepilot-customer-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!customer) {
    return (
      <Link
        href="/login"
        className="rounded-md border border-line bg-panel px-3 py-2 text-ink transition hover:border-pine"
      >
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/settings"
        className="rounded-md bg-surface px-3 py-2 text-sm font-bold text-ink transition hover:bg-mint"
      >
        {customer.fullName || customer.email}
      </Link>
      <button
        type="button"
        onClick={logoutCustomer}
        className="rounded-md border border-line bg-panel px-3 py-2 text-sm font-bold text-ink transition hover:border-pine"
      >
        Log out
      </button>
    </div>
  );
}
