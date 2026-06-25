import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = cleanEmail(body.email);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ exists: false, validEmail: false });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({
      exists: null,
      reason: "Supabase service role is not configured.",
      validEmail: true,
    });
  }

  const { data, error } = await supabase
    .from("users")
    .select("id,email,email_verified_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, exists: null, validEmail: true },
      { status: 503 },
    );
  }

  return NextResponse.json({
    emailVerified: Boolean(data?.email_verified_at),
    exists: Boolean(data),
    validEmail: true,
  });
}
