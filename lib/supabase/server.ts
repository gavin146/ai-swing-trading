import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseMode = "admin" | "public";

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0) ?? "";
}

function getSupabaseUrl() {
  return firstNonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL);
}

function getSupabaseKey(mode: SupabaseMode) {
  if (mode === "admin") {
    return firstNonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY);
  }

  return firstNonEmpty(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  );
}

export function hasSupabaseAdminConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseKey("admin"));
}

export function hasSupabasePublicConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseKey("public"));
}

export function createSupabaseAdminClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseKey("admin");

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
