import type { NextRequest } from "next/server";

type RateLimitState = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitState>();

function cleanPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 160);
}

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  return cleanPart(
    forwarded ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown",
  );
}

export function checkRateLimit(
  request: NextRequest,
  args: {
    key?: string;
    limit: number;
    windowMs: number;
  },
) {
  const now = Date.now();
  const key = `${clientIp(request)}:${cleanPart(args.key)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + args.windowMs,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  current.count += 1;

  if (current.count > args.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}
