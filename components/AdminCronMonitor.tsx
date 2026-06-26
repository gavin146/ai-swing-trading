"use client";

import { useEffect, useState } from "react";
import { getAdminHeaders } from "@/lib/admin-client";

type CronItem = {
  errorMessage?: string | null;
  id?: string | null;
  marketCoverage?: {
    status: "healthy" | "thin" | "blocked" | "unknown";
    requestedUniverseLimit: number | null;
    screenerCount: number | null;
    detailedCandidateTarget: number | null;
    detailedCandidateCount: number | null;
    qualifiedCandidateCount: number | null;
    rankedCandidateCount: number | null;
    minimumScreenerCount: number | null;
    minimumDetailedCandidateCount: number | null;
    warning: string | null;
  } | null;
  ranAt?: string | null;
  selectedCount?: number;
  status?: string | null;
  summary?: string | null;
  universeCount?: number;
};

type AlertItem = {
  channel?: string | null;
  errorMessage?: string | null;
  ranAt?: string | null;
  recipient?: string | null;
  status?: string | null;
};

type PredictionEvaluation = {
  level?: string | null;
  message?: string | null;
  ranAt?: string | null;
};

type FailureItem = {
  createdAt?: string | null;
  id?: string | null;
  level?: string | null;
  message?: string | null;
  source?: string | null;
};

type CronStatusPayload = {
  errors?: string[];
  latestAgentRun?: CronItem | null;
  latestAlertLog?: AlertItem | null;
  latestPredictionEvaluation?: PredictionEvaluation | null;
  predictions?: {
    evaluated: number;
    latestDate: string | null;
    pending: number;
    total: number;
  };
  recentFailures?: FailureItem[];
  source?: "supabase" | "empty";
};

function formatDate(value?: string | null) {
  if (!value) return "Not run yet";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function statusTone(value?: string | null) {
  const normalized = value?.toLowerCase() ?? "";

  if (["completed", "queued", "sent", "info"].includes(normalized)) return "good";
  if (["warning", "running", "pending"].includes(normalized)) return "warn";
  if (["failed", "error"].includes(normalized)) return "bad";
  return "neutral";
}

function toneClasses(tone: "good" | "warn" | "bad" | "neutral") {
  if (tone === "good") return "border-pine/20 bg-mint text-pine";
  if (tone === "warn") return "border-amber/30 bg-amber/12 text-ink";
  if (tone === "bad") return "border-coral/25 bg-coral/10 text-coral";
  return "border-line bg-surface text-ink/65";
}

function MonitorCard({
  detail,
  label,
  status,
  title,
}: {
  detail: string;
  label: string;
  status?: string | null;
  title: string;
}) {
  const tone = statusTone(status);

  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-ink/45">{label}</p>
          <h3 className="mt-2 text-lg font-black text-ink">{title}</h3>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${toneClasses(tone)}`}>
          {status ?? "No run"}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-ink/60">{detail}</p>
    </div>
  );
}

function coverageStatusTone(status?: string | null) {
  if (status === "healthy") return "good";
  if (status === "thin") return "warn";
  if (status === "blocked") return "bad";
  return "neutral";
}

function coverageLabel(coverage?: CronItem["marketCoverage"]) {
  if (!coverage) return "Not saved";

  if (coverage.screenerCount !== null && coverage.requestedUniverseLimit !== null) {
    return `${coverage.screenerCount}/${coverage.requestedUniverseLimit} scanned`;
  }

  if (coverage.detailedCandidateCount !== null) {
    return `${coverage.detailedCandidateCount} detailed`;
  }

  return "Not saved";
}

export function AdminCronMonitor() {
  const [payload, setPayload] = useState<CronStatusPayload | null>(null);
  const [message, setMessage] = useState("Loading cron monitor...");
  const [loading, setLoading] = useState(true);

  async function loadStatus() {
    setLoading(true);
    setMessage("Refreshing cron monitor...");

    try {
      const response = await fetch("/api/admin/cron-status", {
        headers: await getAdminHeaders(),
      });
      const nextPayload = (await response.json()) as CronStatusPayload & { error?: string };

      if (!response.ok) {
        throw new Error(nextPayload.error ?? "Cron monitor failed to load.");
      }

      setPayload(nextPayload);
      setMessage("Cron monitor loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cron monitor failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  const latestAgent = payload?.latestAgentRun;
  const latestAlert = payload?.latestAlertLog;
  const latestEvaluation = payload?.latestPredictionEvaluation;
  const predictions = payload?.predictions;
  const recentFailures = payload?.recentFailures ?? [];

  return (
    <section className="mt-6 rounded-3xl border border-line bg-panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-normal text-pine">
            Cron monitor
          </p>
          <h2 className="mt-2 text-2xl font-black text-ink">
            Last automated operations
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/60">
            This checks saved production logs for the morning ranking run, email
            delivery, prediction evaluation, and recent failures.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={loading}
          className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-black text-ink hover:border-pine disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-4">
        <MonitorCard
          label="Daily rankings"
          title={latestAgent ? `${latestAgent.selectedCount ?? 0} picks saved` : "No ranking run"}
          status={latestAgent?.status}
          detail={
            latestAgent
              ? `${formatDate(latestAgent.ranAt)}. ${latestAgent.selectedCount ?? 0} selected from ${latestAgent.universeCount ?? 0} candidates.`
              : "No production ranking run has been recorded yet."
          }
        />
        <MonitorCard
          label="Market coverage"
          title={coverageLabel(latestAgent?.marketCoverage)}
          status={latestAgent?.marketCoverage?.status ?? "unknown"}
          detail={
            latestAgent?.marketCoverage
              ? `Deep analysis: ${latestAgent.marketCoverage.detailedCandidateCount ?? "n/a"}/${latestAgent.marketCoverage.detailedCandidateTarget ?? "n/a"}. Qualified: ${latestAgent.marketCoverage.qualifiedCandidateCount ?? "n/a"}.`
              : "Older runs did not save market coverage metadata."
          }
        />
        <MonitorCard
          label="Morning email"
          title={latestAlert ? `${latestAlert.channel ?? "email"} ${latestAlert.status ?? "recorded"}` : "No alert log"}
          status={latestAlert?.status}
          detail={
            latestAlert
              ? `${formatDate(latestAlert.ranAt)}. Latest recipient: ${latestAlert.recipient ?? "not saved"}.`
              : "No morning alert delivery has been recorded yet."
          }
        />
        <MonitorCard
          label="Outcome evaluation"
          title={latestEvaluation ? "Prediction check recorded" : "No evaluation log"}
          status={latestEvaluation?.level}
          detail={
            latestEvaluation
              ? `${formatDate(latestEvaluation.ranAt)}. ${latestEvaluation.message ?? "Evaluation ran."}`
              : "The prediction evaluation cron has not written an event yet."
          }
        />
        <MonitorCard
          label="Prediction ledger"
          title={`${predictions?.total ?? 0} latest picks`}
          status={(predictions?.pending ?? 0) > 0 ? "pending" : predictions?.total ? "completed" : "neutral"}
          detail={`${predictions?.pending ?? 0} pending, ${predictions?.evaluated ?? 0} evaluated for ${predictions?.latestDate ?? "no saved date"}.`}
        />
      </div>

      {latestAgent?.marketCoverage?.warning ? (
        <p className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold leading-6 ${toneClasses(coverageStatusTone(latestAgent.marketCoverage.status))}`}>
          {latestAgent.marketCoverage.warning}
        </p>
      ) : null}

      <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-black uppercase tracking-normal text-ink/55">
            Recent warnings and failures
          </h3>
          <p className="text-xs font-bold text-ink/45">{message}</p>
        </div>
        <div className="mt-3 grid gap-2">
          {recentFailures.length ? (
            recentFailures.map((item) => (
              <div
                key={item.id ?? `${item.source}-${item.createdAt}`}
                className={`rounded-2xl border px-4 py-3 ${toneClasses(statusTone(item.level))}`}
              >
                <p className="text-sm font-black">{item.source ?? "system"}</p>
                <p className="mt-1 text-xs font-semibold leading-5 opacity-75">
                  {formatDate(item.createdAt)} · {item.message ?? "Issue recorded."}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm font-bold text-ink/60">
              No recent warning or error events are currently saved.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
