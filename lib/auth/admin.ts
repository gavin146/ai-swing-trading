import type { NextRequest } from "next/server";

export function isAdminApiRequest(request: NextRequest) {
  const adminSecret = process.env.ADMIN_API_SECRET;

  if (adminSecret) {
    return request.headers.get("authorization") === `Bearer ${adminSecret}`;
  }

  if (process.env.NODE_ENV !== "production") {
    return request.headers.get("x-tradepilot-admin") === "true";
  }

  return false;
}

export function getAdminUnauthorizedResponse() {
  return {
    error:
      "Admin access is required. Configure ADMIN_API_SECRET in production and send it as a Bearer token from trusted admin tooling.",
  };
}
