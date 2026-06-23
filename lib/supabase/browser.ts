"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0) ?? "";
}

export function createSupabaseBrowserClient() {
  const url = firstNonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = firstNonEmpty(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!url || !key) {
    return null;
  }

  browserClient ??= createClient(url, key);
  return browserClient;
}
