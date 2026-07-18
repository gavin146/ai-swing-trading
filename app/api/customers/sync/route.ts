import { NextRequest, NextResponse } from "next/server";
import type { SubscriptionStatus, UserRole } from "@/lib/database.types";
import { normalizePreferredBrokerage } from "@/lib/brokerages";
import {
  buildCustomerSyncPayload,
  normalizeCustomerSyncEmail,
} from "@/lib/auth/customer-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ownerAdminEmail = "gavin@onefear.co";
const activeSubscriptionStatuses = new Set<SubscriptionStatus>(["active", "trialing"]);

function isMissingPreferredBrokerageColumn(error: { message?: string } | null | undefined) {
  return Boolean(error?.message?.toLowerCase().includes("preferred_brokerage"));
}

async function resolveRole(email: string): Promise<UserRole> {
  if (email === ownerAdminEmail) return "admin";

  const supabase = createSupabaseAdminClient();
  if (!supabase) return "customer";

  const { data } = await supabase
    .from("admin_access_grants")
    .select("email")
    .eq("email", email)
    .is("revoked_at", null)
    .maybeSingle();

  return data?.email ? "admin" : "customer";
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role is not configured." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return NextResponse.json({ error: "A valid SwingFi login session is required." }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const authUser = authData.user;
  const email = normalizeCustomerSyncEmail(authUser?.email);

  if (authError || !authUser || !email) {
    return NextResponse.json({ error: "Your login session could not be verified." }, { status: 401 });
  }

  const role = await resolveRole(email);
  let payload: ReturnType<typeof buildCustomerSyncPayload>;

  try {
    payload = buildCustomerSyncPayload({
      body,
      identity: {
        authUserId: authUser.id,
        email,
      },
      nowIso: new Date().toISOString(),
      role,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile sync could not be verified." },
      { status: 403 },
    );
  }

  let { data, error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "email" })
    .select("id,email,role,email_verified_at,terms_accepted_at,stripe_customer_id")
    .single();

  if (isMissingPreferredBrokerageColumn(error)) {
    const legacyPayload: Record<string, unknown> = { ...payload };
    delete legacyPayload.preferred_brokerage;
    const retry = await supabase
      .from("users")
      .upsert(legacyPayload, { onConflict: "email" })
      .select("id,email,role,email_verified_at,terms_accepted_at,stripe_customer_id")
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (!data) {
    return NextResponse.json({ error: "Could not sync your SwingFi profile." }, { status: 503 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_key,status,current_period_end,trial_end,updated_at")
    .eq("user_id", data.id)
    .in("status", Array.from(activeSubscriptionStatuses))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    customer: {
      email: data.email,
      emailVerifiedAt: data.email_verified_at,
      id: data.id,
      preferredBrokerage: normalizePreferredBrokerage(body?.preferredBrokerage),
      role: data.role,
      stripeCustomerId: data.stripe_customer_id ?? null,
      subscriptionPlanKey: subscription?.plan_key ?? null,
      subscriptionStatus: subscription?.status ?? null,
      termsAcceptedAt: data.terms_accepted_at ?? null,
    },
    synced: true,
  });
}
