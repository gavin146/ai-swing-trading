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
        className="rounded-lg border border-line bg-panel px-3 py-2 font-bold text-ink hover:border-pine hover:shadow-soft"
      >
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/settings"
        className="rounded-lg bg-mint px-3 py-2 text-sm font-black text-pine hover:bg-lime hover:text-ink"
      >
        {customer.fullName || customer.email}
      </Link>
      <button
        type="button"
        onClick={logoutCustomer}
        className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-bold text-ink hover:border-pine hover:shadow-soft"
      >
        Log out
      </button>
    </div>
  );
}
