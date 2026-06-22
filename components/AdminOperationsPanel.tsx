"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AgentRunResult } from "@/lib/agent";
import { resetStoredOpportunities, setStoredOpportunityRows } from "@/lib/opportunity-store";

type StatusPayload = {
  cronProtected: boolean;
  twilioReady: boolean;
  supabaseReady: boolean;
  marketDataReady: boolean;
  newsReady: boolean;
  financialDataReady: boolean;
};

const statusLabels: Array<[keyof StatusPayload, string]> = [
  ["cronProtected", "Cron secret"],
  ["twilioReady", "Twilio SMS"],
  ["supabaseReady", "Supabase"],
  ["marketDataReady", "Market data"],
  ["newsReady", "News data"],
  ["financialDataReady", "Financial data"],
];

export function AdminOperationsPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [message, setMessage] = useState("Ready");
  const [latestRun, setLatestRun] = useState<AgentRunResult | null>(null);

  useEffect(() => {
    fetch("/api/admin/status")
      .then((response) => response.json())
      .then((payload: StatusPayload) => setStatus(payload))
      .catch(() => setStatus(null));
  }, []);

  async function runAgent() {
    setMessage("Running daily ranking agent...");
    const response = await fetch("/api/agent/daily-rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 30 }),
    });
    const payload = (await response.json()) as AgentRunResult;
    setLatestRun(payload);
    setMessage(`Agent ranked ${payload.selectedCount} opportunities.`);
  }

  function applyLatest() {
    if (!latestRun) return;

    setStoredOpportunityRows(latestRun.opportunities);
    setMessage("Applied latest top 30 to dashboard.");
  }

  return (
    <section className="mb-6 rounded-lg border border-line bg-panel p-6 shadow-soft">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            Admin operations
          </p>
          <h1 className="mt-3 text-3xl font-bold text-ink">System controls</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">
            Run the daily agent, apply rankings, and check which production integrations
            are configured.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <button
            type="button"
            onClick={() => void runAgent()}
            className="rounded-md bg-pine px-4 py-3 text-sm font-bold text-white transition hover:bg-ink"
          >
            Run agent
          </button>
          <button
            type="button"
            onClick={applyLatest}
            disabled={!latestRun}
            className="rounded-md border border-line bg-surface px-4 py-3 text-sm font-bold text-ink transition hover:border-pine disabled:cursor-not-allowed disabled:opacity-60"
          >
            Apply latest
          </button>
          <button
            type="button"
            onClick={() => {
              resetStoredOpportunities();
              setMessage("Reset dashboard mock data to current agent seed.");
            }}
            className="rounded-md border border-line bg-surface px-4 py-3 text-sm font-bold text-ink transition hover:border-pine"
          >
            Reset picks
          </button>
          <Link
            href="/backtests"
            className="rounded-md border border-line bg-surface px-4 py-3 text-center text-sm font-bold text-ink transition hover:border-pine"
          >
            View backtests
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statusLabels.map(([key, label]) => (
          <div key={key} className="rounded-md bg-surface px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-normal text-ink/55">
              {label}
            </p>
            <p className={`mt-1 text-sm font-bold ${status?.[key] ? "text-pine" : "text-coral"}`}>
              {status?.[key] ? "Ready" : "Missing"}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 rounded-md bg-surface px-3 py-2 text-sm font-bold text-ink/70">
        {message}
      </p>
    </section>
  );
}
