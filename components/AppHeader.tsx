"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentCustomer, isAdminCustomer, type CustomerProfile } from "@/lib/customer-store";
import { BrandMark } from "./BrandMark";
import { CustomerStatus } from "./CustomerStatus";

type AppHeaderProps = {
  active?: "admin" | "agent" | "dashboard" | "history" | "settings" | "themes";
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

  const navClass = (key: AppHeaderProps["active"]) =>
    `rounded-lg px-3 py-2 transition ${
      active === key
        ? "bg-ink text-white shadow-[0_12px_26px_rgba(7,20,24,0.18)]"
        : "text-ink/68 hover:bg-panel hover:text-ink hover:shadow-soft"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <BrandMark />

        <nav className="flex flex-wrap items-center gap-2 rounded-xl border border-line/80 bg-white/65 p-1 text-sm font-bold shadow-[0_10px_35px_rgba(7,20,24,0.06)]">
          <Link
            href="/dashboard"
            className={navClass("dashboard")}
          >
            Dashboard
          </Link>
          <Link
            href="/settings"
            className={navClass("settings")}
          >
            Settings
          </Link>
          <Link
            href="/history"
            className={navClass("history")}
          >
            History
          </Link>
          {isAdmin ? (
            <>
              <Link
                href="/admin"
                className={navClass("admin")}
              >
                Admin
              </Link>
              <Link
                href="/agent"
                className={navClass("agent")}
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
