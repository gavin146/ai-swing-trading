"use client";

import type { RiskProfile, SubscriptionStatus } from "./database.types";
import { normalizePreferredBrokerage, type PreferredBrokerage } from "./brokerages";
import { createSupabaseBrowserClient } from "./supabase/browser";

export type AlertChannel = "sms" | "email" | "none";
export type CustomerRole = "admin" | "customer";
export type AccountBudget = "not_set" | "under_1000" | "1000_5000" | "5000_25000" | "25000_plus";
export type InvestingExperience = "beginner" | "intermediate" | "advanced";
export type PositionSizePreference = "small" | "moderate" | "aggressive";
export type SetupPreference = "steady" | "balanced" | "momentum";
export type CustomerPlanKey = "starter" | "pro" | "premium";

export type CustomerProfile = {
  id: string;
  authUserId?: string | null;
  email: string;
  fullName: string;
  role: CustomerRole;
  phone: string;
  preferredBrokerage: PreferredBrokerage;
  riskProfile: RiskProfile;
  accountBudget: AccountBudget;
  investingExperience: InvestingExperience;
  positionSizePreference: PositionSizePreference;
  setupPreference: SetupPreference;
  minimumConfidence: number;
  maxRiskScore: number;
  morningAlertsEnabled: boolean;
  alertChannel: AlertChannel;
  alertTime: string;
  timezone: string;
  emailVerifiedAt?: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  termsAcceptedAt?: string | null;
  stripeCustomerId?: string | null;
  subscriptionPlanKey?: CustomerPlanKey | null;
  subscriptionStatus?: SubscriptionStatus | null;
};

type StoredCustomer = CustomerProfile & {
  password: string;
};

export type AdminAccessRecord = {
  email: string;
  source: "owner" | "invited";
  createdAt: string;
  createdBy: string | null;
  hasAccount: boolean;
};

type StoredAdminAccess = {
  email: string;
  createdAt: string;
  createdBy: string | null;
};

const customersKey = "swingfi-customers";
const currentCustomerKey = "swingfi-current-customer-id";
const adminEmailsKey = "swingfi-admin-emails";
const legacyCustomersKey = "tradepilot-customers";
const legacyCurrentCustomerKey = "tradepilot-current-customer-id";
const legacyAdminEmailsKey = "tradepilot-admin-emails";
const legacyDemoEmail = "avery@example.com";
const trialLengthDays = 30;
const sessionLengthDays = 14;
const activeSubscriptionStatuses = new Set<SubscriptionStatus>(["active", "trialing"]);
const planPickLimits: Record<CustomerPlanKey, number> = {
  starter: 10,
  pro: 30,
  premium: 90,
};
let lastCustomerSyncSignature = "";
let inFlightCustomerSyncSignature = "";
let inFlightSessionRestore: Promise<CustomerProfile | null> | null = null;

export const SWINGFI_ADMIN_EMAIL = "gavin@onefear.co";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePlanKey(value: unknown): CustomerPlanKey | null {
  return value === "starter" || value === "pro" || value === "premium" ? value : null;
}

function readStorageValue(key: string, legacyKey: string) {
  const current = window.localStorage.getItem(key);
  if (current) return current;

  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy) {
    window.localStorage.setItem(key, legacy);
    window.localStorage.removeItem(legacyKey);
  }

  return legacy;
}

function readAdminAccessList(): StoredAdminAccess[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = readStorageValue(adminEmailsKey, legacyAdminEmailsKey);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as Array<StoredAdminAccess | string>;
    const records = new Map<string, StoredAdminAccess>();

    for (const item of Array.isArray(parsed) ? parsed : []) {
      const record =
        typeof item === "string"
          ? { email: item, createdAt: new Date().toISOString(), createdBy: null }
          : item;
      const email = normalizeEmail(record.email ?? "");

      if (!email || email === SWINGFI_ADMIN_EMAIL || email === legacyDemoEmail) continue;

      records.set(email, {
        email,
        createdAt: record.createdAt ?? new Date().toISOString(),
        createdBy: record.createdBy ?? null,
      });
    }

    const normalizedRecords = Array.from(records.values());
    if (JSON.stringify(parsed) !== JSON.stringify(normalizedRecords)) {
      window.localStorage.setItem(adminEmailsKey, JSON.stringify(normalizedRecords));
    }

    return normalizedRecords;
  } catch {
    window.localStorage.removeItem(adminEmailsKey);
    return [];
  }
}

function writeAdminAccessList(records: StoredAdminAccess[]) {
  const normalizedRecords = records
    .map((record) => ({
      ...record,
      email: normalizeEmail(record.email),
      createdAt: record.createdAt || new Date().toISOString(),
      createdBy: record.createdBy ? normalizeEmail(record.createdBy) : null,
    }))
    .filter((record) => record.email && record.email !== SWINGFI_ADMIN_EMAIL)
    .filter((record, index, list) => list.findIndex((item) => item.email === record.email) === index);

  window.localStorage.setItem(adminEmailsKey, JSON.stringify(normalizedRecords));
  window.dispatchEvent(new Event("swingfi-customer-updated"));
}

export function isAdminEmail(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email ?? "");
  if (normalizedEmail === SWINGFI_ADMIN_EMAIL) {
    return true;
  }

  return readAdminAccessList().some((record) => record.email === normalizedEmail);
}

function withoutPassword(customer: StoredCustomer): CustomerProfile {
  const profile: CustomerProfile = {
    id: customer.id,
    authUserId: customer.authUserId ?? null,
    email: customer.email,
    fullName: customer.fullName,
    role: customer.role ?? "customer",
    phone: customer.phone,
    preferredBrokerage: normalizePreferredBrokerage(customer.preferredBrokerage),
    riskProfile: customer.riskProfile,
    accountBudget: customer.accountBudget,
    investingExperience: customer.investingExperience,
    positionSizePreference: customer.positionSizePreference,
    setupPreference: customer.setupPreference,
    minimumConfidence: customer.minimumConfidence,
    maxRiskScore: customer.maxRiskScore,
    morningAlertsEnabled: customer.morningAlertsEnabled,
    alertChannel: customer.alertChannel,
    alertTime: customer.alertTime,
    timezone: customer.timezone,
    emailVerifiedAt: customer.emailVerifiedAt ?? null,
    lastLoginAt: customer.lastLoginAt ?? null,
    createdAt: customer.createdAt,
    termsAcceptedAt: customer.termsAcceptedAt ?? null,
    stripeCustomerId: customer.stripeCustomerId ?? null,
    subscriptionPlanKey: normalizePlanKey(customer.subscriptionPlanKey),
    subscriptionStatus: customer.subscriptionStatus ?? null,
  };

  return profile;
}

function normalizeCustomer(customer: StoredCustomer): StoredCustomer {
  const email = normalizeEmail(customer.email);

  return {
    ...customer,
    email,
    role: email === SWINGFI_ADMIN_EMAIL || customer.role === "admin" ? "admin" : "customer",
    phone: customer.phone ?? "",
    preferredBrokerage: normalizePreferredBrokerage(customer.preferredBrokerage),
    authUserId: customer.authUserId ?? null,
    riskProfile: customer.riskProfile ?? "balanced",
    accountBudget: customer.accountBudget ?? "not_set",
    investingExperience: customer.investingExperience ?? "beginner",
    positionSizePreference: customer.positionSizePreference ?? "small",
    setupPreference: customer.setupPreference ?? "balanced",
    minimumConfidence: customer.minimumConfidence ?? 70,
    maxRiskScore: customer.maxRiskScore ?? 65,
    morningAlertsEnabled: customer.morningAlertsEnabled ?? true,
    alertChannel: customer.alertChannel ?? "email",
    alertTime: customer.alertTime ?? "08:30",
    timezone:
      customer.timezone ??
      (typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "America/Chicago"),
    emailVerifiedAt:
      customer.emailVerifiedAt === undefined
        ? customer.createdAt ?? new Date().toISOString()
        : customer.emailVerifiedAt,
    lastLoginAt: customer.lastLoginAt ?? null,
    createdAt: customer.createdAt ?? new Date().toISOString(),
    termsAcceptedAt: customer.termsAcceptedAt ?? null,
    stripeCustomerId: customer.stripeCustomerId ?? null,
    subscriptionPlanKey: normalizePlanKey(customer.subscriptionPlanKey),
    subscriptionStatus: customer.subscriptionStatus ?? null,
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateFromIso(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T) {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

export function getTrialEndsAt(customer: CustomerProfile | null | undefined) {
  const createdAt = dateFromIso(customer?.createdAt);
  return createdAt ? addDays(createdAt, trialLengthDays).toISOString() : null;
}

export function getAccessState(customer: CustomerProfile | null | undefined) {
  if (!customer) {
    return {
      canViewAnalysis: false,
      isAdmin: false,
      isEmailVerified: false,
      isTrialActive: false,
      isSubscriptionActive: false,
      planKey: null as CustomerPlanKey | null,
      planLabel: "No plan",
      trialDaysRemaining: 0,
      trialEndsAt: null,
    };
  }

  const isAdmin = isAdminCustomer(customer);
  const isEmailVerified = isAdmin || Boolean(customer.emailVerifiedAt);
  const trialEndsAt = getTrialEndsAt(customer);
  const trialEndDate = dateFromIso(trialEndsAt);
  const trialMsRemaining = trialEndDate ? trialEndDate.getTime() - Date.now() : 0;
  const isTrialActive = trialMsRemaining > 0;
  const isSubscriptionActive = customer.subscriptionStatus
    ? activeSubscriptionStatuses.has(customer.subscriptionStatus)
    : false;
  const planKey = getCustomerPlanKey(customer);

  return {
    canViewAnalysis: isAdmin || (isEmailVerified && (isTrialActive || isSubscriptionActive)),
    isAdmin,
    isEmailVerified,
    isTrialActive,
    isSubscriptionActive,
    planKey,
    planLabel: getCustomerPlanLabel(customer),
    trialDaysRemaining: Math.max(0, Math.ceil(trialMsRemaining / 86_400_000)),
    trialEndsAt,
  };
}

function readCustomers(): StoredCustomer[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = readStorageValue(customersKey, legacyCustomersKey);

  if (!stored) {
    return [];
  }

  try {
    const customers = JSON.parse(stored) as StoredCustomer[];
    const normalizedCustomers = Array.isArray(customers)
      ? customers
          .filter((customer) => normalizeEmail(customer.email) !== legacyDemoEmail)
          .map(normalizeCustomer)
      : [];

    if (JSON.stringify(customers) !== JSON.stringify(normalizedCustomers)) {
      window.localStorage.setItem(customersKey, JSON.stringify(normalizedCustomers));
    }

    return normalizedCustomers;
  } catch {
    window.localStorage.removeItem(customersKey);
    window.localStorage.removeItem(currentCustomerKey);
    return [];
  }
}

function writeCustomers(customers: StoredCustomer[]) {
  window.localStorage.setItem(customersKey, JSON.stringify(customers));
  window.dispatchEvent(new Event("swingfi-customer-updated"));
}

function writeCustomersIfChanged(customers: StoredCustomer[], currentCustomerId?: string) {
  const previousCustomers = readCustomers();
  const previousCurrentId = readStorageValue(currentCustomerKey, legacyCurrentCustomerKey);
  const customersChanged = JSON.stringify(previousCustomers) !== JSON.stringify(customers);
  const currentChanged =
    currentCustomerId !== undefined && previousCurrentId !== currentCustomerId;

  if (customersChanged) {
    window.localStorage.setItem(customersKey, JSON.stringify(customers));
  }

  if (currentChanged && currentCustomerId) {
    window.localStorage.setItem(currentCustomerKey, currentCustomerId);
  }

  if (customersChanged || currentChanged) {
    window.dispatchEvent(new Event("swingfi-customer-updated"));
  }
}

function applySyncedProfile(
  customerId: string,
  updates: {
    emailVerifiedAt?: string | null;
    subscriptionPlanKey?: CustomerPlanKey | null;
    role?: CustomerRole;
    stripeCustomerId?: string | null;
    subscriptionStatus?: SubscriptionStatus | null;
    termsAcceptedAt?: string | null;
  },
) {
  const hasRole = updates.role === "admin" || updates.role === "customer";
  const hasEmailVerifiedAt = updates.emailVerifiedAt !== undefined;
  const hasStripeCustomerId = updates.stripeCustomerId !== undefined;
  const hasSubscriptionPlanKey = updates.subscriptionPlanKey !== undefined;
  const hasSubscriptionStatus = updates.subscriptionStatus !== undefined;
  const hasTermsAcceptedAt = updates.termsAcceptedAt !== undefined;

  if (
    !hasRole &&
    !hasEmailVerifiedAt &&
    !hasStripeCustomerId &&
    !hasSubscriptionPlanKey &&
    !hasSubscriptionStatus &&
    !hasTermsAcceptedAt
  ) {
    return;
  }

  const customers = readCustomers();
  const nextCustomers = customers.map((customer) =>
    customer.id === customerId
      ? {
          ...customer,
          ...(hasRole ? { role: updates.role } : {}),
          ...(hasEmailVerifiedAt ? { emailVerifiedAt: updates.emailVerifiedAt } : {}),
          ...(hasStripeCustomerId ? { stripeCustomerId: updates.stripeCustomerId } : {}),
          ...(hasSubscriptionPlanKey ? { subscriptionPlanKey: normalizePlanKey(updates.subscriptionPlanKey) } : {}),
          ...(hasSubscriptionStatus ? { subscriptionStatus: updates.subscriptionStatus } : {}),
          ...(hasTermsAcceptedAt ? { termsAcceptedAt: updates.termsAcceptedAt } : {}),
        }
      : customer,
  );

  if (JSON.stringify(customers) !== JSON.stringify(nextCustomers)) {
    writeCustomers(nextCustomers);
  }
}

function syncCustomerProfile(customer: CustomerProfile | null) {
  if (!customer || typeof window === "undefined") return;

  const signature = JSON.stringify({
    accountBudget: customer.accountBudget,
    alertChannel: customer.alertChannel,
    alertTime: customer.alertTime,
    authUserId: customer.authUserId ?? null,
    createdAt: customer.createdAt,
    email: customer.email,
    emailVerifiedAt: customer.emailVerifiedAt ?? null,
    fullName: customer.fullName,
    id: customer.id,
    investingExperience: customer.investingExperience,
    lastLoginAt: customer.lastLoginAt ?? null,
    maxRiskScore: customer.maxRiskScore,
    minimumConfidence: customer.minimumConfidence,
    morningAlertsEnabled: customer.morningAlertsEnabled,
    phone: customer.phone,
    preferredBrokerage: customer.preferredBrokerage,
    positionSizePreference: customer.positionSizePreference,
    riskProfile: customer.riskProfile,
    role: customer.role,
    stripeCustomerId: customer.stripeCustomerId ?? null,
    setupPreference: customer.setupPreference,
    termsAcceptedAt: customer.termsAcceptedAt ?? null,
    subscriptionPlanKey: customer.subscriptionPlanKey ?? null,
    subscriptionStatus: customer.subscriptionStatus ?? null,
    timezone: customer.timezone,
  });

  if (signature === lastCustomerSyncSignature || signature === inFlightCustomerSyncSignature) {
    return;
  }

  inFlightCustomerSyncSignature = signature;

  fetch("/api/customers/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer),
  })
    .then(async (response) => {
      if (!response.ok) return;

      const payload = (await response.json().catch(() => null)) as {
        customer?: {
          emailVerifiedAt?: string | null;
          subscriptionPlanKey?: CustomerPlanKey | null;
          role?: CustomerRole;
          subscriptionStatus?: SubscriptionStatus | null;
          termsAcceptedAt?: string | null;
          stripeCustomerId?: string | null;
        };
      } | null;

      applySyncedProfile(customer.id, {
        emailVerifiedAt: payload?.customer?.emailVerifiedAt,
        role: payload?.customer?.role,
        subscriptionPlanKey:
          payload?.customer?.subscriptionPlanKey === undefined
            ? undefined
            : normalizePlanKey(payload.customer.subscriptionPlanKey),
        subscriptionStatus: payload?.customer?.subscriptionStatus,
        termsAcceptedAt: payload?.customer?.termsAcceptedAt,
        stripeCustomerId: payload?.customer?.stripeCustomerId,
      });
      lastCustomerSyncSignature = signature;
    })
    .catch((error) => {
      console.warn("SwingFi customer sync failed", error);
    })
    .finally(() => {
      if (inFlightCustomerSyncSignature === signature) {
        inFlightCustomerSyncSignature = "";
      }
    });
}

export function getCustomerProfiles() {
  return readCustomers().map(withoutPassword);
}

export function getAdminAccessRecords(): AdminAccessRecord[] {
  const customers = readCustomers();
  const invitedRecords = readAdminAccessList();

  return [
    {
      email: SWINGFI_ADMIN_EMAIL,
      source: "owner",
      createdAt: "2026-06-22T00:00:00.000Z",
      createdBy: null,
      hasAccount: customers.some((customer) => normalizeEmail(customer.email) === SWINGFI_ADMIN_EMAIL),
    },
    ...invitedRecords.map((record) => ({
      email: record.email,
      source: "invited" as const,
      createdAt: record.createdAt,
      createdBy: record.createdBy,
      hasAccount: customers.some((customer) => normalizeEmail(customer.email) === record.email),
    })),
  ];
}

export function getCurrentCustomer(): CustomerProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const customers = readCustomers();
  const currentId = readStorageValue(currentCustomerKey, legacyCurrentCustomerKey);
  const current = customers.find((customer) => customer.id === currentId) ?? null;

  if (!current) {
    window.localStorage.removeItem(currentCustomerKey);
    return null;
  }

  const lastLoginAt = dateFromIso(current.lastLoginAt);
  if (!lastLoginAt || addDays(lastLoginAt, sessionLengthDays).getTime() <= Date.now()) {
    window.localStorage.removeItem(currentCustomerKey);
    window.dispatchEvent(new Event("swingfi-customer-updated"));
    return null;
  }

  return withoutPassword(current);
}

export function loginCustomer(email: string, password: string) {
  const customers = readCustomers();
  const normalizedEmail = normalizeEmail(email);
  const customer = customers.find((item) => normalizeEmail(item.email) === normalizedEmail);

  if (!customer) {
    throw new Error("No SwingFi account was found for that email.");
  }

  if (customer.password !== password) {
    throw new Error("That password does not match this account.");
  }

  customer.lastLoginAt = new Date().toISOString();
  writeCustomers(customers);
  window.localStorage.setItem(currentCustomerKey, customer.id);
  window.dispatchEvent(new Event("swingfi-customer-updated"));
  const profile = withoutPassword(customer);
  syncCustomerProfile(profile);
  return profile;
}

export function signupCustomer(values: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
  preferredBrokerage?: PreferredBrokerage;
  accountBudget?: AccountBudget;
  investingExperience?: InvestingExperience;
  positionSizePreference?: PositionSizePreference;
  riskProfile?: RiskProfile;
  setupPreference?: SetupPreference;
}) {
  const customers = readCustomers();
  const normalizedEmail = normalizeEmail(values.email);

  if (customers.some((customer) => normalizeEmail(customer.email) === normalizedEmail)) {
    throw new Error("An account already exists for that email.");
  }

  const nextCustomer: StoredCustomer = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    fullName: `${values.firstName.trim()} ${values.lastName.trim()}`.trim(),
    role: isAdminEmail(normalizedEmail) ? "admin" : "customer",
    phone: values.phone?.trim() ?? "",
    preferredBrokerage: normalizePreferredBrokerage(values.preferredBrokerage),
    riskProfile: values.riskProfile ?? "balanced",
    accountBudget: values.accountBudget ?? "not_set",
    investingExperience: values.investingExperience ?? "beginner",
    positionSizePreference: values.positionSizePreference ?? "small",
    setupPreference: values.setupPreference ?? "balanced",
    minimumConfidence:
      values.riskProfile === "conservative" ? 78 : values.riskProfile === "aggressive" ? 62 : 70,
    maxRiskScore:
      values.riskProfile === "conservative" ? 45 : values.riskProfile === "aggressive" ? 78 : 65,
    morningAlertsEnabled: true,
    alertChannel: "email",
    alertTime: "08:30",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    emailVerifiedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    password: values.password,
  };

  writeCustomers([nextCustomer, ...customers]);
  window.localStorage.setItem(currentCustomerKey, nextCustomer.id);
  window.dispatchEvent(new Event("swingfi-customer-updated"));
  const profile = withoutPassword(nextCustomer);
  syncCustomerProfile(profile);
  return profile;
}

export function rememberAuthenticatedCustomer(values: {
  accountBudget?: AccountBudget;
  alertChannel?: AlertChannel;
  alertTime?: string;
  authUserId?: string | null;
  id?: string;
  email: string;
  emailVerifiedAt?: string | null;
  fullName: string;
  investingExperience?: InvestingExperience;
  lastLoginAt?: string | null;
  maxRiskScore?: number;
  minimumConfidence?: number;
  morningAlertsEnabled?: boolean;
  password?: string;
  phone?: string;
  preferredBrokerage?: PreferredBrokerage | null;
  positionSizePreference?: PositionSizePreference;
  riskProfile?: RiskProfile;
  role?: CustomerRole;
  setupPreference?: SetupPreference;
  createdAt?: string | null;
  termsAcceptedAt?: string | null;
  stripeCustomerId?: string | null;
  subscriptionStatus?: SubscriptionStatus | null;
  subscriptionPlanKey?: CustomerPlanKey | null;
  timezone?: string | null;
}) {
  const customers = readCustomers();
  const normalizedEmail = normalizeEmail(values.email);
  const existing = customers.find((customer) => normalizeEmail(customer.email) === normalizedEmail);
  const existingIndex = customers.findIndex(
    (customer) => normalizeEmail(customer.email) === normalizedEmail,
  );
  const riskProfile = values.riskProfile ?? existing?.riskProfile ?? "balanced";
  const nextCustomer: StoredCustomer = normalizeCustomer({
    id: existing?.id ?? values.id ?? crypto.randomUUID(),
    authUserId: values.authUserId ?? existing?.authUserId ?? null,
    email: normalizedEmail,
    fullName: values.fullName.trim() || existing?.fullName || normalizedEmail,
    role:
      normalizedEmail === SWINGFI_ADMIN_EMAIL ||
      values.role === "admin" ||
      (!values.role && existing?.role === "admin")
        ? "admin"
        : "customer",
    phone: values.phone?.trim() ?? existing?.phone ?? "",
    preferredBrokerage: normalizePreferredBrokerage(
      values.preferredBrokerage ?? existing?.preferredBrokerage,
    ),
    riskProfile,
    accountBudget: values.accountBudget ?? existing?.accountBudget ?? "not_set",
    investingExperience: values.investingExperience ?? existing?.investingExperience ?? "beginner",
    positionSizePreference:
      values.positionSizePreference ?? existing?.positionSizePreference ?? "small",
    setupPreference: values.setupPreference ?? existing?.setupPreference ?? "balanced",
    minimumConfidence:
      values.minimumConfidence ??
      existing?.minimumConfidence ??
      (riskProfile === "conservative" ? 78 : riskProfile === "aggressive" ? 62 : 70),
    maxRiskScore:
      values.maxRiskScore ??
      existing?.maxRiskScore ??
      (riskProfile === "conservative" ? 45 : riskProfile === "aggressive" ? 78 : 65),
    morningAlertsEnabled: values.morningAlertsEnabled ?? existing?.morningAlertsEnabled ?? true,
    alertChannel: values.alertChannel ?? existing?.alertChannel ?? "email",
    alertTime: values.alertTime ?? existing?.alertTime ?? "08:30",
    timezone:
      values.timezone ??
      existing?.timezone ??
      (typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "America/Chicago"),
    lastLoginAt: values.lastLoginAt ?? existing?.lastLoginAt ?? new Date().toISOString(),
    createdAt: existing?.createdAt ?? values.createdAt ?? new Date().toISOString(),
    termsAcceptedAt: values.termsAcceptedAt ?? existing?.termsAcceptedAt ?? null,
    stripeCustomerId: values.stripeCustomerId ?? existing?.stripeCustomerId ?? null,
    emailVerifiedAt:
      values.emailVerifiedAt !== undefined
        ? values.emailVerifiedAt
        : existing?.emailVerifiedAt ?? null,
    password: values.password ?? existing?.password ?? "",
    subscriptionPlanKey: normalizePlanKey(values.subscriptionPlanKey ?? existing?.subscriptionPlanKey),
    subscriptionStatus: values.subscriptionStatus ?? existing?.subscriptionStatus ?? null,
  });
  const nextCustomers =
    existingIndex >= 0
      ? customers.map((customer, index) => (index === existingIndex ? nextCustomer : customer))
      : [nextCustomer, ...customers];

  writeCustomersIfChanged(nextCustomers, nextCustomer.id);
  const profile = withoutPassword(nextCustomer);
  syncCustomerProfile(profile);
  return profile;
}

export function updateCurrentCustomer(updates: Partial<CustomerProfile>) {
  const customers = readCustomers();
  const current = getCurrentCustomer();
  if (!current) {
    throw new Error("Log in before updating settings.");
  }

  const nextCustomers = customers.map((customer) =>
    customer.id === current.id
      ? {
          ...customer,
          ...updates,
          id: customer.id,
          email: normalizeEmail(updates.email ?? customer.email),
          role: (isAdminEmail(updates.email ?? customer.email) ? "admin" : "customer") as CustomerRole,
        }
      : customer,
  );

  writeCustomers(nextCustomers);
  const nextCustomer = getCurrentCustomer();
  syncCustomerProfile(nextCustomer);
  return nextCustomer;
}

export function grantAdminAccess(email: string) {
  const current = getCurrentCustomer();
  if (!isAdminCustomer(current)) {
    throw new Error("Only an admin can grant admin access.");
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  if (normalizedEmail === legacyDemoEmail) {
    throw new Error("The old demo account cannot be made an admin.");
  }

  if (normalizedEmail !== SWINGFI_ADMIN_EMAIL) {
    const existingRecords = readAdminAccessList();
    if (!existingRecords.some((record) => record.email === normalizedEmail)) {
      writeAdminAccessList([
        ...existingRecords,
        {
          email: normalizedEmail,
          createdAt: new Date().toISOString(),
          createdBy: current?.email ?? null,
        },
      ]);
    }
  }

  const customers = readCustomers();
  const nextCustomers = customers.map((customer) =>
    normalizeEmail(customer.email) === normalizedEmail
      ? { ...customer, role: "admin" as CustomerRole }
      : customer,
  );
  writeCustomers(nextCustomers);
  const grantedCustomer = nextCustomers.find((customer) => normalizeEmail(customer.email) === normalizedEmail);
  if (grantedCustomer) syncCustomerProfile(withoutPassword(grantedCustomer));

  return getAdminAccessRecords();
}

export function revokeAdminAccess(email: string) {
  const current = getCurrentCustomer();
  if (!isAdminCustomer(current)) {
    throw new Error("Only an admin can revoke admin access.");
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail === SWINGFI_ADMIN_EMAIL) {
    throw new Error("The owner admin cannot be removed.");
  }

  writeAdminAccessList(readAdminAccessList().filter((record) => record.email !== normalizedEmail));

  const customers = readCustomers();
  const nextCustomers = customers.map((customer) =>
    normalizeEmail(customer.email) === normalizedEmail
      ? { ...customer, role: "customer" as CustomerRole }
      : customer,
  );
  writeCustomers(nextCustomers);
  const revokedCustomer = nextCustomers.find((customer) => normalizeEmail(customer.email) === normalizedEmail);
  if (revokedCustomer) syncCustomerProfile(withoutPassword(revokedCustomer));

  return getAdminAccessRecords();
}

export function logoutCustomer() {
  window.localStorage.removeItem(currentCustomerKey);
  window.dispatchEvent(new Event("swingfi-customer-updated"));
}

export async function restoreAuthenticatedCustomerSession() {
  if (inFlightSessionRestore) {
    return inFlightSessionRestore;
  }

  inFlightSessionRestore = restoreAuthenticatedCustomerSessionInternal().finally(() => {
    inFlightSessionRestore = null;
  });

  return inFlightSessionRestore;
}

async function restoreAuthenticatedCustomerSessionInternal() {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    const current = getCurrentCustomer();
    syncCustomerProfile(current);
    return current;
  }

  const { data } = await withTimeout(
    supabase.auth.getSession(),
    2_500,
    { data: { session: null }, error: null },
  );
  const session = data.session;
  const user = session?.user;
  if (!user?.email) {
    const current = getCurrentCustomer();
    syncCustomerProfile(current);
    return current;
  }

  if (session?.access_token) {
    try {
      const response = await withTimeout(
        fetch("/api/customers/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ accessToken: session.access_token }),
        }),
        4_000,
        new Response(null, { status: 408 }),
      );
      const payload = (await response.json().catch(() => null)) as {
        customer?: Parameters<typeof rememberAuthenticatedCustomer>[0];
      } | null;

      if (response.ok && payload?.customer) {
        return rememberAuthenticatedCustomer(payload.customer);
      }
    } catch {
      return getCurrentCustomer();
    }
  }

  return rememberAuthenticatedCustomer({
    authUserId: user.id,
    createdAt: user.created_at,
    email: user.email,
    fullName:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : user.email,
    phone: typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : undefined,
    preferredBrokerage:
      typeof user.user_metadata?.preferred_brokerage === "string"
        ? normalizePreferredBrokerage(user.user_metadata.preferred_brokerage)
        : undefined,
    riskProfile:
      user.user_metadata?.risk_profile === "conservative" ||
      user.user_metadata?.risk_profile === "balanced" ||
      user.user_metadata?.risk_profile === "aggressive"
        ? user.user_metadata.risk_profile
        : undefined,
  });
}

export function isAdminCustomer(customer: CustomerProfile | null | undefined) {
  return isAdminEmail(customer?.email);
}

export function hasFullProductAccess(customer: CustomerProfile | null | undefined) {
  return getAccessState(customer).canViewAnalysis;
}

export function getCustomerPlanKey(customer: CustomerProfile | null | undefined): CustomerPlanKey | null {
  if (!customer) return null;
  if (isAdminCustomer(customer)) return "premium";

  const explicitPlan = normalizePlanKey(customer.subscriptionPlanKey);
  const isSubscriptionActive = customer.subscriptionStatus
    ? activeSubscriptionStatuses.has(customer.subscriptionStatus)
    : false;
  if (explicitPlan && isSubscriptionActive) return explicitPlan;

  const access = (() => {
    const trialEndsAt = getTrialEndsAt(customer);
    const trialEndDate = dateFromIso(trialEndsAt);
    const isTrialActive = trialEndDate ? trialEndDate.getTime() > Date.now() : false;
    return isTrialActive ? "pro" : null;
  })();

  return access;
}

export function getCustomerPlanLabel(customer: CustomerProfile | null | undefined) {
  const planKey = getCustomerPlanKey(customer);
  if (!customer) return "No plan";
  if (isAdminCustomer(customer)) return "Admin full access";
  if (!planKey) return "No active plan";
  const trialEndsAt = getTrialEndsAt(customer);
  const trialEndDate = dateFromIso(trialEndsAt);
  const isTrialActive = trialEndDate ? trialEndDate.getTime() > Date.now() : false;
  if (!customer.subscriptionPlanKey && isTrialActive) return "Pro trial";
  if (planKey === "starter") return "Starter";
  if (planKey === "premium") return "Premium";
  return "Pro";
}

export function getCustomerDailyPickLimit(customer: CustomerProfile) {
  if (isAdminCustomer(customer)) return planPickLimits.premium;

  const planKey = getCustomerPlanKey(customer);
  if (planKey) return planPickLimits[planKey];

  const riskLimit =
    customer.riskProfile === "conservative"
      ? 12
      : customer.riskProfile === "aggressive"
        ? 30
        : 20;
  const budgetLimit =
    customer.accountBudget === "under_1000"
      ? 12
      : customer.accountBudget === "1000_5000"
        ? 16
        : 30;

  return Math.min(riskLimit, budgetLimit);
}
