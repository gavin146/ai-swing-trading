export const brand = {
  appName: "SwingFi",
  badge: "AI",
  contactEmail: "tradestockswithai@gmail.com",
  legalLastUpdated: "June 23, 2026",
  tagline: "Daily swing trade intelligence",
};

export function getPublicAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const fallback = "https://www.getswingfi.com";
  const url = configured
    ? configured.startsWith("http")
      ? configured
      : `https://${configured}`
    : fallback;

  return url.replace(/\/$/, "");
}
