"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { CustomerStatus } from "@/components/CustomerStatus";
import { getCurrentCustomer, isAdminCustomer, type CustomerProfile } from "@/lib/customer-store";

type AppShellProps = {
  active?: "admin" | "agent" | "dashboard" | "history" | "settings";
  children: React.ReactNode;
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

const customerLinks = [
  { href: "/dashboard", key: "dashboard", label: "Dashboard", symbol: "D" },
  { href: "/history", key: "history", label: "History", symbol: "H" },
  { href: "/settings", key: "settings", label: "Settings", symbol: "S" },
] as const;

const adminLinks = [
  { href: "/admin", key: "admin", label: "Admin", symbol: "A" },
  { href: "/agent", key: "agent", label: "Agent", symbol: "R" },
] as const;

function navClass(isActive: boolean) {
  return `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${
    isActive
      ? "bg-ink text-white shadow-[0_16px_36px_rgba(7,20,24,0.18)]"
      : "text-ink/62 hover:bg-white hover:text-ink hover:shadow-[0_12px_32px_rgba(7,20,24,0.06)]"
  }`;
}

export function AppShell({ active, children, eyebrow, subtitle, title }: AppShellProps) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const isAdmin = isAdminCustomer(customer);

  useEffect(() => {
    const refresh = () => setCustomer(getCurrentCustomer());

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("swingfi-customer-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("swingfi-customer-updated", refresh);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fafb_0%,#eef4f6_46%,#f7fafb_100%)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-line/75 bg-white/82 px-4 py-5 shadow-[18px_0_54px_rgba(7,20,24,0.06)] backdrop-blur-2xl lg:block">
        <BrandMark />
        <nav className="mt-8 grid gap-2">
          {customerLinks.map((item) => (
            <Link key={item.href} href={item.href} className={navClass(active === item.key)}>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-xs font-black text-inherit ring-1 ring-line/70 group-hover:bg-panel">
                {item.symbol}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        {isAdmin ? (
          <div className="mt-8 border-t border-line pt-5">
            <p className="px-3 text-xs font-black uppercase tracking-normal text-ink/42">
              Operations
            </p>
            <nav className="mt-3 grid gap-2">
              {adminLinks.map((item) => (
                <Link key={item.href} href={item.href} className={navClass(active === item.key)}>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-xs font-black text-inherit ring-1 ring-line/70 group-hover:bg-panel">
                    {item.symbol}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}

        <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Daily brief
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/62">
            Rankings refresh before the market opens. Review entries, stops, and risk
            before making any decision.
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-surface/82 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4 lg:hidden">
              <BrandMark compact />
              <CustomerStatus />
            </div>
            <div className="hidden items-center justify-between gap-4 lg:flex">
              <div>
                {eyebrow ? (
                  <p className="text-xs font-black uppercase tracking-normal text-pine">
                    {eyebrow}
                  </p>
                ) : null}
                <h1 className="mt-1 text-3xl font-black tracking-normal text-ink">{title}</h1>
              </div>
              <CustomerStatus />
            </div>
            <nav className="max-w-full overflow-x-auto rounded-2xl border border-line/70 bg-white/74 p-1 text-sm font-bold shadow-[0_10px_28px_rgba(7,20,24,0.05)] lg:hidden">
              <div className="flex min-w-max gap-2">
              {[...customerLinks, ...(isAdmin ? adminLinks : [])].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-xl px-3 py-2 ${
                    active === item.key ? "bg-ink text-white" : "text-ink/64"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              </div>
            </nav>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="mb-6 lg:hidden">
            {eyebrow ? (
              <p className="text-xs font-black uppercase tracking-normal text-pine">{eyebrow}</p>
            ) : null}
            <h1 className="mt-2 text-3xl font-black tracking-normal text-ink">{title}</h1>
          </div>
          {subtitle ? (
            <p className="mb-6 max-w-3xl text-sm font-medium leading-7 text-ink/58 lg:-mt-2">
              {subtitle}
            </p>
          ) : null}
          {children}
        </section>
      </div>
    </main>
  );
}
