"use client";

import type { RiskProfile } from "./database.types";

export type AlertChannel = "sms" | "email" | "none";

export type CustomerProfile = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  riskProfile: RiskProfile;
  minimumConfidence: number;
  maxRiskScore: number;
  morningAlertsEnabled: boolean;
  alertChannel: AlertChannel;
  alertTime: string;
  timezone: string;
  createdAt: string;
};

type StoredCustomer = CustomerProfile & {
  password: string;
};

const customersKey = "tradepilot-customers";
const currentCustomerKey = "tradepilot-current-customer-id";

const demoCustomer: StoredCustomer = {
  id: "demo-customer",
  email: "avery@example.com",
  fullName: "Avery Investor",
  phone: "",
  riskProfile: "balanced",
  minimumConfidence: 70,
  maxRiskScore: 65,
  morningAlertsEnabled: true,
  alertChannel: "sms",
  alertTime: "07:30",
  timezone: "America/Chicago",
  createdAt: "2026-06-20T04:00:00.000Z",
  password: "demo1234",
};

function withoutPassword(customer: StoredCustomer): CustomerProfile {
  const profile: CustomerProfile = {
    id: customer.id,
    email: customer.email,
    fullName: customer.fullName,
    phone: customer.phone,
    riskProfile: customer.riskProfile,
    minimumConfidence: customer.minimumConfidence,
    maxRiskScore: customer.maxRiskScore,
    morningAlertsEnabled: customer.morningAlertsEnabled,
    alertChannel: customer.alertChannel,
    alertTime: customer.alertTime,
    timezone: customer.timezone,
    createdAt: customer.createdAt,
  };

  return profile;
}

function readCustomers(): StoredCustomer[] {
  if (typeof window === "undefined") {
    return [demoCustomer];
  }

  const stored = window.localStorage.getItem(customersKey);

  if (!stored) {
    window.localStorage.setItem(customersKey, JSON.stringify([demoCustomer]));
    window.localStorage.setItem(currentCustomerKey, demoCustomer.id);
    return [demoCustomer];
  }

  try {
    const customers = JSON.parse(stored) as StoredCustomer[];
    return customers.length > 0 ? customers : [demoCustomer];
  } catch {
    window.localStorage.setItem(customersKey, JSON.stringify([demoCustomer]));
    window.localStorage.setItem(currentCustomerKey, demoCustomer.id);
    return [demoCustomer];
  }
}

function writeCustomers(customers: StoredCustomer[]) {
  window.localStorage.setItem(customersKey, JSON.stringify(customers));
  window.dispatchEvent(new Event("tradepilot-customer-updated"));
}

export function getCustomerProfiles() {
  return readCustomers().map(withoutPassword);
}

export function getCurrentCustomer() {
  if (typeof window === "undefined") {
    return withoutPassword(demoCustomer);
  }

  const customers = readCustomers();
  const currentId = window.localStorage.getItem(currentCustomerKey);
  const current = customers.find((customer) => customer.id === currentId) ?? customers[0];

  if (!currentId) {
    window.localStorage.setItem(currentCustomerKey, current.id);
  }

  return withoutPassword(current);
}

export function loginCustomer(email: string, password: string) {
  const customers = readCustomers();
  const normalizedEmail = email.trim().toLowerCase();
  const customer = customers.find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.password === password,
  );

  if (!customer) {
    throw new Error("No customer matched that email and password.");
  }

  window.localStorage.setItem(currentCustomerKey, customer.id);
  window.dispatchEvent(new Event("tradepilot-customer-updated"));
  return withoutPassword(customer);
}

export function signupCustomer(values: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
}) {
  const customers = readCustomers();
  const normalizedEmail = values.email.trim().toLowerCase();

  if (customers.some((customer) => customer.email.toLowerCase() === normalizedEmail)) {
    throw new Error("An account already exists for that email.");
  }

  const nextCustomer: StoredCustomer = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    fullName: `${values.firstName.trim()} ${values.lastName.trim()}`.trim(),
    phone: values.phone?.trim() ?? "",
    riskProfile: "balanced",
    minimumConfidence: 70,
    maxRiskScore: 65,
    morningAlertsEnabled: true,
    alertChannel: values.phone ? "sms" : "none",
    alertTime: "07:30",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    createdAt: new Date().toISOString(),
    password: values.password,
  };

  writeCustomers([nextCustomer, ...customers]);
  window.localStorage.setItem(currentCustomerKey, nextCustomer.id);
  window.dispatchEvent(new Event("tradepilot-customer-updated"));
  return withoutPassword(nextCustomer);
}

export function updateCurrentCustomer(updates: Partial<CustomerProfile>) {
  const customers = readCustomers();
  const current = getCurrentCustomer();
  const nextCustomers = customers.map((customer) =>
    customer.id === current.id
      ? {
          ...customer,
          ...updates,
          id: customer.id,
          email: updates.email?.trim().toLowerCase() ?? customer.email,
        }
      : customer,
  );

  writeCustomers(nextCustomers);
  return getCurrentCustomer();
}

export function logoutCustomer() {
  window.localStorage.removeItem(currentCustomerKey);
  window.dispatchEvent(new Event("tradepilot-customer-updated"));
}

export function getCustomerDailyPickLimit(customer: CustomerProfile) {
  if (customer.riskProfile === "conservative") return 12;
  if (customer.riskProfile === "aggressive") return 30;
  return 20;
}
