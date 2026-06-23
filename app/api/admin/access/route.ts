import { NextRequest, NextResponse } from "next/server";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ownerAdminEmail = "gavin@onefear.co";

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

async function buildAccessRecords() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      error: "Supabase service role is not configured.",
      records: [],
      status: 503,
    };
  }

  const [{ data: grants, error: grantError }, { data: users, error: userError }] =
    await Promise.all([
      supabase
        .from("admin_access_grants")
        .select("email,created_at,granted_by_user_id,revoked_at")
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("users").select("id,email"),
    ]);

  if (grantError || userError) {
    return {
      error: grantError?.message ?? userError?.message ?? "Admin access could not be loaded.",
      records: [],
      status: 503,
    };
  }

  const userById = new Map((users ?? []).map((user) => [user.id, user.email]));
  const userEmails = new Set((users ?? []).map((user) => normalizeEmail(user.email)));
  const records = [
    {
      email: ownerAdminEmail,
      source: "owner",
      createdAt: "2026-06-22T00:00:00.000Z",
      createdBy: null,
      hasAccount: userEmails.has(ownerAdminEmail),
    },
    ...(grants ?? [])
      .filter((grant) => normalizeEmail(grant.email) !== ownerAdminEmail)
      .map((grant) => ({
        email: normalizeEmail(grant.email),
        source: "invited",
        createdAt: grant.created_at,
        createdBy: grant.granted_by_user_id
          ? (userById.get(grant.granted_by_user_id) ?? null)
          : null,
        hasAccount: userEmails.has(normalizeEmail(grant.email)),
      })),
  ];

  return { records, status: 200 };
}

export async function GET(request: NextRequest) {
  if (!isAdminApiRequest(request)) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const result = await buildAccessRecords();
  if ("error" in result) {
    return NextResponse.json({ error: result.error, records: result.records }, { status: result.status });
  }

  return NextResponse.json({ records: result.records });
}

export async function POST(request: NextRequest) {
  if (!isAdminApiRequest(request)) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role is not configured." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    createdByEmail?: string;
    email?: string;
  };
  const email = normalizeEmail(body.email);
  const createdByEmail = normalizeEmail(body.createdByEmail);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid admin email is required." }, { status: 400 });
  }

  if (email === ownerAdminEmail) {
    const result = await buildAccessRecords();
    return NextResponse.json({ records: "records" in result ? result.records : [] });
  }

  const { data: grantedBy } = createdByEmail
    ? await supabase.from("users").select("id").eq("email", createdByEmail).maybeSingle()
    : { data: null };

  const { error } = await supabase.from("admin_access_grants").upsert(
    {
      email,
      granted_by_user_id: grantedBy?.id ?? null,
      revoked_at: null,
    },
    { onConflict: "email" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  await supabase.from("users").update({ role: "admin" }).eq("email", email);

  const result = await buildAccessRecords();
  if ("error" in result) {
    return NextResponse.json({ error: result.error, records: result.records }, { status: result.status });
  }

  return NextResponse.json({ records: result.records });
}

export async function DELETE(request: NextRequest) {
  if (!isAdminApiRequest(request)) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role is not configured." },
      { status: 503 },
    );
  }

  const email = normalizeEmail(request.nextUrl.searchParams.get("email"));

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid admin email is required." }, { status: 400 });
  }

  if (email === ownerAdminEmail) {
    return NextResponse.json({ error: "The owner admin cannot be removed." }, { status: 400 });
  }

  const { error } = await supabase
    .from("admin_access_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("email", email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  await supabase.from("users").update({ role: "customer" }).eq("email", email);

  const result = await buildAccessRecords();
  if ("error" in result) {
    return NextResponse.json({ error: result.error, records: result.records }, { status: result.status });
  }

  return NextResponse.json({ records: result.records });
}
