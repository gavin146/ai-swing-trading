"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  getCurrentCustomer,
  updateCurrentCustomer,
  type AlertChannel,
  type CustomerProfile,
} from "@/lib/customer-store";
import type { RiskProfile } from "@/lib/database.types";

export function SettingsForm() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCustomer(getCurrentCustomer());
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const next = updateCurrentCustomer({
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      riskProfile: String(formData.get("riskProfile") ?? "balanced") as RiskProfile,
      minimumConfidence: Number(formData.get("minimumConfidence") ?? 70),
      maxRiskScore: Number(formData.get("maxRiskScore") ?? 65),
      morningAlertsEnabled: formData.get("morningAlertsEnabled") === "on",
      alertChannel: String(formData.get("alertChannel") ?? "sms") as AlertChannel,
      alertTime: String(formData.get("alertTime") ?? "07:30"),
      timezone: String(formData.get("timezone") ?? "America/Chicago"),
    });

    setCustomer(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  if (!customer) {
    return (
      <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
        <p className="text-sm font-bold text-ink">Loading profile...</p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
      <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-ink">Profile</h2>
          {saved ? (
            <span className="rounded-md bg-mint px-3 py-2 text-sm font-bold text-pine">
              Saved
            </span>
          ) : null}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-ink">
            Display name
            <input
              name="fullName"
              type="text"
              defaultValue={customer.fullName}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Email
            <input
              name="email"
              type="email"
              defaultValue={customer.email}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Phone
            <input
              name="phone"
              type="tel"
              defaultValue={customer.phone}
              placeholder="+15551234567"
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Timezone
            <input
              name="timezone"
              type="text"
              defaultValue={customer.timezone}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Opportunity filters</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-ink">
            Risk tolerance
            <select
              name="riskProfile"
              defaultValue={customer.riskProfile}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Minimum confidence
            <input
              name="minimumConfidence"
              type="number"
              min="0"
              max="100"
              defaultValue={customer.minimumConfidence}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Max risk score
            <input
              name="maxRiskScore"
              type="number"
              min="0"
              max="100"
              defaultValue={customer.maxRiskScore}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <h2 className="text-xl font-bold text-ink">Morning alerts</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              TradePilot runs the ranking check before the market opens, then emails
              your daily stock analysis link. 8:30 AM Eastern gives you time to review
              before the 9:30 AM open.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-3 self-start rounded-md border border-line bg-surface px-4 py-3 text-sm font-bold text-ink">
            <input
              name="morningAlertsEnabled"
              type="checkbox"
              defaultChecked={customer.morningAlertsEnabled}
              className="h-4 w-4 accent-pine"
            />
            Enabled
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-ink">
            Channel
            <select
              name="alertChannel"
              defaultValue={customer.alertChannel}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            >
              <option value="email">Email</option>
              <option value="none">None</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Alert time
            <input
              name="alertTime"
              type="time"
              defaultValue={customer.alertTime}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className="rounded-md bg-pine px-4 py-3 text-sm font-bold text-white transition hover:bg-ink"
          >
            Save settings
          </button>
        </div>

        <p className="mt-4 rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink/65">
          Customers do not manually run the agent. Admins schedule the pre-market job,
          and enabled customers receive the email automatically.
        </p>
      </section>
    </form>
  );
}
