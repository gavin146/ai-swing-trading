import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const ownerAdminEmail = "gavin@onefear.co";

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

async function isApprovedSupabaseAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) return false;

  const supabase = createSupabaseAdminClient();
  if (!supabase) return false;

  const { data, error } = await supabase.auth.getUser(token);
  const email = normalizeEmail(data.user?.email);

  if (error || !data.user || !email) return false;
  if (email === ownerAdminEmail) return true;

  const [userRoleResult, grantResult] = await Promise.all([
    supabase.from("users").select("role").eq("email", email).maybeSingle(),
    supabase
      .from("admin_access_grants")
      .select("email")
      .eq("email", email)
      .is("revoked_at", null)
      .maybeSingle(),
  ]);

  return userRoleResult.data?.role === "admin" || Boolean(grantResult.data?.email);
}

export async function isAdminApiRequest(request: NextRequest) {
  const adminSecret = process.env.ADMIN_API_SECRET;

  if (process.env.NODE_ENV !== "production") {
    return (
      request.headers.get("x-swingfi-admin") === "true" ||
      request.headers.get("x-tradepilot-admin") === "true" ||
      (await isApprovedSupabaseAdmin(request))
    );
  }

  if (adminSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${adminSecret}`) {
      return true;
    }
  }

  return isApprovedSupabaseAdmin(request);
}

export function getAdminUnauthorizedResponse() {
  return {
    error:
      "Admin access is required. Sign in with an approved admin account, or use ADMIN_API_SECRET from trusted admin tooling.",
  };
}
