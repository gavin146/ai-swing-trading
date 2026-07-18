import type { TradeHistoryRow, TradeStatus } from "../database.types";
import { getFmpCompanyProfile } from "../providers/fmp";
import { assertServerOnlyModule } from "./server-only";
import { systemTimeProvider } from "./time";
import type {
  BrokerageCapabilities,
  BrokerageConnectionSummary,
  BrokerageReadProvider,
  PortfolioPosition,
  PortfolioPositionPlan,
  PortfolioPositionQuote,
  PortfolioSnapshot,
  PortfolioSyncResult,
  TimeProvider,
} from "./types";
import {
  assertNoTradingCapability,
  assertUserId,
  buildPortfolioCompleteness,
  normalizeBrokerageCapabilities,
  validatePortfolioSnapshot,
} from "./validation";

assertServerOnlyModule("lib/copilot/manual-portfolio-provider");

export type ManualTrackedTrade = Omit<
  TradeHistoryRow,
  "entry_price" | "quantity" | "stop_loss" | "target_price"
> & {
  entry_price: number | null;
  quantity: number | null;
  stop_loss: number | null;
  target_price: number | null;
};

export type ManualPortfolioTradeRepository = {
  listActiveTrackedTrades(userId: string): Promise<ManualTrackedTrade[]>;
};

export type ManualQuoteResult = {
  dataAsOf: string | null;
  fetchedAt: string;
  message?: string;
  price: number | null;
  source: string;
  status: "fresh" | "stale" | "missing" | "error";
};

export type ManualPortfolioQuoteService = {
  getQuotes(symbols: string[], fetchedAt: string): Promise<Map<string, ManualQuoteResult>>;
};

export type ManualPortfolioReadProviderOptions = {
  enabled?: boolean;
  quoteService: ManualPortfolioQuoteService;
  repository: ManualPortfolioTradeRepository;
  staleQuoteMaxAgeMs?: number;
  timeProvider?: TimeProvider;
};

type SupabaseLikeClient = {
  from(table: "trade_history"): {
    select(columns: string): {
      eq(column: string, value: string): {
        in(column: string, values: string[]): {
          order(column: string, options: { ascending: boolean }): {
            limit(count: number): Promise<{
              data: TradeHistoryRow[] | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    };
  };
};

const manualCapabilities: BrokerageCapabilities = normalizeBrokerageCapabilities({
  canDisconnect: false,
  canReadAccounts: false,
  canReadBalances: false,
  canReadHoldings: true,
  canReadTransactions: false,
  canRefresh: true,
});

const activeStatuses = new Set<TradeStatus>(["open", "planned"]);

function normalizeSymbol(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isoOrNull(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function latestIso(values: Array<string | null | undefined>, fallback: string) {
  const latest = values
    .map((value) => isoOrNull(value))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return latest ?? fallback;
}

export function getTrackedPlanHoldingDays(notes: unknown) {
  const text = String(notes ?? "").trim();
  const match =
    text.match(/planned hold:\s*(\d+)\s*days/i) ??
    text.match(/estimated a\s*(\d+)-day holding window/i);
  const parsed = Number(match?.[1]);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getOriginalPlanSource(trade: ManualTrackedTrade): PortfolioPositionPlan["planSource"] {
  const notes = String(trade.notes ?? "");

  if (/source:\s*latest swingfi daily analysis/i.test(notes)) {
    return "swingfi_daily_analysis";
  }

  if (/source:\s*market-structure estimate/i.test(notes)) {
    return "market_structure_estimate";
  }

  return trade.opportunity_id ? "swingfi_tracker" : "manual_trade_history";
}

function isQuoteUsable(quote: ManualQuoteResult | undefined) {
  return quote?.status === "fresh" && positiveNumber(quote.price) !== null;
}

function quoteMetadata(quote: ManualQuoteResult | undefined): PortfolioPositionQuote {
  if (!quote) {
    return {
      dataAsOf: null,
      fetchedAt: null,
      message: "No quote was returned for this tracked trade.",
      source: "unavailable",
      status: "missing",
    };
  }

  return {
    dataAsOf: quote.dataAsOf,
    fetchedAt: quote.fetchedAt,
    message: quote.message,
    source: quote.source,
    status: quote.status,
  };
}

function buildPlan(trade: ManualTrackedTrade): PortfolioPositionPlan {
  return {
    entryPrice: positiveNumber(trade.entry_price),
    holdingPeriodDays: getTrackedPlanHoldingDays(trade.notes),
    notes: trade.notes,
    opportunityId: trade.opportunity_id,
    planCreatedAt: isoOrNull(trade.created_at),
    planSource: getOriginalPlanSource(trade),
    stopLoss: positiveNumber(trade.stop_loss),
    targetPrice: positiveNumber(trade.target_price),
  };
}

function normalizeTradePosition(args: {
  fetchedAt: string;
  quote: ManualQuoteResult | undefined;
  trade: ManualTrackedTrade;
  userId: string;
}): PortfolioPosition | null {
  const symbol = normalizeSymbol(args.trade.symbol);

  if (!symbol || args.trade.user_id !== args.userId || !activeStatuses.has(args.trade.status)) {
    return null;
  }

  const quantity = positiveNumber(args.trade.quantity);
  const averageEntryPrice = positiveNumber(args.trade.entry_price);
  const quoteIsUsable = isQuoteUsable(args.quote);
  const currentPrice = quoteIsUsable ? positiveNumber(args.quote?.price) : null;
  const marketValue =
    quantity !== null && currentPrice !== null ? Number((quantity * currentPrice).toFixed(2)) : null;
  const costBasis =
    quantity !== null && averageEntryPrice !== null
      ? Number((quantity * averageEntryPrice).toFixed(2))
      : null;
  const unrealizedGainLoss =
    marketValue !== null && costBasis !== null ? Number((marketValue - costBasis).toFixed(2)) : null;
  const dataAsOf = quoteIsUsable
    ? args.quote?.dataAsOf ?? args.fetchedAt
    : latestIso([args.trade.opened_at, args.trade.created_at], args.fetchedAt);

  return {
    assetType: args.trade.asset_type ?? "unknown",
    averageEntryPrice,
    costBasis,
    currency: "USD",
    currentPrice,
    dataAsOf,
    fetchedAt: args.fetchedAt,
    id: `manual:${args.trade.id}`,
    marketValue,
    openedAt: isoOrNull(args.trade.opened_at) ?? undefined,
    originalPlan: buildPlan(args.trade),
    providerId: "manual_trade_history",
    quantity,
    quote: quoteMetadata(args.quote),
    sourceTradeHistoryId: args.trade.id,
    symbol,
    unrealizedGainLoss,
  };
}

function getManualCompletenessAdditions(positions: PortfolioPosition[]) {
  const missingFields = new Set<string>();

  positions.forEach((position) => {
    if (position.costBasis === null) missingFields.add("costBasis");
    if (position.originalPlan?.entryPrice === null) missingFields.add("originalPlan.entryPrice");
    if (position.originalPlan?.targetPrice === null) missingFields.add("originalPlan.targetPrice");
    if (position.originalPlan?.stopLoss === null) missingFields.add("originalPlan.stopLoss");
    if (position.originalPlan?.holdingPeriodDays === null) {
      missingFields.add("originalPlan.holdingPeriodDays");
    }
    if (position.quote?.status !== "fresh") missingFields.add("freshQuote");
  });

  const missing = Array.from(missingFields).sort();

  return {
    missingFields: missing,
    warnings: missing.length
      ? [`Manual SwingFi tracker snapshot is missing: ${missing.join(", ")}.`]
      : [],
  };
}

export class SupabaseManualPortfolioTradeRepository implements ManualPortfolioTradeRepository {
  private readonly supabase: SupabaseLikeClient;
  private readonly limit: number;

  constructor(supabase: SupabaseLikeClient, options: { limit?: number } = {}) {
    this.supabase = supabase;
    this.limit = options.limit ?? 200;
  }

  async listActiveTrackedTrades(userId: string) {
    const cleanUserId = assertUserId(userId);
    const { data, error } = await this.supabase
      .from("trade_history")
      .select("*")
      .eq("user_id", cleanUserId)
      .in("status", ["open", "planned"])
      .order("created_at", { ascending: false })
      .limit(this.limit);

    if (error) {
      throw new Error(error.message ?? "Could not load tracked trades.");
    }

    return (data ?? []) as ManualTrackedTrade[];
  }
}

export class FmpManualPortfolioQuoteService implements ManualPortfolioQuoteService {
  async getQuotes(symbols: string[], fetchedAt: string) {
    const uniqueSymbols = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)));
    const entries: Array<readonly [string, ManualQuoteResult]> = await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        try {
          const profile = await getFmpCompanyProfile(symbol);
          const price = positiveNumber(profile?.price);

          return [
            symbol,
            {
              dataAsOf: fetchedAt,
              fetchedAt,
              message: price
                ? "Latest FMP profile price was available during the manual portfolio sync."
                : "FMP profile did not include a reliable current price.",
              price,
              source: "fmp_profile",
              status: price ? "fresh" : "missing",
            } satisfies ManualQuoteResult,
          ] as const;
        } catch (error) {
          return [
            symbol,
            {
              dataAsOf: null,
              fetchedAt,
              message: error instanceof Error ? error.message : "Quote lookup failed.",
              price: null,
              source: "fmp_profile",
              status: "error",
            } satisfies ManualQuoteResult,
          ] as const;
        }
      }),
    );

    return new Map(entries);
  }
}

export class ManualPortfolioReadProvider implements BrokerageReadProvider {
  readonly id = "manual_trade_history" as const;
  readonly displayName = "SwingFi tracker";
  readonly capabilities = manualCapabilities;
  private readonly enabled: boolean;
  private readonly quoteService: ManualPortfolioQuoteService;
  private readonly repository: ManualPortfolioTradeRepository;
  private readonly staleQuoteMaxAgeMs: number;
  private readonly timeProvider: TimeProvider;

  constructor(options: ManualPortfolioReadProviderOptions) {
    assertNoTradingCapability(manualCapabilities);
    this.enabled = options.enabled ?? true;
    this.quoteService = options.quoteService;
    this.repository = options.repository;
    this.staleQuoteMaxAgeMs = options.staleQuoteMaxAgeMs ?? 20 * 60 * 1000;
    this.timeProvider = options.timeProvider ?? systemTimeProvider;
  }

  isEnabled() {
    return this.enabled;
  }

  async getConnectionInstructions(userId: string) {
    assertUserId(userId);

    return {
      message:
        "SwingFi tracker uses positions users manually added inside SwingFi. No brokerage connection is required.",
      providerId: this.id,
      status: this.isEnabled() ? "instructions" as const : "disabled" as const,
    };
  }

  async getConnectionHealth(userId: string) {
    assertUserId(userId);

    return {
      checkedAt: this.timeProvider.nowIso(),
      message: this.isEnabled()
        ? "Manual SwingFi tracker provider is ready."
        : "Manual SwingFi tracker provider is disabled.",
      providerId: this.id,
      retryable: false,
      status: this.isEnabled() ? "connected" as const : "disabled" as const,
    };
  }

  async syncPortfolio(userId: string): Promise<PortfolioSyncResult> {
    const cleanUserId = assertUserId(userId);

    if (!this.isEnabled()) {
      return {
        error: {
          code: "disabled_provider",
          message: "Manual SwingFi tracker provider is disabled.",
          providerId: this.id,
          retryable: false,
        },
        ok: false,
        providerId: this.id,
      };
    }

    const fetchedAt = this.timeProvider.nowIso();
    let trades: ManualTrackedTrade[];

    try {
      trades = await this.repository.listActiveTrackedTrades(cleanUserId);
    } catch (error) {
      return {
        error: {
          code: "sync_failed",
          message: error instanceof Error ? error.message : "Manual portfolio sync failed.",
          providerId: this.id,
          retryable: true,
        },
        ok: false,
        providerId: this.id,
      };
    }

    const scopedTrades = trades.filter((trade) => trade.user_id === cleanUserId);
    const warnings: string[] = [];

    if (scopedTrades.length !== trades.length) {
      warnings.push("Repository returned rows outside the requested user scope; those rows were ignored.");
    }

    const activeTrades = scopedTrades.filter((trade) => activeStatuses.has(trade.status));
    const symbols = Array.from(
      new Set(activeTrades.map((trade) => normalizeSymbol(trade.symbol)).filter(Boolean)),
    );
    let quotes = new Map<string, ManualQuoteResult>();

    try {
      quotes = await this.quoteService.getQuotes(symbols, fetchedAt);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Quote service failed: ${error.message}`
          : "Quote service failed for the manual portfolio snapshot.",
      );
    }

    const nowMs = this.timeProvider.now().getTime();
    const normalizedQuotes = new Map(
      Array.from(quotes.entries()).map(([symbol, quote]) => {
        const dataAsOfMs = quote.dataAsOf ? new Date(quote.dataAsOf).getTime() : Number.NaN;
        const isStale =
          quote.status === "fresh" &&
          Number.isFinite(dataAsOfMs) &&
          nowMs - dataAsOfMs > this.staleQuoteMaxAgeMs;

        return [
          symbol,
          isStale
            ? {
                ...quote,
                message: "Quote was available but too old to use for valuation.",
                status: "stale" as const,
              }
            : quote,
        ] as const;
      }),
    );

    const positions = activeTrades
      .map((trade) =>
        normalizeTradePosition({
          fetchedAt,
          quote: normalizedQuotes.get(normalizeSymbol(trade.symbol)),
          trade,
          userId: cleanUserId,
        }),
      )
      .filter((position): position is PortfolioPosition => Boolean(position));
    const completeness = buildPortfolioCompleteness(positions);
    const manualCompleteness = getManualCompletenessAdditions(positions);
    const quoteWarnings = positions
      .filter((position) => position.quote?.status !== "fresh")
      .map((position) => `${position.symbol}: ${position.quote?.message ?? "Quote unavailable."}`);
    const snapshot: PortfolioSnapshot = validatePortfolioSnapshot({
      accounts: [],
      completeness: {
        ...completeness,
        missingFields: Array.from(
          new Set([...completeness.missingFields, ...manualCompleteness.missingFields]),
        ).sort(),
        warnings: [
          ...warnings,
          ...completeness.warnings,
          ...manualCompleteness.warnings,
          ...quoteWarnings,
        ],
      },
      dataAsOf: latestIso(positions.map((position) => position.dataAsOf), fetchedAt),
      fetchedAt,
      id: `${cleanUserId}:manual:${fetchedAt}`,
      positions,
      providerId: this.id,
      source: "swingfi_tracker",
      userId: cleanUserId,
    });

    return {
      ok: true,
      providerId: this.id,
      snapshot,
      warnings: snapshot.completeness.warnings,
    };
  }

  async disconnect(userId: string): Promise<BrokerageConnectionSummary> {
    assertUserId(userId);

    return {
      capabilities: {
        ...this.capabilities,
        canPlaceOrders: false,
      },
      displayName: this.displayName,
      providerId: this.id,
      status: "disconnected",
      statusMessage:
        "Manual tracker data stays in SwingFi trade history. There is no external brokerage connection to disconnect.",
    };
  }
}
