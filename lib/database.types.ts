export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AssetType = "stock" | "etf" | "crypto";
export type AgentRunStatus = "queued" | "running" | "completed" | "failed";
export type AlertChannel = "sms" | "email" | "none";
export type AlertStatus = "preview" | "queued" | "sent" | "failed";
export type RiskProfile = "conservative" | "balanced" | "aggressive";
export type TradeStatus = "planned" | "open" | "closed" | "cancelled";

export type UserRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
  risk_profile: RiskProfile;
  minimum_confidence: number;
  max_risk_score: number;
  morning_alerts_enabled: boolean;
  alert_channel: AlertChannel;
  alert_time: string;
  timezone: string;
  created_at: string;
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
  universe_count: number;
  selected_count: number;
  market_regime: string | null;
  summary: string | null;
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
  composite_score: number;
  created_at: string;
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
  user_id: string;
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
  user_id: string;
  alert_log_id: string | null;
  opportunity_id: string | null;
  symbol: string;
  tracking_id: string;
  source: string;
  user_agent: string | null;
  clicked_at: string;
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
export type OpportunityUpdate = Partial<OpportunityInsert>;
export type AgentRunUpdate = Partial<AgentRunInsert>;
export type OpportunityRankingUpdate = Partial<OpportunityRankingInsert>;
export type DailyPickUpdate = Partial<DailyPickInsert>;
export type AlertLogUpdate = Partial<AlertLogInsert>;
export type EmailLinkEventUpdate = Partial<EmailLinkEventInsert>;
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
