"use client";

const adminTokenKey = "tradepilot-admin-api-token";

export function getStoredAdminToken() {
  if (typeof window === "undefined") return "";

  return window.localStorage.getItem(adminTokenKey) ?? "";
}

export function setStoredAdminToken(token: string) {
  if (typeof window === "undefined") return;

  const nextToken = token.trim();

  if (nextToken) {
    window.localStorage.setItem(adminTokenKey, nextToken);
  } else {
    window.localStorage.removeItem(adminTokenKey);
  }

  window.dispatchEvent(new Event("tradepilot-admin-token-updated"));
}

export function getAdminHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const token = getStoredAdminToken();

  if (token) {
    nextHeaders.set("authorization", `Bearer ${token}`);
  } else {
    nextHeaders.set("x-tradepilot-admin", "true");
  }

  return nextHeaders;
}
