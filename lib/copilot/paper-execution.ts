import { createHash } from "node:crypto";
import type { CopilotFeatureConfig } from "./config";
import type { TimeProvider } from "./types";
import { systemTimeProvider } from "./time";

export type PaperAssetType = "stock" | "etf" | "crypto" | "option" | "unknown";
export type PaperOrderSide = "buy" | "sell";
export type PaperOrderType = "market" | "limit";
export type PaperOrderStatus = "accepted" | "filled" | "cancelled" | "rejected";
export type PaperExecutionMode = "paper" | "live";
export type PaperMarketRegime = "risk_on" | "balanced" | "defensive" | "unknown";

export type PaperPriceEvidence = {
  dataAsOf: string | null;
  fetchedAt: string | null;
  maxAgeSeconds: number;
  price: number | null;
  source: string;
  symbol: string;
};

export type PaperSignalReference = {
  id: string;
  type: "opportunity" | "copilot_signal" | "manual_test";
};

export type PaperStrategyReference = {
  id: string;
  version: string;
};

export type PaperTradePlan = {
  entryHigh?: number | null;
  entryLow?: number | null;
  expiresAt: string;
  holdingPeriodDays: number;
  stopLoss: number;
  targetPrice: number;
};

export type OrderIntent = {
  assetType: PaperAssetType;
  createdAt: string;
  explanationEvidence: string[];
  id: string;
  idempotencyKey: string;
  isClosing?: boolean;
  limitPrice?: number | null;
  mode: PaperExecutionMode;
  orderType: PaperOrderType;
  quantity: number;
  sector?: string | null;
  side: PaperOrderSide;
  signalRef: PaperSignalReference;
  sourceQuote: PaperPriceEvidence;
  strategy: PaperStrategyReference;
  symbol: string;
  tradePlan: PaperTradePlan;
  unsupportedFeatures?: {
    cryptoExecution?: boolean;
    fractionalShares?: boolean;
    leverage?: boolean;
    margin?: boolean;
    options?: boolean;
    shortSale?: boolean;
    transfer?: boolean;
  };
  upcomingEarningsAt?: string | null;
  allowLlmOverride?: boolean;
};

export type CreateOrderIntentInput = Omit<OrderIntent, "id" | "idempotencyKey" | "symbol"> & {
  idempotencyKey?: string;
  symbol: string;
};

export type PaperFill = {
  createdAt: string;
  id: string;
  orderId: string;
  price: number;
  quantity: number;
  side: PaperOrderSide;
  symbol: string;
};

export type PaperOrder = {
  acceptedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  fillIds: string[];
  id: string;
  idempotencyKey: string;
  intent: OrderIntent;
  rejectionReason?: string;
  status: PaperOrderStatus;
};

export type PaperPosition = {
  assetType: PaperAssetType;
  averageEntryPrice: number;
  marketValue: number;
  openedAt: string;
  quantity: number;
  sector?: string | null;
  symbol: string;
  updatedAt: string;
};

export type PaperLedgerEvent = {
  at: string;
  id: string;
  message: string;
  orderId?: string;
  type:
    | "order_accepted"
    | "order_filled"
    | "order_rejected"
    | "order_cancelled"
    | "cancel_rejected";
};

export type PaperAccountState = {
  accountId: string;
  cash: number;
  currency: "USD";
  fills: PaperFill[];
  ledger: PaperLedgerEvent[];
  orders: PaperOrder[];
  positions: PaperPosition[];
};

export type RiskPolicyConfig = {
  allowDefensiveNewEntries: boolean;
  earningsBlackoutDays: number;
  entryPriceTolerancePct: number;
  maxOpenPositions: number;
  maxOrderNotional: number;
  maxPortfolioExposurePct: number;
  maxPositionNotional: number;
  maxSectorExposurePct: number;
  paperTradingEnabled: boolean;
  quoteMaxAgeSeconds: number;
  supportedAssetTypes: PaperAssetType[];
};

export type RiskPolicyInput = {
  account: PaperAccountState;
  config?: Partial<RiskPolicyConfig>;
  existingIdempotencyKeys?: Iterable<string>;
  featureConfig?: Pick<CopilotFeatureConfig, "paperTradingEnabled">;
  intent: OrderIntent;
  marketRegime?: PaperMarketRegime;
  now: Date;
};

export type RiskPolicyDecision =
  | {
      approvedIntent: OrderIntent;
      llmOverrideAllowed: false;
      ok: true;
      ruleVersion: string;
      warnings: string[];
    }
  | {
      llmOverrideAllowed: false;
      message: string;
      ok: false;
      reasonCode: RiskPolicyRejectCode;
      ruleVersion: string;
      violations: string[];
    };

export type RiskPolicyRejectCode =
  | "paper_trading_disabled"
  | "live_mode_rejected"
  | "price_unavailable"
  | "price_stale"
  | "duplicate_order"
  | "unsupported_asset"
  | "unsupported_behavior"
  | "position_limit"
  | "portfolio_exposure_limit"
  | "sector_concentration_limit"
  | "too_many_open_positions"
  | "invalid_quantity"
  | "invalid_trade_plan"
  | "entry_outside_plan"
  | "defensive_regime"
  | "earnings_blackout"
  | "insufficient_position";

export type PaperExecutionResult =
  | {
      account: PaperAccountState;
      decision: RiskPolicyDecision & { ok: true };
      fills: PaperFill[];
      ok: true;
      order: PaperOrder;
    }
  | {
      account: PaperAccountState;
      decision: RiskPolicyDecision & { ok: false };
      ok: false;
      order?: PaperOrder;
    };

export type PaperCancellationResult =
  | {
      account: PaperAccountState;
      ok: true;
      order: PaperOrder;
    }
  | {
      account: PaperAccountState;
      message: string;
      ok: false;
    };

export type PaperExecutionProvider = {
  cancelOrder(orderId: string): Promise<PaperCancellationResult>;
  getAccountState(): Promise<PaperAccountState>;
  submitOrder(intent: OrderIntent): Promise<PaperExecutionResult>;
};

export const paperRiskPolicyRuleVersion = "paper-risk-policy.v1";

export function createDefaultRiskPolicyConfig(
  overrides: Partial<RiskPolicyConfig> = {},
): RiskPolicyConfig {
  const config: RiskPolicyConfig = {
    allowDefensiveNewEntries: false,
    earningsBlackoutDays: 3,
    entryPriceTolerancePct: 1,
    maxOpenPositions: 10,
    maxOrderNotional: 2_500,
    maxPortfolioExposurePct: 90,
    maxPositionNotional: 5_000,
    maxSectorExposurePct: 35,
    paperTradingEnabled: false,
    quoteMaxAgeSeconds: 900,
    supportedAssetTypes: ["stock", "etf"],
    ...overrides,
  };

  validateRiskPolicyConfig(config);

  return config;
}

export function createPaperAccountState(
  overrides: Partial<PaperAccountState> = {},
): PaperAccountState {
  return cloneAccountState({
    accountId: "paper-account",
    cash: 25_000,
    currency: "USD",
    fills: [],
    ledger: [],
    orders: [],
    positions: [],
    ...overrides,
  });
}

export function createOrderIntent(input: CreateOrderIntentInput): OrderIntent {
  const symbol = normalizeSymbol(input.symbol);
  const hashInput = stableStringify({
    assetType: input.assetType,
    createdAt: input.createdAt,
    limitPrice: input.limitPrice ?? null,
    mode: input.mode,
    orderType: input.orderType,
    quantity: input.quantity,
    side: input.side,
    signalRef: input.signalRef,
    sourceQuote: input.sourceQuote,
    strategy: input.strategy,
    symbol,
    tradePlan: input.tradePlan,
  });
  const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 24);

  return {
    ...input,
    id: `paper_intent_${hash}`,
    idempotencyKey: input.idempotencyKey ?? `paper_order_${hash}`,
    sourceQuote: {
      ...input.sourceQuote,
      symbol,
    },
    symbol,
  };
}

export class RiskPolicyEngine {
  evaluate(input: RiskPolicyInput): RiskPolicyDecision {
    const config = createDefaultRiskPolicyConfig({
      ...input.config,
      paperTradingEnabled:
        input.featureConfig?.paperTradingEnabled ?? input.config?.paperTradingEnabled ?? false,
    });
    const intent = normalizeIntent(input.intent);
    const referencePrice = orderReferencePrice(intent);
    const violations: Array<{ code: RiskPolicyRejectCode; message: string }> = [];

    if (!config.paperTradingEnabled) {
      violations.push({
        code: "paper_trading_disabled",
        message: "Paper trading is disabled by configuration.",
      });
    }

    if (intent.mode !== "paper") {
      violations.push({
        code: "live_mode_rejected",
        message: "Live execution is not supported by SwingFi paper execution.",
      });
    }

    if (referencePrice === null) {
      violations.push({
        code: "price_unavailable",
        message: "A fresh positive source quote is required before a paper order can be reviewed.",
      });
    } else if (isQuoteStale(intent.sourceQuote, input.now, config.quoteMaxAgeSeconds)) {
      violations.push({
        code: "price_stale",
        message: "The source quote is stale for the configured risk policy.",
      });
    }

    if (hasDuplicateIdempotencyKey(input)) {
      violations.push({
        code: "duplicate_order",
        message: "This idempotency key has already been used.",
      });
    }

    if (!config.supportedAssetTypes.includes(intent.assetType)) {
      violations.push({
        code: "unsupported_asset",
        message: "Only whole-share U.S. stock and ETF paper simulation is supported.",
      });
    }

    if (hasUnsupportedBehavior(intent)) {
      violations.push({
        code: "unsupported_behavior",
        message: "Options, leverage, margin, short sales, crypto execution, transfers, and fractional behavior are not supported.",
      });
    }

    if (!Number.isInteger(intent.quantity) || intent.quantity <= 0) {
      violations.push({
        code: "invalid_quantity",
        message: "Paper orders must use a positive whole-share quantity.",
      });
    }

    const existingPosition = findPosition(input.account, intent.symbol);

    if (intent.side === "sell") {
      if (!existingPosition || intent.quantity > existingPosition.quantity) {
        violations.push({
          code: "insufficient_position",
          message: "Sell intents may only close an existing paper position.",
        });
      }
    } else if (!isValidEntryPlan(intent, referencePrice)) {
      violations.push({
        code: "invalid_trade_plan",
        message: "A buy intent requires a target above entry and a stop below entry.",
      });
    }

    if (
      intent.side === "buy" &&
      referencePrice !== null &&
      isOutsideEntryPlan(intent, referencePrice, config.entryPriceTolerancePct)
    ) {
      violations.push({
        code: "entry_outside_plan",
        message: "The reference price is outside the configured SwingFi entry range tolerance.",
      });
    }

    if (intent.side === "buy" && referencePrice !== null && Number.isInteger(intent.quantity)) {
      const notional = referencePrice * intent.quantity;
      const equity = accountEquity(input.account);
      const positionValue = (existingPosition?.marketValue ?? 0) + notional;

      if (notional > config.maxOrderNotional) {
        violations.push({
          code: "position_limit",
          message: "The order is above the configured maximum single-order paper limit.",
        });
      }

      if (positionValue > config.maxPositionNotional) {
        violations.push({
          code: "position_limit",
          message: "The resulting paper position would exceed the configured position limit.",
        });
      }

      if (equity > 0 && (totalMarketValue(input.account) + notional) / equity > config.maxPortfolioExposurePct / 100) {
        violations.push({
          code: "portfolio_exposure_limit",
          message: "The order would exceed the configured portfolio exposure limit.",
        });
      }

      if (
        intent.sector &&
        equity > 0 &&
        (sectorMarketValue(input.account, intent.sector) + notional) / equity >
          config.maxSectorExposurePct / 100
      ) {
        violations.push({
          code: "sector_concentration_limit",
          message: "The order would exceed the configured sector concentration limit.",
        });
      }

      if (!existingPosition && input.account.positions.length >= config.maxOpenPositions) {
        violations.push({
          code: "too_many_open_positions",
          message: "The paper account already has the configured maximum number of open positions.",
        });
      }
    }

    if (
      intent.side === "buy" &&
      input.marketRegime === "defensive" &&
      !config.allowDefensiveNewEntries
    ) {
      violations.push({
        code: "defensive_regime",
        message: "New paper entries are blocked during a defensive market regime by policy.",
      });
    }

    if (
      intent.side === "buy" &&
      isInsideEarningsBlackout(intent.upcomingEarningsAt, input.now, config.earningsBlackoutDays)
    ) {
      violations.push({
        code: "earnings_blackout",
        message: "The planned entry is too close to a known earnings or binary event date.",
      });
    }

    if (violations.length) {
      const primary = violations[0];

      return {
        llmOverrideAllowed: false,
        message: primary.message,
        ok: false,
        reasonCode: primary.code,
        ruleVersion: paperRiskPolicyRuleVersion,
        violations: Array.from(new Set(violations.map((violation) => violation.message))),
      };
    }

    return {
      approvedIntent: intent,
      llmOverrideAllowed: false,
      ok: true,
      ruleVersion: paperRiskPolicyRuleVersion,
      warnings: [
        "Paper simulation only. Simulated fills do not represent real market execution.",
      ],
    };
  }
}

export class InMemoryPaperExecutionProvider implements PaperExecutionProvider {
  private readonly clock: TimeProvider;
  private readonly config: RiskPolicyConfig;
  private readonly marketRegime: PaperMarketRegime;
  private readonly riskEngine: RiskPolicyEngine;
  private state: PaperAccountState;

  constructor(args: {
    account?: Partial<PaperAccountState>;
    clock?: TimeProvider;
    config?: Partial<RiskPolicyConfig>;
    marketRegime?: PaperMarketRegime;
    riskEngine?: RiskPolicyEngine;
  }) {
    this.clock = args.clock ?? systemTimeProvider;
    this.config = createDefaultRiskPolicyConfig(args.config);
    this.marketRegime = args.marketRegime ?? "balanced";
    this.riskEngine = args.riskEngine ?? new RiskPolicyEngine();
    this.state = createPaperAccountState(args.account);
  }

  async getAccountState(): Promise<PaperAccountState> {
    return cloneAccountState(this.state);
  }

  async submitOrder(intent: OrderIntent): Promise<PaperExecutionResult> {
    const decision = this.riskEngine.evaluate({
      account: this.state,
      config: this.config,
      intent,
      marketRegime: this.marketRegime,
      now: this.clock.now(),
    });

    if (!decision.ok) {
      const order = this.recordRejectedOrder(intent, decision.message);

      return {
        account: cloneAccountState(this.state),
        decision,
        ok: false,
        order,
      };
    }

    const order = this.recordAcceptedOrder(decision.approvedIntent);
    const fillPrice = orderReferencePrice(decision.approvedIntent);

    if (fillPrice !== null && shouldFill(decision.approvedIntent)) {
      const fill = this.recordFill(order, fillPrice);

      return {
        account: cloneAccountState(this.state),
        decision,
        fills: [fill],
        ok: true,
        order: cloneOrder(this.state.orders.find((item) => item.id === order.id) ?? order),
      };
    }

    return {
      account: cloneAccountState(this.state),
      decision,
      fills: [],
      ok: true,
      order: cloneOrder(order),
    };
  }

  async cancelOrder(orderId: string): Promise<PaperCancellationResult> {
    const order = this.state.orders.find((item) => item.id === orderId);
    const now = this.clock.nowIso();

    if (!order) {
      this.recordLedger("cancel_rejected", `Paper order ${orderId} was not found.`, orderId);

      return {
        account: cloneAccountState(this.state),
        message: "Paper order was not found.",
        ok: false,
      };
    }

    if (order.status !== "accepted") {
      this.recordLedger("cancel_rejected", `Paper order ${order.id} cannot be cancelled after ${order.status}.`, order.id);

      return {
        account: cloneAccountState(this.state),
        message: "Only accepted unfilled paper orders can be cancelled.",
        ok: false,
      };
    }

    order.cancelledAt = now;
    order.status = "cancelled";
    this.recordLedger("order_cancelled", `Paper order ${order.id} was cancelled.`, order.id);

    return {
      account: cloneAccountState(this.state),
      ok: true,
      order: cloneOrder(order),
    };
  }

  private recordRejectedOrder(intent: OrderIntent, reason: string) {
    const now = this.clock.nowIso();
    const order: PaperOrder = {
      createdAt: now,
      fillIds: [],
      id: `paper_order_${stableHash(`${intent.idempotencyKey}:rejected:${now}`)}`,
      idempotencyKey: intent.idempotencyKey,
      intent: normalizeIntent(intent),
      rejectionReason: reason,
      status: "rejected",
    };

    this.state.orders.push(order);
    this.recordLedger("order_rejected", reason, order.id);

    return cloneOrder(order);
  }

  private recordAcceptedOrder(intent: OrderIntent) {
    const now = this.clock.nowIso();
    const order: PaperOrder = {
      acceptedAt: now,
      createdAt: now,
      fillIds: [],
      id: `paper_order_${stableHash(intent.idempotencyKey)}`,
      idempotencyKey: intent.idempotencyKey,
      intent: normalizeIntent(intent),
      status: "accepted",
    };

    this.state.orders.push(order);
    this.recordLedger("order_accepted", `Paper order ${order.id} was accepted for simulation.`, order.id);

    return order;
  }

  private recordFill(order: PaperOrder, fillPrice: number) {
    const now = this.clock.nowIso();
    const fill: PaperFill = {
      createdAt: now,
      id: `paper_fill_${stableHash(`${order.id}:${fillPrice}:${now}`)}`,
      orderId: order.id,
      price: fillPrice,
      quantity: order.intent.quantity,
      side: order.intent.side,
      symbol: order.intent.symbol,
    };

    order.fillIds.push(fill.id);
    order.status = "filled";
    this.state.fills.push(fill);
    this.reconcileFill(fill, order.intent);
    this.recordLedger("order_filled", `Paper order ${order.id} filled in simulation.`, order.id);

    return cloneFill(fill);
  }

  private reconcileFill(fill: PaperFill, intent: OrderIntent) {
    const notional = fill.price * fill.quantity;
    const existingPosition = findPosition(this.state, fill.symbol);
    const now = this.clock.nowIso();

    if (fill.side === "buy") {
      this.state.cash = roundMoney(this.state.cash - notional);

      if (!existingPosition) {
        this.state.positions.push({
          assetType: intent.assetType,
          averageEntryPrice: fill.price,
          marketValue: roundMoney(notional),
          openedAt: now,
          quantity: fill.quantity,
          sector: intent.sector ?? null,
          symbol: fill.symbol,
          updatedAt: now,
        });
        return;
      }

      const totalQuantity = existingPosition.quantity + fill.quantity;
      const totalCost = existingPosition.averageEntryPrice * existingPosition.quantity + notional;
      existingPosition.averageEntryPrice = roundMoney(totalCost / totalQuantity);
      existingPosition.marketValue = roundMoney(totalQuantity * fill.price);
      existingPosition.quantity = totalQuantity;
      existingPosition.updatedAt = now;
      return;
    }

    if (!existingPosition) return;

    this.state.cash = roundMoney(this.state.cash + notional);
    existingPosition.quantity = roundShares(existingPosition.quantity - fill.quantity);
    existingPosition.marketValue = roundMoney(existingPosition.quantity * fill.price);
    existingPosition.updatedAt = now;

    if (existingPosition.quantity <= 0) {
      this.state.positions = this.state.positions.filter(
        (position) => position.symbol !== fill.symbol,
      );
    }
  }

  private recordLedger(type: PaperLedgerEvent["type"], message: string, orderId?: string) {
    const at = this.clock.nowIso();

    this.state.ledger.push({
      at,
      id: `paper_ledger_${stableHash(`${type}:${message}:${orderId ?? ""}:${at}`)}`,
      message,
      orderId,
      type,
    });
  }
}

function validateRiskPolicyConfig(config: RiskPolicyConfig) {
  const positiveFields: Array<keyof RiskPolicyConfig> = [
    "earningsBlackoutDays",
    "entryPriceTolerancePct",
    "maxOpenPositions",
    "maxOrderNotional",
    "maxPortfolioExposurePct",
    "maxPositionNotional",
    "maxSectorExposurePct",
    "quoteMaxAgeSeconds",
  ];

  positiveFields.forEach((field) => {
    const value = config[field];

    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid paper risk policy config: ${field}.`);
    }
  });

  if (!config.supportedAssetTypes.length) {
    throw new Error("Paper risk policy requires at least one supported asset type.");
  }
}

function normalizeIntent(intent: OrderIntent): OrderIntent {
  return {
    ...intent,
    explanationEvidence: [...intent.explanationEvidence],
    sourceQuote: {
      ...intent.sourceQuote,
      symbol: normalizeSymbol(intent.sourceQuote.symbol || intent.symbol),
    },
    symbol: normalizeSymbol(intent.symbol),
    tradePlan: { ...intent.tradePlan },
  };
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function orderReferencePrice(intent: OrderIntent) {
  const price = intent.orderType === "limit" && intent.limitPrice ? intent.limitPrice : intent.sourceQuote.price;

  return Number.isFinite(price) && price !== null && price > 0 ? price : null;
}

function isQuoteStale(quote: PaperPriceEvidence, now: Date, maxAgeSeconds: number) {
  const asOf = parseDate(quote.dataAsOf ?? quote.fetchedAt);

  if (!asOf) return true;

  return now.getTime() - asOf.getTime() > maxAgeSeconds * 1000;
}

function hasDuplicateIdempotencyKey(input: RiskPolicyInput) {
  const known = new Set(input.existingIdempotencyKeys ?? []);

  input.account.orders.forEach((order) => known.add(order.idempotencyKey));

  return known.has(input.intent.idempotencyKey);
}

function hasUnsupportedBehavior(intent: OrderIntent) {
  const flags = intent.unsupportedFeatures;

  return Boolean(
    flags?.cryptoExecution ||
      flags?.fractionalShares ||
      flags?.leverage ||
      flags?.margin ||
      flags?.options ||
      flags?.shortSale ||
      flags?.transfer,
  );
}

function isValidEntryPlan(intent: OrderIntent, referencePrice: number | null) {
  if (referencePrice === null) return true;

  return intent.tradePlan.targetPrice > referencePrice && intent.tradePlan.stopLoss < referencePrice;
}

function isOutsideEntryPlan(intent: OrderIntent, referencePrice: number, tolerancePct: number) {
  const { entryHigh, entryLow } = intent.tradePlan;
  const tolerance = tolerancePct / 100;

  if (typeof entryLow === "number" && referencePrice < entryLow * (1 - tolerance)) return true;
  if (typeof entryHigh === "number" && referencePrice > entryHigh * (1 + tolerance)) return true;

  return false;
}

function isInsideEarningsBlackout(
  upcomingEarningsAt: string | null | undefined,
  now: Date,
  blackoutDays: number,
) {
  const earningsAt = parseDate(upcomingEarningsAt);

  if (!earningsAt) return false;

  const daysUntil = (earningsAt.getTime() - now.getTime()) / 86_400_000;

  return daysUntil >= 0 && daysUntil <= blackoutDays;
}

function shouldFill(intent: OrderIntent) {
  if (intent.orderType === "market") return true;
  if (typeof intent.limitPrice !== "number" || !Number.isFinite(intent.limitPrice)) return false;

  return intent.side === "buy"
    ? intent.sourceQuote.price !== null && intent.sourceQuote.price <= intent.limitPrice
    : intent.sourceQuote.price !== null && intent.sourceQuote.price >= intent.limitPrice;
}

function findPosition(account: PaperAccountState, symbol: string) {
  const normalized = normalizeSymbol(symbol);

  return account.positions.find((position) => normalizeSymbol(position.symbol) === normalized);
}

function totalMarketValue(account: PaperAccountState) {
  return account.positions.reduce((total, position) => total + position.marketValue, 0);
}

function accountEquity(account: PaperAccountState) {
  return account.cash + totalMarketValue(account);
}

function sectorMarketValue(account: PaperAccountState, sector: string) {
  const normalized = sector.trim().toLowerCase();

  return account.positions.reduce((total, position) => {
    if (position.sector?.trim().toLowerCase() !== normalized) return total;

    return total + position.marketValue;
  }, 0);
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function roundShares(value: number) {
  return Number(value.toFixed(8));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function cloneAccountState(account: PaperAccountState): PaperAccountState {
  return {
    accountId: account.accountId,
    cash: account.cash,
    currency: account.currency,
    fills: account.fills.map(cloneFill),
    ledger: account.ledger.map((event) => ({ ...event })),
    orders: account.orders.map(cloneOrder),
    positions: account.positions.map((position) => ({ ...position })),
  };
}

function cloneOrder(order: PaperOrder): PaperOrder {
  return {
    ...order,
    fillIds: [...order.fillIds],
    intent: {
      ...order.intent,
      explanationEvidence: [...order.intent.explanationEvidence],
      sourceQuote: { ...order.intent.sourceQuote },
      strategy: { ...order.intent.strategy },
      signalRef: { ...order.intent.signalRef },
      tradePlan: { ...order.intent.tradePlan },
      unsupportedFeatures: order.intent.unsupportedFeatures
        ? { ...order.intent.unsupportedFeatures }
        : undefined,
    },
  };
}

function cloneFill(fill: PaperFill): PaperFill {
  return { ...fill };
}
