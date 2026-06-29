import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = cleanEmail(body.email);
  const rateLimit = checkRateLimit(request, {
    key: `auth:account-status:${email}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many account checks. Wait a few minutes, then try again." },
      {
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        status: 429,
      },
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ validEmail: false });
  }

  return NextResponse.json({ validEmail: true });
}
