export const brand = {
  appName: "SwingFi",
  badge: "AI",
  contactEmail: "tradestockswithai@gmail.com",
  legalLastUpdated: "June 29, 2026",
  tagline: "Daily swing trade intelligence",
};

export function normalizeAppUrl(
  value: string | undefined | null,
  fallback = "https://www.swingfi.trade",
) {
  const configured = value?.trim();
  const rawUrl = configured
    ? configured.startsWith("http")
      ? configured
      : `https://${configured}`
    : fallback;
  const parsed = new URL(rawUrl.replace(/\/$/, ""));
  const host = parsed.hostname.toLowerCase();

  if (host === "getswingfi.com" || host === "www.getswingfi.com") {
    return "https://www.swingfi.trade";
  }

  return parsed.toString().replace(/\/$/, "");
}

export function getPublicAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return normalizeAppUrl(configured);
}
