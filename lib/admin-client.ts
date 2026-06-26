"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const adminTokenKey = "swingfi-admin-api-token";
const legacyAdminTokenKey = "tradepilot-admin-api-token";

function readAdminToken() {
  const current = window.localStorage.getItem(adminTokenKey);
  if (current) return current;

  const legacy = window.localStorage.getItem(legacyAdminTokenKey);
  if (legacy) {
    window.localStorage.setItem(adminTokenKey, legacy);
    window.localStorage.removeItem(legacyAdminTokenKey);
  }

  return legacy ?? "";
}

export function getStoredAdminToken() {
  if (typeof window === "undefined") return "";

  return readAdminToken();
}

export function setStoredAdminToken(token: string) {
  if (typeof window === "undefined") return;

  const nextToken = token.trim();

  if (nextToken) {
    window.localStorage.setItem(adminTokenKey, nextToken);
  } else {
    window.localStorage.removeItem(adminTokenKey);
  }

  window.dispatchEvent(new Event("swingfi-admin-token-updated"));
}

export async function getAdminHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const token = getStoredAdminToken();

  if (token) {
    nextHeaders.set("authorization", `Bearer ${token}`);
    return nextHeaders;
  }

  const supabase = createSupabaseBrowserClient();
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const accessToken = data.session?.access_token;

  if (accessToken) {
    nextHeaders.set("authorization", `Bearer ${accessToken}`);
  } else {
    nextHeaders.set("x-swingfi-admin", "true");
  }

  return nextHeaders;
}
