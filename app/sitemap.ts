import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getPublicAppUrl();
  const lastModified = new Date("2026-06-23T00:00:00.000Z");

  return [
    "",
    "/pricing",
    "/login",
    "/signup",
    "/legal",
    "/legal/disclaimer",
    "/legal/privacy",
    "/legal/terms",
  ].map((path) => ({
    url: `${appUrl}${path}`,
    lastModified,
  }));
}
