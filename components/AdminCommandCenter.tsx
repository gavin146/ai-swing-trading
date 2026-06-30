"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminHeaders } from "@/lib/admin-client";
import type { CustomerProfile } from "@/lib/customer-store";
import type { CustomerUsageSummary } from "@/lib/customer-analytics";
import type { OpportunityRow } from "@/lib/database.types";
import type { OpportunityDataSource } from "@/lib/repositories/opportunities";

type AdminDestination =
  | "operations"
  | "backtesting"
  | "accuracy"
  | "access"
  | "communications"
  | "customers"
  | "opportunities";

type StatusPayload = {
  adminProtected: boolean;
  cronProtected: boolean;
  vercelCronConfigured: boolean;
  predictionEvaluationCronConfigured: boolean;
  dailyRankingsScheduleUtc: string;
  morningAlertsScheduleUtc: string;
  predictionEvaluationScheduleUtc: string;
  emailReady: boolean;
  openAiReady: boolean;
  stripeReady: boolean;
  stripeCheckoutEnabled: boolean;
  stripeMode: string;
  stripePortalConfigured: boolean;
  stripeReason: string;
  stripeWebhookConfigured: boolean;
  twilioReady: boolean;
  supabaseReady: boolean;
  supabaseAdminReady: boolean;
  livePersistenceReady: boolean;
  liveDataMissing: boolean;
  marketDataReady: boolean;
  macroDataReady: boolean;
  blsReady: boolean;
  emailFrom: string;
  emailProvider: string;
  emailReason: string | null;
};

type AdminCommandCenterProps = {
  onNavigate: (destination: AdminDestination) => void;
};

type ActivityItem = {
  description: string;
  id: string;
  meta?: string;
  status: "good" | "warn" | "bad" | "neutral";
  timestamp: string;
  title: string;
  type: "agent" | "email" | "click" | "backtest" | "error";
};

const requiredChecks: Array<[keyof StatusPayload, string]> = [
  ["adminProtected", "Admin secret"],
  ["cronProtected", "Cron secret"],
  ["emailReady", "Email"],
  ["openAiReady", "OpenAI"],
  ["supabaseAdminReady", "Supabase writes"],
  ["marketDataReady", "FMP market data"],
  ["macroDataReady", "FRED macro"],
  ["stripeReady", "Stripe keys"],
  ["stripeWebhookConfigured", "Stripe webhook"],
  ["stripePortalConfigured", "Stripe billing portal"],
  ["stripeCheckoutEnabled", "Stripe checkout"],
];

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function activityTone(status: ActivityItem["status"]) {
  if (status === "good") return "border-pine/25 bg-mint text-pine";
  if (status === "warn") return "border-amber/30 bg-amber/12 text-ink";
  if (status === "bad") return "border-coral/25 bg-coral/10 text-coral";
  return "border-line bg-surface text-ink/62";
}

function activityLabel(type: ActivityItem["type"]) {
  return {
    agent: "Run",
    backtest: "Test",
    click: "Click",
    email: "Send",
    error: "Alert",
  }[type];
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="premium-panel min-w-0 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-normal text-pine">
            Unified activity feed
          </p>
          <h3 className="mt-2 text-2xl font-black text-ink">
            Agent, email, customer, and backtest activity
          </h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/60">
            This ties the major admin signals together so you can quickly see what
            ran, what was sent, what customers clicked, what backtesting learned,
            and whether any API or workflow failed.
          </p>
        </div>
        <span className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-black text-ink">
          {items.length} recent events
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[78px_1fr_auto] sm:items-center"
            >
              <div className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${activityTone(item.status)}`}>
                {activityLabel(item.type)}
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-sm font-black text-ink">{item.title}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-ink/58">
                  {item.description}
                </p>
                {item.meta ? (
                  <p className="mt-1 text-xs font-bold text-ink/42">{item.meta}</p>
                ) : null}
              </div>
              <p className="text-xs font-bold text-ink/45 sm:text-right">
                {formatDate(item.timestamp)}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-black text-ink">No activity loaded yet</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-ink/55">
              Once the agent, alert sender, click tracking, or backtests run, this
              area becomes the admin timeline.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function HealthCard({
  label,
  status,
  value,
}: {
  label: string;
  status: "good" | "warn" | "bad";
  value: string;
}) {
  const classes = {
    bad: "border-coral/25 bg-coral/10 text-coral",
    good: "border-pine/20 bg-mint text-pine",
    warn: "border-amber/30 bg-amber/12 text-ink",
  };

  return (
    <div className={`min-w-0 rounded-2xl border px-4 py-3 ${classes[status]}`}>
      <p className="text-xs font-black uppercase tracking-normal opacity-70">{label}</p>
      <p className="mt-2 break-words text-2xl font-black">{value}</p>
    </div>
  );
}

function ChecklistCard({
  detail,
  label,
  ready,
  required = false,
}: {
  detail: string;
  label: string;
  ready: boolean;
  required?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        ready
          ? "border-pine/20 bg-mint"
          : required
            ? "border-coral/25 bg-coral/10"
            : "border-amber/30 bg-amber/[0.16]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-black text-ink">{label}</p>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-normal ${
            ready
              ? "bg-white text-pine ring-1 ring-pine/20"
              : required
                ? "bg-white text-coral ring-1 ring-coral/20"
                : "bg-white text-ink/60 ring-1 ring-line"
          }`}
        >
          {ready ? "Ready" : required ? "Required" : "Improve"}
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-ink/58">{detail}</p>
    </div>
  );
}

export function AdminCommandCenter({ onNavigate }: AdminCommandCenterProps) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [usage, setUsage] = useState<CustomerUsageSummary[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [opportunitySource, setOpportunitySource] = useState<OpportunityDataSource>("empty");
  const [loadingMessage, setLoadingMessage] = useState("Loading command center...");
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);

  useEffect(() => {
    async function loadOverview() {
      const adminHeaders = await getAdminHeaders();
      const warnings: string[] = [];
      const readJson = async <T,>(response: Response, label: string) => {
        const payload = (await response.json().catch(() => ({}))) as T & {
          error?: string;
          reason?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? payload.reason ?? `${label} could not be loaded.`);
        }

        return payload;
      };
      const [statusResult, customerResult, opportunityResult, activityResult] =
        await Promise.allSettled([
          fetch("/api/admin/status", { headers: adminHeaders }).then((response) =>
            readJson<StatusPayload>(response, "Admin status"),
          ),
          fetch("/api/admin/customers", { headers: adminHeaders }).then((response) =>
            readJson<{
              customers?: CustomerProfile[];
              usage?: CustomerUsageSummary[];
            }>(response, "Customer analytics"),
          ),
          fetch("/api/opportunities", { headers: adminHeaders }).then((response) =>
            readJson<{
              rows?: OpportunityRow[];
              source?: OpportunityDataSource;
            }>(response, "Opportunity data"),
          ),
          fetch("/api/admin/activity", { headers: adminHeaders }).then((response) =>
            readJson<{
              items?: ActivityItem[];
            }>(response, "Activity feed"),
          ),
        ]);

      if (statusResult.status === "fulfilled") {
        setStatus(statusResult.value);
      } else {
        warnings.push(statusResult.reason instanceof Error ? statusResult.reason.message : "Admin status could not be loaded.");
      }

      if (customerResult.status === "fulfilled") {
        setCustomers(customerResult.value.customers ?? []);
        setUsage(customerResult.value.usage ?? []);
      } else {
        warnings.push(customerResult.reason instanceof Error ? customerResult.reason.message : "Customer analytics could not be loaded.");
        setCustomers([]);
        setUsage([]);
      }

      if (opportunityResult.status === "fulfilled") {
        setOpportunities(opportunityResult.value.rows ?? []);
        setOpportunitySource(opportunityResult.value.source ?? "empty");
      } else {
        warnings.push(opportunityResult.reason instanceof Error ? opportunityResult.reason.message : "Opportunity data could not be loaded.");
        setOpportunities([]);
        setOpportunitySource("empty");
      }

      if (activityResult.status === "fulfilled") {
        setActivity(activityResult.value.items ?? []);
      } else {
        warnings.push(activityResult.reason instanceof Error ? activityResult.reason.message : "Activity feed could not be loaded.");
        setActivity([]);
      }

      setLoadWarnings(warnings);
      setLoadingMessage(
        warnings.length
          ? `Command center loaded with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`
          : "Live admin overview loaded.",
      );
    }

    loadOverview().catch((error) => {
      setLoadWarnings([error instanceof Error ? error.message : "Admin command center could not be loaded."]);
      setLoadingMessage("Admin command center could not be loaded.");
    });
  }, []);

  const missingChecks = useMemo(
    () =>
      status
        ? requiredChecks
            .filter(([key]) => !status?.[key])
            .map(([, label]) => label)
        : [],
    [status],
  );
  const isLoading = !status;
  const monthlyClicks = usage.reduce((total, item) => total + item.totalLinkClicks, 0);
  const activeCustomers = usage.filter((item) => item.totalLinkClicks > 0).length;
  const latestOpportunity = opportunities
    .map((item) => item.created_at)
    .sort()
    .at(-1);
  const topSaved = opportunities.filter((item) => item.score >= 75).length;
  const apiReadyCount = status ? requiredChecks.length - missingChecks.length : 0;
  const apiHealth = status ? Math.round((apiReadyCount / requiredChecks.length) * 100) : 0;
  const qualityGateChecks = [
    ["Picks saved", opportunities.length > 0, "Today has customer-ready rankings saved."],
    ["Email ready", Boolean(status?.emailReady), "The branded sender is ready for alerts."],
    [
      "Data ready",
      Boolean(status?.marketDataReady && status?.macroDataReady),
      "Market and macro providers are available.",
    ],
    [
      "Calibration ready",
      Boolean(status?.supabaseAdminReady),
      "Backtest feedback can be saved and applied.",
    ],
    [
      "Outcome checks",
      Boolean(status?.predictionEvaluationCronConfigured),
      "Forward predictions are evaluated after the market closes.",
    ],
  ] as const;
  const productionChecklist = {
    required: [
      [
        "Admin and cron secrets",
        Boolean(status?.adminProtected && status?.cronProtected),
        "Production admin and scheduled jobs must require secrets.",
      ],
      [
        "Supabase writes",
        Boolean(status?.supabaseReady && status?.supabaseAdminReady && status?.livePersistenceReady),
        "Customers, picks, predictions, and portfolio records must persist.",
      ],
      [
        "Market analysis feeds",
        Boolean(status?.marketDataReady && status?.openAiReady),
        "FMP and OpenAI must be available before publishing daily rankings.",
      ],
      [
        "Morning email delivery",
        Boolean(status?.emailReady),
        "Resend sender and branded email alerts must be ready before users rely on briefs.",
      ],
      [
        "Billing launch gate",
        Boolean(status?.stripeReady && status?.stripeWebhookConfigured && status?.stripePortalConfigured && status?.stripeCheckoutEnabled),
        "Live checkout, webhook sync, and customer billing portal must work before charging.",
      ],
    ],
    recommended: [
      [
        "Prediction evaluation cron",
        Boolean(status?.predictionEvaluationCronConfigured),
        "Outcome tracking should run automatically so accuracy can improve over time.",
      ],
      [
        "Daily rankings cron",
        Boolean(status?.vercelCronConfigured),
        "The morning agent should run without a manual admin click.",
      ],
      [
        "Macro context",
        Boolean(status?.macroDataReady),
        "FRED macro data improves market-regime context for ranking language.",
      ],
      [
        "SMS readiness",
        Boolean(status?.twilioReady),
        "Twilio can remain secondary while email is the main alert channel.",
      ],
    ],
    growth: [
      [
        "Saved customer activity",
        customers.length > 0,
        "Real customer accounts make onboarding, email, and engagement reporting measurable.",
      ],
      [
        "Forward prediction sample",
        opportunities.length > 0,
        "Daily picks must be saved consistently before prediction accuracy becomes meaningful.",
      ],
      [
        "Email engagement",
        monthlyClicks > 0,
        "Clicks prove users are opening alerts and reaching their dashboard.",
      ],
    ],
  } as const;
  const requiredReadyCount = productionChecklist.required.filter(([, ready]) => ready).length;
  const requiredTotal = productionChecklist.required.length;
  const launchReadiness = isLoading
    ? "Checking"
    : requiredReadyCount === requiredTotal
      ? "Ready for final live test"
      : `${requiredTotal - requiredReadyCount} required blocker${requiredTotal - requiredReadyCount === 1 ? "" : "s"}`;

  return (
    <section className="grid min-w-0 gap-5">
      <div className="premium-panel overflow-hidden rounded-3xl">
        <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
          <div className="p-5 sm:p-6">
            <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
            <p className="text-sm font-black uppercase tracking-normal text-pine">
              Admin command center
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-ink">
              Today&apos;s operating picture
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-ink/62">
              One place to verify the morning agent, customer engagement, delivery
              readiness, API health, and anything blocking production operation.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HealthCard
                label="Run status"
                status={isLoading ? "warn" : opportunities.length > 0 ? "good" : "bad"}
                value={isLoading ? "Checking" : opportunities.length > 0 ? "Picks saved" : "No picks"}
              />
              <HealthCard
                label="Email"
                status={isLoading ? "warn" : status?.emailReady ? "good" : "bad"}
                value={isLoading ? "Checking" : status?.emailReady ? "Ready" : "Blocked"}
              />
              <HealthCard
                label="Customers"
                status={isLoading ? "warn" : customers.length > 0 ? "good" : "warn"}
                value={isLoading ? "Checking" : String(customers.length)}
              />
              <HealthCard
                label="API health"
                status={isLoading ? "warn" : apiHealth >= 90 ? "good" : apiHealth >= 70 ? "warn" : "bad"}
                value={isLoading ? "Checking" : `${apiHealth}%`}
              />
            </div>
          </div>

          <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-5 text-white xl:border-l xl:border-t-0">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Needs attention
            </p>
            <p className="mt-3 text-4xl font-black">
              {isLoading ? "..." : missingChecks.length}
              <span className="text-base text-white/44"> issues</span>
            </p>
            <div className="mt-4 grid gap-2">
              {(isLoading
                ? ["Loading provider health"]
                : missingChecks.length
                  ? missingChecks
                  : ["All required systems ready"]
              ).map(
                (item) => (
                  <p
                    key={item}
                    className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2 text-sm font-bold text-white/78"
                  >
                    {item}
                  </p>
                ),
              )}
            </div>
            <p className="mt-4 text-xs font-semibold leading-5 text-white/52">
              {loadingMessage}
            </p>
          </div>
        </div>
      </div>

      {loadWarnings.length ? (
        <section className="rounded-3xl border border-amber/30 bg-amber/[0.14] p-4 sm:p-5">
          <p className="text-sm font-black uppercase tracking-normal text-ink">
            Partial admin data loaded
          </p>
          <div className="mt-3 grid gap-2">
            {loadWarnings.map((warning) => (
              <p key={warning} className="text-sm font-bold leading-6 text-ink/68">
                {warning}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="premium-panel min-w-0 rounded-3xl p-5 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[1fr_300px] xl:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-pine">
              Production readiness
            </p>
            <h3 className="mt-2 text-2xl font-black text-ink">
              Launch checklist for SwingFi
            </h3>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/60">
              This separates hard blockers from improvements so you can see whether
              SwingFi is safe to operate, safe to charge for, and improving prediction
              quality over time.
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-surface p-4">
            <p className="text-xs font-black uppercase tracking-normal text-ink/42">
              Launch status
            </p>
            <p className="mt-2 text-2xl font-black text-ink">{launchReadiness}</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-ink/55">
              Required checks ready: {isLoading ? "--" : `${requiredReadyCount}/${requiredTotal}`}.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5">
          {[
            ["Required before charging", productionChecklist.required, true],
            ["Recommended before public launch", productionChecklist.recommended, false],
            ["Growth and quality signals", productionChecklist.growth, false],
          ].map(([title, checks, required]) => (
            <div key={String(title)}>
              <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                {String(title)}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(checks as ReadonlyArray<readonly [string, boolean, string]>).map(
                  ([label, ready, detail]) => (
                    <ChecklistCard
                      key={label}
                      label={label}
                      ready={!isLoading && ready}
                      detail={isLoading ? "Checking production configuration..." : detail}
                      required={Boolean(required)}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid min-w-0 gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
        <section className="premium-panel min-w-0 rounded-3xl p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-normal text-pine">
                Daily workflow
              </p>
              <h3 className="mt-2 text-2xl font-black text-ink">
                Morning run and customer delivery
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("operations")}
              className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white hover:bg-pine"
            >
              Open agent controls
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                Latest pick batch
              </p>
              <p className="mt-2 text-sm font-black text-ink">
                {formatDate(latestOpportunity)}
              </p>
              <p className="mt-1 text-xs font-semibold text-ink/52">
                Source: {opportunitySource}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                Top picks saved
              </p>
              <p className="mt-2 text-3xl font-black text-pine">{topSaved}</p>
              <p className="mt-1 text-xs font-semibold text-ink/52">
                Opportunities scoring 75+
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-normal text-ink/45">
                Email engagement
              </p>
              <p className="mt-2 text-3xl font-black text-ink">{monthlyClicks}</p>
              <p className="mt-1 text-xs font-semibold text-ink/52">
                {activeCustomers} active this month
              </p>
            </div>
          </div>
        </section>

        <section className="premium-panel min-w-0 rounded-3xl p-5 sm:p-6">
          <p className="text-sm font-black uppercase tracking-normal text-pine">
            Connected feedback loop
          </p>
          <h3 className="mt-2 text-2xl font-black text-ink">
            Analysis quality controls
          </h3>
          <div className="mt-5 grid gap-3">
            {[
              ["Backtesting", "Verify whether recent picks hit target, stop, or expired.", "backtesting"],
              ["Prediction accuracy", "Measure live picks against SPY/QQQ before making stronger claims.", "accuracy"],
              ["Customers", "See which users open emails and which symbols they revisit.", "customers"],
              ["Alert studio", "Preview the branded morning email before scheduled sends.", "communications"],
              ["Admin access", "Approve admins and confirm role-based access.", "access"],
            ].map(([label, description, destination]) => (
              <button
                key={label}
                type="button"
                onClick={() => onNavigate(destination as AdminDestination)}
                className="rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-pine/35 hover:bg-white"
              >
                <span className="block text-sm font-black text-ink">{label}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-ink/55">
                  {description}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="premium-panel min-w-0 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-pine">
              Operator checklist
            </p>
            <h3 className="mt-2 text-2xl font-black text-ink">
              What should be true before alerts go out
            </h3>
          </div>
          <span className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-black text-ink">
            Morning quality gate
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {qualityGateChecks.map(([label, ready, detail]) => (
            <div
              key={String(label)}
              className={`rounded-2xl border p-4 ${
                isLoading
                  ? "border-line bg-surface"
                  : ready
                    ? "border-pine/20 bg-mint"
                    : "border-amber/30 bg-amber/[0.16]"
              }`}
            >
              <p className="text-sm font-black text-ink">{label}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-ink/58">
                {isLoading ? "Checking status..." : detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ActivityFeed items={activity} />

      <section className="premium-panel min-w-0 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-pine">
              Production blockers
            </p>
            <h3 className="mt-2 text-2xl font-black text-ink">What to fix before launch</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("access")}
            className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-black text-ink hover:border-pine"
          >
            Manage roles
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(missingChecks.length ? missingChecks : ["No required blockers detected"]).map(
            (item) => (
              <div key={item} className="min-w-0 rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm font-black text-ink">{item}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-ink/55">
                  {item === "No required blockers detected"
                    ? "Core admin systems are reporting ready."
                    : "Open the relevant admin section, confirm the env var or provider setup, then recheck this page."}
                </p>
              </div>
            ),
          )}
        </div>
      </section>
    </section>
  );
}
