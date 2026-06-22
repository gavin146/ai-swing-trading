"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentCustomer, isAdminCustomer, type CustomerProfile } from "@/lib/customer-store";
import { CustomerStatus } from "./CustomerStatus";

type AppHeaderProps = {
  active?: "admin" | "agent" | "dashboard" | "settings" | "themes";
};

export function AppHeader({ active }: AppHeaderProps) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const isAdmin = isAdminCustomer(customer);

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

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-pine text-sm font-bold text-white">
            TP
          </span>
          <span>
            <span className="block text-base font-bold text-ink">TradePilot AI</span>
            <span className="block text-xs font-medium text-ink/55">
              Swing trade discovery
            </span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink/70">
          <Link
            href="/dashboard"
            className={`rounded-md px-3 py-2 transition hover:bg-mint hover:text-ink ${
              active === "dashboard" ? "bg-mint text-ink" : ""
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/settings"
            className={`rounded-md px-3 py-2 transition hover:bg-mint hover:text-ink ${
              active === "settings" ? "bg-mint text-ink" : ""
            }`}
          >
            Settings
          </Link>
          {isAdmin ? (
            <>
              <Link
                href="/admin"
                className={`rounded-md px-3 py-2 transition hover:bg-mint hover:text-ink ${
                  active === "admin" ? "bg-mint text-ink" : ""
                }`}
              >
                Admin
              </Link>
              <Link
                href="/agent"
                className={`rounded-md px-3 py-2 transition hover:bg-mint hover:text-ink ${
                  active === "agent" ? "bg-mint text-ink" : ""
                }`}
              >
                Agent
              </Link>
            </>
          ) : null}
          <CustomerStatus />
        </nav>
      </div>
    </header>
  );
}
