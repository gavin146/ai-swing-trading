"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getAccessState,
  getCurrentCustomer,
  restoreAuthenticatedCustomerSession,
  type CustomerProfile,
} from "@/lib/customer-store";

type PickHistoryItem = {
  id: string;
  pick_date: string;
  rank: number;
  opportunities:
    | {
        symbol: string;
        score: number;
        confidence: number;
        risk_score: number;
        entry_low: number;
        entry_high: number;
        target_price: number;
        stop_loss: number;
        expected_gain: number;
        expected_loss: number;
        holding_period_days: number;
      }
    | Array<{
        symbol: string;
        score: number;
        confidence: number;
        risk_score: number;
        entry_low: number;
        entry_high: number;
        target_price: number;
        stop_loss: number;
        expected_gain: number;
        expected_loss: number;
        holding_period_days: number;
      }>;
};

type PerformanceOutcome = {
  evaluatedAt: string | null;
  excessReturnPct: number | null;
  maxDrawdownPct: number | null;
  maxGainPct: number | null;
  pickDate: string;
  rank: number;
  returnPct: number | null;
  score: number | null;
  status: string;
  statusLabel: string;
  symbol: string;
  tracked: boolean;
};

type PerformanceSummary = {
  averageExcessReturnPct: number;
  averageMaxDrawdownPct: number;
  averageMaxGainPct: number;
  averageReturnPct: number;
  beatBenchmarkRate: number;
  evaluatedCount: number;
  openCount: number;
  pendingCount: number;
  stopHitRate: number;
  targetHitRate: number;
  totalPicks: number;
  trackedCount: number;
};

type PerformancePayload = {
  latestDate?: string | null;
  message?: string;
  outcomes?: PerformanceOutcome[];
  summary?: PerformanceSummary;
};

function currency(value: number) {
  return `$${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: Number(value) >= 1000 ? 0 : 2,
    minimumFractionDigits: Number(value) >= 1000 ? 0 : 2,
  })}`;
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function outcomePercent(outcome: PerformanceOutcome, key: "excessReturnPct" | "maxGainPct" | "returnPct") {
  if (!["target_hit", "stop_hit", "expired", "no_entry", "no_data"].includes(outcome.status)) {
    return "--";
  }

  return percent(outcome[key]);
}

function outcomeTone(status: string) {
  if (status === "target_hit") return "bg-mint text-pine border-pine/20";
  if (status === "stop_hit") return "bg-coral/10 text-coral border-coral/25";
  if (status === "entered") return "bg-sky text-ink border-line";
  if (status === "pending") return "bg-surface text-ink/62 border-line";

  return "bg-white text-ink/62 border-line";
}

function PerformanceStat({
  description,
  label,
  tone = "neutral",
  value,
}: {
  description: string;
  label: string;
  tone?: "neutral" | "positive" | "risk";
  value: string | number;
}) {
  const toneClass = {
    neutral: "bg-white text-ink",
    positive: "bg-mint text-pine",
    risk: "bg-coral/10 text-coral",
  }[tone];

  return (
    <div className={`rounded-2xl border border-line/80 p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-normal opacity-60">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-ink/55">{description}</p>
    </div>
  );
}

function opportunityFor(item: PickHistoryItem) {
  return Array.isArray(item.opportunities) ? item.opportunities[0] : item.opportunities;
}

export function PickHistoryPanel() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [performance, setPerformance] = useState<PerformancePayload | null>(null);
  const [picks, setPicks] = useState<PickHistoryItem[]>([]);
  const [status, setStatus] = useState("Loading saved picks...");

  useEffect(() => {
    async function load() {
      const current = (await restoreAuthenticatedCustomerSession().catch(() => null)) ?? getCurrentCustomer();
      setCustomer(current);

      if (!current) {
        setStatus("Create an account or log in to see your saved daily picks.");
        return;
      }

      if (!getAccessState(current).canViewAnalysis) {
        setStatus("Your free trial has ended. Subscribe to unlock saved stock analysis history.");
        return;
      }

      const params = new URLSearchParams({ email: current.email, limit: "90" });
      Promise.all([
        fetch(`/api/daily-picks?${params.toString()}`),
        fetch(`/api/performance?${params.toString()}`),
      ])
        .then(async (response) => {
          const [dailyPicksResponse, performanceResponse] = response;
          const payload = (await dailyPicksResponse.json()) as {
            error?: string;
            picks?: PickHistoryItem[];
          };
          const performancePayload = (await performanceResponse.json().catch(() => null)) as
            | (PerformancePayload & { error?: string })
            | null;

          if (!dailyPicksResponse.ok || payload.error) {
            throw new Error(payload.error ?? "Could not load saved picks.");
          }

          setPicks(payload.picks ?? []);
          if (performanceResponse.ok && performancePayload && !performancePayload.error) {
            setPerformance(performancePayload);
          } else {
            setPerformance(null);
          }
          setStatus(
            payload.picks?.length
              ? "Showing personalized picks saved from morning agent runs."
              : "No saved daily picks are available yet.",
          );
        })
        .catch((error) => {
          setPicks([]);
          setStatus(error instanceof Error ? error.message : "Could not load saved picks.");
        });
    }

    load();
  }, []);

  const performanceSummary = performance?.summary;
  const recentOutcomes = performance?.outcomes?.filter((item) => item.tracked).slice(0, 8) ?? [];

  const grouped = useMemo(() => {
    const groups = new Map<string, PickHistoryItem[]>();

    for (const pick of picks) {
      const group = groups.get(pick.pick_date) ?? [];
      group.push(pick);
      groups.set(pick.pick_date, group);
    }

    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items: items.sort((a, b) => a.rank - b.rank),
    }));
  }, [picks]);

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_20px_70px_rgba(7,20,24,0.07)]">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              Customer archive
            </p>
            <h2 className="mt-2 text-2xl font-black text-ink">
              {customer ? `${customer.fullName || customer.email}'s saved lists` : "Account required"}
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-ink/60">{status}</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-bold text-ink hover:border-pine"
          >
            Today&apos;s dashboard
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_20px_70px_rgba(7,20,24,0.07)]">
        <div className="grid gap-0 xl:grid-cols-[340px_1fr]">
          <div className="bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Performance center
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-normal">
              Is SwingFi improving?
            </h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/66">
              We track whether saved picks entered the range, hit targets, hit stops,
              and beat market benchmarks. This is how SwingFi becomes measurable
              research instead of a static idea list.
            </p>
            <p className="mt-5 rounded-2xl border border-white/14 bg-white/8 p-4 text-xs font-semibold leading-5 text-white/58">
              {performance?.message ??
                "Outcome tracking appears after daily picks and prediction evaluations are saved."}
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PerformanceStat
                description="Picks with completed outcome checks."
                label="Evaluated"
                value={`${performanceSummary?.evaluatedCount ?? 0}/${performanceSummary?.totalPicks ?? picks.length}`}
              />
              <PerformanceStat
                description="Evaluated picks that reached target."
                label="Target hit"
                tone="positive"
                value={`${performanceSummary?.targetHitRate ?? 0}%`}
              />
              <PerformanceStat
                description="Evaluated picks that hit stop loss."
                label="Stop hit"
                tone="risk"
                value={`${performanceSummary?.stopHitRate ?? 0}%`}
              />
              <PerformanceStat
                description="Average return versus SPY/QQQ benchmark blend."
                label="Excess return"
                tone={(performanceSummary?.averageExcessReturnPct ?? 0) >= 0 ? "positive" : "risk"}
                value={percent(performanceSummary?.averageExcessReturnPct)}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <PerformanceStat
                description="Average return after evaluation."
                label="Avg return"
                tone={(performanceSummary?.averageReturnPct ?? 0) >= 0 ? "positive" : "risk"}
                value={percent(performanceSummary?.averageReturnPct)}
              />
              <PerformanceStat
                description="Average best move after entry."
                label="Max gain"
                tone="positive"
                value={percent(performanceSummary?.averageMaxGainPct)}
              />
              <PerformanceStat
                description="Average worst move after entry."
                label="Drawdown"
                tone="risk"
                value={percent(performanceSummary?.averageMaxDrawdownPct)}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-line bg-surface/70 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-normal text-pine">
                Recent tracked outcomes
              </p>
              <h3 className="mt-1 text-2xl font-black text-ink">
                Proof points behind the rankings
              </h3>
            </div>
            <p className="text-sm font-semibold text-ink/54">
              {performanceSummary?.pendingCount ?? 0} pending · {performanceSummary?.openCount ?? 0} open
            </p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {recentOutcomes.length ? (
              recentOutcomes.map((outcome) => (
                <Link
                  key={`${outcome.symbol}-${outcome.pickDate}-${outcome.rank}`}
                  href={`/opportunities/${outcome.symbol}`}
                  className="rounded-2xl border border-line bg-white p-4 transition hover:border-pine/35"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                        {outcome.pickDate} · Rank #{outcome.rank}
                      </p>
                      <p className="mt-1 text-2xl font-black text-ink">{outcome.symbol}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${outcomeTone(outcome.status)}`}>
                      {outcome.statusLabel}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-surface p-3">
                      <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                        Return
                      </p>
                      <p className="mt-1 font-black text-ink">{outcomePercent(outcome, "returnPct")}</p>
                    </div>
                    <div className="rounded-xl bg-surface p-3">
                      <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                        Max gain
                      </p>
                      <p className="mt-1 font-black text-pine">{outcomePercent(outcome, "maxGainPct")}</p>
                    </div>
                    <div className="rounded-xl bg-surface p-3">
                      <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                        Vs market
                      </p>
                      <p className="mt-1 font-black text-ink">{outcomePercent(outcome, "excessReturnPct")}</p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-line bg-white p-5 lg:col-span-2">
                <p className="text-sm font-black uppercase tracking-normal text-pine">
                  Outcome tracking is waiting for more data
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">
                  After the prediction evaluation job runs, recent pick outcomes will
                  appear here with return, drawdown, target, stop, and benchmark context.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {grouped.length ? (
        grouped.map((group) => (
          <div key={group.date} className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_20px_70px_rgba(7,20,24,0.07)]">
            <div className="flex flex-col gap-2 border-b border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-pine">
                  Morning run
                </p>
                <h2 className="mt-1 text-xl font-black text-ink">{group.date}</h2>
              </div>
              <span className="rounded-full bg-mint px-3 py-1 text-xs font-black text-pine">
                {group.items.length} saved picks
              </span>
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {group.items.map((item) => {
                const opportunity = opportunityFor(item);

                if (!opportunity) return null;

                return (
                  <Link
                    key={item.id}
                    href={`/opportunities/${opportunity.symbol}`}
                    className="rounded-2xl border border-line bg-white p-4 shadow-[0_10px_28px_rgba(7,20,24,0.045)] transition hover:border-pine/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                          Rank #{item.rank}
                        </p>
                        <p className="mt-1 text-2xl font-black text-ink">
                          {opportunity.symbol}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-mint px-3 py-2 text-right">
                        <p className="text-xs font-black uppercase tracking-normal text-pine/65">
                          Score
                        </p>
                        <p className="text-xl font-black text-pine">{opportunity.score}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-surface p-3">
                        <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                          Confidence
                        </p>
                        <p className="mt-1 font-black text-ink">{opportunity.confidence}/100</p>
                      </div>
                      <div className="rounded-xl bg-surface p-3">
                        <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                          Risk
                        </p>
                        <p className="mt-1 font-black text-coral">{opportunity.risk_score}/100</p>
                      </div>
                      <div className="rounded-xl bg-surface p-3">
                        <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                          Target
                        </p>
                        <p className="mt-1 font-black text-pine">
                          {currency(opportunity.target_price)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-surface p-3">
                        <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                          Stop
                        </p>
                        <p className="mt-1 font-black text-coral">
                          {currency(opportunity.stop_loss)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-bold text-ink/48">
                      Entry {currency(opportunity.entry_low)} - {currency(opportunity.entry_high)}
                      {" · "}
                      {opportunity.holding_period_days} day plan
                    </p>
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 hidden w-full overflow-x-auto md:block">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-normal text-ink/55">
                    <th className="py-3 pr-4">Rank</th>
                    <th className="py-3 pr-4">Symbol</th>
                    <th className="py-3 pr-4">Score</th>
                    <th className="py-3 pr-4">Confidence</th>
                    <th className="py-3 pr-4">Risk</th>
                    <th className="py-3 pr-4">Entry</th>
                    <th className="py-3 pr-4">Target</th>
                    <th className="py-3 pr-4">Stop</th>
                    <th className="py-3 pr-4">Hold</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => {
                    const opportunity = opportunityFor(item);

                    if (!opportunity) return null;

                    return (
                      <tr key={item.id} className="border-b border-line last:border-b-0">
                        <td className="py-4 pl-5 pr-4 font-bold text-ink">#{item.rank}</td>
                        <td className="py-4 pr-4">
                          <Link
                            href={`/opportunities/${opportunity.symbol}`}
                            className="font-black text-pine hover:text-ink"
                          >
                            {opportunity.symbol}
                          </Link>
                        </td>
                        <td className="py-4 pr-4 font-bold text-pine">{opportunity.score}</td>
                        <td className="py-4 pr-4">{opportunity.confidence}</td>
                        <td className="py-4 pr-4">{opportunity.risk_score}</td>
                        <td className="py-4 pr-4">
                          {currency(opportunity.entry_low)} - {currency(opportunity.entry_high)}
                        </td>
                        <td className="py-4 pr-4 font-bold text-pine">
                          {currency(opportunity.target_price)}
                        </td>
                        <td className="py-4 pr-4 font-bold text-coral">
                          {currency(opportunity.stop_loss)}
                        </td>
                        <td className="py-4 pr-5">{opportunity.holding_period_days} days</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-3xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-black uppercase tracking-normal text-pine">
            Waiting for saved picks
          </p>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            The next successful morning agent run will save personalized picks here.
          </p>
        </div>
      )}
    </section>
  );
}
