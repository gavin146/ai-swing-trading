"use client";

import type { RiskProfile } from "./database.types";

export type AlertChannel = "sms" | "email" | "none";
export type CustomerRole = "admin" | "customer";
export type AccountBudget = "not_set" | "under_1000" | "1000_5000" | "5000_25000" | "25000_plus";
export type InvestingExperience = "beginner" | "intermediate" | "advanced";
export type PositionSizePreference = "small" | "moderate" | "aggressive";
export type SetupPreference = "steady" | "balanced" | "momentum";

export type CustomerProfile = {
  id: string;
  email: string;
  fullName: string;
  role: CustomerRole;
  phone: string;
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
  lastLoginAt: string | null;
  createdAt: string;
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

const customersKey = "tradepilot-customers";
const currentCustomerKey = "tradepilot-current-customer-id";
const adminEmailsKey = "tradepilot-admin-emails";
const legacyDemoEmail = "avery@example.com";

export const TRADEPILOT_ADMIN_EMAIL = "gavin@onefear.co";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readAdminAccessList(): StoredAdminAccess[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(adminEmailsKey);
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

      if (!email || email === TRADEPILOT_ADMIN_EMAIL || email === legacyDemoEmail) continue;

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
    .filter((record) => record.email && record.email !== TRADEPILOT_ADMIN_EMAIL)
    .filter((record, index, list) => list.findIndex((item) => item.email === record.email) === index);

  window.localStorage.setItem(adminEmailsKey, JSON.stringify(normalizedRecords));
  window.dispatchEvent(new Event("tradepilot-customer-updated"));
}

export function isAdminEmail(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email ?? "");
  if (normalizedEmail === TRADEPILOT_ADMIN_EMAIL) {
    return true;
  }

  return readAdminAccessList().some((record) => record.email === normalizedEmail);
}

function withoutPassword(customer: StoredCustomer): CustomerProfile {
  const profile: CustomerProfile = {
    id: customer.id,
    email: customer.email,
    fullName: customer.fullName,
    role: customer.role ?? "customer",
    phone: customer.phone,
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
    lastLoginAt: customer.lastLoginAt ?? null,
    createdAt: customer.createdAt,
  };

  return profile;
}

function normalizeCustomer(customer: StoredCustomer): StoredCustomer {
  const email = normalizeEmail(customer.email);

  return {
    ...customer,
    email,
    role: isAdminEmail(email) ? "admin" : "customer",
    phone: customer.phone ?? "",
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
    lastLoginAt: customer.lastLoginAt ?? null,
  };
}

function readCustomers(): StoredCustomer[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(customersKey);

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
  window.dispatchEvent(new Event("tradepilot-customer-updated"));
}

function syncCustomerProfile(customer: CustomerProfile | null) {
  if (!customer || typeof window === "undefined") return;

  fetch("/api/customers/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer),
  }).catch((error) => {
    console.warn("TradePilot customer sync failed", error);
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
      email: TRADEPILOT_ADMIN_EMAIL,
      source: "owner",
      createdAt: "2026-06-22T00:00:00.000Z",
      createdBy: null,
      hasAccount: customers.some((customer) => normalizeEmail(customer.email) === TRADEPILOT_ADMIN_EMAIL),
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
  const currentId = window.localStorage.getItem(currentCustomerKey);
  const current = customers.find((customer) => customer.id === currentId) ?? null;

  if (!current) {
    window.localStorage.removeItem(currentCustomerKey);
    return null;
  }

  return withoutPassword(current);
}

export function loginCustomer(email: string, password: string) {
  const customers = readCustomers();
  const normalizedEmail = normalizeEmail(email);
  const customer = customers.find(
    (item) => normalizeEmail(item.email) === normalizedEmail && item.password === password,
  );

  if (!customer) {
    throw new Error("No customer matched that email and password.");
  }

  customer.lastLoginAt = new Date().toISOString();
  writeCustomers(customers);
  window.localStorage.setItem(currentCustomerKey, customer.id);
  window.dispatchEvent(new Event("tradepilot-customer-updated"));
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
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    password: values.password,
  };

  writeCustomers([nextCustomer, ...customers]);
  window.localStorage.setItem(currentCustomerKey, nextCustomer.id);
  window.dispatchEvent(new Event("tradepilot-customer-updated"));
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

  if (normalizedEmail !== TRADEPILOT_ADMIN_EMAIL) {
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
  if (normalizedEmail === TRADEPILOT_ADMIN_EMAIL) {
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
  window.dispatchEvent(new Event("tradepilot-customer-updated"));
}

export function isAdminCustomer(customer: CustomerProfile | null | undefined) {
  return isAdminEmail(customer?.email);
}

export function hasFullProductAccess(customer: CustomerProfile | null | undefined) {
  return isAdminCustomer(customer);
}

export function getCustomerDailyPickLimit(customer: CustomerProfile) {
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
