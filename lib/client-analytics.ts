"use client";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type AnalyticsEventParams = Record<string, string | number | boolean | null | undefined>;

export function trackAnalyticsEvent(eventName: string, params: AnalyticsEventParams = {}) {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event: eventName,
    ...params,
  });

  if (window.gtag) {
    window.gtag("event", eventName, params);
  }
}

export function trackOnce(storageKey: string, eventName: string, params: AnalyticsEventParams = {}) {
  if (typeof window === "undefined") return;

  try {
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, "tracked");
  } catch {
    // If storage is blocked, still send the event once for this render path.
  }

  trackAnalyticsEvent(eventName, params);
}
