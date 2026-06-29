"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BillingPortalButton } from "@/components/BillingPortalButton";
import {
  getAccessState,
  getCurrentCustomer,
  getCustomerPlanLabel,
  restoreAuthenticatedCustomerSession,
  updateCurrentCustomer,
  type AccountBudget,
  type AlertChannel,
  type CustomerProfile,
  type InvestingExperience,
  type PositionSizePreference,
  type SetupPreference,
} from "@/lib/customer-store";
import { brokerageOptions, type PreferredBrokerage } from "@/lib/brokerages";
import { ToastNotice } from "@/components/ToastNotice";
import type { RiskProfile } from "@/lib/database.types";

type ChoiceOption<T extends string> = {
  description: string;
  label: string;
  value: T;
};

type SettingsChoices = {
  accountBudget: AccountBudget;
  alertChannel: AlertChannel;
  investingExperience: InvestingExperience;
  positionSizePreference: PositionSizePreference;
  preferredBrokerage: PreferredBrokerage;
  riskProfile: RiskProfile;
  setupPreference: SetupPreference;
};

const riskOptions: Array<ChoiceOption<RiskProfile>> = [
  {
    description: "Prioritize lower volatility, higher confidence, and tighter risk filters.",
    label: "Careful",
    value: "conservative",
  },
  {
    description: "Balance quality, upside, and manageable downside for most swing trades.",
    label: "Balanced",
    value: "balanced",
  },
  {
    description: "Allow more volatile setups when upside and momentum look stronger.",
    label: "Growth",
    value: "aggressive",
  },
];

const budgetOptions: Array<ChoiceOption<AccountBudget>> = [
  {
    description: "Keep recommendations broad until you set a range.",
    label: "Not set",
    value: "not_set",
  },
  {
    description: "Favor lower risk and smaller position sizing.",
    label: "Under $1k",
    value: "under_1000",
  },
  {
    description: "Show balanced setups that fit newer accounts.",
    label: "$1k-$5k",
    value: "1000_5000",
  },
  {
    description: "Allow a wider mix of quality and momentum.",
    label: "$5k-$25k",
    value: "5000_25000",
  },
  {
    description: "Use the full ranked list without small-account filtering.",
    label: "$25k+",
    value: "25000_plus",
  },
];

const experienceOptions: Array<ChoiceOption<InvestingExperience>> = [
  {
    description: "Show more guidance and favor easier-to-understand setups.",
    label: "Beginner",
    value: "beginner",
  },
  {
    description: "Balance guidance with a wider range of opportunities.",
    label: "Intermediate",
    value: "intermediate",
  },
  {
    description: "Let higher-conviction, higher-volatility ideas surface when justified.",
    label: "Advanced",
    value: "advanced",
  },
];

const positionSizeOptions: Array<ChoiceOption<PositionSizePreference>> = [
  {
    description: "Prefer smaller, more controlled setups.",
    label: "Small",
    value: "small",
  },
  {
    description: "Use a balanced sizing assumption.",
    label: "Moderate",
    value: "moderate",
  },
  {
    description: "Allow larger swings when risk/reward supports it.",
    label: "Larger",
    value: "aggressive",
  },
];

const setupOptions: Array<ChoiceOption<SetupPreference>> = [
  {
    description: "Favor steadier setups with cleaner confirmation.",
    label: "Steadier",
    value: "steady",
  },
  {
    description: "Mix steady setups with momentum opportunities.",
    label: "Balanced",
    value: "balanced",
  },
  {
    description: "Favor stronger trend and catalyst setups.",
    label: "Momentum",
    value: "momentum",
  },
];

const alertChannelOptions: Array<ChoiceOption<AlertChannel>> = [
  {
    description: "Send the branded morning market brief to your inbox.",
    label: "Email",
    value: "email",
  },
  {
    description: "Text the morning account alert and dashboard link to your phone.",
    label: "SMS",
    value: "sms",
  },
  {
    description: "Keep alerts paused while your preferences stay saved.",
    label: "Off",
    value: "none",
  },
];

function getChoicesFromCustomer(customer: CustomerProfile): SettingsChoices {
  return {
    accountBudget: customer.accountBudget,
    alertChannel: customer.alertChannel,
    investingExperience: customer.investingExperience,
    positionSizePreference: customer.positionSizePreference,
    preferredBrokerage: customer.preferredBrokerage,
    riskProfile: customer.riskProfile,
    setupPreference: customer.setupPreference,
  };
}

function ChoiceCards<T extends string>({
  name,
  onChange,
  options,
  value,
}: {
  name: string;
  onChange: (value: T) => void;
  options: Array<ChoiceOption<T>>;
  value: T;
}) {
  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-2xl border p-4 text-left transition ${
                selected
                  ? "border-pine/30 bg-mint shadow-[0_16px_40px_rgba(27,115,102,0.10)]"
                  : "border-line bg-surface hover:border-pine/30 hover:bg-white"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-black text-ink">{option.label}</span>
                <span
                  className={`h-3 w-3 rounded-full border ${
                    selected ? "border-pine bg-pine" : "border-ink/20 bg-white"
                  }`}
                />
              </span>
              <span className="mt-2 block text-xs font-semibold leading-5 text-ink/58">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsForm() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [choices, setChoices] = useState<SettingsChoices | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCustomer(getCurrentCustomer());
    restoreAuthenticatedCustomerSession()
      .then(setCustomer)
      .catch(() => setCustomer(getCurrentCustomer()))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (customer) setChoices(getChoicesFromCustomer(customer));
  }, [customer]);

  function updateChoice<K extends keyof SettingsChoices>(key: K, value: SettingsChoices[K]) {
    setChoices((current) => ({
      ...(current ?? (customer ? getChoicesFromCustomer(customer) : ({} as SettingsChoices))),
      [key]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");

    try {
      const nextAlertChannel = String(formData.get("alertChannel") ?? "email") as AlertChannel;
      const nextPhone = String(formData.get("phone") ?? "").trim();

      if (nextAlertChannel === "sms" && !nextPhone) {
        throw new Error("Add a phone number before enabling SMS alerts.");
      }

      const next = updateCurrentCustomer({
        accountBudget: String(formData.get("accountBudget") ?? "not_set") as AccountBudget,
        fullName: String(formData.get("fullName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: nextPhone,
        preferredBrokerage: String(
          formData.get("preferredBrokerage") ?? "none",
        ) as PreferredBrokerage,
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
        alertChannel: nextAlertChannel,
        alertTime: String(formData.get("alertTime") ?? "08:30"),
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
      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_20px_70px_rgba(7,20,24,0.07)]">
        <p className="text-sm font-bold text-ink">Loading profile...</p>
      </section>
    );
  }

  if (!customer) {
    return (
      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_20px_70px_rgba(7,20,24,0.07)]">
        <p className="text-sm font-bold uppercase tracking-normal text-pine">Account required</p>
        <h2 className="mt-3 text-2xl font-black text-ink">Create a profile to save settings</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
          Create a SwingFi account to start a 30-day trial, save your trading
          preferences, and keep alerts, saved picks, and filters attached to your profile.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white hover:bg-pine"
          >
            Create account
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

  const access = getAccessState(customer);
  const activeChoices = choices ?? getChoicesFromCustomer(customer);
  const planLabel = getCustomerPlanLabel(customer);

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_20px_70px_rgba(7,20,24,0.07)]">
        <p className="text-sm font-bold uppercase tracking-normal text-pine">
          Access
        </p>
        <h2 className="mt-3 text-2xl font-black text-ink">
          {access.isAdmin
            ? "Admin account with full access"
            : !access.isEmailVerified
              ? "Email confirmation required"
            : access.isTrialActive
              ? `${planLabel}: ${access.trialDaysRemaining} days remaining`
            : access.isSubscriptionActive
              ? `${planLabel} active`
              : "Trial ended"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
          {!access.isEmailVerified
            ? "Confirm your email address to unlock stock rankings, opportunity details, saved picks, and morning research links."
            : access.canViewAnalysis
            ? `Your ${planLabel.toLowerCase()} can access stock rankings, opportunity details, saved picks, portfolio tracking, and morning email links.`
            : "Stock analysis is locked until a subscription is active. Your profile and settings are still saved."}
        </p>
        {!access.isEmailVerified ? (
          <Link
            href={`/verify-email?sent=1&email=${encodeURIComponent(customer.email)}`}
            className="mt-5 inline-flex rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white transition hover:bg-pine"
          >
            Confirm or resend email
          </Link>
        ) : null}
      </section>
      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_20px_70px_rgba(7,20,24,0.07)]">
        <p className="text-sm font-bold uppercase tracking-normal text-pine">
          Billing
        </p>
        <h2 className="mt-3 text-2xl font-black text-ink">
          {access.isAdmin
            ? "Admin accounts have full access"
            : access.isSubscriptionActive
              ? `${planLabel} subscription`
              : access.isTrialActive
                ? "Free trial access"
                : "Choose a plan to unlock analysis"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/60">
          {access.isAdmin
            ? "Admins bypass subscription limits for operations, QA, and customer support."
            : access.isSubscriptionActive
              ? "Manage payment method, invoices, cancellation, and renewal details through Stripe's secure customer portal."
              : access.isTrialActive
                ? "Your free trial is active. You can compare plans anytime before paid billing begins."
                : "Your profile is saved, but stock analysis requires an active plan after the free trial."}
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {access.isSubscriptionActive ? (
            <BillingPortalButton stripeCustomerId={customer.stripeCustomerId} />
          ) : null}
          {!access.isAdmin ? (
            <Link
              href="/pricing"
              className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white transition hover:bg-pine"
            >
              Compare plans
            </Link>
          ) : null}
        </div>
        <p className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-xs font-semibold leading-5 text-ink/56">
          Subscription checkout and billing are handled by Stripe. SwingFi never stores
          card numbers.
        </p>
      </section>
      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_20px_70px_rgba(7,20,24,0.07)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-ink">Profile</h2>
          {saved ? (
            <span className="rounded-md bg-mint px-3 py-2 text-sm font-bold text-pine">
              Saved
            </span>
          ) : null}
        </div>
        {error ? (
          <ToastNotice className="mt-4" tone="error" title="Settings not saved">
            {error}
          </ToastNotice>
        ) : null}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-ink">
            Display name
            <input
              name="fullName"
              type="text"
              defaultValue={customer.fullName}
              className="rounded-xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Email
            <input
              name="email"
              type="email"
              defaultValue={customer.email}
              className="rounded-xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Phone
            <input
              name="phone"
              type="tel"
              defaultValue={customer.phone}
              placeholder="+15551234567"
              className="rounded-xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Timezone
            <input
              name="timezone"
              type="text"
              defaultValue={customer.timezone}
              className="rounded-xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_20px_70px_rgba(7,20,24,0.07)]">
        <h2 className="text-xl font-bold text-ink">Brokerage handoff</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/60">
          Choose the institution SwingFi should prioritize when you open a ranked
          opportunity. SwingFi never stores brokerage usernames, passwords, or account
          credentials. Your browser or password manager handles login after the handoff.
        </p>
        <div className="mt-5">
          <ChoiceCards
            name="preferredBrokerage"
            onChange={(value) => updateChoice("preferredBrokerage", value)}
            options={brokerageOptions}
            value={activeChoices.preferredBrokerage}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_20px_70px_rgba(7,20,24,0.07)]">
        <h2 className="text-xl font-bold text-ink">Opportunity filters</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/60">
          These answers personalize which ranked opportunities reach your dashboard.
          They do not change the market score; they help SwingFi show ideas that better
          match your confidence needs, risk comfort, account range, and trading style.
        </p>
        <div className="mt-6 grid gap-6">
          <div className="grid gap-3">
            <p className="text-sm font-black text-ink">Risk tolerance</p>
            <ChoiceCards
              name="riskProfile"
              onChange={(value) => updateChoice("riskProfile", value)}
              options={riskOptions}
              value={activeChoices.riskProfile}
            />
          </div>
          <div className="grid gap-3">
            <p className="text-sm font-black text-ink">Budget range</p>
            <ChoiceCards
              name="accountBudget"
              onChange={(value) => updateChoice("accountBudget", value)}
              options={budgetOptions}
              value={activeChoices.accountBudget}
            />
          </div>
          <div className="grid gap-3">
            <p className="text-sm font-black text-ink">Experience level</p>
            <ChoiceCards
              name="investingExperience"
              onChange={(value) => updateChoice("investingExperience", value)}
              options={experienceOptions}
              value={activeChoices.investingExperience}
            />
          </div>
          <div className="grid gap-3">
            <p className="text-sm font-black text-ink">Position size style</p>
            <ChoiceCards
              name="positionSizePreference"
              onChange={(value) => updateChoice("positionSizePreference", value)}
              options={positionSizeOptions}
              value={activeChoices.positionSizePreference}
            />
          </div>
          <div className="grid gap-3">
            <p className="text-sm font-black text-ink">Setup preference</p>
            <ChoiceCards
              name="setupPreference"
              onChange={(value) => updateChoice("setupPreference", value)}
              options={setupOptions}
              value={activeChoices.setupPreference}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-ink">
            Minimum confidence
            <input
              name="minimumConfidence"
              type="number"
              min="0"
              max="100"
              defaultValue={customer.minimumConfidence}
              className="rounded-xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
            <span className="text-xs font-semibold leading-5 text-ink/50">
              Higher means fewer ideas, but stronger data agreement.
            </span>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Max risk score
            <input
              name="maxRiskScore"
              type="number"
              min="0"
              max="100"
              defaultValue={customer.maxRiskScore}
              className="rounded-xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
            <span className="text-xs font-semibold leading-5 text-ink/50">
              Lower means calmer setups; higher allows more volatile opportunities.
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_20px_70px_rgba(7,20,24,0.07)]">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <h2 className="text-xl font-bold text-ink">Morning alerts</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              SwingFi runs the ranking check before the market opens, then emails
              your daily stock analysis link. 8:30 AM Eastern gives you time to review
              before the 9:30 AM open.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-3 self-start rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink">
            <input
              name="morningAlertsEnabled"
              type="checkbox"
              defaultChecked={customer.morningAlertsEnabled}
              className="h-4 w-4 accent-pine"
            />
            Enabled
          </label>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_240px]">
          <div className="grid gap-3">
            <p className="text-sm font-black text-ink">Delivery channel</p>
            <ChoiceCards
              name="alertChannel"
              onChange={(value) => updateChoice("alertChannel", value)}
              options={alertChannelOptions}
              value={activeChoices.alertChannel}
            />
            {activeChoices.alertChannel === "sms" ? (
              <div className="rounded-2xl border border-line bg-mint p-4 text-xs font-semibold leading-5 text-pine">
                By choosing SMS and saving settings, you consent to receive SwingFi
                account alerts and daily trade-research notifications at the phone
                number on your profile. Message frequency varies, usually one pre-market
                alert per trading day. Message and data rates may apply. Reply STOP to
                unsubscribe or HELP for help.
              </div>
            ) : null}
          </div>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Alert time
            <input
              name="alertTime"
              type="time"
              defaultValue={customer.alertTime}
              className="rounded-xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className="rounded-2xl bg-pine px-4 py-3 text-sm font-bold text-white transition hover:bg-ink"
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
