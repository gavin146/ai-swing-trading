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

function getNextMonthStart(monthStart: string) {
  const date = new Date(`${monthStart}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function isSmsSource(source: string | null | undefined) {
  return source?.toLowerCase().includes("sms") ?? false;
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
  const nextMonthStart = getNextMonthStart(monthStart);
  const [
    { data: users, error: usersError },
    { data: alertLogs, error: alertLogsError },
    { data: linkEvents, error: linkEventsError },
    openEventsResult,
  ] =
    await Promise.all([
      supabase
        .from("users")
        .select(
          "id,email,full_name,role,phone,risk_profile,account_budget,investing_experience,position_size_preference,setup_preference,minimum_confidence,max_risk_score,morning_alerts_enabled,alert_channel,alert_time,timezone,last_login_at,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("alert_logs")
        .select("user_id,channel,status,sent_at,created_at")
        .gte("created_at", monthStart)
        .lt("created_at", nextMonthStart),
      supabase
        .from("email_link_events")
        .select("user_id,symbol,source,clicked_at")
        .gte("clicked_at", monthStart)
        .lt("clicked_at", nextMonthStart),
      supabase
        .from("alert_open_events")
        .select("user_id,tracking_id,source,opened_at")
        .gte("opened_at", monthStart)
        .lt("opened_at", nextMonthStart),
    ]);

  if (usersError || alertLogsError || linkEventsError) {
    return NextResponse.json(
      {
        customers: [],
        error:
          usersError?.message ??
          alertLogsError?.message ??
          linkEventsError?.message ??
          "Customer query failed.",
        source: "empty",
        usage: [],
      },
      { status: 503 },
    );
  }

  const openEvents = openEventsResult.error ? [] : (openEventsResult.data ?? []);
  const usageByUser = new Map<
    string,
    {
      emailLinkClicks: number;
      emailOpens: Set<string>;
      emailsSent: number;
      lastEmailClickAt: string | null;
      lastEmailOpenAt: string | null;
      lastLinkClickAt: string | null;
      smsLinkClicks: number;
      smsSent: number;
      symbolCounts: Map<string, number>;
      totalLinkClicks: number;
    }
  >();

  function ensureUsage(userId: string) {
    const current = usageByUser.get(userId);
    if (current) return current;

    const next = {
      emailLinkClicks: 0,
      emailOpens: new Set<string>(),
      emailsSent: 0,
      lastEmailClickAt: null,
      lastEmailOpenAt: null,
      lastLinkClickAt: null,
      smsLinkClicks: 0,
      smsSent: 0,
      symbolCounts: new Map<string, number>(),
      totalLinkClicks: 0,
    };

    usageByUser.set(userId, next);
    return next;
  }

  (alertLogs ?? []).forEach((log) => {
    if (!log.user_id || (log.status !== "sent" && log.status !== "queued")) return;
    const item = ensureUsage(String(log.user_id));

    if (log.channel === "sms") {
      item.smsSent += 1;
    } else if (log.channel === "email") {
      item.emailsSent += 1;
    }
  });

  (linkEvents ?? []).forEach((event) => {
    if (!event.user_id) return;
    const item = ensureUsage(String(event.user_id));
    const clickedAt = String(event.clicked_at);

    item.totalLinkClicks += 1;
    item.lastLinkClickAt =
      !item.lastLinkClickAt || clickedAt > item.lastLinkClickAt ? clickedAt : item.lastLinkClickAt;

    if (isSmsSource(String(event.source ?? ""))) {
      item.smsLinkClicks += 1;
    } else {
      item.emailLinkClicks += 1;
      item.lastEmailClickAt =
        !item.lastEmailClickAt || clickedAt > item.lastEmailClickAt
          ? clickedAt
          : item.lastEmailClickAt;
    }

    const symbol = String(event.symbol ?? "").toUpperCase();
    if (symbol) {
      item.symbolCounts.set(symbol, (item.symbolCounts.get(symbol) ?? 0) + 1);
    }
  });

  openEvents.forEach((event) => {
    if (!event.user_id) return;
    const item = ensureUsage(String(event.user_id));
    const openedAt = String(event.opened_at);

    item.emailOpens.add(String(event.tracking_id));
    item.lastEmailOpenAt =
      !item.lastEmailOpenAt || openedAt > item.lastEmailOpenAt ? openedAt : item.lastEmailOpenAt;
  });

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
      preferredBrokerage: "none",
      positionSizePreference: (user.position_size_preference ?? "small") as PositionSizePreference,
      riskProfile: user.risk_profile as RiskProfile,
      role: user.role as UserRole,
      setupPreference: (user.setup_preference ?? "balanced") as SetupPreference,
      timezone: String(user.timezone ?? "America/Chicago"),
    })),
    source: "supabase",
    trackingWarning: openEventsResult.error
      ? `Open tracking is not available yet: ${openEventsResult.error.message}`
      : null,
    usage: Array.from(usageByUser.entries()).map(([userId, item]) => ({
      customerId: userId,
      emailLinkClicks: item.emailLinkClicks,
      emailOpens: item.emailOpens.size,
      emailsSent: item.emailsSent,
      lastEmailClickAt: item.lastEmailClickAt,
      lastEmailOpenAt: item.lastEmailOpenAt,
      lastLinkClickAt: item.lastLinkClickAt,
      monthKey: monthStart.slice(0, 7),
      smsLinkClicks: item.smsLinkClicks,
      smsSent: item.smsSent,
      topSymbols: Array.from(item.symbolCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([symbol]) => symbol),
      totalLinkClicks: item.totalLinkClicks,
    })),
  });
}
