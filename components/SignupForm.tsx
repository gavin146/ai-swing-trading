"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  isAdminCustomer,
  rememberAuthenticatedCustomer,
  signupCustomer,
  SWINGFI_ADMIN_EMAIL,
  type AccountBudget,
  type InvestingExperience,
  type PositionSizePreference,
  type SetupPreference,
} from "@/lib/customer-store";
import type { RiskProfile } from "@/lib/database.types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const accountBudget = String(formData.get("accountBudget") ?? "not_set") as AccountBudget;
    const firstName = String(formData.get("firstName") ?? "");
    const lastName = String(formData.get("lastName") ?? "");
    const email = String(formData.get("email") ?? "");
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const investingExperience = String(
      formData.get("investingExperience") ?? "beginner",
    ) as InvestingExperience;
    const password = String(formData.get("password") ?? "");
    const phone = String(formData.get("phone") ?? "");
    const positionSizePreference = String(
      formData.get("positionSizePreference") ?? "small",
    ) as PositionSizePreference;
    const riskProfile = String(formData.get("riskProfile") ?? "balanced") as RiskProfile;
    const setupPreference = String(formData.get("setupPreference") ?? "balanced") as SetupPreference;

    try {
      const supabase = createSupabaseBrowserClient();
      let customer;

      if (supabase) {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
              risk_profile: riskProfile,
            },
          },
        });

        if (authError || !data.user) {
          customer = signupCustomer({
            accountBudget,
            firstName,
            lastName,
            email,
            investingExperience,
            password,
            phone,
            positionSizePreference,
            riskProfile,
            setupPreference,
          });
        } else {
          customer = rememberAuthenticatedCustomer({
            accountBudget,
            authUserId: data.user.id,
            email: data.user.email ?? email,
            fullName,
            investingExperience,
            password,
            phone,
            positionSizePreference,
            riskProfile,
            setupPreference,
          });
        }
      } else {
        customer = signupCustomer({
          accountBudget,
          firstName,
          lastName,
          email,
          investingExperience,
          password,
          phone,
          positionSizePreference,
          riskProfile,
          setupPreference,
        });
      }

      router.push(isAdminCustomer(customer) ? "/admin" : "/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Signup failed.");
      setLoading(false);
    }
  }

  return (
    <section className="w-full max-w-3xl rounded-3xl border border-line/70 bg-white p-6 shadow-[0_24px_80px_rgba(7,20,24,0.08)] sm:p-8">
      <div>
        <p className="text-xs font-black uppercase tracking-normal text-pine">
          Step 1 of 1
        </p>
        <h1 className="mt-3 text-3xl font-black text-ink">Create your investor profile</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          Set up your profile for pre-market stock ideas, email alerts, and
          beginner-friendly trade explanations.
        </p>
        <p className="mt-3 rounded-2xl bg-surface px-3 py-2 text-xs font-bold leading-5 text-ink/60">
          Admin tools unlock for {SWINGFI_ADMIN_EMAIL} and emails approved by an
          existing admin. Everyone else gets the open beta customer experience.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-ink">
          First name
          <input
            name="firstName"
            type="text"
            required
            placeholder="Avery"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Last name
          <input
            name="lastName"
            type="text"
            required
            placeholder="Chen"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
          Email
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
          Phone
          <input
            name="phone"
            type="tel"
            placeholder="+15551234567"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Create a password"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <div className="sm:col-span-2">
          <p className="text-sm font-black uppercase tracking-normal text-pine">
            Pick preferences
          </p>
          <p className="mt-1 text-sm leading-6 text-ink/60">
            SwingFi uses these answers to prioritize the daily list around your risk
            comfort, confidence needs, and account size.
          </p>
        </div>
        <fieldset className="grid gap-3 sm:col-span-2">
          <legend className="text-sm font-bold text-ink">Risk comfort</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["conservative", "Careful", "Fewer ideas, lower risk"],
              ["balanced", "Balanced", "Quality first, still flexible"],
              ["aggressive", "Aggressive", "More volatile opportunities"],
            ].map(([value, label, description]) => (
              <label
                key={value}
                className="rounded-2xl border border-line bg-surface p-4 text-sm transition hover:border-pine"
              >
                <input
                  name="riskProfile"
                  type="radio"
                  value={value}
                  defaultChecked={value === "balanced"}
                className="mr-2 accent-pine"
                />
                <span className="font-black text-ink">{label}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-ink/55">
                  {description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Budget range
          <select
            name="accountBudget"
            defaultValue="not_set"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          >
            <option value="not_set">I will decide later</option>
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
            defaultValue="beginner"
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
            defaultValue="small"
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
            defaultValue="balanced"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          >
            <option value="steady">Steadier setups</option>
            <option value="balanced">Balanced setups</option>
            <option value="momentum">Momentum setups</option>
          </select>
        </label>
        {error ? (
          <p className="rounded-md bg-coral/20 px-3 py-2 text-sm font-bold text-ink sm:col-span-2">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine disabled:cursor-not-allowed disabled:opacity-70 sm:col-span-2"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/65">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-pine">
          Log in
        </Link>
      </p>
    </section>
  );
}
