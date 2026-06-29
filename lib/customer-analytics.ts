"use client";

export type EmailLinkEvent = {
  id: string;
  customerId: string;
  symbol: string;
  trackingId: string;
  source: "morning_email" | "manual";
  clickedAt: string;
};

export type CustomerUsageSummary = {
  customerId: string;
  monthKey: string;
  emailsSent: number;
  smsSent: number;
  emailOpens: number;
  lastEmailOpenAt: string | null;
  emailLinkClicks: number;
  smsLinkClicks: number;
  totalLinkClicks: number;
  lastEmailClickAt: string | null;
  lastLinkClickAt: string | null;
  topSymbols: string[];
};

const eventsKey = "swingfi-email-link-events";
const legacyEventsKey = "tradepilot-email-link-events";

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function isProductionEvent(event: EmailLinkEvent) {
  return event.customerId !== "demo-customer" && !event.trackingId.startsWith("demo-");
}

export function getEmailLinkEvents() {
  if (typeof window === "undefined") {
    return [];
  }

  const stored =
    window.localStorage.getItem(eventsKey) ?? window.localStorage.getItem(legacyEventsKey);

  if (!stored) {
    window.localStorage.removeItem(legacyEventsKey);
    return [];
  }

  try {
    const parsed = (JSON.parse(stored) as EmailLinkEvent[]).filter(isProductionEvent);
    window.localStorage.setItem(eventsKey, JSON.stringify(parsed));
    window.localStorage.removeItem(legacyEventsKey);
    return parsed;
  } catch {
    window.localStorage.removeItem(eventsKey);
    window.localStorage.removeItem(legacyEventsKey);
    return [];
  }
}

export function trackEmailLinkClick(args: {
  customerId: string;
  symbol: string;
  trackingId: string;
  source?: EmailLinkEvent["source"];
}) {
  if (typeof window === "undefined") return;

  const events = getEmailLinkEvents();
  const event: EmailLinkEvent = {
    id: crypto.randomUUID(),
    customerId: args.customerId,
    symbol: args.symbol.toUpperCase(),
    trackingId: args.trackingId,
    source: args.source ?? "morning_email",
    clickedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(eventsKey, JSON.stringify([event, ...events]));
  window.dispatchEvent(new Event("swingfi-analytics-updated"));
}

export function getCustomerUsageSummaries(date = new Date()) {
  const key = monthKey(date);
  const events = getEmailLinkEvents().filter((event) => event.clickedAt.startsWith(key));
  const byCustomer = new Map<string, EmailLinkEvent[]>();

  events.forEach((event) => {
    const current = byCustomer.get(event.customerId) ?? [];
    byCustomer.set(event.customerId, [...current, event]);
  });

  return Array.from(byCustomer.entries()).map(([customerId, customerEvents]) => {
    const symbolCounts = new Map<string, number>();

    customerEvents.forEach((event) => {
      symbolCounts.set(event.symbol, (symbolCounts.get(event.symbol) ?? 0) + 1);
    });

    return {
      customerId,
      emailsSent: 0,
      smsSent: 0,
      emailOpens: 0,
      monthKey: key,
      emailLinkClicks: customerEvents.length,
      smsLinkClicks: 0,
      totalLinkClicks: customerEvents.length,
      lastEmailOpenAt: null,
      lastEmailClickAt:
        customerEvents
          .map((event) => event.clickedAt)
          .sort()
          .at(-1) ?? null,
      lastLinkClickAt:
        customerEvents
          .map((event) => event.clickedAt)
          .sort()
          .at(-1) ?? null,
      topSymbols: Array.from(symbolCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([symbol]) => symbol),
    } satisfies CustomerUsageSummary;
  });
}
