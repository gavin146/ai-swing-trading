import { NextRequest, NextResponse } from "next/server";
import type {
  AccountBudget,
  AlertChannel,
  InvestingExperience,
  PositionSizePreference,
  RiskProfile,
  SetupPreference,
  SubscriptionStatus,
  UserRole,
} from "@/lib/database.types";
import { normalizePreferredBrokerage } from "@/lib/brokerages";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ownerAdminEmail = "gavin@onefear.co";
const userSelectBase =
  "id,email,full_name,role,auth_user_id,phone,risk_profile,account_budget,investing_experience,position_size_preference,setup_preference,minimum_confidence,max_risk_score,morning_alerts_enabled,alert_channel,alert_time,timezone,email_verified_at,terms_accepted_at,last_login_at,created_at";
const userSelectWithBrokerage = `${userSelectBase},preferred_brokerage`;

function isMissingPreferredBrokerageColumn(error: { message?: string } | null | undefined) {
  return Boolean(error?.message?.toLowerCase().includes("preferred_brokerage"));
}

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function fallbackRiskProfile(value: unknown): RiskProfile {
  return value === "conservative" || value === "aggressive" || value === "balanced"
    ? value
    : "balanced";
}

function shouldRefreshLoginTimestamp(value: unknown) {
  const previous = new Date(cleanText(value));

  if (Number.isNaN(previous.getTime())) return true;

  return Date.now() - previous.getTime() > 30 * 60 * 1000;
}

async function resolveRole(email: string): Promise<UserRole> {
  if (email === ownerAdminEmail) return "admin";

  const supabase = createSupabaseAdminClient();
  if (!supabase) return "customer";

  const { data } = await supabase
    .from("admin_access_grants")
    .select("email")
    .eq("email", email)
    .is("revoked_at", null)
    .maybeSingle();

  return data?.email ? "admin" : "customer";
}

function toCustomer(
  row: Record<string, unknown>,
  subscription: { plan_key?: string | null; status?: SubscriptionStatus | null } | null,
) {
  const riskProfile = fallbackRiskProfile(row.risk_profile);

  return {
    accountBudget: (row.account_budget ?? "not_set") as AccountBudget,
    alertChannel: (row.alert_channel ?? "email") as AlertChannel,
    alertTime: cleanText(row.alert_time, "08:30") || "08:30",
    authUserId: cleanText(row.auth_user_id) || null,
    createdAt: cleanText(row.created_at, new Date().toISOString()),
    email: normalizeEmail(row.email),
    emailVerifiedAt: row.email_verified_at ? cleanText(row.email_verified_at) : null,
    fullName: cleanText(row.full_name, normalizeEmail(row.email)),
    id: cleanText(row.id),
    investingExperience: (row.investing_experience ?? "beginner") as InvestingExperience,
    lastLoginAt: row.last_login_at ? cleanText(row.last_login_at) : null,
    maxRiskScore: Number(row.max_risk_score ?? (riskProfile === "conservative" ? 45 : riskProfile === "aggressive" ? 78 : 65)),
    minimumConfidence: Number(row.minimum_confidence ?? (riskProfile === "conservative" ? 78 : riskProfile === "aggressive" ? 62 : 70)),
    morningAlertsEnabled: Boolean(row.morning_alerts_enabled ?? true),
    phone: cleanText(row.phone),
    preferredBrokerage: normalizePreferredBrokerage(row.preferred_brokerage),
    positionSizePreference: (row.position_size_preference ?? "small") as PositionSizePreference,
    riskProfile,
    role: (row.role ?? "customer") as UserRole,
    setupPreference: (row.setup_preference ?? "balanced") as SetupPreference,
    subscriptionPlanKey: subscription?.plan_key ?? null,
    subscriptionStatus: subscription?.status ?? null,
    termsAcceptedAt: row.terms_accepted_at ? cleanText(row.terms_accepted_at) : null,
    timezone: cleanText(row.timezone, "America/Chicago") || "America/Chicago",
  };
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role is not configured." },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const body = (await request.json().catch(() => null)) as { accessToken?: string } | null;
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : cleanText(body?.accessToken);

  if (!token) {
    return NextResponse.json({ error: "A valid Supabase session is required." }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const authUser = authData.user;
  const email = normalizeEmail(authUser?.email);

  if (authError || !authUser || !email) {
    return NextResponse.json({ error: "Your login session could not be verified." }, { status: 401 });
  }

  const initialUserResult = await supabase
    .from("users")
    .select(userSelectWithBrokerage)
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  let userRow = initialUserResult.data as Record<string, unknown> | null;
  let userError = initialUserResult.error;

  if (isMissingPreferredBrokerageColumn(userError)) {
    const fallback = await supabase
      .from("users")
      .select(userSelectBase)
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    userRow = fallback.data as Record<string, unknown> | null;
    userError = fallback.error;
  }

  if (!userRow && !userError) {
    const byEmail = await supabase
      .from("users")
      .select(userSelectWithBrokerage)
      .eq("email", email)
      .maybeSingle();

    userRow = byEmail.data as Record<string, unknown> | null;
    userError = byEmail.error;

    if (isMissingPreferredBrokerageColumn(userError)) {
      const fallbackByEmail = await supabase
        .from("users")
        .select(userSelectBase)
        .eq("email", email)
        .maybeSingle();

      userRow = fallbackByEmail.data as Record<string, unknown> | null;
      userError = fallbackByEmail.error;
    }
  }

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 503 });
  }

  const now = new Date().toISOString();
  const role = await resolveRole(email);

  if (!userRow) {
    const riskProfile = fallbackRiskProfile(authUser.user_metadata?.risk_profile);
    const fullName = cleanText(authUser.user_metadata?.full_name, email);
    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert({
        account_budget: "not_set",
        alert_channel: "email" as AlertChannel,
        alert_time: "08:30",
        auth_user_id: authUser.id,
        created_at: authUser.created_at ?? now,
        email,
        full_name: fullName,
        investing_experience: "beginner",
        last_login_at: now,
        max_risk_score: riskProfile === "conservative" ? 45 : riskProfile === "aggressive" ? 78 : 65,
        minimum_confidence: riskProfile === "conservative" ? 78 : riskProfile === "aggressive" ? 62 : 70,
        morning_alerts_enabled: true,
        phone: cleanText(authUser.user_metadata?.phone),
        preferred_brokerage: normalizePreferredBrokerage(authUser.user_metadata?.preferred_brokerage),
        position_size_preference: "small",
        risk_profile: riskProfile,
        role,
        setup_preference: "balanced",
        timezone: "America/Chicago",
      })
      .select(userSelectWithBrokerage)
      .single();

    if (isMissingPreferredBrokerageColumn(insertError)) {
      const { data: legacyInserted, error: legacyInsertError } = await supabase
        .from("users")
        .insert({
          account_budget: "not_set",
          alert_channel: "email" as AlertChannel,
          alert_time: "08:30",
          auth_user_id: authUser.id,
          created_at: authUser.created_at ?? now,
          email,
          full_name: fullName,
          investing_experience: "beginner",
          last_login_at: now,
          max_risk_score: riskProfile === "conservative" ? 45 : riskProfile === "aggressive" ? 78 : 65,
          minimum_confidence: riskProfile === "conservative" ? 78 : riskProfile === "aggressive" ? 62 : 70,
          morning_alerts_enabled: true,
          phone: cleanText(authUser.user_metadata?.phone),
          position_size_preference: "small",
          risk_profile: riskProfile,
          role,
          setup_preference: "balanced",
          timezone: "America/Chicago",
        })
        .select(userSelectBase)
        .single();

      if (legacyInsertError || !legacyInserted) {
        return NextResponse.json(
          { error: legacyInsertError?.message ?? "Could not create your SwingFi profile." },
          { status: 503 },
        );
      }

      userRow = legacyInserted as Record<string, unknown>;
      return NextResponse.json({
        customer: toCustomer(userRow as Record<string, unknown>, null),
      });
    }

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: insertError?.message ?? "Could not create your SwingFi profile." },
        { status: 503 },
      );
    }

    userRow = inserted as Record<string, unknown>;
  } else {
    const updatePayload: Record<string, unknown> = {};
    if (shouldRefreshLoginTimestamp(userRow.last_login_at)) updatePayload.last_login_at = now;
    if (!userRow.auth_user_id) updatePayload.auth_user_id = authUser.id;
    if (userRow.role !== role) updatePayload.role = role;

    if (Object.keys(updatePayload).length) {
      const updated = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", cleanText(userRow.id))
        .select(userSelectWithBrokerage)
        .single();

      if (isMissingPreferredBrokerageColumn(updated.error)) {
        const fallbackUpdated = await supabase
          .from("users")
          .update(updatePayload)
          .eq("id", cleanText(userRow.id))
          .select(userSelectBase)
          .single();

        userRow = (fallbackUpdated.data as Record<string, unknown> | null) ?? userRow;
      } else {
        userRow = (updated.data as Record<string, unknown> | null) ?? userRow;
      }
    }
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_key,status,updated_at")
    .eq("user_id", cleanText(userRow.id))
    .in("status", ["active", "trialing"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    customer: toCustomer(
      userRow as Record<string, unknown>,
      (subscription as { plan_key?: string | null; status?: SubscriptionStatus | null } | null) ?? null,
    ),
  });
}
