"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCurrentCustomer,
  getCustomerProfiles,
  type CustomerProfile,
} from "@/lib/customer-store";
import { getCustomerUsageSummaries, type CustomerUsageSummary } from "@/lib/customer-analytics";

function formatDate(value: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminCustomerPanel() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [usage, setUsage] = useState<CustomerUsageSummary[]>([]);

  useEffect(() => {
    const refresh = () => {
      getCurrentCustomer();
      setCustomers(getCustomerProfiles());
      setUsage(getCustomerUsageSummaries());
    };

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("tradepilot-customer-updated", refresh);
    window.addEventListener("tradepilot-analytics-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("tradepilot-customer-updated", refresh);
      window.removeEventListener("tradepilot-analytics-updated", refresh);
    };
  }, []);

  const usageByCustomer = useMemo(
    () => new Map(usage.map((item) => [item.customerId, item])),
    [usage],
  );
  const totalClicks = usage.reduce((total, item) => total + item.emailLinkClicks, 0);
  const activeCustomers = usage.filter((item) => item.emailLinkClicks > 0).length;

  return (
    <section className="premium-panel mb-6 rounded-xl p-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            Customer analytics
          </p>
          <h2 className="mt-3 text-3xl font-black text-ink">Email engagement</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">
            Track customer profiles, alert preferences, last login, and how many times
            each customer opens emailed stock-analysis links this month.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-72">
          <div className="rounded-lg bg-mint px-4 py-3 ring-1 ring-pine/10">
            <p className="text-xs font-black uppercase tracking-normal text-pine/70">
              Monthly clicks
            </p>
            <p className="mt-1 text-2xl font-black text-pine">{totalClicks}</p>
          </div>
          <div className="rounded-lg bg-sky px-4 py-3 ring-1 ring-ink/5">
            <p className="text-xs font-black uppercase tracking-normal text-ink/55">
              Active users
            </p>
            <p className="mt-1 text-2xl font-black text-ink">{activeCustomers}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 w-full max-w-full overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-normal text-ink/55">
              <th className="py-3 pr-4">Customer</th>
              <th className="py-3 pr-4">Role</th>
              <th className="py-3 pr-4">Risk profile</th>
              <th className="py-3 pr-4">Alerts</th>
              <th className="py-3 pr-4">Monthly link opens</th>
              <th className="py-3 pr-4">Top viewed symbols</th>
              <th className="py-3 pr-4">Last link open</th>
              <th className="py-3 pr-4">Last login</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => {
              const customerUsage = usageByCustomer.get(customer.id);

              return (
                <tr key={customer.id} className="border-b border-line last:border-b-0">
                  <td className="py-4 pr-4">
                    <p className="font-bold text-ink">{customer.fullName || "Unnamed"}</p>
                    <p className="mt-1 text-xs font-semibold text-ink/50">{customer.email}</p>
                  </td>
                  <td className="py-4 pr-4 capitalize">{customer.role}</td>
                  <td className="py-4 pr-4 capitalize">{customer.riskProfile}</td>
                  <td className="py-4 pr-4">
                    {customer.morningAlertsEnabled ? customer.alertChannel : "Off"} at{" "}
                    {customer.alertTime}
                  </td>
                  <td className="py-4 pr-4 font-bold text-pine">
                    {customerUsage?.emailLinkClicks ?? 0}
                  </td>
                  <td className="py-4 pr-4">
                    {customerUsage?.topSymbols.length
                      ? customerUsage.topSymbols.join(", ")
                      : "--"}
                  </td>
                  <td className="py-4 pr-4">{formatDate(customerUsage?.lastEmailClickAt ?? null)}</td>
                  <td className="py-4 pr-4">{formatDate(customer.lastLoginAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
