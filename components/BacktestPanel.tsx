"use client";

import { useEffect, useMemo, useState } from "react";
import type { BacktestSummary } from "@/lib/backtesting";

type BacktestState = "idle" | "loading" | "ready" | "error";

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function outcomeLabel(value: string) {
  if (value === "target_hit") return "Target hit";
  if (value === "stop_hit") return "Stop hit";
  if (value === "expired") return "Expired";
  return "No data";
}

export function BacktestPanel() {
  const [status, setStatus] = useState<BacktestState>("idle");
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [message, setMessage] = useState("Ready to verify recent picks");

  async function runBacktest() {
    setStatus("loading");
    setMessage("Running rolling verification against historical candles...");

    try {
      const response = await fetch("/api/backtests/rolling?windows=5&intervalDays=21&limit=6");

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Backtest failed");
      }

      const payload = (await response.json()) as BacktestSummary;
      setSummary(payload);
      setStatus("ready");
      setMessage("Verification run complete");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Verification run failed");
    }
  }

  useEffect(() => {
    void runBacktest();
  }, []);

  const recentTrades = useMemo(() => summary?.trades.slice(0, 12) ?? [], [summary]);

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-pine">
              Performance verification
            </p>
            <h1 className="mt-3 text-4xl font-bold text-ink">Rolling backtest</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-ink/65">
              Tests recent historical ranking windows against future FMP candles to
              measure target hits, stop hits, average return, drawdown, and score-band
              quality.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runBacktest()}
            className="rounded-md bg-pine px-4 py-3 text-sm font-bold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "loading"}
          >
            Run verification
          </button>
        </div>

        <div className="mt-6 rounded-lg border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-normal text-ink/55">Status</p>
          <p className="mt-2 text-xl font-bold text-ink">{message}</p>
        </div>
      </section>

      {summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-normal text-ink/55">
                Target hit rate
              </p>
              <p className="mt-2 text-3xl font-bold text-pine">{summary.targetHitRate}%</p>
            </div>
            <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-normal text-ink/55">
                Stop hit rate
              </p>
              <p className="mt-2 text-3xl font-bold text-coral">{summary.stopHitRate}%</p>
            </div>
            <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-normal text-ink/55">
                Avg return
              </p>
              <p className="mt-2 text-3xl font-bold text-ink">
                {formatPercent(summary.averageReturnPct)}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-normal text-ink/55">
                Trades tested
              </p>
              <p className="mt-2 text-3xl font-bold text-ink">{summary.tradesTested}</p>
            </div>
            <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-normal text-ink/55">
                Avg reward/risk
              </p>
              <p className="mt-2 text-3xl font-bold text-ink">
                {summary.averageRewardRiskRatio.toFixed(2)}R
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
            <h2 className="text-2xl font-bold text-ink">Score bands</h2>
            <div className="mt-5 w-full overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-normal text-ink/55">
                    <th className="py-3 pr-4">Band</th>
                    <th className="py-3 pr-4">Trades</th>
                    <th className="py-3 pr-4">Target hit</th>
                    <th className="py-3 pr-4">Avg return</th>
                    <th className="py-3 pr-4">Avg risk</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.scoreBands.map((band) => (
                    <tr key={band.label} className="border-b border-line last:border-b-0">
                      <td className="py-4 pr-4 font-bold text-ink">{band.label}</td>
                      <td className="py-4 pr-4">{band.count}</td>
                      <td className="py-4 pr-4 font-semibold text-pine">
                        {band.targetHitRate}%
                      </td>
                      <td className="py-4 pr-4">{formatPercent(band.averageReturnPct)}</td>
                      <td className="py-4 pr-4">{band.averageRiskScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
            <h2 className="text-2xl font-bold text-ink">Recent simulated trades</h2>
            <div className="mt-5 w-full overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-normal text-ink/55">
                    <th className="py-3 pr-4">As of</th>
                    <th className="py-3 pr-4">Entry</th>
                    <th className="py-3 pr-4">Symbol</th>
                    <th className="py-3 pr-4">Rank</th>
                    <th className="py-3 pr-4">Score</th>
                    <th className="py-3 pr-4">Risk</th>
                    <th className="py-3 pr-4">Outcome</th>
                    <th className="py-3 pr-4">R/R</th>
                    <th className="py-3 pr-4">Return</th>
                    <th className="py-3 pr-4">Max gain</th>
                    <th className="py-3 pr-4">Max drawdown</th>
                    <th className="py-3 pr-4">Exit</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade) => (
                    <tr
                      key={`${trade.asOf}-${trade.symbol}-${trade.rank}`}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className="py-4 pr-4 font-semibold text-ink">{trade.asOf}</td>
                      <td className="py-4 pr-4">{trade.entryDate ?? "--"}</td>
                      <td className="py-4 pr-4 font-bold text-ink">{trade.symbol}</td>
                      <td className="py-4 pr-4">#{trade.rank}</td>
                      <td className="py-4 pr-4">{trade.score}</td>
                      <td className="py-4 pr-4">{trade.riskScore}</td>
                      <td className="py-4 pr-4 font-semibold text-pine">
                        {outcomeLabel(trade.outcome)}
                      </td>
                      <td className="py-4 pr-4">{trade.rewardRiskRatio.toFixed(2)}R</td>
                      <td className="py-4 pr-4">{formatPercent(trade.returnPct)}</td>
                      <td className="py-4 pr-4">{formatPercent(trade.maxGainPct)}</td>
                      <td className="py-4 pr-4">{formatPercent(trade.maxDrawdownPct)}</td>
                      <td className="py-4 pr-4">{trade.exitDate ?? "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
            <h2 className="text-2xl font-bold text-ink">Method notes</h2>
            <ul className="mt-4 grid gap-2 text-sm leading-6 text-ink/65">
              {summary.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
