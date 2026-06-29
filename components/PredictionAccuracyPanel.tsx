"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminHeaders } from "@/lib/admin-client";
import {
  getCurrentCustomer,
  isAdminCustomer,
  restoreAuthenticatedCustomerSession,
} from "@/lib/customer-store";
import type { PredictionAccuracySummary } from "@/lib/prediction-tracking";

type AccuracyState = "idle" | "loading" | "ready" | "error";

function formatPercent(value: number | null | undefined) {
  const next = Number(value ?? 0);
  return `${next > 0 ? "+" : ""}${next.toFixed(2)}%`;
}

function statusLabel(status: string) {
  if (status === "target_hit") return "Target hit";
  if (status === "stop_hit") return "Stop hit";
  if (status === "no_entry") return "No entry";
  if (status === "no_data") return "No data";
  if (status === "pending") return "Watching";
  if (status === "entered") return "Entered";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(next.getTime())) return null;

  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function daysUntil(date: string | null) {
  if (!date) return null;

  const today = new Date();
  const target = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(target.getTime())) return null;

  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());

  return Math.ceil((targetUtc - todayUtc) / (24 * 60 * 60 * 1000));
}

function StatCard({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "good" | "neutral" | "risk";
  value: string | number;
}) {
  const classes = {
    good: "border-pine/20 bg-mint text-pine",
    neutral: "border-line bg-surface text-ink",
    risk: "border-coral/25 bg-coral/10 text-coral",
  };

  return (
    <div className={`rounded-2xl border p-4 ${classes[tone]}`}>
      <p className="text-xs font-black uppercase tracking-normal opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function HeatmapGrid({
  items,
  title,
}: {
  items: PredictionAccuracySummary["outcomeHeatmap"]["byScoreBand"];
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-black text-ink">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => {
          const strength =
            item.count === 0
              ? "bg-white text-ink/45"
              : item.averageReturnPct >= 2 || item.targetHitRate >= 45
                ? "bg-mint text-pine"
                : item.stopHitRate >= 35 || item.averageReturnPct < 0
                  ? "bg-coral/10 text-coral"
                  : "bg-white text-ink";

          return (
            <div key={item.label} className={`rounded-xl border border-line px-3 py-2 ${strength}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-normal">{item.label}</p>
                <p className="text-xs font-black">{item.count} trades</p>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-bold">
                <span>Target {item.targetHitRate}%</span>
                <span>Stop {item.stopHitRate}%</span>
                <span>{formatPercent(item.averageReturnPct)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PredictionAccuracyPanel() {
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [checkedAccess, setCheckedAccess] = useState(false);
  const [message, setMessage] = useState("Loading forward prediction tracking...");
  const [status, setStatus] = useState<AccuracyState>("idle");
  const [summary, setSummary] = useState<PredictionAccuracySummary | null>(null);

  async function loadSummary(method: "GET" | "POST" = "GET") {
    if (!adminAllowed && !isAdminCustomer(getCurrentCustomer())) {
      setStatus("error");
      setMessage("Admin access is required to view prediction accuracy.");
      return;
    }

    setStatus("loading");
    setMessage(method === "POST" ? "Evaluating pending predictions..." : "Loading prediction accuracy...");

    try {
      const response = await fetch("/api/admin/predictions", {
        headers: await getAdminHeaders(),
        method,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Prediction accuracy failed");
      }

      const payload = (await response.json()) as PredictionAccuracySummary;
      setSummary(payload);
      setStatus("ready");
      setMessage(
        method === "POST"
          ? `Updated ${payload.updatedCount} predictions`
          : "Forward prediction tracking loaded",
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Prediction accuracy failed");
    }
  }

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      const restored = await restoreAuthenticatedCustomerSession();
      if (!active) return;

      const allowed = isAdminCustomer(restored ?? getCurrentCustomer());
      setAdminAllowed(allowed);
      setCheckedAccess(true);

      if (allowed) {
        setStatus("loading");
        setMessage("Loading prediction accuracy...");

        try {
          const response = await fetch("/api/admin/predictions", {
            headers: await getAdminHeaders(),
            method: "GET",
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(payload.error ?? "Prediction accuracy failed");
          }

          if (!active) return;
          const payload = (await response.json()) as PredictionAccuracySummary;
          setSummary(payload);
          setStatus("ready");
          setMessage("Forward prediction tracking loaded");
        } catch (error) {
          if (!active) return;
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Prediction accuracy failed");
        }
      } else {
        setStatus("error");
        setMessage("Admin access is required to view prediction accuracy.");
      }
    }

    void checkAccess().catch(() => {
      if (!active) return;
      setAdminAllowed(false);
      setCheckedAccess(true);
      setStatus("error");
      setMessage("Admin access is required to view prediction accuracy.");
    });

    return () => {
      active = false;
    };
  }, []);

  const recentPredictions = useMemo(
    () => summary?.predictions.slice(0, 18) ?? [],
    [summary],
  );
  const pendingPredictions = useMemo(
    () => summary?.predictions.filter((prediction) => prediction.status === "pending") ?? [],
    [summary],
  );
  const enteredPredictions = useMemo(
    () => summary?.predictions.filter((prediction) => prediction.status === "entered") ?? [],
    [summary],
  );
  const completedPredictions = useMemo(
    () =>
      summary?.predictions.filter((prediction) =>
        ["target_hit", "stop_hit", "expired", "no_entry", "no_data"].includes(prediction.status),
      ) ?? [],
    [summary],
  );
  const firstMaturityDate = useMemo(() => {
    const dates = pendingPredictions
      .map((prediction) => addDays(prediction.prediction_date, prediction.holding_period_days))
      .filter((date): date is string => Boolean(date))
      .sort();

    return dates[0] ?? null;
  }, [pendingPredictions]);
  const firstMaturityDays = daysUntil(firstMaturityDate);
  const lifecycleMessage =
    (summary?.totalPredictions ?? 0) > 0 && (summary?.evaluatedCount ?? 0) === 0
      ? `SwingFi is tracking ${summary?.totalPredictions ?? 0} live predictions. They stay in watching mode until price enters the planned range or the holding window matures. The first full outcome window is expected around ${firstMaturityDate ?? "the next eligible trading window"}.`
      : summary?.verificationMessage ?? message;

  if (checkedAccess && !adminAllowed) {
    return (
      <section className="premium-panel rounded-3xl p-6">
        <p className="text-sm font-black uppercase tracking-normal text-coral">Admin only</p>
        <h2 className="mt-3 text-3xl font-black text-ink">Prediction accuracy is restricted</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-ink/62">
          Forward outcome tracking is internal verification data. Customers should see
          simple explanations and risk language, not raw model-performance diagnostics.
        </p>
      </section>
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
      <section className="premium-panel overflow-hidden rounded-3xl">
        <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
          <div className="p-5 sm:p-6">
            <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
            <p className="text-sm font-black uppercase tracking-normal text-pine">
              Prediction accuracy
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-ink">
              Forward outcome tracking
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-ink/62">
              This tracks the exact daily picks shown to users, then measures whether
              each one entered, hit target, hit stop, expired, and outperformed SPY/QQQ.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void loadSummary("POST")}
                disabled={status === "loading"}
                className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white hover:bg-pine disabled:cursor-not-allowed disabled:opacity-60"
              >
                Evaluate pending predictions
              </button>
              <button
                type="button"
                onClick={() => void loadSummary()}
                disabled={status === "loading"}
                className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-black text-ink hover:border-pine disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh summary
              </button>
            </div>
          </div>
          <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-5 text-white xl:border-l xl:border-t-0">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Verification status
            </p>
            <p className="mt-3 text-4xl font-black">
              {summary?.evaluatedCount ?? 0}
              <span className="text-base text-white/44"> evaluated</span>
            </p>
            <p className="mt-4 text-sm font-semibold leading-7 text-white/64">
              {lifecycleMessage}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <StatCard label="Total" value={summary?.totalPredictions ?? "--"} />
        <StatCard label="Target hit" value={`${summary?.targetHitRate ?? 0}%`} tone="good" />
        <StatCard label="Stop hit" value={`${summary?.stopHitRate ?? 0}%`} tone="risk" />
        <StatCard label="Avg return" value={formatPercent(summary?.averageReturnPct)} />
        <StatCard label="Excess vs SPY/QQQ" value={formatPercent(summary?.averageExcessReturnPct)} tone={(summary?.averageExcessReturnPct ?? 0) >= 0 ? "good" : "risk"} />
        <StatCard label="Open/pending" value={`${summary?.openCount ?? 0}/${summary?.pendingCount ?? 0}`} />
        <StatCard
          label="Learning rules"
          value={summary?.calibrationGeneratedCount ?? 0}
          tone={summary?.calibrationStatus === "active" ? "good" : "neutral"}
        />
      </section>

      <section className="premium-panel rounded-3xl p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-pine">
              Prediction lifecycle
            </p>
            <h3 className="mt-2 text-2xl font-black text-ink">
              Why the accuracy numbers are still zero
            </h3>
            <p className="mt-3 text-sm font-semibold leading-7 text-ink/62">
              A prediction is saved the morning it appears in the app. It does not count
              as right or wrong until the trade either enters the buy range and hits a
              target/stop, expires after its holding window, or never enters at all.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-normal text-ink/55">
                Watching
              </p>
              <p className="mt-2 text-3xl font-black text-ink">{pendingPredictions.length}</p>
              <p className="mt-2 text-xs font-bold leading-5 text-ink/55">
                Waiting for entry or enough days to judge.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-normal text-ink/55">
                Entered
              </p>
              <p className="mt-2 text-3xl font-black text-pine">{enteredPredictions.length}</p>
              <p className="mt-2 text-xs font-bold leading-5 text-ink/55">
                In range, but not finished yet.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-normal text-ink/55">
                Completed
              </p>
              <p className="mt-2 text-3xl font-black text-ink">{completedPredictions.length}</p>
              <p className="mt-2 text-xs font-bold leading-5 text-ink/55">
                Mature enough for accuracy metrics.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-line bg-sky px-4 py-3 text-sm font-bold leading-6 text-ink">
          First full outcome window: {firstMaturityDate ?? "No pending predictions"}{" "}
          {firstMaturityDays !== null
            ? firstMaturityDays > 0
              ? `(${firstMaturityDays} day${firstMaturityDays === 1 ? "" : "s"} away)`
              : "(eligible now)"
            : ""}
        </div>
      </section>

      <section className="premium-panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-pine">
              Score-band proof
            </p>
            <h3 className="mt-2 text-2xl font-black text-ink">
              Are higher scores actually performing better?
            </h3>
          </div>
          <span className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-black text-ink">
            Latest: {summary?.latestPredictionDate ?? "No saved predictions"}
          </span>
        </div>
        <div className="mt-5 w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-normal text-ink/55">
                <th className="py-3 pr-4">Band</th>
                <th className="py-3 pr-4">Count</th>
                <th className="py-3 pr-4">Target hit</th>
                <th className="py-3 pr-4">Avg return</th>
                <th className="py-3 pr-4">Excess return</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.scoreBands ?? []).map((band) => (
                <tr key={band.label} className="border-b border-line last:border-b-0">
                  <td className="py-4 pr-4 font-black text-ink">{band.label}</td>
                  <td className="py-4 pr-4">{band.count}</td>
                  <td className="py-4 pr-4 font-bold text-pine">{band.targetHitRate}%</td>
                  <td className="py-4 pr-4">{formatPercent(band.averageReturnPct)}</td>
                  <td className="py-4 pr-4">{formatPercent(band.averageExcessReturnPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="premium-panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-pine">
              Outcome heatmap
            </p>
            <h3 className="mt-2 text-2xl font-black text-ink">
              Where predictions are working or failing
            </h3>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink/60">
              This groups completed predictions by score band, risk band, setup
              pattern, and holding window so calibration can reward what works and
              penalize what does not.
            </p>
          </div>
          <span className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-black text-ink">
            Admin only
          </span>
        </div>
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          <HeatmapGrid title="Score band" items={summary?.outcomeHeatmap.byScoreBand ?? []} />
          <HeatmapGrid title="Risk band" items={summary?.outcomeHeatmap.byRiskBand ?? []} />
          <HeatmapGrid title="Setup pattern" items={summary?.outcomeHeatmap.bySetupPattern ?? []} />
          <HeatmapGrid title="Holding window" items={summary?.outcomeHeatmap.byHoldingWindow ?? []} />
        </div>
      </section>

      <section className="premium-panel rounded-3xl p-5 sm:p-6">
        <h3 className="text-2xl font-black text-ink">Recent live predictions</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">{message}</p>
        <div className="mt-5 w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-normal text-ink/55">
                <th className="py-3 pr-4">Date</th>
                <th className="py-3 pr-4">Rank</th>
                <th className="py-3 pr-4">Symbol</th>
                <th className="py-3 pr-4">Score</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Entry</th>
                <th className="py-3 pr-4">Exit</th>
                <th className="py-3 pr-4">Return</th>
                <th className="py-3 pr-4">SPY</th>
                <th className="py-3 pr-4">QQQ</th>
                <th className="py-3 pr-4">Excess</th>
              </tr>
            </thead>
            <tbody>
              {recentPredictions.length ? (
                recentPredictions.map((prediction) => (
                  <tr key={prediction.id} className="border-b border-line last:border-b-0">
                    <td className="py-4 pr-4 font-semibold text-ink">{prediction.prediction_date}</td>
                    <td className="py-4 pr-4">#{prediction.rank}</td>
                    <td className="py-4 pr-4 font-black text-ink">{prediction.symbol}</td>
                    <td className="py-4 pr-4">{prediction.score}</td>
                    <td className="py-4 pr-4 font-bold text-pine">{statusLabel(prediction.status)}</td>
                    <td className="py-4 pr-4">{prediction.entry_date ?? "--"}</td>
                    <td className="py-4 pr-4">{prediction.exit_date ?? "--"}</td>
                    <td className="py-4 pr-4">{formatPercent(prediction.return_pct)}</td>
                    <td className="py-4 pr-4">{formatPercent(prediction.spy_return_pct)}</td>
                    <td className="py-4 pr-4">{formatPercent(prediction.qqq_return_pct)}</td>
                    <td className="py-4 pr-4 font-bold text-ink">{formatPercent(prediction.excess_return_pct)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-6 pr-4 text-sm font-semibold text-ink/60" colSpan={11}>
                    No live predictions have been saved yet. Run and persist the daily
                    ranking agent after applying the latest database schema.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
