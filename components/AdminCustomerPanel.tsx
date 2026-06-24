"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminHeaders } from "@/lib/admin-client";
import type { CustomerProfile } from "@/lib/customer-store";
import type { CustomerUsageSummary } from "@/lib/customer-analytics";

type CustomerDataSource = "supabase" | "empty";

function formatDate(value: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBudget(value: CustomerProfile["accountBudget"]) {
  const labels: Record<CustomerProfile["accountBudget"], string> = {
    "1000_5000": "$1k-$5k",
    "25000_plus": "$25k+",
    "5000_25000": "$5k-$25k",
    not_set: "Not set",
    under_1000: "Under $1k",
  };

  return labels[value] ?? "Not set";
}

export function AdminCustomerPanel() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [usage, setUsage] = useState<CustomerUsageSummary[]>([]);
  const [dataSource, setDataSource] = useState<CustomerDataSource>("empty");
  const [status, setStatus] = useState("Loading customer analytics...");
  const [trackingWarning, setTrackingWarning] = useState<string | null>(null);

  useEffect(() => {
    const refreshFromServer = async () => {
      try {
        const response = await fetch("/api/admin/customers", {
          headers: getAdminHeaders(),
        });
        const payload = (await response.json()) as {
          customers?: CustomerProfile[];
          error?: string;
          reason?: string;
          source?: CustomerDataSource;
          trackingWarning?: string | null;
          usage?: CustomerUsageSummary[];
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load customer analytics.");
        }

        if (payload.source === "supabase") {
          setCustomers(payload.customers ?? []);
          setUsage(payload.usage ?? []);
          setDataSource("supabase");
          setTrackingWarning(payload.trackingWarning ?? null);
          setStatus("Showing live Supabase customer and email-link analytics.");
          return;
        }

        setCustomers([]);
        setUsage([]);
        setDataSource("empty");
        setTrackingWarning(null);
        setStatus(
          payload.reason
            ? `No live customer analytics are available: ${payload.reason}`
            : "No live customer analytics are available.",
        );
      } catch (error) {
        setCustomers([]);
        setUsage([]);
        setDataSource("empty");
        setTrackingWarning(null);
        setStatus(error instanceof Error ? error.message : "Server data unavailable.");
      }
    };

    void refreshFromServer();
  }, []);

  const usageByCustomer = useMemo(
    () => new Map(usage.map((item) => [item.customerId, item])),
    [usage],
  );
  const totalClicks = usage.reduce((total, item) => total + item.totalLinkClicks, 0);
  const totalEmailOpens = usage.reduce((total, item) => total + item.emailOpens, 0);
  const totalEmailsSent = usage.reduce((total, item) => total + item.emailsSent, 0);
  const totalSmsSent = usage.reduce((total, item) => total + item.smsSent, 0);
  const activeCustomers = usage.filter((item) => item.totalLinkClicks > 0).length;
  const alertCustomers = customers.filter((customer) => customer.morningAlertsEnabled).length;
  const adminCustomers = customers.filter((customer) => customer.role === "admin").length;
  const customersWithoutPreferences = customers.filter(
    (customer) =>
      customer.accountBudget === "not_set" || customer.investingExperience === "beginner",
  ).length;

  return (
    <section className="premium-panel mb-6 rounded-3xl p-5 sm:p-6">
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
          <p
            className={`mt-3 inline-flex rounded-md px-3 py-2 text-sm font-bold ${
              dataSource === "supabase" ? "bg-mint text-pine" : "bg-coral/15 text-ink/70"
            }`}
          >
            {status}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-72">
          <div className="rounded-2xl bg-mint px-4 py-3 ring-1 ring-pine/10">
            <p className="text-xs font-black uppercase tracking-normal text-pine/70">
              Monthly clicks
            </p>
            <p className="mt-1 text-2xl font-black text-pine">{totalClicks}</p>
          </div>
          <div className="rounded-2xl bg-sky px-4 py-3 ring-1 ring-ink/5">
            <p className="text-xs font-black uppercase tracking-normal text-ink/55">
              Active users
            </p>
            <p className="mt-1 text-2xl font-black text-ink">{activeCustomers}</p>
          </div>
        </div>
      </div>

      {trackingWarning ? (
        <p className="mt-4 rounded-2xl bg-amber/12 px-4 py-3 text-sm font-bold leading-6 text-ink/70">
          {trackingWarning}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total customers", customers.length, "Profiles in Supabase"],
          ["Morning alerts", alertCustomers, "Users receiving daily alerts"],
          ["Admin users", adminCustomers, "Accounts with full access"],
          ["Email opens", totalEmailOpens, "Best-effort open tracking"],
        ].map(([label, value, description]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-black uppercase tracking-normal text-ink/45">
              {label}
            </p>
            <p className="mt-2 text-3xl font-black text-ink">{value}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-ink/52">
              {description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white/78 p-4">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black text-ink">Customer engagement loop</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/58">
              Morning alerts create sent records, email pixels estimate opens, and
              tracked links show who clicked through to analysis. SMS does not have a
              true open event, so texts are measured by sends and clicks.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-surface px-3 py-3">
              <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                Sent
              </p>
              <p className="mt-1 text-xl font-black text-ink">
                {totalEmailsSent + totalSmsSent}
              </p>
            </div>
            <div className="rounded-xl bg-surface px-3 py-3">
              <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                Open rate
              </p>
              <p className="mt-1 text-xl font-black text-ink">
                {totalEmailsSent ? Math.round((totalEmailOpens / totalEmailsSent) * 100) : 0}%
              </p>
            </div>
            <div className="rounded-xl bg-surface px-3 py-3">
              <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                Click rate
              </p>
              <p className="mt-1 text-xl font-black text-ink">
                {totalEmailsSent + totalSmsSent
                  ? Math.round((totalClicks / (totalEmailsSent + totalSmsSent)) * 100)
                  : 0}
                %
              </p>
            </div>
            <div className="rounded-xl bg-surface px-3 py-3">
              <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                Needs profile
              </p>
              <p className="mt-1 text-xl font-black text-ink">
                {customersWithoutPreferences}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 w-full max-w-full overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-normal text-ink/55">
              <th className="py-3 pr-4">Customer</th>
              <th className="py-3 pr-4">Role</th>
              <th className="py-3 pr-4">Risk profile</th>
              <th className="py-3 pr-4">Preferences</th>
              <th className="py-3 pr-4">Alerts</th>
              <th className="py-3 pr-4">Sent</th>
              <th className="py-3 pr-4">Email opens</th>
              <th className="py-3 pr-4">Link clicks</th>
              <th className="py-3 pr-4">Top viewed symbols</th>
              <th className="py-3 pr-4">Last engagement</th>
              <th className="py-3 pr-4">Last login</th>
            </tr>
          </thead>
          <tbody>
            {customers.length > 0 ? customers.map((customer) => {
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
                    <p className="font-semibold capitalize text-ink">
                      {customer.setupPreference} / {customer.positionSizePreference}
                    </p>
                    <p className="mt-1 text-xs font-semibold capitalize text-ink/50">
                      {customer.investingExperience}, {formatBudget(customer.accountBudget)}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    {customer.morningAlertsEnabled ? customer.alertChannel : "Off"} at{" "}
                    {customer.alertTime}
                  </td>
                  <td className="py-4 pr-4">
                    <p className="font-bold text-ink">
                      E {customerUsage?.emailsSent ?? 0} / SMS {customerUsage?.smsSent ?? 0}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    <p className="font-bold text-pine">{customerUsage?.emailOpens ?? 0}</p>
                    <p className="mt-1 text-xs font-semibold text-ink/50">
                      {formatDate(customerUsage?.lastEmailOpenAt ?? null)}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    <p className="font-bold text-pine">
                      {customerUsage?.totalLinkClicks ?? 0}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-ink/50">
                      E {customerUsage?.emailLinkClicks ?? 0} / SMS {customerUsage?.smsLinkClicks ?? 0}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    {customerUsage?.topSymbols.length
                      ? customerUsage.topSymbols.join(", ")
                      : "--"}
                  </td>
                  <td className="py-4 pr-4">{formatDate(customerUsage?.lastLinkClickAt ?? null)}</td>
                  <td className="py-4 pr-4">{formatDate(customer.lastLoginAt)}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={11} className="py-8 pr-4">
                  <div className="rounded-lg border border-line bg-surface p-5">
                    <p className="text-sm font-black uppercase tracking-normal text-pine">
                      No live customers found
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ink/60">
                      Customer profiles and email-link usage will appear after Supabase
                      auth/database are connected and real users exist.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
