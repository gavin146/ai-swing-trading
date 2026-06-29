"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminCronMonitor } from "@/components/AdminCronMonitor";
import { PasswordField } from "@/components/PasswordField";
import {
  getAdminHeaders,
  getStoredAdminToken,
  setStoredAdminToken,
} from "@/lib/admin-client";

type StatusPayload = {
  adminProtected: boolean;
  cronProtected: boolean;
  vercelCronConfigured: boolean;
  emailReady: boolean;
  openAiReady: boolean;
  stripeReady: boolean;
  stripeCheckoutEnabled: boolean;
  stripePortalConfigured: boolean;
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

type AdminRunPayload = {
  dataQuality?: {
    marketCoverage?: {
      requestedUniverseLimit?: number;
      screenerCount?: number;
      detailedCandidateCount?: number;
      detailedCandidateTarget?: number;
      qualifiedCandidateCount?: number;
      status?: string;
      warning?: string | null;
    };
  };
  selectedCount: number;
  persisted?: boolean;
  persistence?: {
    error?: string;
    reason?: string;
  };
};

const statusLabels: Array<[keyof StatusPayload, string]> = [
  ["adminProtected", "Admin secret"],
  ["cronProtected", "Cron secret"],
  ["vercelCronConfigured", "Vercel cron"],
  ["emailReady", "Email"],
  ["openAiReady", "OpenAI"],
  ["stripeReady", "Stripe keys"],
  ["stripeCheckoutEnabled", "Checkout flag"],
  ["stripePortalConfigured", "Billing portal"],
  ["supabaseReady", "Supabase auth"],
  ["supabaseAdminReady", "Supabase writes"],
  ["livePersistenceReady", "Live database"],
  ["liveDataMissing", "Live data missing"],
  ["marketDataReady", "FMP market"],
  ["macroDataReady", "FRED macro"],
  ["blsReady", "BLS public"],
  ["twilioReady", "Twilio SMS"],
];

export function AdminOperationsPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [message, setMessage] = useState("Ready");
  const [runningAgent, setRunningAgent] = useState(false);
  const [adminToken, setAdminToken] = useState("");

  useEffect(() => {
    setAdminToken(getStoredAdminToken());
    getAdminHeaders()
      .then((headers) => fetch("/api/admin/status", { headers }))
      .then((response) => response.json())
      .then((payload: StatusPayload) => setStatus(payload))
      .catch(() => setStatus(null));
  }, []);

  async function runAgent() {
    setRunningAgent(true);
    setMessage("Running daily ranking agent...");
    try {
      const response = await fetch("/api/admin/run-agent", {
        method: "POST",
        headers: await getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ detailedLimit: 350, limit: 30, universeLimit: 1000 }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Agent run failed.");
      }

      const payload = (await response.json()) as AdminRunPayload;
      const coverage = payload.dataQuality?.marketCoverage;
      const coverageText = coverage
        ? ` Market scanned ${coverage.screenerCount ?? "n/a"}/${coverage.requestedUniverseLimit ?? "n/a"}; deep analyzed ${coverage.detailedCandidateCount ?? "n/a"}/${coverage.detailedCandidateTarget ?? "n/a"}.`
        : "";
      setMessage(
        payload.persisted
          ? `Agent ranked and saved ${payload.selectedCount} opportunities.${coverageText}`
          : `Agent ranked ${payload.selectedCount} opportunities but did not save them: ${
              payload.persistence?.reason ?? payload.persistence?.error ?? "Supabase persistence unavailable."
            }${coverageText}`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Agent run failed. Check the server logs and integration status.",
      );
    } finally {
      setRunningAgent(false);
    }
  }

  return (
    <section className="premium-panel mb-6 min-w-0 overflow-hidden rounded-3xl p-5 sm:p-6">
      <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            Daily agent controls
          </p>
            <h1 className="mt-3 text-3xl font-black text-ink">Run the morning analysis</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">
            Run the daily agent, save rankings, and check production integrations.
            Recommended schedule: 8:30 AM Eastern, before the 9:30 AM market open,
            then email all enabled customers their daily analysis links.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <button
            type="button"
            onClick={() => void runAgent()}
            disabled={runningAgent}
            className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine disabled:cursor-not-allowed disabled:opacity-70"
          >
            {runningAgent ? "Running..." : "Run agent"}
          </button>
          <Link
            href="/admin?tab=backtesting"
            className="rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-bold text-ink hover:border-pine"
          >
            View backtests
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {[
          [
            "1. Data intake",
            status?.marketDataReady ? "FMP market data ready" : "FMP market data missing",
            status?.marketDataReady,
          ],
          [
            "2. AI scoring",
            status?.openAiReady ? "OpenAI key ready" : "OpenAI key missing",
            status?.openAiReady,
          ],
          [
            "3. Save picks",
            status?.livePersistenceReady ? "Supabase writes ready" : "Supabase writes blocked",
            status?.livePersistenceReady,
          ],
          [
            "4. Send alerts",
            status?.emailReady ? "Email ready" : "Email blocked",
            status?.emailReady,
          ],
        ].map(([label, description, ready]) => (
          <div
            key={String(label)}
            className={`rounded-2xl border p-4 ${
              ready ? "border-pine/20 bg-mint" : "border-coral/20 bg-coral/10"
            }`}
          >
            <p className={`text-xs font-black uppercase tracking-normal ${ready ? "text-pine/70" : "text-coral"}`}>
              {label}
            </p>
            <p className="mt-2 text-sm font-black text-ink">{description}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {statusLabels.map(([key, label]) => (
          <div key={key} className="min-w-0 rounded-2xl bg-surface px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-normal text-ink/55">
              {label}
            </p>
            <p
              className={`mt-1 text-sm font-bold ${
                key === "liveDataMissing"
                    ? status?.[key]
                      ? "text-coral"
                      : "text-pine"
                    : status?.[key]
                    ? "text-pine"
                    : "text-coral"
              }`}
            >
              {key === "liveDataMissing"
                ? status?.[key]
                  ? "Missing"
                  : "Off"
                : status?.[key]
                  ? "Ready"
                  : "Missing"}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 break-words rounded-2xl bg-surface px-4 py-3 text-sm font-bold leading-6 text-ink/70">
        {message}
      </p>

      <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface p-4 md:grid-cols-3">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-ink/55">
            Email provider
          </p>
          <p className="mt-1 text-sm font-bold text-ink">
            {status?.emailProvider ?? "resend"}
          </p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-ink/55">
            Sender
          </p>
          <p className="mt-1 break-all text-sm font-bold text-ink">
            {status?.emailFrom || "Missing"}
          </p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-ink/55">
            Email status
          </p>
          <p className={`mt-1 text-sm font-bold ${status?.emailReady ? "text-pine" : "text-coral"}`}>
            {status?.emailReady ? "Ready to send" : status?.emailReason ?? "Missing"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-panel p-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Production admin API secret
          <PasswordField
            label="admin API secret"
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            placeholder="Paste ADMIN_API_SECRET for protected admin actions"
            className="rounded-xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setStoredAdminToken(adminToken);
              setMessage(
                adminToken.trim()
                  ? "Admin token saved in this browser for protected actions."
                  : "Admin token cleared from this browser.",
              );
            }}
            className="rounded-xl bg-pine px-4 py-3 text-sm font-bold text-white transition hover:bg-ink"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setAdminToken("");
              setStoredAdminToken("");
              setMessage("Admin token cleared from this browser.");
            }}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink transition hover:border-pine"
          >
            Clear
          </button>
        </div>
      </div>

      <AdminCronMonitor />
    </section>
  );
}
