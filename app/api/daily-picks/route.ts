import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await resolveCustomerSession(request);
  if (session.error) {
    return NextResponse.json({ error: session.error, picks: [] }, { status: session.status });
  }

  const limit = Math.max(1, Math.min(90, Number(request.nextUrl.searchParams.get("limit") ?? 30)));
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role is not configured.", picks: [] },
      { status: 503 },
    );
  }

  const user = session.user!;

  const { data, error } = await supabase
    .from("daily_picks")
    .select(
      "id,pick_date,rank,created_at,opportunities(id,symbol,asset_type,score,confidence,risk_score,entry_low,entry_high,target_price,stop_loss,expected_gain,expected_loss,holding_period_days,explanation,created_at),agent_runs(id,market_regime,summary,created_at,completed_at)",
    )
    .eq("user_id", user.id)
    .order("pick_date", { ascending: false })
    .order("rank", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message, picks: [] }, { status: 503 });
  }

  return NextResponse.json({
    customer: { email: user.email, id: user.id },
    picks: data ?? [],
    source: "supabase",
  });
}
