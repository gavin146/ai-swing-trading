export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AssetType = "stock" | "etf" | "crypto";
export type AccountBudget = "not_set" | "under_1000" | "1000_5000" | "5000_25000" | "25000_plus";
export type AgentRunStatus = "queued" | "running" | "completed" | "failed";
export type AlertChannel = "sms" | "email" | "none";
export type AlertStatus = "preview" | "queued" | "sent" | "failed";
export type CalibrationConfidence = "low" | "medium" | "high";
export type InvestingExperience = "beginner" | "intermediate" | "advanced";
export type PositionSizePreference = "small" | "moderate" | "aggressive";
export type RiskProfile = "conservative" | "balanced" | "aggressive";
export type SetupPreference = "steady" | "balanced" | "momentum";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";
export type TradeStatus = "planned" | "open" | "closed" | "cancelled";
export type UserRole = "customer" | "admin";

export type UserRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string | null;
  role: UserRole;
  stripe_customer_id: string | null;
  phone: string | null;
  risk_profile: RiskProfile;
  account_budget: AccountBudget;
  investing_experience: InvestingExperience;
  position_size_preference: PositionSizePreference;
  setup_preference: SetupPreference;
  minimum_confidence: number;
  max_risk_score: number;
  morning_alerts_enabled: boolean;
  alert_channel: AlertChannel;
  alert_time: string;
  timezone: string;
  email_verified_at: string | null;
  email_unsubscribed_at: string | null;
  terms_accepted_at: string | null;
  last_login_at: string | null;
  created_at: string;
};

export type AuthEmailVerificationTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  email: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export type AdminAccessGrantRow = {
  id: string;
  email: string;
  granted_by_user_id: string | null;
  created_at: string;
  revoked_at: string | null;
};

export type OpportunityRow = {
  id: string;
  symbol: string;
  asset_type: AssetType;
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
  explanation: string;
  created_at: string;
};

export type AgentRunRow = {
  id: string;
  status: AgentRunStatus;
  source: string;
  universe_count: number;
  selected_count: number;
  market_regime: string | null;
  summary: string | null;
  data_quality: Json;
  cost_estimate: Json;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
};

export type OpportunityRankingRow = {
  id: string;
  agent_run_id: string;
  opportunity_id: string;
  rank: number;
  technical_score: number;
  financial_score: number;
  news_score: number;
  macro_score: number;
  liquidity_score: number;
  risk_score: number;
  confidence_score: number;
  raw_composite_score: number;
  composite_score: number;
  calibration_rules: Json;
  created_at: string;
};

export type BacktestRunRow = {
  id: string;
  generated_at: string;
  windows_tested: number;
  trades_tested: number;
  target_hit_rate: number;
  stop_hit_rate: number;
  expired_rate: number;
  average_return_pct: number;
  average_max_gain_pct: number;
  average_max_drawdown_pct: number;
  average_reward_risk_ratio: number;
  average_score: number;
  symbols: string[];
  score_bands: Json;
  learning_summary: string;
  openai_instruction: string;
  notes: string[];
  created_at: string;
};

export type BacktestTradeRow = {
  id: string;
  backtest_run_id: string;
  as_of: string;
  symbol: string;
  rank: number;
  score: number;
  confidence: number;
  risk_score: number;
  entry_date: string | null;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  reward_risk_ratio: number;
  holding_period_days: number;
  outcome: "target_hit" | "stop_hit" | "expired" | "no_data";
  exit_date: string | null;
  exit_price: number | null;
  return_pct: number;
  max_gain_pct: number;
  max_drawdown_pct: number;
  created_at: string;
};

export type RankingCalibrationRuleRow = {
  id: string;
  source_backtest_run_id: string | null;
  rule_key: string;
  label: string;
  description: string;
  trigger_config: Json;
  trigger_description: string;
  score_penalty: number;
  confidence_penalty: number;
  risk_adjustment: number;
  sample_size: number;
  target_hit_rate: number;
  stop_hit_rate: number;
  average_return_pct: number;
  confidence: CalibrationConfidence;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type SubscriptionRow = {
  id: string;
  user_id: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  plan_key: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyPickRow = {
  id: string;
  user_id: string;
  opportunity_id: string;
  agent_run_id: string;
  rank: number;
  pick_date: string;
  created_at: string;
};

export type AlertLogRow = {
  id: string;
  user_id: string | null;
  agent_run_id: string | null;
  channel: AlertChannel;
  status: AlertStatus;
  recipient: string;
  message: string;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

export type EmailLinkEventRow = {
  id: string;
  user_id: string | null;
  alert_log_id: string | null;
  opportunity_id: string | null;
  symbol: string;
  tracking_id: string;
  source: string;
  user_agent: string | null;
  clicked_at: string;
  created_at: string;
};

export type AlertOpenEventRow = {
  id: string;
  user_id: string | null;
  alert_log_id: string | null;
  tracking_id: string;
  source: string;
  user_agent: string | null;
  opened_at: string;
  created_at: string;
};

export type AppEventLogRow = {
  id: string;
  level: "info" | "warning" | "error";
  source: string;
  message: string;
  metadata: Json;
  created_at: string;
};

export type CustomerMonthlyUsageRow = {
  id: string;
  user_id: string;
  month_start: string;
  email_link_clicks: number;
  last_email_click_at: string | null;
  top_symbols: string[];
  created_at: string;
  updated_at: string;
};

export type WatchlistRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type WatchlistItemRow = {
  id: string;
  watchlist_id: string;
  opportunity_id: string;
  created_at: string;
};

export type TradeHistoryRow = {
  id: string;
  user_id: string;
  opportunity_id: string | null;
  symbol: string;
  asset_type: AssetType;
  entry_price: number;
  exit_price: number | null;
  target_price: number;
  stop_loss: number;
  quantity: number;
  status: TradeStatus;
  opened_at: string | null;
  closed_at: string | null;
  realized_gain: number | null;
  realized_loss: number | null;
  notes: string | null;
  created_at: string;
};

export type UserInsert = Omit<UserRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type AuthEmailVerificationTokenInsert = Omit<
  AuthEmailVerificationTokenRow,
  "id" | "created_at" | "consumed_at"
> & {
  id?: string;
  consumed_at?: string | null;
  created_at?: string;
};

export type AdminAccessGrantInsert = Omit<AdminAccessGrantRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type OpportunityInsert = Omit<OpportunityRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type AgentRunInsert = Omit<AgentRunRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type OpportunityRankingInsert = Omit<OpportunityRankingRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type BacktestRunInsert = Omit<BacktestRunRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type BacktestTradeInsert = Omit<BacktestTradeRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type RankingCalibrationRuleInsert = Omit<
  RankingCalibrationRuleRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type SubscriptionInsert = Omit<SubscriptionRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type DailyPickInsert = Omit<DailyPickRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type AlertLogInsert = Omit<AlertLogRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type EmailLinkEventInsert = Omit<EmailLinkEventRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type AlertOpenEventInsert = Omit<AlertOpenEventRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type AppEventLogInsert = Omit<AppEventLogRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type CustomerMonthlyUsageInsert = Omit<
  CustomerMonthlyUsageRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type WatchlistInsert = Omit<WatchlistRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type WatchlistItemInsert = Omit<WatchlistItemRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type TradeHistoryInsert = Omit<TradeHistoryRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type UserUpdate = Partial<UserInsert>;
export type AuthEmailVerificationTokenUpdate = Partial<AuthEmailVerificationTokenInsert>;
export type AdminAccessGrantUpdate = Partial<AdminAccessGrantInsert>;
export type OpportunityUpdate = Partial<OpportunityInsert>;
export type AgentRunUpdate = Partial<AgentRunInsert>;
export type BacktestRunUpdate = Partial<BacktestRunInsert>;
export type BacktestTradeUpdate = Partial<BacktestTradeInsert>;
export type RankingCalibrationRuleUpdate = Partial<RankingCalibrationRuleInsert>;
export type SubscriptionUpdate = Partial<SubscriptionInsert>;
export type AppEventLogUpdate = Partial<AppEventLogInsert>;
export type OpportunityRankingUpdate = Partial<OpportunityRankingInsert>;
export type DailyPickUpdate = Partial<DailyPickInsert>;
export type AlertLogUpdate = Partial<AlertLogInsert>;
export type EmailLinkEventUpdate = Partial<EmailLinkEventInsert>;
export type AlertOpenEventUpdate = Partial<AlertOpenEventInsert>;
export type CustomerMonthlyUsageUpdate = Partial<CustomerMonthlyUsageInsert>;
export type WatchlistUpdate = Partial<WatchlistInsert>;
export type WatchlistItemUpdate = Partial<WatchlistItemInsert>;
export type TradeHistoryUpdate = Partial<TradeHistoryInsert>;

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: UserInsert;
        Update: UserUpdate;
      };
      auth_email_verification_tokens: {
        Row: AuthEmailVerificationTokenRow;
        Insert: AuthEmailVerificationTokenInsert;
        Update: AuthEmailVerificationTokenUpdate;
      };
      admin_access_grants: {
        Row: AdminAccessGrantRow;
        Insert: AdminAccessGrantInsert;
        Update: AdminAccessGrantUpdate;
      };
      opportunities: {
        Row: OpportunityRow;
        Insert: OpportunityInsert;
        Update: OpportunityUpdate;
      };
      agent_runs: {
        Row: AgentRunRow;
        Insert: AgentRunInsert;
        Update: AgentRunUpdate;
      };
      opportunity_rankings: {
        Row: OpportunityRankingRow;
        Insert: OpportunityRankingInsert;
        Update: OpportunityRankingUpdate;
      };
      daily_picks: {
        Row: DailyPickRow;
        Insert: DailyPickInsert;
        Update: DailyPickUpdate;
      };
      alert_logs: {
        Row: AlertLogRow;
        Insert: AlertLogInsert;
        Update: AlertLogUpdate;
      };
      email_link_events: {
        Row: EmailLinkEventRow;
        Insert: EmailLinkEventInsert;
        Update: EmailLinkEventUpdate;
      };
      alert_open_events: {
        Row: AlertOpenEventRow;
        Insert: AlertOpenEventInsert;
        Update: AlertOpenEventUpdate;
      };
      customer_monthly_usage: {
        Row: CustomerMonthlyUsageRow;
        Insert: CustomerMonthlyUsageInsert;
        Update: CustomerMonthlyUsageUpdate;
      };
      watchlists: {
        Row: WatchlistRow;
        Insert: WatchlistInsert;
        Update: WatchlistUpdate;
      };
      watchlist_items: {
        Row: WatchlistItemRow;
        Insert: WatchlistItemInsert;
        Update: WatchlistItemUpdate;
      };
      trade_history: {
        Row: TradeHistoryRow;
        Insert: TradeHistoryInsert;
        Update: TradeHistoryUpdate;
      };
    };
    Enums: {
      asset_type: AssetType;
      agent_run_status: AgentRunStatus;
      alert_channel: AlertChannel;
      alert_status: AlertStatus;
      risk_profile: RiskProfile;
      trade_status: TradeStatus;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
