"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { CustomerStatus } from "@/components/CustomerStatus";
import { SwingFiAssistant } from "@/components/SwingFiAssistant";
import {
  getCurrentCustomer,
  isAdminCustomer,
  restoreAuthenticatedCustomerSession,
  type CustomerProfile,
} from "@/lib/customer-store";

type AppShellProps = {
  active?: "admin" | "copilot" | "dashboard" | "history" | "portfolio" | "settings";
  children: React.ReactNode;
  eyebrow?: string;
  showCopilot?: boolean;
  subtitle?: string;
  title: string;
};

const customerLinks = [
  { href: "/dashboard", key: "dashboard", label: "Dashboard", symbol: "D" },
  { href: "/portfolio", key: "portfolio", label: "Portfolio", symbol: "P" },
  { href: "/copilot", key: "copilot", label: "Copilot", symbol: "C" },
  { href: "/history", key: "history", label: "History", symbol: "H" },
  { href: "/settings", key: "settings", label: "Settings", symbol: "S" },
] as const;

const adminLinks = [
  { href: "/admin", key: "admin", label: "Admin", symbol: "A" },
] as const;

type AppNavLink = (typeof customerLinks)[number] | (typeof adminLinks)[number];

function navClass(isActive: boolean) {
  return `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${
    isActive
      ? "bg-ink text-white shadow-[0_16px_36px_rgba(7,20,24,0.18)]"
      : "text-ink/62 hover:bg-white hover:text-ink hover:shadow-[0_12px_32px_rgba(7,20,24,0.06)]"
  }`;
}

function navIconClass(isActive: boolean) {
  return `grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black ring-1 transition ${
    isActive
      ? "bg-white/12 text-white ring-white/18"
      : "bg-surface text-ink/58 ring-line/70 group-hover:bg-panel group-hover:text-ink"
  }`;
}

function topNavClass(isActive: boolean) {
  return `shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
    isActive
      ? "bg-ink text-white shadow-[0_12px_28px_rgba(7,20,24,0.16)]"
      : "text-ink/58 hover:bg-white hover:text-ink"
  }`;
}

function bottomNavClass(isActive: boolean) {
  return `flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-1.5 text-center text-[10px] font-black leading-tight transition sm:px-2 sm:py-2 sm:text-[11px] ${
    isActive
      ? "bg-ink text-white shadow-[0_10px_24px_rgba(7,20,24,0.18)]"
      : "text-ink/58 hover:bg-surface hover:text-ink"
  }`;
}

function contentMaxWidth(active: AppShellProps["active"]) {
  if (active === "admin") return "max-w-[96rem]";
  return active === "dashboard" ? "max-w-[88rem]" : "max-w-7xl";
}

function MobileBottomNav({
  active,
  links,
}: {
  active: AppShellProps["active"];
  links: ReadonlyArray<AppNavLink>;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[120] border-t border-line/80 bg-white/95 px-2 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-18px_44px_rgba(7,20,24,0.14)] backdrop-blur-2xl md:hidden">
      <div
        className="mx-auto grid max-w-md gap-1"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
      >
        {links.map((item) => {
          const isActive = active === item.key;

          return (
            <Link key={item.href} href={item.href} className={bottomNavClass(isActive)}>
              <span
                className={`grid h-6 w-6 place-items-center rounded-lg text-[10px] ring-1 sm:h-7 sm:w-7 sm:rounded-xl sm:text-[11px] ${
                  isActive
                    ? "bg-white/12 text-white ring-white/20"
                    : "bg-surface text-ink/54 ring-line/75"
                }`}
              >
                {item.symbol}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({
  active,
  children,
  eyebrow,
  showCopilot = process.env.NEXT_PUBLIC_COPILOT_ENABLED === "true",
  subtitle,
  title,
}: AppShellProps) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const isAdmin = isAdminCustomer(customer);
  const isOperationsPage = active === "admin";
  const normalizedCustomerEmail = customer?.email.trim().toLowerCase() ?? "";
  const canShowCopilotPreview = showCopilot && normalizedCustomerEmail === "gavin@onefear.co";
  const customerNavLinks = customerLinks.filter((item) => canShowCopilotPreview || item.key !== "copilot");
  const visibleLinks = [...customerNavLinks, ...(isAdmin ? adminLinks : [])];
  const shellLinks = isOperationsPage
    ? isAdmin
      ? visibleLinks
      : adminLinks
    : visibleLinks;
  const isActiveLink = (key: string) => active === key;

  useEffect(() => {
    const refresh = async () => {
      const current = getCurrentCustomer();
      if (current) setCustomer(current);

      const restored = await restoreAuthenticatedCustomerSession();
      setCustomer(restored ?? getCurrentCustomer());
      setSessionLoaded(true);
    };

    refresh().catch(() => {
      setCustomer(getCurrentCustomer());
      setSessionLoaded(true);
    });
    window.addEventListener("storage", refresh);
    window.addEventListener("swingfi-customer-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("swingfi-customer-updated", refresh);
    };
  }, []);

  if (!isOperationsPage) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f7fafb_0%,#eef4f6_46%,#f7fafb_100%)] pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="sticky top-0 z-[95] border-b border-line/70 bg-surface/94 backdrop-blur-2xl md:relative md:z-30">
          <div className={`mx-auto flex ${contentMaxWidth(active)} flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4 lg:px-8`}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="lg:hidden">
                  <BrandMark compact />
                </div>
                <div className="hidden lg:block">
                  <BrandMark />
                </div>
              </div>

              <nav className="hidden items-center gap-1 rounded-full border border-line/75 bg-white/74 p-1 shadow-[0_10px_28px_rgba(7,20,24,0.055)] md:flex">
                {shellLinks.map((item) => (
                  <Link key={item.href} href={item.href} className={topNavClass(isActiveLink(item.key))}>
                    {item.label}
                  </Link>
                ))}
              </nav>

              <CustomerStatus />
            </div>
          </div>
        </header>

        <section className={`mx-auto ${contentMaxWidth(active)} px-3 py-3 sm:px-6 sm:py-5 lg:px-8`}>
          <div className="mb-3 flex flex-col gap-1.5 sm:mb-4 sm:gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              {eyebrow ? (
                <p className="text-xs font-black uppercase tracking-normal text-pine">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="mt-1 max-w-4xl text-[1.55rem] font-black leading-tight tracking-normal text-ink sm:mt-2 sm:text-4xl">
                {title}
              </h1>
            </div>
            {subtitle ? (
              <p className="max-w-2xl text-xs font-semibold leading-5 text-ink/58 sm:text-sm sm:leading-7 lg:text-right">
                {subtitle}
              </p>
            ) : null}
          </div>
          {children}
        </section>
        <SwingFiAssistant enabled={Boolean(customer)} />
        <MobileBottomNav active={active} links={shellLinks} />
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f7fafb_0%,#eef4f6_46%,#f7fafb_100%)] pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-line/75 bg-white/82 px-4 py-5 shadow-[18px_0_54px_rgba(7,20,24,0.06)] backdrop-blur-2xl lg:block">
        <BrandMark />
        <nav className="mt-8 grid gap-2">
          {(isAdmin ? customerNavLinks : adminLinks).map((item) => (
            <Link key={item.href} href={item.href} className={navClass(isActiveLink(item.key))}>
              <span className={navIconClass(isActiveLink(item.key))}>
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
                <Link key={item.href} href={item.href} className={navClass(isActiveLink(item.key))}>
                  <span className={navIconClass(isActiveLink(item.key))}>
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
            {!sessionLoaded ? "Checking access" : isAdmin ? "Daily brief" : "Admin access"}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/62">
            {!sessionLoaded
              ? "SwingFi is restoring your signed-in profile before showing protected tools."
              : isAdmin
                ? "Rankings refresh before the market opens. Review entries, stops, and risk before making any decision."
                : "Sign in with an approved admin email to manage runs, users, alerts, and model feedback."}
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-[95] border-b border-line/70 bg-surface/94 backdrop-blur-2xl lg:relative lg:z-30">
          <div className={`mx-auto flex ${contentMaxWidth(active)} flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4 lg:px-8`}>
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
          </div>
        </header>

        <section className={`mx-auto ${contentMaxWidth(active)} px-3 py-3 sm:px-6 sm:py-6 lg:px-8`}>
          <div className="mb-3 sm:mb-6 lg:hidden">
            {eyebrow ? (
              <p className="text-xs font-black uppercase tracking-normal text-pine">{eyebrow}</p>
            ) : null}
            <h1 className="mt-1 text-[1.55rem] font-black leading-tight tracking-normal text-ink sm:mt-2 sm:text-3xl">{title}</h1>
          </div>
          {subtitle ? (
            <p className="mb-4 max-w-3xl text-xs font-medium leading-5 text-ink/58 sm:mb-6 sm:text-sm sm:leading-7 lg:-mt-2">
              {subtitle}
            </p>
          ) : null}
          {children}
        </section>
      </div>
      <SwingFiAssistant enabled={Boolean(customer)} />
      <MobileBottomNav active={active} links={shellLinks} />
    </main>
  );
}
