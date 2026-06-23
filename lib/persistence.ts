import type {
  AgentRunResult,
  RankedEquityOpportunity,
  RankingCalibrationRule,
} from "@/lib/agent";
import type { BacktestSummary } from "@/lib/backtesting";
import type {
  AccountBudget,
  AlertChannel,
  AlertStatus,
  Json,
  OpportunityRow,
  RiskProfile,
  SetupPreference,
} from "@/lib/database.types";
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/server";

type PersistenceResult = {
  persisted: boolean;
  reason?: string;
  error?: string;
};

export type MorningAlertRecipient = {
  userId: string | null;
  email: string;
  fullName: string;
};

function notConfigured(): PersistenceResult {
  return {
    persisted: false,
    reason:
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable persistence.",
  };
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isUuid(value: string | null | undefined) {
  return Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  );
}

function cleanUserId(value: string | null | undefined) {
  return isUuid(value) ? value : null;
}

type PickUserPreference = {
  id: string;
  account_budget: AccountBudget;
  max_risk_score: number;
  minimum_confidence: number;
  position_size_preference: "small" | "moderate" | "aggressive";
  risk_profile: RiskProfile;
  setup_preference: SetupPreference;
};

function dailyPickLimit(user: PickUserPreference) {
  const riskLimit =
    user.risk_profile === "conservative" ? 12 : user.risk_profile === "aggressive" ? 30 : 20;
  const budgetLimit =
    user.account_budget === "under_1000"
      ? 12
      : user.account_budget === "1000_5000"
        ? 16
        : 30;

  return Math.min(riskLimit, budgetLimit);
}

function personalizedPickScore(opportunity: OpportunityRow, user: PickUserPreference) {
  const confidenceGap = Math.max(0, user.minimum_confidence - opportunity.confidence);
  const riskGap = Math.max(0, opportunity.risk_score - user.max_risk_score);
  let penalty = confidenceGap * 1.1 + riskGap * 1.25;

  if (user.risk_profile === "conservative") {
    penalty += Math.max(0, opportunity.risk_score - 45) * 0.35;
    penalty -= opportunity.confidence >= 78 && opportunity.risk_score <= 45 ? 5 : 0;
  }

  if (user.risk_profile === "aggressive") {
    penalty -= opportunity.score >= 75 && opportunity.expected_gain >= 7 ? 4 : 0;
    penalty += opportunity.confidence < 62 ? 6 : 0;
  }

  if (user.position_size_preference === "small") {
    penalty += Math.max(0, opportunity.risk_score - 55) * 0.3;
  }

  if (user.position_size_preference === "aggressive") {
    penalty -= opportunity.score >= 72 && opportunity.expected_gain >= 6 ? 2 : 0;
  }

  if (user.setup_preference === "steady") {
    penalty += Math.max(0, opportunity.risk_score - 50) * 0.35;
    penalty -= opportunity.confidence >= 75 && opportunity.risk_score <= 50 ? 3 : 0;
  }

  if (user.setup_preference === "momentum") {
    penalty -= opportunity.score >= 75 && opportunity.expected_gain >= 8 ? 4 : 0;
    penalty += opportunity.confidence < 65 ? 4 : 0;
  }

  if (user.account_budget === "under_1000") {
    penalty += Math.max(0, opportunity.risk_score - 50) * 0.25;
  }

  if (user.account_budget === "1000_5000") {
    penalty += Math.max(0, opportunity.risk_score - 60) * 0.15;
  }

  return opportunity.score * 1.15 + opportunity.confidence * 0.3 - opportunity.risk_score * 0.22 - penalty;
}

async function persistPersonalizedDailyPicks(result: AgentRunResult) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) return notConfigured();

  const { data: users, error: userError } = await supabase
    .from("users")
    .select(
      "id,risk_profile,account_budget,position_size_preference,setup_preference,minimum_confidence,max_risk_score",
    )
    .is("email_unsubscribed_at", null)
    .limit(1000);

  if (userError) {
    return { persisted: false, error: userError.message } satisfies PersistenceResult;
  }

  if (!users?.length) {
    return { persisted: true, reason: "No users available for personalized daily picks." };
  }

  const pickDate = result.asOf.slice(0, 10);
  const { error: deleteError } = await supabase
    .from("daily_picks")
    .delete()
    .eq("pick_date", pickDate);

  if (deleteError) {
    return { persisted: false, error: deleteError.message } satisfies PersistenceResult;
  }

  const rows = users.flatMap((user) => {
    const preferences = {
      id: String(user.id),
      account_budget: (user.account_budget ?? "not_set") as AccountBudget,
      max_risk_score: Number(user.max_risk_score ?? 65),
      minimum_confidence: Number(user.minimum_confidence ?? 70),
      position_size_preference: (user.position_size_preference ?? "small") as PickUserPreference["position_size_preference"],
      risk_profile: (user.risk_profile ?? "balanced") as RiskProfile,
      setup_preference: (user.setup_preference ?? "balanced") as SetupPreference,
    } satisfies PickUserPreference;
    const ranked = result.rankings
      .map((item, index) => {
        const opportunity = item.opportunity;
        const directMatch =
          opportunity.confidence >= preferences.minimum_confidence &&
          opportunity.risk_score <= preferences.max_risk_score;

        return {
          directMatch,
          index,
          item,
          score: personalizedPickScore(opportunity, preferences),
        };
      })
      .sort((a, b) => {
        if (a.directMatch !== b.directMatch) return a.directMatch ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      })
      .slice(0, dailyPickLimit(preferences));

    return ranked.map((entry, index) => ({
      user_id: preferences.id,
      opportunity_id: entry.item.opportunity.id,
      agent_run_id: result.runId,
      rank: index + 1,
      pick_date: pickDate,
    }));
  });

  if (rows.length === 0) {
    return { persisted: true, reason: "No personalized daily pick rows generated." };
  }

  const { error: insertError } = await supabase.from("daily_picks").insert(rows);

  return {
    persisted: !insertError,
    error: insertError?.message,
  } satisfies PersistenceResult;
}

export function isPersistenceConfigured() {
  return hasSupabaseAdminConfig();
}

export async function recordAppEvent(args: {
  level: "info" | "warning" | "error";
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return notConfigured();
  }

  const { error } = await supabase.from("app_event_logs").insert({
    level: args.level,
    source: args.source,
    message: args.message,
    metadata: asJson(args.metadata ?? {}),
  });

  return {
    persisted: !error,
    error: error?.message,
  } satisfies PersistenceResult;
}

export async function persistAgentRun(result: AgentRunResult) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return notConfigured();
  }

  const { error: runError } = await supabase.from("agent_runs").upsert(
    {
      id: result.runId,
      status: "completed",
      source: result.dataSource,
      universe_count: result.universeCount,
      selected_count: result.selectedCount,
      market_regime: result.marketRegime,
      summary: result.summary,
      data_quality: asJson(result.dataQuality),
      cost_estimate: asJson(result.costEstimate),
      started_at: result.asOf,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (runError) {
    await recordAppEvent({
      level: "error",
      source: "persistAgentRun",
      message: "Failed to save agent run.",
      metadata: { error: runError.message, runId: result.runId },
    });

    return { persisted: false, error: runError.message } satisfies PersistenceResult;
  }

  const { error: opportunityError } = await supabase
    .from("opportunities")
    .upsert(result.opportunities, { onConflict: "id" });

  if (opportunityError) {
    return { persisted: false, error: opportunityError.message } satisfies PersistenceResult;
  }

  const { error: deleteRankingError } = await supabase
    .from("opportunity_rankings")
    .delete()
    .eq("agent_run_id", result.runId);

  if (deleteRankingError) {
    return { persisted: false, error: deleteRankingError.message } satisfies PersistenceResult;
  }

  const rankingRows = result.rankings.map((ranking) => ({
    agent_run_id: result.runId,
    opportunity_id: ranking.opportunity.id,
    rank: ranking.rank,
    technical_score: ranking.scores.technical,
    financial_score: ranking.scores.financial,
    news_score: ranking.scores.news,
    macro_score: ranking.scores.macro,
    liquidity_score: ranking.scores.liquidity,
    risk_score: ranking.scores.risk,
    confidence_score: ranking.scores.confidence,
    raw_composite_score: ranking.rawScores.composite,
    composite_score: ranking.scores.composite,
    calibration_rules: asJson(ranking.calibration),
  }));
  const { error: rankingError } = await supabase
    .from("opportunity_rankings")
    .insert(rankingRows);

  if (rankingError) {
    return { persisted: false, error: rankingError.message } satisfies PersistenceResult;
  }

  const dailyPicks = await persistPersonalizedDailyPicks(result);
  if (!dailyPicks.persisted) {
    return { persisted: false, error: dailyPicks.error } satisfies PersistenceResult;
  }

  return { persisted: true } satisfies PersistenceResult;
}

export async function getMorningAlertRecipients() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    const configured = process.env.ALERT_CUSTOMER_EMAILS ?? process.env.ALERT_TEST_EMAIL ?? "";
    const envRecipients = configured
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email) => ({
        userId: null,
        email,
        fullName: process.env.ALERT_TEST_CUSTOMER_NAME ?? "",
      }));

    return {
      recipients: envRecipients,
      source: "environment" as const,
      persistence: notConfigured(),
    };
  }

  const { data, error } = await supabase
    .from("users")
    .select("id,email,full_name")
    .eq("morning_alerts_enabled", true)
    .eq("alert_channel", "email")
    .is("email_unsubscribed_at", null);

  if (error) {
    await recordAppEvent({
      level: "error",
      source: "getMorningAlertRecipients",
      message: "Failed to load email alert recipients.",
      metadata: { error: error.message },
    });

    return {
      recipients: [] as MorningAlertRecipient[],
      source: "supabase" as const,
      persistence: { persisted: false, error: error.message } satisfies PersistenceResult,
    };
  }

  return {
    recipients: (data ?? []).map((user) => ({
      userId: user.id,
      email: user.email,
      fullName: user.full_name ?? "",
    })) satisfies MorningAlertRecipient[],
    source: "supabase" as const,
    persistence: { persisted: true } satisfies PersistenceResult,
  };
}

export async function persistAlertLog(args: {
  userId?: string | null;
  agentRunId?: string | null;
  channel: AlertChannel;
  status: AlertStatus;
  recipient: string;
  message: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return notConfigured();
  }

  const { error } = await supabase.from("alert_logs").insert({
    user_id: cleanUserId(args.userId),
    agent_run_id: cleanUserId(args.agentRunId),
    channel: args.channel,
    status: args.status,
    recipient: args.recipient,
    message: args.message,
    provider_message_id: args.providerMessageId ?? null,
    error_message: args.errorMessage ?? null,
    sent_at: args.sentAt ?? (args.status === "sent" || args.status === "queued" ? new Date().toISOString() : null),
  });

  return {
    persisted: !error,
    error: error?.message,
  } satisfies PersistenceResult;
}

function toRuleInsert(rule: RankingCalibrationRule, backtestRunId: string | null) {
  return {
    source_backtest_run_id: backtestRunId,
    rule_key: rule.ruleKey,
    label: rule.label,
    description: rule.description,
    trigger_config: asJson({ ruleKey: rule.ruleKey }),
    trigger_description: rule.triggerDescription,
    score_penalty: rule.scorePenalty,
    confidence_penalty: rule.confidencePenalty,
    risk_adjustment: rule.riskAdjustment,
    sample_size: rule.sampleSize,
    target_hit_rate: rule.targetHitRate,
    stop_hit_rate: rule.stopHitRate,
    average_return_pct: rule.averageReturnPct,
    confidence: rule.confidence,
    active: rule.active,
  };
}

export async function persistBacktestSummary(summary: BacktestSummary) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return notConfigured();
  }

  const { data: run, error: runError } = await supabase
    .from("backtest_runs")
    .insert({
      generated_at: summary.generatedAt,
      windows_tested: summary.windowsTested,
      trades_tested: summary.tradesTested,
      target_hit_rate: summary.targetHitRate,
      stop_hit_rate: summary.stopHitRate,
      expired_rate: summary.expiredRate,
      average_return_pct: summary.averageReturnPct,
      average_max_gain_pct: summary.averageMaxGainPct,
      average_max_drawdown_pct: summary.averageMaxDrawdownPct,
      average_reward_risk_ratio: summary.averageRewardRiskRatio,
      average_score: summary.averageScore,
      symbols: summary.symbols,
      score_bands: asJson(summary.scoreBands),
      learning_summary: summary.learningFeedback.summary,
      openai_instruction: summary.learningFeedback.openAiInstruction,
      notes: summary.notes,
    })
    .select("id")
    .single();

  if (runError || !run) {
    return {
      persisted: false,
      error: runError?.message ?? "Backtest run insert failed.",
    } satisfies PersistenceResult;
  }

  const tradeRows = summary.trades.map((trade) => ({
    backtest_run_id: run.id,
    as_of: trade.asOf,
    symbol: trade.symbol,
    rank: trade.rank,
    score: trade.score,
    confidence: trade.confidence,
    risk_score: trade.riskScore,
    entry_date: trade.entryDate,
    entry_price: trade.entryPrice,
    target_price: trade.targetPrice,
    stop_loss: trade.stopLoss,
    reward_risk_ratio: trade.rewardRiskRatio,
    holding_period_days: trade.holdingPeriodDays,
    outcome: trade.outcome,
    exit_date: trade.exitDate,
    exit_price: trade.exitPrice,
    return_pct: trade.returnPct,
    max_gain_pct: trade.maxGainPct,
    max_drawdown_pct: trade.maxDrawdownPct,
  }));
  const { error: tradeError } = tradeRows.length
    ? await supabase.from("backtest_trades").insert(tradeRows)
    : { error: null };

  if (tradeError) {
    return { persisted: false, error: tradeError.message } satisfies PersistenceResult;
  }

  const { error: deactivateError } = await supabase
    .from("ranking_calibration_rules")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("active", true);

  if (deactivateError) {
    return { persisted: false, error: deactivateError.message } satisfies PersistenceResult;
  }

  const { error: rulesError } = await supabase
    .from("ranking_calibration_rules")
    .insert(summary.calibrationTable.map((rule) => toRuleInsert(rule, run.id)));

  if (rulesError) {
    return { persisted: false, error: rulesError.message } satisfies PersistenceResult;
  }

  return { persisted: true } satisfies PersistenceResult;
}

export async function persistEmailLinkClick(args: {
  trackingId: string;
  symbol?: string | null;
  customerId?: string | null;
  source?: string | null;
  userAgent?: string | null;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return notConfigured();
  }

  const symbol =
    args.symbol?.trim().toUpperCase() ??
    args.trackingId.split("-").find((part) => /^[A-Z]{1,6}$/.test(part)) ??
    "UNKNOWN";
  const userId = cleanUserId(args.customerId);
  const { error } = await supabase.from("email_link_events").insert({
    user_id: userId,
    alert_log_id: null,
    opportunity_id: null,
    symbol,
    tracking_id: args.trackingId,
    source: args.source ?? "morning_email",
    user_agent: args.userAgent ?? null,
  });

  return {
    persisted: !error,
    error: error?.message,
  } satisfies PersistenceResult;
}

export async function unsubscribeEmailAlerts(args: {
  customerId?: string | null;
  email?: string | null;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return notConfigured();
  }

  const now = new Date().toISOString();

  if (isUuid(args.customerId)) {
    const { error } = await supabase
      .from("users")
      .update({
        morning_alerts_enabled: false,
        email_unsubscribed_at: now,
      })
      .eq("id", args.customerId);

    return {
      persisted: !error,
      error: error?.message,
    } satisfies PersistenceResult;
  }

  const email = args.email?.trim().toLowerCase();

  if (!email) {
    return {
      persisted: false,
      reason: "A valid customer id or email is required to unsubscribe.",
    } satisfies PersistenceResult;
  }

  const { error } = await supabase
    .from("users")
    .update({
      morning_alerts_enabled: false,
      email_unsubscribed_at: now,
    })
    .eq("email", email);

  return {
    persisted: !error,
    error: error?.message,
  } satisfies PersistenceResult;
}

export function summarizeCalibration(rankings: RankedEquityOpportunity[]) {
  const adjusted = rankings.filter((ranking) => ranking.calibration.length > 0);

  return {
    adjustedCount: adjusted.length,
    adjustedSymbols: adjusted.map((ranking) => ranking.candidate.symbol),
    totalPenalty: adjusted.reduce(
      (total, ranking) => total + (ranking.rawScores.composite - ranking.scores.composite),
      0,
    ),
  };
}
