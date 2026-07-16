import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ownerAdminEmail = "gavin@onefear.co";

function isLocalHost(host: string) {
  const hostname = host.split(":")[0]?.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export async function POST(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (process.env.NODE_ENV === "production" || !isLocalHost(host)) {
    return NextResponse.json({ error: "Codex auto-login is only available on localhost." }, { status: 404 });
  }

  if (process.env.SWINGFI_ENABLE_CODEX_AUTO_LOGIN !== "true") {
    return NextResponse.json({ error: "Codex auto-login is not enabled." }, { status: 403 });
  }

  const email = (process.env.SWINGFI_CODEX_AUTO_LOGIN_EMAIL ?? ownerAdminEmail).trim().toLowerCase();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin config is missing." }, { status: 503 });
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    email,
    type: "magiclink",
  });
  const tokenHash = data?.properties?.hashed_token;

  if (error || !tokenHash) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create a local Codex login session." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    email,
    tokenHash,
    type: "magiclink",
  });
}
