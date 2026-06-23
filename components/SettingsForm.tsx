"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  getCurrentCustomer,
  updateCurrentCustomer,
  type AccountBudget,
  type AlertChannel,
  type CustomerProfile,
  type InvestingExperience,
  type PositionSizePreference,
  type SetupPreference,
} from "@/lib/customer-store";
import type { RiskProfile } from "@/lib/database.types";

export function SettingsForm() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCustomer(getCurrentCustomer());
    setLoaded(true);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");

    try {
      const next = updateCurrentCustomer({
        accountBudget: String(formData.get("accountBudget") ?? "not_set") as AccountBudget,
        fullName: String(formData.get("fullName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        investingExperience: String(
          formData.get("investingExperience") ?? "beginner",
        ) as InvestingExperience,
        positionSizePreference: String(
          formData.get("positionSizePreference") ?? "small",
        ) as PositionSizePreference,
        riskProfile: String(formData.get("riskProfile") ?? "balanced") as RiskProfile,
        setupPreference: String(formData.get("setupPreference") ?? "balanced") as SetupPreference,
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Settings could not be saved.");
    }
  }

  if (!loaded) {
    return (
      <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
        <p className="text-sm font-bold text-ink">Loading profile...</p>
      </section>
    );
  }

  if (!customer) {
    return (
      <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
        <p className="text-sm font-bold uppercase tracking-normal text-pine">Account required</p>
        <h2 className="mt-3 text-2xl font-black text-ink">Create a profile to save settings</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
          TradePilot is open while we finish the product, but profile preferences need a
          local account so alerts, saved picks, and filters stay attached to you.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-lg bg-ink px-4 py-3 text-center text-sm font-black text-white hover:bg-pine"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-line bg-surface px-4 py-3 text-center text-sm font-bold text-ink hover:border-pine"
          >
            Log in
          </Link>
        </div>
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
        {error ? (
          <p className="mt-4 rounded-md bg-coral/20 px-3 py-2 text-sm font-bold text-ink">
            {error}
          </p>
        ) : null}
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
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            Budget range
            <select
              name="accountBudget"
              defaultValue={customer.accountBudget}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            >
              <option value="not_set">Not set</option>
              <option value="under_1000">Under $1,000</option>
              <option value="1000_5000">$1,000 to $5,000</option>
              <option value="5000_25000">$5,000 to $25,000</option>
              <option value="25000_plus">$25,000+</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Experience
            <select
              name="investingExperience"
              defaultValue={customer.investingExperience}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Position size style
            <select
              name="positionSizePreference"
              defaultValue={customer.positionSizePreference}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            >
              <option value="small">Small and careful</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Larger swings</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Setup preference
            <select
              name="setupPreference"
              defaultValue={customer.setupPreference}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            >
              <option value="steady">Steadier setups</option>
              <option value="balanced">Balanced setups</option>
              <option value="momentum">Momentum setups</option>
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
