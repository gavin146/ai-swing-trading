const safePathPattern = /^\/[A-Za-z0-9/_?=&%+.#:-]*$/;

export function normalizeCustomerNextPath(
  value: string | null | undefined,
  fallback?: string,
) {
  if (!value) return fallback;
  if (!safePathPattern.test(value)) return fallback;
  if (value.startsWith("//") || value.includes("://")) return fallback;

  return value;
}

export function customerDestinationLabel(path: string | null | undefined) {
  const safePath = normalizeCustomerNextPath(path);

  if (!safePath || safePath === "/dashboard") return "today's dashboard";
  if (safePath === "/portfolio") return "your portfolio";
  if (safePath === "/history") return "saved pick history";
  if (safePath === "/settings") return "settings";
  if (safePath === "/pricing") return "pricing";
  if (safePath === "/admin") return "admin";
  if (safePath.startsWith("/opportunities/")) return "this stock analysis";

  return "SwingFi";
}

export function loginHref(nextPath?: string | null) {
  const safePath = normalizeCustomerNextPath(nextPath);

  return safePath ? `/login?next=${encodeURIComponent(safePath)}` : "/login";
}

export function signupHref({
  nextPath,
  plan,
}: {
  nextPath?: string | null;
  plan?: string | null;
} = {}) {
  const params = new URLSearchParams();
  const safePath = normalizeCustomerNextPath(nextPath);

  if (safePath) params.set("next", safePath);
  if (plan) params.set("plan", plan);

  const query = params.toString();
  return query ? `/signup?${query}` : "/signup";
}
