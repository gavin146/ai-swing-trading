import { NextRequest, NextResponse } from "next/server";
import type { AlertChannel, RiskProfile, UserRole } from "@/lib/database.types";
import {
  createEmailVerificationToken,
  normalizeAuthEmail,
  sendVerificationEmail,
} from "@/lib/auth/email-verification";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ownerAdminEmail = "gavin@onefear.co";
const accountBudgets = new Set(["not_set", "under_1000", "1000_5000", "5000_25000", "25000_plus"]);
const investingExperiences = new Set(["beginner", "intermediate", "advanced"]);
const positionSizePreferences = new Set(["small", "moderate", "aggressive"]);
const riskProfiles = new Set<RiskProfile>(["conservative", "balanced", "aggressive"]);
const setupPreferences = new Set(["steady", "balanced", "momentum"]);

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
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
      { error: "Signup is not configured because Supabase admin access is missing." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = normalizeAuthEmail(body?.email);
  const password = cleanText(body?.password);
  const firstName = cleanText(body?.firstName);
  const lastName = cleanText(body?.lastName);
  const fullName = cleanText(body?.fullName, `${firstName} ${lastName}`) || email;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Create a password with at least 8 characters." },
      { status: 400 },
    );
  }

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  }

  if (body?.termsAccepted !== true || body?.riskAcknowledged !== true) {
    return NextResponse.json(
      { error: "You must accept the SwingFi terms and risk notice before creating an account." },
      { status: 400 },
    );
  }

  const riskProfile = riskProfiles.has(body?.riskProfile as RiskProfile)
    ? (body?.riskProfile as RiskProfile)
    : "balanced";
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
  const minimumConfidence = clampScore(
    riskProfile === "conservative" ? 78 : riskProfile === "aggressive" ? 62 : 70,
  );
  const maxRiskScore = clampScore(
    riskProfile === "conservative" ? 45 : riskProfile === "aggressive" ? 78 : 65,
  );
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const role = await resolveRole(email);
  const now = new Date().toISOString();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone: cleanText(body?.phone),
      risk_profile: riskProfile,
    },
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      {
        error:
          authError?.message?.toLowerCase().includes("already")
            ? "An account already exists for that email. Log in or reset your password."
            : authError?.message ?? "Could not create your account.",
      },
      { status: authError?.message?.toLowerCase().includes("already") ? 409 : 400 },
    );
  }

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .upsert(
      {
        account_budget: accountBudget,
        alert_channel: "email" as AlertChannel,
        alert_time: "08:30",
        auth_user_id: authData.user.id,
        created_at: authData.user.created_at ?? now,
        email,
        email_verified_at: null,
        full_name: fullName,
        investing_experience: investingExperience,
        last_login_at: now,
        max_risk_score: maxRiskScore,
        minimum_confidence: minimumConfidence,
        morning_alerts_enabled: true,
        phone: cleanText(body?.phone),
        position_size_preference: positionSizePreference,
        risk_profile: riskProfile,
        role,
        setup_preference: setupPreference,
        terms_accepted_at: now,
        timezone: cleanText(body?.timezone, "America/Chicago") || "America/Chicago",
      },
      { onConflict: "email" },
    )
    .select("id,email,full_name,role,auth_user_id,created_at,email_verified_at")
    .single();

  if (userError || !userRow) {
    return NextResponse.json(
      { error: userError?.message ?? "Could not save your SwingFi profile." },
      { status: 503 },
    );
  }

  const { token } = await createEmailVerificationToken(supabase, {
    email,
    userId: userRow.id,
  });
  const delivery = await sendVerificationEmail({
    appUrl,
    email,
    name: fullName,
    token,
  });

  if (delivery.status === "failed") {
    return NextResponse.json(
      { error: delivery.error ?? "Account created, but the verification email could not be sent." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      customer: {
        accountBudget,
        alertChannel: "email",
        alertTime: "08:30",
        authUserId: authData.user.id,
        createdAt: authData.user.created_at ?? now,
        email,
        emailVerifiedAt: null,
        fullName,
        id: userRow.id,
        investingExperience,
        lastLoginAt: now,
        maxRiskScore,
        minimumConfidence,
        morningAlertsEnabled: true,
        phone: cleanText(body?.phone),
        preferredBrokerage: "none",
        positionSizePreference,
        riskProfile,
        role,
        setupPreference,
        stripeCustomerId: null,
        subscriptionPlanKey: null,
        subscriptionStatus: null,
        termsAcceptedAt: now,
        timezone: cleanText(body?.timezone, "America/Chicago") || "America/Chicago",
      },
      verificationEmailSent: true,
    },
    { status: 201 },
  );
}
