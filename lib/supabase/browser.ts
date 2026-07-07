"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0) ?? "";
}

async function safeSupabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch {
    return new Response(
      JSON.stringify({
        message: "SwingFi could not reach Supabase from this browser session.",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 503,
        statusText: "Supabase unavailable",
      },
    );
  }
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

  browserClient ??= createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: true,
      persistSession: true,
    },
    global: {
      fetch: safeSupabaseFetch,
    },
  });
  return browserClient;
}
