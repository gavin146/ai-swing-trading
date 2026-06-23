"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentRunResult } from "@/lib/agent";
import { getCurrentCustomer, isAdminCustomer } from "@/lib/customer-store";

type RunState = "idle" | "loading" | "ready" | "error";
type AgentSource = "fmp";
type ExplanationState = {
  status: "idle" | "loading" | "ready" | "error";
  symbol: string | null;
  text: string | null;
  message: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AgentRunnerPanel() {
  const [status, setStatus] = useState<RunState>("idle");
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [checkedAccess, setCheckedAccess] = useState(false);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [message, setMessage] = useState("Ready to run");
  const [source, setSource] = useState<AgentSource>("fmp");
  const [explanation, setExplanation] = useState<ExplanationState>({
    status: "idle",
    symbol: null,
    text: null,
    message: null,
  });

  async function runAgent(method: "GET" | "POST" = "POST", nextSource: AgentSource = source) {
    if (!isAdminCustomer(getCurrentCustomer())) {
      setStatus("error");
      setMessage("Admin access is required to run the ranking agent.");
      return;
    }

    setStatus("loading");
    setSource(nextSource);
    setMessage(
      nextSource === "fmp"
        ? "Analyzing live FMP candles, fundamentals, and ranking inputs..."
        : "Preparing live analysis...",
    );

    try {
      const url =
        method === "GET"
          ? `/api/agent/daily-rankings?source=${nextSource}&limit=90`
          : "/api/agent/daily-rankings";
      const response = await fetch(url, {
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: method === "POST" ? JSON.stringify({ limit: 90, source: nextSource }) : undefined,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Agent run failed");
      }

      const nextResult = (await response.json()) as AgentRunResult;
      setResult(nextResult);
      setExplanation({
        status: "idle",
        symbol: null,
        text: null,
        message: null,
      });
      setStatus("ready");
      setMessage(
        "Top 90 live FMP-ranked opportunities are ready",
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The agent could not complete the run.");
    }
  }

  useEffect(() => {
    const allowed = isAdminCustomer(getCurrentCustomer());
    setAdminAllowed(allowed);
    setCheckedAccess(true);

    if (allowed) {
      void runAgent("GET", "fmp");
    } else {
      setStatus("error");
      setMessage("Admin access is required to run the ranking agent.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topFive = useMemo(() => result?.rankings.slice(0, 5) ?? [], [result]);

  async function generateExplanation(symbol = result?.rankings[0]?.candidate.symbol) {
    if (!symbol || !result) return;

    setExplanation({
      status: "loading",
      symbol,
      text: null,
      message: "Generating AI explanation...",
    });

    try {
      const response = await fetch("/api/agent/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          source: result.dataSource,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "AI explanation failed");
      }

      const payload = (await response.json()) as {
        explanation: string;
        mode: string;
        error?: string | null;
      };

      setExplanation({
        status: payload.mode === "openai" ? "ready" : "error",
        symbol,
        text: payload.explanation,
        message:
          payload.mode === "openai"
            ? "Generated with OpenAI"
            : payload.error ?? "OpenAI fallback explanation",
      });
    } catch (error) {
      setExplanation({
        status: "error",
        symbol,
        text: null,
        message:
          error instanceof Error ? error.message : "The AI explanation could not be generated.",
      });
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      {checkedAccess && !adminAllowed ? (
        <section className="min-w-0 rounded-lg border border-line bg-panel p-6 shadow-soft">
          <p className="text-sm font-bold uppercase tracking-normal text-coral">
            Admin only
          </p>
          <h1 className="mt-3 text-4xl font-bold text-ink">Agent controls are restricted</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-ink/65">
            Customers receive the morning brief automatically by email. Manual agent runs
            are reserved for admins so customers have a simple daily-picks experience.
          </p>
        </section>
      ) : null}

      {!checkedAccess || !adminAllowed ? null : (
        <>
      <section className="min-w-0 rounded-lg border border-line bg-panel p-6 shadow-soft">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-pine">
              Morning AI ranking agent
            </p>
            <h1 className="mt-3 text-4xl font-bold text-ink">Top 30 stock selector</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-ink/65">
              The system should run before the market opens, around 8:30 AM Eastern,
              then send customers an email linking to the daily analysis. Manual runs
              stay admin-only for testing, support, and operations.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={() => void runAgent("POST", "fmp")}
              className="rounded-md bg-pine px-4 py-3 text-sm font-bold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
              disabled={status === "loading"}
            >
              Run live FMP
            </button>
            <button
              type="button"
              onClick={() => void generateExplanation()}
              className="rounded-md border border-line bg-surface px-4 py-3 text-sm font-bold text-ink transition hover:border-pine disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!result || explanation.status === "loading"}
            >
              Explain top pick
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-ink/55">
              Status
            </p>
            <p className="mt-2 text-xl font-bold text-ink">{message}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-normal text-ink/45">
              Source: {result?.dataSource ?? source}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-ink/55">
              Universe
            </p>
            <p className="mt-2 text-xl font-bold text-pine">
              {result ? result.universeCount : "--"} stocks
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-ink/55">
              Selected
            </p>
            <p className="mt-2 text-xl font-bold text-pine">
              {result ? result.selectedCount : "--"}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-ink/55">
              Market regime
            </p>
            <p className="mt-2 text-xl font-bold capitalize text-pine">
              {result ? result.marketRegime : "--"}
            </p>
          </div>
        </div>

        {result ? (
          <div className="mt-5 rounded-lg border border-line bg-surface p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <h2 className="text-lg font-bold text-ink">Estimated deployed run cost</h2>
                <p className="mt-2 text-sm leading-6 text-ink/60">
                  Mock mode is free. This estimate assumes structured data is scored
                  deterministically and the LLM only summarizes the final ranked set.
                </p>
              </div>
              <div className="rounded-md bg-mint px-4 py-3 text-right">
                <p className="text-xs font-bold uppercase tracking-normal text-pine/65">
                  Total estimate
                </p>
                <p className="mt-1 text-2xl font-bold text-pine">
                  ${result.costEstimate.estimatedTotalUsd.toFixed(4)}
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-md border border-line bg-panel p-4">
              <p className="text-xs font-bold uppercase tracking-normal text-ink/55">
                Data verification status
              </p>
              <p className="mt-2 text-sm font-bold text-ink">
                Price data: {result.dataQuality.priceData} / Financial data:{" "}
                {result.dataQuality.financialData} / Macro data:{" "}
                {result.dataQuality.macroData}
              </p>
              <p className="mt-1 text-sm font-bold text-ink">
                News: {result.dataQuality.newsData} / Events:{" "}
                {result.dataQuality.eventData} / SEC: {result.dataQuality.secData}
              </p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink/60">
                {result.dataQuality.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md bg-panel px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-normal text-ink/55">
                  Model
                </p>
                <p className="mt-1 text-sm font-bold text-ink">
                  {result.costEstimate.openAiModel}
                </p>
              </div>
              <div className="rounded-md bg-panel px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-normal text-ink/55">
                  Tokens
                </p>
                <p className="mt-1 text-sm font-bold text-ink">
                  {result.costEstimate.expectedInputTokens.toLocaleString()} in /{" "}
                  {result.costEstimate.expectedOutputTokens.toLocaleString()} out
                </p>
              </div>
              <div className="rounded-md bg-panel px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-normal text-ink/55">
                  Web search
                </p>
                <p className="mt-1 text-sm font-bold text-ink">
                  {result.costEstimate.expectedWebSearchCalls} calls
                </p>
              </div>
              <div className="rounded-md bg-panel px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-normal text-ink/55">
                  SMS alerts
                </p>
                <p className="mt-1 text-sm font-bold text-ink">
                  ${result.costEstimate.estimatedTwilioSmsUsd.toFixed(4)} / customer
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {result ? (
        <section className="min-w-0 rounded-lg border border-line bg-panel p-6 shadow-soft">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-normal text-pine">
                Latest run
              </p>
              <h2 className="mt-3 text-2xl font-bold text-ink">
                {formatDate(result.asOf)}
              </h2>
            </div>
            <p className="text-sm font-semibold text-ink/55">{result.runId}</p>
          </div>
          <p className="mt-4 max-w-4xl leading-7 text-ink/65">{result.summary}</p>

          <div className="mt-6 w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-normal text-ink/55">
                  <th className="py-3 pr-4">Rank</th>
                  <th className="py-3 pr-4">Symbol</th>
                  <th className="py-3 pr-4">Score</th>
                  <th className="py-3 pr-4">Confidence</th>
                  <th className="py-3 pr-4">Risk</th>
                  <th className="py-3 pr-4">Technical</th>
                  <th className="py-3 pr-4">Financial</th>
                  <th className="py-3 pr-4">News</th>
                  <th className="py-3 pr-4">Macro</th>
                  <th className="py-3 pr-4">Calibration</th>
                  <th className="py-3 pr-4">Target</th>
                </tr>
              </thead>
              <tbody>
                {result.rankings.map((item) => (
                  <tr
                    key={`${item.rank}-${item.candidate.symbol}-${item.opportunity.id}`}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="py-4 pr-4 font-bold text-ink">#{item.rank}</td>
                    <td className="py-4 pr-4">
                      <p className="font-bold text-ink">{item.candidate.symbol}</p>
                      <p className="mt-1 text-xs font-semibold text-ink/50">
                        {item.candidate.companyName}
                      </p>
                    </td>
                    <td className="py-4 pr-4 font-bold text-pine">
                      {item.scores.composite}
                    </td>
                    <td className="py-4 pr-4">{item.scores.confidence}</td>
                    <td className="py-4 pr-4">{item.scores.risk}</td>
                    <td className="py-4 pr-4">{item.scores.technical}</td>
                    <td className="py-4 pr-4">{item.scores.financial}</td>
                    <td className="py-4 pr-4">{item.scores.news}</td>
                    <td className="py-4 pr-4">{item.scores.macro}</td>
                    <td className="py-4 pr-4">
                      {item.calibration.length > 0 ? (
                        <div>
                          <p className="font-bold text-coral">
                            -{item.rawScores.composite - item.scores.composite} pts
                          </p>
                          <p className="mt-1 max-w-[180px] text-xs leading-5 text-ink/50">
                            {item.calibration.map((rule) => rule.label).join(", ")}
                          </p>
                        </div>
                      ) : (
                        <span className="font-semibold text-pine">None</span>
                      )}
                    </td>
                    <td className="py-4 pr-4 font-semibold text-pine">
                      ${item.opportunity.target_price.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {result && explanation.status !== "idle" ? (
        <section className="min-w-0 rounded-lg border border-line bg-panel p-6 shadow-soft">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-normal text-pine">
                AI explanation
              </p>
              <h2 className="mt-3 text-2xl font-bold text-ink">
                {explanation.symbol ?? "Top pick"}
              </h2>
            </div>
            <p className="text-sm font-semibold text-ink/55">{explanation.message}</p>
          </div>
          {explanation.text ? (
            <p className="mt-4 max-w-4xl leading-7 text-ink/70">{explanation.text}</p>
          ) : (
            <p className="mt-4 max-w-4xl leading-7 text-ink/60">
              {explanation.message ?? "Waiting for explanation."}
            </p>
          )}
        </section>
      ) : null}

      {topFive.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {topFive.map((item) => (
            <article
              key={`top-${item.rank}-${item.candidate.symbol}-${item.opportunity.id}`}
              className="rounded-lg border border-line bg-panel p-5 shadow-soft"
            >
              <p className="text-xs font-bold uppercase tracking-normal text-pine">
                #{item.rank}
              </p>
              <h3 className="mt-3 text-2xl font-bold text-ink">{item.candidate.symbol}</h3>
              <p className="mt-1 text-sm font-semibold text-ink/55">
                {item.candidate.sector}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-mint px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-normal text-pine/70">
                    Score
                  </p>
                  <p className="font-bold text-pine">{item.scores.composite}</p>
                </div>
                <div className="rounded-md bg-coral/20 px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-normal text-ink/55">
                    Risk
                  </p>
                  <p className="font-bold text-ink">{item.scores.risk}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}
        </>
      )}
    </div>
  );
}
