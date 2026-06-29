import { NextResponse } from "next/server";
import type { TradeStatus } from "@/lib/database.types";
import { resolveCustomerSession } from "@/lib/auth/customer-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TradeUpdateBody = {
  exitPrice?: number | string | null;
  notes?: string;
  status?: TradeStatus;
};

type PortfolioTradeRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function parsePositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeStatus(value: unknown): TradeStatus | null {
  return value === "planned" || value === "open" || value === "closed" || value === "cancelled"
    ? value
    : null;
}

export async function PATCH(request: Request, { params }: PortfolioTradeRouteProps) {
  const session = await resolveCustomerSession(request);
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  const supabase = session.supabase!;
  const user = session.user!;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as TradeUpdateBody | null;
  const status = normalizeStatus(body?.status);
  const exitPrice = parsePositiveNumber(body?.exitPrice);
  const update: Record<string, unknown> = {};

  if (status) {
    update.status = status;
    if (status === "closed") {
      update.closed_at = new Date().toISOString();
    }
  }

  if (body?.exitPrice !== undefined) {
    update.exit_price = exitPrice;
  }

  if (body?.notes !== undefined) {
    update.notes = cleanText(body.notes) || null;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "No trade updates were provided." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("trade_history")
    .select("entry_price,quantity")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 503 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Trade not found." }, { status: 404 });
  }

  if (status === "closed" && exitPrice) {
    const entryPrice = Number(existing.entry_price);
    const quantity = Number(existing.quantity);
    const realized = (exitPrice - entryPrice) * quantity;
    update.realized_gain = realized > 0 ? realized : null;
    update.realized_loss = realized < 0 ? Math.abs(realized) : null;
  }

  const { data, error } = await supabase
    .from("trade_history")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not update this trade." },
      { status: 503 },
    );
  }

  return NextResponse.json({ trade: data });
}
