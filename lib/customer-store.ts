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
  authUserId?: string | null;
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

const customersKey = "swingfi-customers";
const currentCustomerKey = "swingfi-current-customer-id";
const adminEmailsKey = "swingfi-admin-emails";
const legacyCustomersKey = "tradepilot-customers";
const legacyCurrentCustomerKey = "tradepilot-current-customer-id";
const legacyAdminEmailsKey = "tradepilot-admin-emails";
const legacyDemoEmail = "avery@example.com";

export const SWINGFI_ADMIN_EMAIL = "gavin@onefear.co";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
    lastLoginAt: customer.lastLoginAt ?? null,
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

function applySyncedRole(customerId: string, role: CustomerRole | undefined) {
  if (!role || (role !== "admin" && role !== "customer")) return;

  const customers = readCustomers();
  const nextCustomers = customers.map((customer) =>
    customer.id === customerId ? { ...customer, role } : customer,
  );

  if (JSON.stringify(customers) !== JSON.stringify(nextCustomers)) {
    writeCustomers(nextCustomers);
  }
}

function syncCustomerProfile(customer: CustomerProfile | null) {
  if (!customer || typeof window === "undefined") return;

  fetch("/api/customers/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer),
  })
    .then(async (response) => {
      if (!response.ok) return;

      const payload = (await response.json().catch(() => null)) as {
        customer?: { role?: CustomerRole };
      } | null;

      applySyncedRole(customer.id, payload?.customer?.role);
    })
    .catch((error) => {
      console.warn("SwingFi customer sync failed", error);
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
  window.dispatchEvent(new Event("swingfi-customer-updated"));
  const profile = withoutPassword(nextCustomer);
  syncCustomerProfile(profile);
  return profile;
}

export function rememberAuthenticatedCustomer(values: {
  accountBudget?: AccountBudget;
  authUserId?: string | null;
  email: string;
  fullName: string;
  investingExperience?: InvestingExperience;
  password?: string;
  phone?: string;
  positionSizePreference?: PositionSizePreference;
  riskProfile?: RiskProfile;
  setupPreference?: SetupPreference;
}) {
  const customers = readCustomers();
  const normalizedEmail = normalizeEmail(values.email);
  const existing = customers.find((customer) => normalizeEmail(customer.email) === normalizedEmail);
  const existingIndex = customers.findIndex(
    (customer) => normalizeEmail(customer.email) === normalizedEmail,
  );
  const riskProfile = values.riskProfile ?? existing?.riskProfile ?? "balanced";
  const nextCustomer: StoredCustomer = normalizeCustomer({
    id: existing?.id ?? crypto.randomUUID(),
    authUserId: values.authUserId ?? existing?.authUserId ?? null,
    email: normalizedEmail,
    fullName: values.fullName.trim() || existing?.fullName || normalizedEmail,
    role: isAdminEmail(normalizedEmail) ? "admin" : "customer",
    phone: values.phone?.trim() ?? existing?.phone ?? "",
    riskProfile,
    accountBudget: values.accountBudget ?? existing?.accountBudget ?? "not_set",
    investingExperience: values.investingExperience ?? existing?.investingExperience ?? "beginner",
    positionSizePreference:
      values.positionSizePreference ?? existing?.positionSizePreference ?? "small",
    setupPreference: values.setupPreference ?? existing?.setupPreference ?? "balanced",
    minimumConfidence:
      existing?.minimumConfidence ??
      (riskProfile === "conservative" ? 78 : riskProfile === "aggressive" ? 62 : 70),
    maxRiskScore:
      existing?.maxRiskScore ??
      (riskProfile === "conservative" ? 45 : riskProfile === "aggressive" ? 78 : 65),
    morningAlertsEnabled: existing?.morningAlertsEnabled ?? true,
    alertChannel: existing?.alertChannel ?? "email",
    alertTime: existing?.alertTime ?? "08:30",
    timezone:
      existing?.timezone ??
      (typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "America/Chicago"),
    lastLoginAt: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    password: values.password ?? existing?.password ?? "",
  });
  const nextCustomers =
    existingIndex >= 0
      ? customers.map((customer, index) => (index === existingIndex ? nextCustomer : customer))
      : [nextCustomer, ...customers];

  writeCustomers(nextCustomers);
  window.localStorage.setItem(currentCustomerKey, nextCustomer.id);
  window.dispatchEvent(new Event("swingfi-customer-updated"));
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
