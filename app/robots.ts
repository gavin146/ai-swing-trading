import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getPublicAppUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/pricing",
          "/login",
          "/signup",
          "/legal",
          "/legal/disclaimer",
          "/legal/privacy",
          "/legal/terms",
        ],
        disallow: [
          "/admin",
          "/agent",
          "/api",
          "/backtests",
          "/billing",
          "/dashboard",
          "/e",
          "/history",
          "/opportunities",
          "/portfolio",
          "/reset-password",
          "/settings",
          "/themes",
          "/unsubscribe",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
