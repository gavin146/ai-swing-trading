import type { NextRequest } from "next/server";
import { isAdminApiRequest } from "@/lib/auth/admin";
import { resolveCustomerSession } from "@/lib/auth/customer-session";

const trialLengthMs = 30 * 24 * 60 * 60 * 1000;
const activeSubscriptionStatuses = ["active", "trialing"];

function isRecentTrial(createdAt: unknown) {
  const parsed = new Date(String(createdAt ?? ""));

  if (Number.isNaN(parsed.getTime())) return false;

  return Date.now() - parsed.getTime() <= trialLengthMs;
}

export type ResearchAccessResult =
  | {
      allowed: true;
      isAdmin: boolean;
      userId: string | null;
    }
  | {
      allowed: false;
      body: {
        error: string;
        reason: string;
        source: "empty";
      };
      status: number;
    };

export async function resolveResearchAccess(request: NextRequest): Promise<ResearchAccessResult> {
  if (await isAdminApiRequest(request)) {
    return {
      allowed: true,
      isAdmin: true,
      userId: null,
    };
  }

  const session = await resolveCustomerSession(request);
  if (session.error) {
    return {
      allowed: false,
      body: {
        error: session.error,
        reason: "Sign in to start or continue your SwingFi trial.",
        source: "empty",
      },
      status: session.status,
    };
  }

  const supabase = session.supabase!;
  const user = session.user!;
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id,role,created_at,email_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  if (userError || !userRow) {
    return {
      allowed: false,
      body: {
        error: userError?.message ?? "Customer profile was not found.",
        reason: "Create or restore your SwingFi account before opening research.",
        source: "empty",
      },
      status: userError ? 503 : 404,
    };
  }

  if (userRow.role === "admin" || user.role === "admin") {
    return {
      allowed: true,
      isAdmin: true,
      userId: user.id,
    };
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .in("status", activeSubscriptionStatuses)
    .limit(1)
    .maybeSingle();
  const emailVerified = Boolean(userRow.email_verified_at);
  const trialActive = isRecentTrial(userRow.created_at);
  const subscriptionActive = Boolean(subscription?.status);

  if (emailVerified && (trialActive || subscriptionActive)) {
    return {
      allowed: true,
      isAdmin: false,
      userId: user.id,
    };
  }

  return {
    allowed: false,
    body: {
      error: emailVerified
        ? "An active trial or subscription is required to view SwingFi research."
        : "Email verification is required to view SwingFi research.",
      reason: emailVerified
        ? "Start a subscription from Pricing or Settings to unlock today's analysis."
        : "Confirm your email, then return to SwingFi to open today's analysis.",
      source: "empty",
    },
    status: emailVerified ? 402 : 403,
  };
}
