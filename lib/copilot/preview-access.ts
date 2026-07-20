import { assertServerOnlyModule } from "./server-only";

assertServerOnlyModule("lib/copilot/preview-access");

const defaultCopilotPreviewEmail = "gavin@onefear.co";
const defaultRateLimitWindowMs = 60_000;
const defaultRateLimitMaxRequests = 30;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitEntry>();

export function normalizeCopilotPreviewEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function getCopilotPreviewAllowlist(env: Record<string, string | undefined> = process.env) {
  const configured = env.COPILOT_PREVIEW_EMAILS?.trim();
  const source = configured ? configured : defaultCopilotPreviewEmail;

  return new Set(
    source
      .split(",")
      .map(normalizeCopilotPreviewEmail)
      .filter(Boolean),
  );
}

export function isCopilotPreviewEmailAllowed(
  sessionEmail: unknown,
  env: Record<string, string | undefined> = process.env,
) {
  const normalized = normalizeCopilotPreviewEmail(sessionEmail);
  return Boolean(normalized && getCopilotPreviewAllowlist(env).has(normalized));
}

export function redactCopilotSensitiveText(value: unknown) {
  return String(value ?? "")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_]+/g, "[redacted_key]")
    .replace(/\bsk-[A-Za-z0-9_-]+/g, "[redacted_key]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted_jwt]")
    .replace(
      /\b(api[_-]?key|service[_-]?role|secret|token|authorization|password)\s*[:=]\s*["']?[^"',\s}]+/gi,
      "$1=[redacted]",
    );
}

export function sanitizeCopilotError(value: unknown, fallback = "Copilot preview is temporarily unavailable.") {
  const message = value instanceof Error ? value.message : String(value ?? fallback);
  const redacted = redactCopilotSensitiveText(message).trim();

  return (redacted || fallback).slice(0, 240);
}

export function logCopilotServerError(context: string, error: unknown, metadata: Record<string, unknown> = {}) {
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, redactCopilotSensitiveText(value)]),
  );
  const stack = error instanceof Error ? redactCopilotSensitiveText(error.stack).slice(0, 1_200) : undefined;

  console.error("[copilot]", {
    context,
    message: sanitizeCopilotError(error),
    ...safeMetadata,
    ...(stack ? { stack } : {}),
  });
}

export function checkCopilotPreviewRateLimit(
  key: string,
  options: {
    limit?: number;
    nowMs?: number;
    windowMs?: number;
  } = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const windowMs = options.windowMs ?? defaultRateLimitWindowMs;
  const limit = options.limit ?? defaultRateLimitMaxRequests;
  const existing = rateLimitBuckets.get(key);

  if (!existing || existing.resetAt <= nowMs) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: nowMs + windowMs,
    });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: nowMs + windowMs,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  rateLimitBuckets.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export function resetCopilotPreviewRateLimitForTests() {
  rateLimitBuckets.clear();
}
