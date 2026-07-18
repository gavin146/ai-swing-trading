import { NextResponse } from "next/server";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { getCopilotFeatureConfig } from "@/lib/copilot/config";
import {
  FmpManualPortfolioQuoteService,
  ManualPortfolioReadProvider,
  SupabaseManualPortfolioTradeRepository,
} from "@/lib/copilot/manual-portfolio-provider";
import { buildCopilotUiViewModel, createDemoCopilotUiViewModel } from "@/lib/copilot/ui-view-model";
import { listLatestOpportunities } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sanitizeError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value ?? "Copilot report failed.");
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 220);
}

export async function GET(request: Request) {
  if (!getCopilotFeatureConfig().copilotEnabled) {
    return NextResponse.json({ error: "Copilot is not available." }, { status: 404 });
  }

  if (process.env.COPILOT_FIXTURE_MODE === "true" && process.env.NODE_ENV !== "production") {
    return NextResponse.json(await createDemoCopilotUiViewModel());
  }

  const session = await resolveCustomerSession(request);
  if (session.error) {
    return NextResponse.json(
      {
        error: session.error,
      },
      { status: session.status },
    );
  }

  try {
    const supabase = session.supabase!;
    const user = session.user!;
    const provider = new ManualPortfolioReadProvider({
      quoteService: new FmpManualPortfolioQuoteService(),
      repository: new SupabaseManualPortfolioTradeRepository(supabase as never),
    });
    const sync = await provider.syncPortfolio(user.id);

    if (!sync.ok) {
      return NextResponse.json(
        {
          error: sync.error.message,
        },
        { status: sync.error.retryable ? 503 : 400 },
      );
    }

    const opportunities = await listLatestOpportunities(8).then((result) => result.rows).catch(() => []);
    const viewModel = await buildCopilotUiViewModel({
      mode: "manual",
      opportunities,
      snapshot: sync.snapshot,
      warnings: sync.warnings,
    });

    return NextResponse.json(viewModel);
  } catch (error) {
    return NextResponse.json(
      {
        error: sanitizeError(error),
      },
      { status: 503 },
    );
  }
}
