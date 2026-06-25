"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { ToastNotice, type ToastTone } from "@/components/ToastNotice";
import {
  rememberAuthenticatedCustomer,
  SWINGFI_ADMIN_EMAIL,
  type AccountBudget,
  type InvestingExperience,
  type PositionSizePreference,
  type SetupPreference,
} from "@/lib/customer-store";
import type { RiskProfile } from "@/lib/database.types";

type SignupValues = {
  accountBudget: AccountBudget;
  email: string;
  firstName: string;
  investingExperience: InvestingExperience;
  lastName: string;
  password: string;
  phone: string;
  positionSizePreference: PositionSizePreference;
  riskProfile: RiskProfile;
  setupPreference: SetupPreference;
};

type SignupResponse = {
  customer?: Parameters<typeof rememberAuthenticatedCustomer>[0] & {
    id: string;
    emailVerifiedAt: string | null;
    lastLoginAt: string | null;
    maxRiskScore: number;
    minimumConfidence: number;
    morningAlertsEnabled: boolean;
    role: "admin" | "customer";
    timezone: string;
  };
  error?: string;
  verificationEmailSent?: boolean;
};

type AccountStatusResponse = {
  exists?: boolean | null;
  validEmail?: boolean;
};

type SignupNotice = {
  message: string;
  title?: string;
  tone: ToastTone;
};

const initialValues: SignupValues = {
  accountBudget: "not_set",
  email: "",
  firstName: "",
  investingExperience: "beginner",
  lastName: "",
  password: "",
  phone: "",
  positionSizePreference: "small",
  riskProfile: "balanced",
  setupPreference: "balanced",
};

const steps = [
  "Name",
  "Contact",
  "Risk",
  "Experience",
  "Style",
  "Secure",
] as const;

const riskOptions: Array<[RiskProfile, string, string]> = [
  ["conservative", "Careful", "Lower-risk ideas and cleaner confirmation."],
  ["balanced", "Balanced", "Quality first with room for moderate upside."],
  ["aggressive", "Aggressive", "More volatile setups with more upside potential."],
];

const budgetOptions: Array<[AccountBudget, string, string]> = [
  ["not_set", "Decide later", "Use the app first, then refine sizing."],
  ["under_1000", "Under $1,000", "Keep ideas smaller and more risk-aware."],
  ["1000_5000", "$1k to $5k", "Balanced filtering for early accounts."],
  ["5000_25000", "$5k to $25k", "More room for diversified swing ideas."],
  ["25000_plus", "$25k+", "Show the broadest useful opportunity set."],
];

const experienceOptions: Array<[InvestingExperience, string, string]> = [
  ["beginner", "Beginner", "Explain scores and trade plans in plain English."],
  ["intermediate", "Intermediate", "Keep the guidance, move a little faster."],
  ["advanced", "Advanced", "Prioritize signal depth and decision speed."],
];

const sizeOptions: Array<[PositionSizePreference, string, string]> = [
  ["small", "Small and careful", "Favor tighter risk and easier-to-size ideas."],
  ["moderate", "Moderate", "Balance upside with risk control."],
  ["aggressive", "Larger swings", "Let higher-upside setups into the list."],
];

const setupOptions: Array<[SetupPreference, string, string]> = [
  ["steady", "Steadier setups", "Favor cleaner trends and calmer price action."],
  ["balanced", "Balanced setups", "Mix trend quality, catalysts, and reward/risk."],
  ["momentum", "Momentum setups", "Prioritize stronger upside and price movement."],
];

function ChoiceGrid<T extends string>({
  name,
  onChange,
  options,
  value,
}: {
  name: string;
  onChange: (value: T) => void;
  options: Array<[T, string, string]>;
  value: T;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map(([optionValue, label, description]) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          className={`rounded-2xl border p-4 text-left transition ${
            value === optionValue
              ? "border-ink bg-ink text-white shadow-[0_18px_42px_rgba(7,20,24,0.18)]"
              : "border-line bg-surface text-ink hover:border-pine hover:bg-white"
          }`}
          aria-pressed={value === optionValue}
          aria-label={`${name}: ${label}`}
        >
          <span className="block text-base font-black">{label}</span>
          <span className={`mt-2 block text-sm font-semibold leading-6 ${value === optionValue ? "text-white/64" : "text-ink/58"}`}>
            {description}
          </span>
        </button>
      ))}
    </div>
  );
}

async function getAccountStatus(email: string) {
  const response = await fetch("/api/auth/account-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  return (await response.json().catch(() => ({}))) as AccountStatusResponse;
}

function friendlySignupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("already exists") || lower.includes("already registered")) {
    return "An account already exists for that email. Log in or reset your password instead.";
  }
  if (lower.includes("password")) return message;
  if (lower.includes("email")) return message;

  return message || "Signup failed.";
}

export function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<SignupValues>(initialValues);
  const [notice, setNotice] = useState<SignupNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const progress = Math.round(((step + 1) / steps.length) * 100);
  const fullName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim();

  const stepMeta = useMemo(
    () => [
      {
        eyebrow: "Profile",
        title: "What should we call you?",
        text: "Your dashboard and morning emails should feel personal without getting noisy.",
      },
      {
        eyebrow: "Free trial",
        title: "Start your 30-day free month",
        text: "Use the same email for login, alerts, password resets, and future billing.",
      },
      {
        eyebrow: "Risk fit",
        title: "How much risk feels comfortable?",
        text: "SwingFi uses this to filter the daily ranked list before it reaches your dashboard.",
      },
      {
        eyebrow: "Account fit",
        title: "Tell us where you are starting",
        text: "These answers help keep ideas understandable and sized to your situation.",
      },
      {
        eyebrow: "Trading style",
        title: "What kind of swing setups do you want?",
        text: "You can change these preferences later from settings.",
      },
      {
        eyebrow: "Security",
        title: "Create your password",
        text: "After signup, confirm your email to unlock the dashboard and start using your free trial.",
      },
    ],
    [],
  );

  function update<K extends keyof SignupValues>(key: K, value: SignupValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function showNotice(tone: ToastTone, message: string, title?: string) {
    setNotice({ message, title, tone });
  }

  function validateCurrentStep() {
    if (step === 0 && (!values.firstName.trim() || !values.lastName.trim())) {
      return "Enter your first and last name.";
    }

    if (step === 1 && (!values.email.trim().includes("@"))) {
      return "Enter a valid email address.";
    }

    if (step === 5 && values.password.length < 8) {
      return "Create a password with at least 8 characters.";
    }

    return "";
  }

  async function goNext() {
    const validation = validateCurrentStep();
    if (validation) {
      showNotice("warning", validation, "Quick check");
      return;
    }

    if (step === 1) {
      setLoading(true);
      const status = await getAccountStatus(values.email);
      setLoading(false);

      if (status.validEmail === false) {
        showNotice("warning", "Enter a valid email address.", "Email needed");
        return;
      }

      if (status.exists === true) {
        showNotice(
          "info",
          "An account already exists for that email. Log in or reset your password instead.",
          "Account already exists",
        );
        return;
      }
    }

    setNotice(null);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function handleCreateAccount() {
    const validation = validateCurrentStep();
    if (validation) {
      showNotice("warning", validation, "Quick check");
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          fullName,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as SignupResponse;

      if (!response.ok || payload.error || !payload.customer) {
        throw new Error(payload.error ?? "Signup failed.");
      }

      const customer = rememberAuthenticatedCustomer({
        ...payload.customer,
        password: values.password,
      });

      router.push(`/verify-email?sent=1&email=${encodeURIComponent(customer.email)}`);
    } catch (caught) {
      showNotice("error", friendlySignupError(caught), "Could not create account");
      setLoading(false);
    }
  }

  const current = stepMeta[step];

  return (
    <section className="w-full min-w-0 max-w-4xl overflow-hidden rounded-[2rem] border border-line/70 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
      <div className="grid min-w-0 lg:grid-cols-[290px_1fr]">
        <aside className="min-w-0 overflow-hidden bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-5 text-white sm:p-8">
          <p className="text-xs font-black uppercase tracking-normal text-lime">
            30 days free
          </p>
          <h2 className="mt-3 text-2xl font-black leading-tight sm:mt-4 sm:text-3xl">
            Build your daily stock research profile
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/62 sm:mt-4 sm:leading-7">
            No payment required today. Your trial unlocks rankings, opportunity details,
            saved picks, and morning email links.
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/12 sm:mt-8">
            <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-xs font-bold text-white/50">
            Step {step + 1} of {steps.length}: {steps[step]}
          </p>
          <div className="mt-4 flex gap-1.5 sm:hidden">
            {steps.map((item, index) => (
              <span
                key={item}
                aria-label={item}
                className={`h-2 flex-1 rounded-full ${
                  index <= step ? "bg-lime" : "bg-white/14"
                }`}
              />
            ))}
          </div>
          <div className="mt-8 hidden gap-2 sm:grid">
            {steps.map((item, index) => (
              <div
                key={item}
                className={`rounded-2xl border px-3 py-2 text-sm font-bold ${
                  index === step
                    ? "border-lime bg-lime text-ink"
                    : index < step
                      ? "border-white/16 bg-white/10 text-white"
                      : "border-white/10 text-white/42"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            {current.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-normal text-ink sm:text-4xl">
            {current.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ink/60">
            {current.text}
          </p>

          <div className="mt-8 min-h-[310px]">
            {step === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  First name
                  <input
                    value={values.firstName}
                    onChange={(event) => update("firstName", event.target.value)}
                    autoComplete="given-name"
                    className="rounded-2xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
                    placeholder="Avery"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Last name
                  <input
                    value={values.lastName}
                    onChange={(event) => update("lastName", event.target.value)}
                    autoComplete="family-name"
                    className="rounded-2xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
                    placeholder="Chen"
                  />
                </label>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Email
                  <input
                    value={values.email}
                    onChange={(event) => update("email", event.target.value)}
                    type="email"
                    autoComplete="email"
                    className="rounded-2xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
                    placeholder="you@example.com"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Phone <span className="text-xs font-semibold text-ink/45">Optional</span>
                  <input
                    value={values.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    type="tel"
                    autoComplete="tel"
                    className="rounded-2xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
                    placeholder="+15551234567"
                  />
                </label>
                <div className="rounded-2xl border border-line bg-mint p-4 text-sm font-bold leading-6 text-pine">
                  Your trial starts after signup. We will use email first for morning alerts,
                  and SMS can be added later from settings.
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <ChoiceGrid
                name="Risk comfort"
                value={values.riskProfile}
                options={riskOptions}
                onChange={(value) => update("riskProfile", value)}
              />
            ) : null}

            {step === 3 ? (
              <div className="grid gap-6">
                <div>
                  <p className="mb-3 text-sm font-black text-ink">Account range</p>
                  <ChoiceGrid
                    name="Budget"
                    value={values.accountBudget}
                    options={budgetOptions}
                    onChange={(value) => update("accountBudget", value)}
                  />
                </div>
                <div>
                  <p className="mb-3 text-sm font-black text-ink">Trading experience</p>
                  <ChoiceGrid
                    name="Experience"
                    value={values.investingExperience}
                    options={experienceOptions}
                    onChange={(value) => update("investingExperience", value)}
                  />
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="grid gap-6">
                <div>
                  <p className="mb-3 text-sm font-black text-ink">Position sizing</p>
                  <ChoiceGrid
                    name="Position size"
                    value={values.positionSizePreference}
                    options={sizeOptions}
                    onChange={(value) => update("positionSizePreference", value)}
                  />
                </div>
                <div>
                  <p className="mb-3 text-sm font-black text-ink">Setup preference</p>
                  <ChoiceGrid
                    name="Setup preference"
                    value={values.setupPreference}
                    options={setupOptions}
                    onChange={(value) => update("setupPreference", value)}
                  />
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Password
                  <PasswordField
                    label="password"
                    value={values.password}
                    onChange={(event) => update("password", event.target.value)}
                    autoComplete="new-password"
                    className="rounded-2xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
                    placeholder="Create a password"
                  />
                </label>
                <div className="grid gap-3 rounded-3xl border border-line bg-surface p-4 sm:grid-cols-3">
                  {[
                    ["Trial", "30 days free"],
                    ["Risk", values.riskProfile],
                    ["Email", values.email || "Not set"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                        {label}
                      </p>
                      <p className="mt-1 truncate text-sm font-black capitalize text-ink">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="rounded-2xl bg-surface px-4 py-3 text-xs font-bold leading-5 text-ink/58">
                  Admin tools unlock for {SWINGFI_ADMIN_EMAIL} and emails approved by an
                  existing admin. Admins keep full access when subscriptions are enabled.
                </p>
              </div>
            ) : null}
          </div>

          {notice ? (
            <ToastNotice className="mt-5" tone={notice.tone} title={notice.title}>
              {notice.message}
            </ToastNotice>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setStep((currentStep) => Math.max(0, currentStep - 1));
              }}
              disabled={step === 0 || loading}
              className="rounded-2xl border border-line bg-surface px-5 py-3 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={loading}
                className="rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Checking..." : "Continue"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreateAccount}
                disabled={loading}
                className="rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Creating account..." : "Start free month"}
              </button>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-ink/65">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-pine">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
