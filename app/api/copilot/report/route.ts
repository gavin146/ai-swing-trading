import { NextResponse } from "next/server";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { getCopilotFeatureConfig } from "@/lib/copilot/config";
import {
  FmpManualPortfolioQuoteService,
  ManualPortfolioReadProvider,
  SupabaseManualPortfolioTradeRepository,
} from "@/lib/copilot/manual-portfolio-provider";
import {
  checkCopilotPreviewRateLimit,
  isCopilotPreviewEmailAllowed,
  logCopilotServerError,
} from "@/lib/copilot/preview-access";
import { buildCopilotUiViewModel, createDemoCopilotUiViewModel } from "@/lib/copilot/ui-view-model";
import { listLatestOpportunities } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const copilotPreviewTrackedPositionLimit = 50;
const copilotPreviewQuoteConcurrency = 5;
const noStoreHeaders = {
  "Cache-Control": "private, no-store",
};

function copilotJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", noStoreHeaders["Cache-Control"]);

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export async function GET(request: Request) {
  if (!getCopilotFeatureConfig().copilotEnabled) {
    return copilotJson({ error: "Copilot is not available." }, { status: 404 });
  }

  const session = await resolveCustomerSession(request);
  if (session.error) {
    return copilotJson(
      {
        error: session.error,
      },
      { status: session.status },
    );
  }

  if (!isCopilotPreviewEmailAllowed(session.user?.email)) {
    return copilotJson({ error: "Copilot preview is not available." }, { status: 404 });
  }

  const rateLimit = checkCopilotPreviewRateLimit(session.user?.id ?? session.user?.email ?? "unknown");
  if (!rateLimit.allowed) {
    return copilotJson(
      { error: "Copilot preview is temporarily busy. Try again in a minute." },
      { status: 429 },
    );
  }

  if (process.env.COPILOT_FIXTURE_MODE === "true" && process.env.NODE_ENV !== "production") {
    return copilotJson(await createDemoCopilotUiViewModel());
  }

  try {
    const supabase = session.supabase!;
    const user = session.user!;
    const provider = new ManualPortfolioReadProvider({
      quoteService: new FmpManualPortfolioQuoteService({
        concurrency: copilotPreviewQuoteConcurrency,
      }),
      repository: new SupabaseManualPortfolioTradeRepository(supabase as never, {
        limit: copilotPreviewTrackedPositionLimit,
      }),
    });
    const sync = await provider.syncPortfolio(user.id);

    if (!sync.ok) {
      logCopilotServerError("manual_portfolio_sync_failed", sync.error, {
        providerId: sync.providerId,
        retryable: sync.error.retryable,
        userId: user.id,
      });

      return copilotJson(
        {
          error: "Copilot preview is temporarily unavailable.",
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

    return copilotJson(viewModel);
  } catch (error) {
    logCopilotServerError("copilot_report_failed", error);

    return copilotJson(
      {
        error: "Copilot preview is temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}
