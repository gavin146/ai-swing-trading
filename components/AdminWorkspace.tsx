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
import { PredictionAccuracyPanel } from "@/components/PredictionAccuracyPanel";
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
  | "accuracy"
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
        key: "accuracy",
        label: "Prediction accuracy",
        description: "Forward proof that live picks are beating benchmarks.",
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

const adminTabs = adminTabGroups.flatMap((group) => group.tabs);

export function AdminWorkspace() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  useEffect(() => {
    const refresh = async () => {
      const current = getCurrentCustomer();
      if (current) setCustomer(current);

      const restored = await restoreAuthenticatedCustomerSession();
      setCustomer(restored ?? getCurrentCustomer());
      setLoaded(true);
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
    if (activeTab === "accuracy") return <PredictionAccuracyPanel />;
    if (activeTab === "access") return <AdminAccessPanel />;
    if (activeTab === "communications") return <AdminCommunicationsPanel />;
    if (activeTab === "customers") return <AdminCustomerPanel />;
    if (activeTab === "opportunities") return <AdminOpportunityPanel />;
    return <AdminOperationsPanel />;
  }, [activeTab]);

  if (!loaded) {
    return (
      <section className="premium-panel overflow-hidden rounded-3xl">
        <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
          <div className="p-6">
            <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
            <p className="text-sm font-black uppercase tracking-normal text-pine">
              Secure admin check
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-ink">
              Verifying your operations access
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-ink/60">
              SwingFi is confirming that this session belongs to an approved admin
              before loading customer, alert, and ranking controls.
            </p>
          </div>
          <div className="border-t border-line bg-surface p-6 lg:border-l lg:border-t-0">
            <div className="skeleton h-4 w-36 rounded-full" />
            <div className="skeleton mt-5 h-12 rounded-2xl" />
            <div className="skeleton mt-4 h-24 rounded-3xl" />
          </div>
        </div>
      </section>
    );
  }

  if (!customer || !isAdminCustomer(customer)) {
    return (
      <section className="premium-panel overflow-hidden rounded-3xl">
        <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
          <div className="p-6 sm:p-8">
            <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
            <p className="text-sm font-black uppercase tracking-normal text-pine">
              Admin account required
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-normal text-ink">
              Sign in with an approved admin email
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ink/65">
              Admin access is limited to approved emails. The owner account is{" "}
              {SWINGFI_ADMIN_EMAIL}. Existing admins can approve additional team
              members, then each person creates their own password-protected account.
            </p>
            {customer ? (
              <p className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink/65">
                Current account: {customer.email}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine"
              >
                Log in as admin
              </Link>
              <Link
                href="/signup"
                className="rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-bold text-ink hover:border-pine"
              >
                Create approved account
              </Link>
            </div>
          </div>
          <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white lg:border-l lg:border-t-0">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Protected tools
            </p>
            <div className="mt-5 grid gap-3">
              {[
                "Daily agent runs",
                "Customer profiles and activity",
                "Email and SMS alert studio",
                "Backtesting and calibration",
                "Prediction accuracy verification",
                "Admin role approvals",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/14 bg-white/8 p-3 text-sm font-bold text-white/76"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const adminCustomer = customer;

  return (
    <div className="grid min-w-0 gap-5 2xl:grid-cols-[260px_minmax(0,1fr)] 2xl:gap-6">
      <aside className="premium-panel min-w-0 rounded-3xl p-3 sm:p-4 2xl:sticky 2xl:top-24 2xl:self-start">
        <div className="rounded-2xl bg-ink p-4 text-white sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4 2xl:block">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-normal text-white/60">
              SwingFi admin
            </p>
            <p className="mt-1 break-words text-sm font-bold">{adminCustomer.email}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-white/62">
              Full access to operations, alerts, customers, and opportunity management.
            </p>
          </div>
          <span className="mt-3 inline-flex w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white sm:mt-0 2xl:mt-3">
            Admin
          </span>
        </div>

        <nav className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:hidden">
          {adminTabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`min-h-11 rounded-2xl border px-3 py-2.5 text-left text-sm font-black transition ${
                  isActive
                    ? "border-pine bg-mint text-ink shadow-soft"
                    : "border-line/70 bg-surface/70 text-ink/68 hover:border-pine/30 hover:bg-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <nav className="mt-4 hidden gap-4 2xl:grid">
          {adminTabGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 text-[11px] font-black uppercase tracking-normal text-ink/38">
                {group.label}
              </p>
              <div className="mt-2 grid gap-2">
                {group.tabs.map((tab) => {
                  const isActive = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`min-h-[74px] rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-pine bg-mint text-ink shadow-soft"
                          : "border-line/70 bg-surface/70 text-ink/68 hover:border-pine/30 hover:bg-white"
                      }`}
                    >
                      <span className="block text-sm font-black">{tab.label}</span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-ink/55">
                        {tab.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-3 hidden rounded-2xl border border-line bg-surface p-3 sm:mt-4 sm:p-4 2xl:block">
          <p className="text-xs font-black uppercase tracking-normal text-ink/55">
            Access rule
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/65">
            The owner email plus approved admin emails receive full product access.
          </p>
        </div>
      </aside>

      <div className="min-w-0 overflow-hidden [&_*]:min-w-0 [&>section]:mb-0">
        {activePanel}
      </div>
    </div>
  );
}
