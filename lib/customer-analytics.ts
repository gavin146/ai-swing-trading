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
  emailLinkClicks: number;
  lastEmailClickAt: string | null;
  topSymbols: string[];
};

const eventsKey = "tradepilot-email-link-events";

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function demoEvents(): EmailLinkEvent[] {
  const now = new Date();
  const month = monthKey(now);

  return [
    {
      id: `${month}-demo-1`,
      customerId: "demo-customer",
      symbol: "NVDA",
      trackingId: "demo-nvda",
      source: "morning_email",
      clickedAt: new Date(now.getFullYear(), now.getMonth(), 3, 8, 44).toISOString(),
    },
    {
      id: `${month}-demo-2`,
      customerId: "demo-customer",
      symbol: "MSFT",
      trackingId: "demo-msft",
      source: "morning_email",
      clickedAt: new Date(now.getFullYear(), now.getMonth(), 7, 8, 51).toISOString(),
    },
    {
      id: `${month}-demo-3`,
      customerId: "demo-customer",
      symbol: "AMD",
      trackingId: "demo-amd",
      source: "morning_email",
      clickedAt: new Date(now.getFullYear(), now.getMonth(), 12, 9, 6).toISOString(),
    },
  ];
}

export function getEmailLinkEvents() {
  if (typeof window === "undefined") {
    return demoEvents();
  }

  const stored = window.localStorage.getItem(eventsKey);

  if (!stored) {
    const seeded = demoEvents();
    window.localStorage.setItem(eventsKey, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return JSON.parse(stored) as EmailLinkEvent[];
  } catch {
    const seeded = demoEvents();
    window.localStorage.setItem(eventsKey, JSON.stringify(seeded));
    return seeded;
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
  window.dispatchEvent(new Event("tradepilot-analytics-updated"));
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
      monthKey: key,
      emailLinkClicks: customerEvents.length,
      lastEmailClickAt:
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
