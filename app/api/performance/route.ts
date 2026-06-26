import { NextRequest, NextResponse } from "next/server";
import type { PredictionOutcomeRow } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DailyPickSourceRow = {
  agent_run_id?: string | null;
  id: string;
  opportunity_id?: string | null;
  pick_date: string;
  rank: number;
  opportunities?:
    | {
        symbol?: string | null;
      }
    | Array<{
        symbol?: string | null;
      }>
    | null;
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function normalizeOpportunitySymbol(row: DailyPickSourceRow) {
  const opportunity = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;

  return opportunity?.symbol?.trim().toUpperCase() ?? "";
}

function statusLabel(status: PredictionOutcomeRow["status"]) {
  const labels: Record<PredictionOutcomeRow["status"], string> = {
    entered: "Entered",
    expired: "Expired",
    no_data: "No data",
    no_entry: "No entry",
    pending: "Pending",
    stop_hit: "Stop hit",
    target_hit: "Target hit",
  };

  return labels[status] ?? status;
}

function outcomeKey(outcome: PredictionOutcomeRow) {
  return `${outcome.opportunity_id}:${outcome.prediction_date}`;
}

function pickKey(pick: DailyPickSourceRow) {
  return `${pick.opportunity_id}:${pick.pick_date}`;
}

function isEvaluated(status: PredictionOutcomeRow["status"]) {
  return ["target_hit", "stop_hit", "expired", "no_entry", "no_data"].includes(status);
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const limit = Math.max(1, Math.min(300, Number(request.nextUrl.searchParams.get("limit") ?? 180)));
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      {
        error: "Supabase service role is not configured.",
        source: "empty",
      },
      { status: 503 },
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A customer email is required.", source: "empty" }, { status: 400 });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id,email")
    .eq("email", email)
    .maybeSingle();

  if (userError || !user) {
    return NextResponse.json({
      error: userError?.message ?? "Customer profile was not found.",
      source: "empty",
    });
  }

  const { data: picks, error: picksError } = await supabase
    .from("daily_picks")
    .select("id,pick_date,rank,opportunity_id,agent_run_id,opportunities(symbol)")
    .eq("user_id", user.id)
    .order("pick_date", { ascending: false })
    .order("rank", { ascending: true })
    .limit(limit);

  if (picksError) {
    return NextResponse.json({ error: picksError.message, source: "empty" }, { status: 503 });
  }

  const pickRows = ((picks ?? []) as DailyPickSourceRow[]).filter((pick) => pick.opportunity_id);
  const opportunityIds = Array.from(new Set(pickRows.map((pick) => pick.opportunity_id).filter(Boolean))) as string[];

  if (opportunityIds.length === 0) {
    return NextResponse.json({
      source: "supabase",
      summary: {
        averageExcessReturnPct: 0,
        averageMaxDrawdownPct: 0,
        averageMaxGainPct: 0,
        averageReturnPct: 0,
        beatBenchmarkRate: 0,
        evaluatedCount: 0,
        openCount: 0,
        pendingCount: 0,
        stopHitRate: 0,
        targetHitRate: 0,
        totalPicks: 0,
        trackedCount: 0,
      },
      outcomes: [],
      message: "No customer picks have been saved yet.",
    });
  }

  const { data: outcomes, error: outcomesError } = await supabase
    .from("prediction_outcomes")
    .select("*")
    .in("opportunity_id", opportunityIds)
    .order("prediction_date", { ascending: false })
    .limit(Math.max(limit, 300));

  if (outcomesError) {
    return NextResponse.json({
      source: "supabase",
      error: outcomesError.message,
      summary: {
        averageExcessReturnPct: 0,
        averageMaxDrawdownPct: 0,
        averageMaxGainPct: 0,
        averageReturnPct: 0,
        beatBenchmarkRate: 0,
        evaluatedCount: 0,
        openCount: 0,
        pendingCount: 0,
        stopHitRate: 0,
        targetHitRate: 0,
        totalPicks: pickRows.length,
        trackedCount: 0,
      },
      outcomes: [],
    });
  }

  const outcomeRows = (outcomes ?? []) as PredictionOutcomeRow[];
  const outcomeByPick = new Map(outcomeRows.map((outcome) => [outcomeKey(outcome), outcome]));
  const combined = pickRows
    .map((pick) => {
      const outcome = outcomeByPick.get(pickKey(pick));

      return {
        entryDate: outcome?.entry_date ?? null,
        evaluatedAt: outcome?.evaluated_at ?? null,
        excessReturnPct: outcome?.excess_return_pct ?? null,
        exitDate: outcome?.exit_date ?? null,
        maxDrawdownPct: outcome?.max_drawdown_pct ?? null,
        maxGainPct: outcome?.max_gain_pct ?? null,
        pickDate: pick.pick_date,
        qqqReturnPct: outcome?.qqq_return_pct ?? null,
        rank: pick.rank,
        returnPct: outcome?.return_pct ?? null,
        score: outcome?.score ?? null,
        spyReturnPct: outcome?.spy_return_pct ?? null,
        status: outcome?.status ?? "pending",
        statusLabel: statusLabel(outcome?.status ?? "pending"),
        symbol: outcome?.symbol ?? normalizeOpportunitySymbol(pick),
        targetPrice: outcome?.target_price ?? null,
        tracked: Boolean(outcome),
      };
    })
    .filter((item) => item.symbol);

  const tracked = combined.filter((item) => item.tracked);
  const evaluated = tracked.filter((item) => isEvaluated(item.status));
  const completedReturns = evaluated.map((item) => item.returnPct ?? 0);
  const excessReturns = evaluated
    .map((item) => item.excessReturnPct)
    .filter((value): value is number => typeof value === "number");
  const beatBenchmarkCount = evaluated.filter((item) => (item.excessReturnPct ?? 0) > 0).length;
  const targetHitCount = evaluated.filter((item) => item.status === "target_hit").length;
  const stopHitCount = evaluated.filter((item) => item.status === "stop_hit").length;
  const latestDate = combined.map((item) => item.pickDate).sort().at(-1) ?? null;

  return NextResponse.json({
    source: "supabase",
    customer: { email: user.email, id: user.id },
    latestDate,
    message:
      evaluated.length >= 20
        ? "SwingFi has enough evaluated picks to show early reliability trends."
        : "SwingFi is tracking outcomes, but more evaluated picks are needed before making strong performance claims.",
    outcomes: combined.slice(0, limit),
    summary: {
      averageExcessReturnPct: round(average(excessReturns), 2),
      averageMaxDrawdownPct: round(average(evaluated.map((item) => item.maxDrawdownPct ?? 0)), 2),
      averageMaxGainPct: round(average(evaluated.map((item) => item.maxGainPct ?? 0)), 2),
      averageReturnPct: round(average(completedReturns), 2),
      beatBenchmarkRate: evaluated.length ? round((beatBenchmarkCount / evaluated.length) * 100, 1) : 0,
      evaluatedCount: evaluated.length,
      openCount: tracked.filter((item) => item.status === "entered").length,
      pendingCount: combined.filter((item) => item.status === "pending").length,
      stopHitRate: evaluated.length ? round((stopHitCount / evaluated.length) * 100, 1) : 0,
      targetHitRate: evaluated.length ? round((targetHitCount / evaluated.length) * 100, 1) : 0,
      totalPicks: combined.length,
      trackedCount: tracked.length,
    },
  });
}
