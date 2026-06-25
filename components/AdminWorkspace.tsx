"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminAccessPanel } from "@/components/AdminAccessPanel";
import { AdminCommandCenter } from "@/components/AdminCommandCenter";
import { AdminCommunicationsPanel } from "@/components/AdminCommunicationsPanel";
import { AdminCustomerPanel } from "@/components/AdminCustomerPanel";
import { AdminOperationsPanel } from "@/components/AdminOperationsPanel";
import { AdminOpportunityPanel } from "@/components/AdminOpportunityPanel";
import { BacktestPanel } from "@/components/BacktestPanel";
import {
  getCurrentCustomer,
  isAdminCustomer,
  restoreAuthenticatedCustomerSession,
  SWINGFI_ADMIN_EMAIL,
  type CustomerProfile,
} from "@/lib/customer-store";

type AdminTab =
  | "overview"
  | "operations"
  | "backtesting"
  | "access"
  | "communications"
  | "customers"
  | "opportunities";

const adminTabGroups: Array<{
  label: string;
  tabs: Array<{
  key: AdminTab;
  label: string;
  description: string;
  }>;
}> = [
  {
    label: "Command",
    tabs: [
      {
        key: "overview",
        label: "Overview",
        description: "Run status, alerts, customers, API health, and blockers.",
      },
    ],
  },
  {
    label: "Daily operations",
    tabs: [
      {
        key: "operations",
        label: "Agent controls",
        description: "Run the morning analysis and check integrations.",
      },
      {
        key: "backtesting",
        label: "Backtesting",
        description: "Outcome tracking and self-learning calibration.",
      },
      {
        key: "opportunities",
        label: "Opportunities",
        description: "Create, update, and remove ranked trade ideas.",
      },
    ],
  },
  {
    label: "Customer growth",
    tabs: [
      {
        key: "communications",
        label: "Alert studio",
        description: "Design branded email and SMS templates.",
      },
      {
        key: "customers",
        label: "Customers",
        description: "Profiles, alert preferences, and link activity.",
      },
    ],
  },
  {
    label: "Security",
    tabs: [
      {
        key: "access",
        label: "Admin access",
        description: "Approve team emails and account setup.",
      },
    ],
  },
];

export function AdminWorkspace() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  useEffect(() => {
    const refresh = async () => {
      setCustomer(getCurrentCustomer());
      setLoaded(true);
      const restored = await restoreAuthenticatedCustomerSession();
      setCustomer(restored);
    };

    refresh().catch(() => {
      setCustomer(getCurrentCustomer());
      setLoaded(true);
    });
    window.addEventListener("storage", refresh);
    window.addEventListener("swingfi-customer-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("swingfi-customer-updated", refresh);
    };
  }, []);

  const activePanel = useMemo(() => {
    if (activeTab === "overview") return <AdminCommandCenter onNavigate={setActiveTab} />;
    if (activeTab === "backtesting") return <BacktestPanel />;
    if (activeTab === "access") return <AdminAccessPanel />;
    if (activeTab === "communications") return <AdminCommunicationsPanel />;
    if (activeTab === "customers") return <AdminCustomerPanel />;
    if (activeTab === "opportunities") return <AdminOpportunityPanel />;
    return <AdminOperationsPanel />;
  }, [activeTab]);

  if (!loaded) {
    return (
      <section className="premium-panel rounded-3xl p-6">
        <p className="text-sm font-bold text-ink">Checking admin access...</p>
      </section>
    );
  }

  if (!customer || !isAdminCustomer(customer)) {
    return (
      <section className="premium-panel rounded-3xl p-6">
        <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
        <p className="text-sm font-bold uppercase tracking-normal text-pine">
          Admin account required
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black text-ink">
          Admin tools require an approved admin email
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
          The owner account is {SWINGFI_ADMIN_EMAIL}. Existing admins can approve
          more emails from the admin workspace, then those people can create their own
          admin accounts with passwords.
        </p>
        {customer ? (
          <p className="mt-4 rounded-md bg-surface px-3 py-2 text-sm font-bold text-ink/65">
            Current account: {customer.email}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine"
          >
            Create admin account
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-bold text-ink hover:border-pine"
          >
            Log in
          </Link>
        </div>
      </section>
    );
  }

  const adminCustomer = customer;

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
      <aside className="premium-panel min-w-0 rounded-3xl p-3 sm:p-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl bg-ink p-4 text-white sm:grid sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4 lg:block">
          <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-normal text-white/60">
            SwingFi admin
          </p>
          <p className="mt-2 break-words text-sm font-bold">{adminCustomer.email}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-white/62">
            Full access to operations, alerts, customers, and opportunity management.
          </p>
          </div>
          <span className="mt-3 inline-flex w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white sm:mt-0 lg:mt-3">
            Admin
          </span>
        </div>

        <nav className="mt-3 grid gap-4 lg:mt-4">
          {adminTabGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 text-[11px] font-black uppercase tracking-normal text-ink/38">
                {group.label}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {group.tabs.map((tab) => {
                  const isActive = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`min-h-12 rounded-2xl border px-3 py-3 text-left transition sm:min-h-[74px] sm:px-4 ${
                        isActive
                          ? "border-pine bg-mint text-ink shadow-soft"
                          : "border-line/70 bg-surface/70 text-ink/68 hover:border-pine/30 hover:bg-white"
                      }`}
                    >
                      <span className="block text-sm font-black">{tab.label}</span>
                      <span className="mt-1 hidden text-xs font-semibold leading-5 text-ink/55 sm:block">
                        {tab.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-3 rounded-2xl border border-line bg-surface p-3 sm:mt-4 sm:p-4">
          <p className="text-xs font-black uppercase tracking-normal text-ink/55">
            Access rule
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/65">
            The owner email plus approved admin emails receive full product access.
          </p>
        </div>
      </aside>

      <div className="min-w-0 [&>section]:mb-0">{activePanel}</div>
    </div>
  );
}
