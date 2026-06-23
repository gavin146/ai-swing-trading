import { NextRequest, NextResponse } from "next/server";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import type {
  AccountBudget,
  AlertChannel,
  InvestingExperience,
  PositionSizePreference,
  RiskProfile,
  SetupPreference,
  UserRole,
} from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getMonthStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function GET(request: NextRequest) {
  if (!isAdminApiRequest(request)) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({
      customers: [],
      reason: "Supabase service role is not configured.",
      source: "empty",
      usage: [],
    });
  }

  const monthStart = getMonthStart();
  const [{ data: users, error: usersError }, { data: usage, error: usageError }] =
    await Promise.all([
      supabase
        .from("users")
        .select(
          "id,email,full_name,role,phone,risk_profile,account_budget,investing_experience,position_size_preference,setup_preference,minimum_confidence,max_risk_score,morning_alerts_enabled,alert_channel,alert_time,timezone,last_login_at,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("customer_monthly_usage")
        .select(
          "user_id,month_start,email_link_clicks,last_email_click_at,top_symbols",
        )
        .eq("month_start", monthStart),
    ]);

  if (usersError || usageError) {
    return NextResponse.json(
      {
        customers: [],
        error: usersError?.message ?? usageError?.message ?? "Customer query failed.",
        source: "empty",
        usage: [],
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    customers: (users ?? []).map((user) => ({
      alertChannel: user.alert_channel as AlertChannel,
      alertTime: String(user.alert_time ?? "08:30"),
      accountBudget: (user.account_budget ?? "not_set") as AccountBudget,
      createdAt: String(user.created_at),
      email: String(user.email),
      fullName: String(user.full_name ?? ""),
      id: String(user.id),
      investingExperience: (user.investing_experience ?? "beginner") as InvestingExperience,
      lastLoginAt: user.last_login_at ? String(user.last_login_at) : null,
      maxRiskScore: Number(user.max_risk_score ?? 65),
      minimumConfidence: Number(user.minimum_confidence ?? 70),
      morningAlertsEnabled: Boolean(user.morning_alerts_enabled),
      phone: String(user.phone ?? ""),
      positionSizePreference: (user.position_size_preference ?? "small") as PositionSizePreference,
      riskProfile: user.risk_profile as RiskProfile,
      role: user.role as UserRole,
      setupPreference: (user.setup_preference ?? "balanced") as SetupPreference,
      timezone: String(user.timezone ?? "America/Chicago"),
    })),
    source: "supabase",
    usage: (usage ?? []).map((item) => ({
      customerId: String(item.user_id),
      emailLinkClicks: Number(item.email_link_clicks ?? 0),
      lastEmailClickAt: item.last_email_click_at ? String(item.last_email_click_at) : null,
      monthKey: String(item.month_start).slice(0, 7),
      topSymbols: Array.isArray(item.top_symbols)
        ? item.top_symbols.map((symbol) => String(symbol))
        : [],
    })),
  });
}
