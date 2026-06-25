import { NextRequest, NextResponse } from "next/server";
import type { AlertChannel, RiskProfile, SubscriptionStatus, UserRole } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ownerAdminEmail = "gavin@onefear.co";
const accountBudgets = new Set(["not_set", "under_1000", "1000_5000", "5000_25000", "25000_plus"]);
const alertChannels = new Set<AlertChannel>(["email", "sms", "none"]);
const investingExperiences = new Set(["beginner", "intermediate", "advanced"]);
const positionSizePreferences = new Set(["small", "moderate", "aggressive"]);
const riskProfiles = new Set<RiskProfile>(["conservative", "balanced", "aggressive"]);
const setupPreferences = new Set(["steady", "balanced", "momentum"]);
const activeSubscriptionStatuses = new Set<SubscriptionStatus>(["active", "trialing"]);

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function clampScore(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
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

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role is not configured." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = normalizeEmail(body?.email);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const role = await resolveRole(email);
  const riskProfile = riskProfiles.has(body?.riskProfile as RiskProfile)
    ? (body?.riskProfile as RiskProfile)
    : "balanced";
  const alertChannel = alertChannels.has(body?.alertChannel as AlertChannel)
    ? (body?.alertChannel as AlertChannel)
    : "email";
  const accountBudget = accountBudgets.has(String(body?.accountBudget))
    ? String(body?.accountBudget)
    : "not_set";
  const investingExperience = investingExperiences.has(String(body?.investingExperience))
    ? String(body?.investingExperience)
    : "beginner";
  const positionSizePreference = positionSizePreferences.has(String(body?.positionSizePreference))
    ? String(body?.positionSizePreference)
    : "small";
  const setupPreference = setupPreferences.has(String(body?.setupPreference))
    ? String(body?.setupPreference)
    : "balanced";
  const createdAt = body?.createdAt ? new Date(String(body.createdAt)) : null;
  const emailVerifiedAt = body?.emailVerifiedAt ? new Date(String(body.emailVerifiedAt)) : null;
  const lastLoginAt = body?.lastLoginAt ? new Date(String(body.lastLoginAt)) : null;
  const authUserId = cleanText(body?.authUserId);
  const payload = {
    account_budget: accountBudget,
    alert_channel: alertChannel,
    alert_time: cleanText(body?.alertTime, "08:30") || "08:30",
    created_at: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString() : undefined,
    email,
    auth_user_id: authUserId || undefined,
    ...(emailVerifiedAt && !Number.isNaN(emailVerifiedAt.getTime())
      ? { email_verified_at: emailVerifiedAt.toISOString() }
      : {}),
    full_name: cleanText(body?.fullName),
    last_login_at:
      lastLoginAt && !Number.isNaN(lastLoginAt.getTime()) ? lastLoginAt.toISOString() : null,
    max_risk_score: clampScore(body?.maxRiskScore, 65),
    minimum_confidence: clampScore(body?.minimumConfidence, 70),
    morning_alerts_enabled: Boolean(body?.morningAlertsEnabled),
    phone: cleanText(body?.phone),
    investing_experience: investingExperience,
    position_size_preference: positionSizePreference,
    risk_profile: riskProfile,
    role,
    setup_preference: setupPreference,
    timezone: cleanText(body?.timezone, "America/Chicago") || "America/Chicago",
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "email" })
    .select("id,email,role,email_verified_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status,current_period_end,trial_end,updated_at")
    .eq("user_id", data.id)
    .in("status", Array.from(activeSubscriptionStatuses))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    customer: {
      email: data.email,
      emailVerifiedAt: data.email_verified_at,
      id: data.id,
      role: data.role,
      subscriptionStatus: subscription?.status ?? null,
    },
    synced: true,
  });
}
