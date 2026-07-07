"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { loginHref } from "@/lib/customer-flow";
import {
  getCurrentCustomer,
  logoutCustomer,
  restoreAuthenticatedCustomerSession,
  type CustomerProfile,
} from "@/lib/customer-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function CustomerStatus() {
  const pathname = usePathname();
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    const refresh = () => setCustomer(getCurrentCustomer());

    refresh();
    restoreAuthenticatedCustomerSession().then(setCustomer).catch(refresh);
    window.addEventListener("swingfi-customer-updated", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("swingfi-customer-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!customer) {
    return (
      <Link
        href={loginHref(pathname || "/dashboard")}
        className="min-h-10 rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink hover:border-pine hover:shadow-soft sm:text-base"
      >
        Log in
      </Link>
    );
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.signOut();
    logoutCustomer();
  }

  const displayName = customer.fullName || customer.email;
  const initial = displayName.trim().charAt(0).toUpperCase() || "S";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link
        href="/settings"
        className="flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-mint px-2 text-sm font-black text-pine hover:bg-lime hover:text-ink sm:max-w-[220px] sm:justify-start sm:px-3"
        aria-label={`Account settings for ${displayName}`}
      >
        <span className="sm:hidden">{initial}</span>
        <span className="hidden truncate sm:block">{displayName}</span>
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        className="min-h-10 rounded-xl border border-line bg-white px-2.5 py-2 text-xs font-bold text-ink hover:border-pine hover:shadow-soft sm:px-3 sm:text-sm"
      >
        <span className="sm:hidden">Out</span>
        <span className="hidden sm:inline">Log out</span>
      </button>
    </div>
  );
}
