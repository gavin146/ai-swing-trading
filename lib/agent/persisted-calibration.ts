import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  setRuntimeCalibrationRules,
  type CalibrationRuleKey,
  type RankingCalibrationRule,
} from "./calibration";

const validRuleKeys: CalibrationRuleKey[] = [
  "high_score_stop_out_guard",
  "tight_stop_volatility",
  "low_target_hit_conservatism",
  "event_risk_drag",
  "weak_quality_drag",
];

function isCalibrationRuleKey(value: string): value is CalibrationRuleKey {
  return validRuleKeys.includes(value as CalibrationRuleKey);
}

function confidence(value: unknown): RankingCalibrationRule["confidence"] {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapPersistedRule(row: Record<string, unknown>): RankingCalibrationRule | null {
  const ruleKey = String(row.rule_key ?? "");

  if (!isCalibrationRuleKey(ruleKey)) {
    return null;
  }

  return {
    id: String(row.id),
    ruleKey,
    label: String(row.label ?? "Persisted calibration"),
    description: String(row.description ?? "Persisted calibration rule."),
    triggerDescription: String(row.trigger_description ?? "Persisted trigger."),
    scorePenalty: numberValue(row.score_penalty),
    confidencePenalty: numberValue(row.confidence_penalty),
    riskAdjustment: numberValue(row.risk_adjustment),
    sampleSize: numberValue(row.sample_size),
    targetHitRate: numberValue(row.target_hit_rate),
    stopHitRate: numberValue(row.stop_hit_rate),
    averageReturnPct: numberValue(row.average_return_pct),
    confidence: confidence(row.confidence),
    active: row.active !== false,
    source: row.source_backtest_run_id ? "backtest" : "forward",
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function hydrateRuntimeCalibrationFromSupabase() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      activeCount: 0,
      loaded: false,
      reason: "Supabase service role is not configured.",
    };
  }

  const { data, error } = await supabase
    .from("ranking_calibration_rules")
    .select("*")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    return {
      activeCount: 0,
      error: error.message,
      loaded: false,
    };
  }

  const rules = (data ?? [])
    .map((row) => mapPersistedRule(row as Record<string, unknown>))
    .filter((rule): rule is RankingCalibrationRule => rule !== null);

  if (rules.length > 0) {
    setRuntimeCalibrationRules(rules);
  }

  return {
    activeCount: rules.length,
    loaded: rules.length > 0,
  };
}
