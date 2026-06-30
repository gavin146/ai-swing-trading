import { NextResponse } from "next/server";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { buildPortfolioExitPlan } from "@/lib/portfolio/exit-plan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExitPlanBody = {
  entryPrice?: number | string;
  symbol?: string;
};

function cleanSymbol(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function parsePositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request) {
  const session = await resolveCustomerSession(request);
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const body = (await request.json().catch(() => null)) as ExitPlanBody | null;
  const symbol = cleanSymbol(body?.symbol);
  const entryPrice = parsePositiveNumber(body?.entryPrice);

  if (!symbol) {
    return NextResponse.json({ error: "Choose the ticker before building a sell plan." }, { status: 400 });
  }

  if (!entryPrice) {
    return NextResponse.json({ error: "Add your entry price before building a sell plan." }, { status: 400 });
  }

  try {
    const plan = await buildPortfolioExitPlan({ entryPrice, symbol });
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "SwingFi could not build a sell plan for this trade.",
      },
      { status: 503 },
    );
  }
}
