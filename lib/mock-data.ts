import type {
  OpportunityRow,
  TradeHistoryRow,
  UserRow,
  WatchlistItemRow,
  WatchlistRow,
} from "./database.types";
import { createDailyMockOpportunityRows } from "./agent";

const createdAt = "2026-06-20T04:00:00.000Z";

export const mockUsers: UserRow[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    auth_user_id: null,
    email: "avery@example.com",
    full_name: "Avery Investor",
    role: "admin",
    stripe_customer_id: null,
    phone: null,
    risk_profile: "balanced",
    account_budget: "not_set",
    investing_experience: "beginner",
    position_size_preference: "small",
    setup_preference: "balanced",
    minimum_confidence: 70,
    max_risk_score: 65,
    morning_alerts_enabled: true,
    alert_channel: "email",
    alert_time: "08:30",
    timezone: "America/Chicago",
    email_verified_at: createdAt,
    email_unsubscribed_at: null,
    terms_accepted_at: createdAt,
    last_login_at: createdAt,
    created_at: createdAt,
  },
];

export const mockOpportunities: OpportunityRow[] = createDailyMockOpportunityRows(
  new Date(createdAt),
);

export const mockWatchlists: WatchlistRow[] = [
  {
    id: "33333333-3333-4333-8333-333333333331",
    user_id: mockUsers[0].id,
    name: "Beginner swing ideas",
    created_at: createdAt,
  },
];

export const mockWatchlistItems: WatchlistItemRow[] = [
  {
    id: "44444444-4444-4444-8444-444444444441",
    watchlist_id: mockWatchlists[0].id,
    opportunity_id: mockOpportunities[0].id,
    created_at: createdAt,
  },
  {
    id: "44444444-4444-4444-8444-444444444442",
    watchlist_id: mockWatchlists[0].id,
    opportunity_id: mockOpportunities[2].id,
    created_at: createdAt,
  },
];

export const mockTradeHistory: TradeHistoryRow[] = [
  {
    id: "55555555-5555-4555-8555-555555555551",
    user_id: mockUsers[0].id,
    opportunity_id: mockOpportunities[2].id,
    symbol: "SPY",
    asset_type: "etf",
    entry_price: 548.5,
    exit_price: 570,
    target_price: 572,
    stop_loss: 538,
    quantity: 4,
    status: "closed",
    opened_at: "2026-05-18T14:30:00.000Z",
    closed_at: "2026-06-04T20:00:00.000Z",
    realized_gain: 86,
    realized_loss: null,
    notes: "Mock closed trade used for historical UI examples.",
    created_at: "2026-05-18T14:15:00.000Z",
  },
];
