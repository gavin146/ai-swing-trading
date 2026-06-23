"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCurrentCustomer, type CustomerProfile } from "@/lib/customer-store";

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

function currency(value: number) {
  return `$${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: Number(value) >= 1000 ? 0 : 2,
    minimumFractionDigits: Number(value) >= 1000 ? 0 : 2,
  })}`;
}

function opportunityFor(item: PickHistoryItem) {
  return Array.isArray(item.opportunities) ? item.opportunities[0] : item.opportunities;
}

export function PickHistoryPanel() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [picks, setPicks] = useState<PickHistoryItem[]>([]);
  const [status, setStatus] = useState("Loading saved picks...");

  useEffect(() => {
    const current = getCurrentCustomer();
    setCustomer(current);

    if (!current) {
      setStatus("Create an account or log in to see your saved daily picks.");
      return;
    }

    const params = new URLSearchParams({ email: current.email, limit: "90" });
    fetch(`/api/daily-picks?${params.toString()}`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          error?: string;
          picks?: PickHistoryItem[];
        };

        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? "Could not load saved picks.");
        }

        setPicks(payload.picks ?? []);
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
  }, []);

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
    <section className="mt-8 grid gap-5">
      <div className="rounded-xl border border-line bg-panel p-5 shadow-soft">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-bold text-ink">
              {customer ? `${customer.fullName || customer.email}'s saved lists` : "Account required"}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink/60">{status}</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-line bg-surface px-4 py-3 text-center text-sm font-bold text-ink hover:border-pine"
          >
            Today&apos;s dashboard
          </Link>
        </div>
      </div>

      {grouped.length ? (
        grouped.map((group) => (
          <div key={group.date} className="rounded-xl border border-line bg-panel p-5 shadow-soft">
            <h2 className="text-xl font-black text-ink">{group.date}</h2>
            <div className="mt-4 w-full overflow-x-auto">
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
                        <td className="py-4 pr-4 font-bold text-ink">#{item.rank}</td>
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
                        <td className="py-4 pr-4">{opportunity.holding_period_days} days</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-xl border border-line bg-panel p-6 shadow-soft">
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
