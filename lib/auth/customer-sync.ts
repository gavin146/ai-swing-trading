import { normalizePreferredBrokerage } from "../brokerages";
import type { AlertChannel, RiskProfile, UserRole } from "../database.types";

const accountBudgets = new Set(["not_set", "under_1000", "1000_5000", "5000_25000", "25000_plus"]);
const alertChannels = new Set<AlertChannel>(["email", "sms", "none"]);
const investingExperiences = new Set(["beginner", "intermediate", "advanced"]);
const positionSizePreferences = new Set(["small", "moderate", "aggressive"]);
const riskProfiles = new Set<RiskProfile>(["conservative", "balanced", "aggressive"]);
const setupPreferences = new Set(["steady", "balanced", "momentum"]);

export type CustomerSyncIdentity = {
  authUserId: string;
  email: string;
};

export function normalizeCustomerSyncEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function assertCustomerSyncMatchesSession(
  bodyEmail: unknown,
  identity: CustomerSyncIdentity,
) {
  const requestedEmail = normalizeCustomerSyncEmail(bodyEmail);
  const sessionEmail = normalizeCustomerSyncEmail(identity.email);

  if (!sessionEmail || !sessionEmail.includes("@")) {
    throw new Error("A verified SwingFi login session is required.");
  }

  if (requestedEmail && requestedEmail !== sessionEmail) {
    throw new Error("Profile sync email must match the active login session.");
  }
}

export function clampCustomerSyncScore(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function buildCustomerSyncPayload(args: {
  body: Record<string, unknown> | null;
  identity: CustomerSyncIdentity;
  nowIso: string;
  role: UserRole;
}) {
  const body = args.body ?? {};
  const riskProfile = riskProfiles.has(body.riskProfile as RiskProfile)
    ? (body.riskProfile as RiskProfile)
    : "balanced";
  const alertChannel = alertChannels.has(body.alertChannel as AlertChannel)
    ? (body.alertChannel as AlertChannel)
    : "email";
  const accountBudget = accountBudgets.has(String(body.accountBudget))
    ? String(body.accountBudget)
    : "not_set";
  const investingExperience = investingExperiences.has(String(body.investingExperience))
    ? String(body.investingExperience)
    : "beginner";
  const positionSizePreference = positionSizePreferences.has(String(body.positionSizePreference))
    ? String(body.positionSizePreference)
    : "small";
  const setupPreference = setupPreferences.has(String(body.setupPreference))
    ? String(body.setupPreference)
    : "balanced";
  const termsAcceptedAt = body.termsAcceptedAt ? new Date(String(body.termsAcceptedAt)) : null;

  assertCustomerSyncMatchesSession(body.email, args.identity);

  return {
    account_budget: accountBudget,
    alert_channel: alertChannel,
    alert_time: cleanText(body.alertTime, "08:30") || "08:30",
    auth_user_id: args.identity.authUserId,
    email: normalizeCustomerSyncEmail(args.identity.email),
    full_name: cleanText(body.fullName),
    last_login_at: args.nowIso,
    max_risk_score: clampCustomerSyncScore(body.maxRiskScore, 65),
    minimum_confidence: clampCustomerSyncScore(body.minimumConfidence, 70),
    morning_alerts_enabled: Boolean(body.morningAlertsEnabled),
    phone: cleanText(body.phone),
    preferred_brokerage: normalizePreferredBrokerage(body.preferredBrokerage),
    investing_experience: investingExperience,
    position_size_preference: positionSizePreference,
    risk_profile: riskProfile,
    role: args.role,
    setup_preference: setupPreference,
    ...(termsAcceptedAt && !Number.isNaN(termsAcceptedAt.getTime())
      ? { terms_accepted_at: termsAcceptedAt.toISOString() }
      : {}),
    timezone: cleanText(body.timezone, "America/Chicago") || "America/Chicago",
  };
}

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}
