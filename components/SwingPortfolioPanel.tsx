"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getCurrentCustomer,
  restoreAuthenticatedCustomerSession,
  type CustomerProfile,
} from "@/lib/customer-store";
import type { AssetType, TradeStatus } from "@/lib/database.types";

type PortfolioTrade = {
  id: string;
  user_id: string;
  opportunity_id: string | null;
  symbol: string;
  asset_type: AssetType;
  entry_price: number;
  exit_price: number | null;
  target_price: number;
  stop_loss: number;
  quantity: number;
  status: TradeStatus;
  opened_at: string | null;
  closed_at: string | null;
  realized_gain: number | null;
  realized_loss: number | null;
  notes: string | null;
  created_at: string;
  currentPrice: number | null;
  daysHeld: number;
  latestNews: Array<{
    publishedDate: string | null;
    site: string | null;
    title: string;
    url: string | null;
  }>;
  planStatus: string;
  plannedHoldingDays: number | null;
  unrealizedReturnPct: number | null;
};

type InitialTrade = {
  assetType?: string;
  entryHigh?: string;
  entryLow?: string;
  holdingPeriodDays?: string;
  opportunityId?: string;
  stopLoss?: string;
  symbol?: string;
  targetPrice?: string;
};

type TickerSuggestion = {
  currency: string;
  exchange: string;
  name: string;
  symbol: string;
};

type EntryPriceEstimate = {
  confidence: "higher" | "estimate";
  estimatedPrice: number;
  message: string;
  source: "fmp_intraday" | "fmp_daily_estimate";
  sourceTime: string | null;
};

type ExitPlan = {
  confidence: "higher" | "estimate";
  explanation: string;
  holdingPeriodDays: number;
  source: "swingfi_daily_analysis" | "market_structure_estimate";
  stopLoss: number;
  targetPrice: number;
};

type FormState = {
  assetType: AssetType;
  entryDate: string;
  entryPrice: string;
  entryTimeWindow: "open" | "midday" | "afternoon" | "after_hours";
  holdingPeriodDays: string;
  notes: string;
  opportunityId: string;
  quantity: string;
  stopLoss: string;
  symbol: string;
  targetPrice: string;
};

const initialForm: FormState = {
  assetType: "stock",
  entryDate: new Date().toISOString().slice(0, 10),
  entryPrice: "",
  entryTimeWindow: "open",
  holdingPeriodDays: "10",
  notes: "",
  opportunityId: "",
  quantity: "1",
  stopLoss: "",
  symbol: "",
  targetPrice: "",
};

const assetLabels: Record<AssetType, string> = {
  crypto: "Crypto",
  etf: "ETF",
  stock: "US stock",
};

const timeWindowLabels: Record<FormState["entryTimeWindow"], string> = {
  after_hours: "After hours",
  afternoon: "Afternoon",
  midday: "Midday",
  open: "Near open",
};

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatTime(value: string | null) {
  if (!value) return "Not refreshed yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not refreshed yet";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function toNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function validateTradePlan(form: FormState) {
  const symbol = form.symbol.trim();
  const entryPrice = toNumber(form.entryPrice);
  const targetPrice = toNumber(form.targetPrice);
  const stopLoss = toNumber(form.stopLoss);
  const quantity = toNumber(form.quantity);

  if (!symbol) return "Add the ticker symbol you bought.";
  if (!entryPrice) return "Add the price you paid for the trade.";
  if (!quantity) return "Add how many shares or units you bought.";
  if (targetPrice && targetPrice <= entryPrice) return "For long trades, the target should be above your entry price.";
  if (stopLoss && stopLoss >= entryPrice) return "For long trades, the stop loss should be below your entry price.";

  return "";
}

function mapAssetType(value: string | undefined): AssetType {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "crypto") return "crypto";
  if (normalized === "etf") return "etf";
  return "stock";
}

function buildOpenedAt(date: string, window: FormState["entryTimeWindow"]) {
  const time = {
    after_hours: "16:30:00",
    afternoon: "15:00:00",
    midday: "12:30:00",
    open: "09:45:00",
  }[window];

  return new Date(`${date}T${time}`).toISOString();
}

function formFromInitialTrade(initialTrade?: InitialTrade): FormState {
  if (!initialTrade?.symbol) return initialForm;

  const entryLow = toNumber(initialTrade.entryLow);
  const entryHigh = toNumber(initialTrade.entryHigh);
  const midpoint = entryLow && entryHigh ? ((entryLow + entryHigh) / 2).toFixed(2) : "";
  const holdingDays = toNumber(initialTrade.holdingPeriodDays);

  return {
    ...initialForm,
    assetType: mapAssetType(initialTrade.assetType),
    entryPrice: midpoint,
    holdingPeriodDays: holdingDays ? String(holdingDays) : initialForm.holdingPeriodDays,
    notes: holdingDays
      ? `Original SwingFi plan estimated a ${holdingDays}-day holding window.`
      : "Added from SwingFi analysis.",
    opportunityId: initialTrade.opportunityId ?? "",
    stopLoss: initialTrade.stopLoss ?? "",
    symbol: initialTrade.symbol.toUpperCase(),
    targetPrice: initialTrade.targetPrice ?? "",
  };
}

function statusTone(status: string) {
  if (status === "At or above target" || status === "Near target" || status === "Inside plan") {
    return "border-pine/25 bg-mint text-pine";
  }

  if (status === "Below stop" || status === "Near stop") {
    return "border-coral/25 bg-coral/10 text-coral";
  }

  return "border-amber/25 bg-amber/15 text-ink";
}

function reviewCountdown(trade: PortfolioTrade) {
  if (!trade.plannedHoldingDays) {
    return {
      label: "SwingFi monitoring",
      detail: "No review countdown was saved for this trade.",
      progress: 0,
      urgency: "neutral",
    };
  }

  const daysLeft = trade.plannedHoldingDays - trade.daysHeld;
  const progress = Math.min(Math.max((trade.daysHeld / trade.plannedHoldingDays) * 100, 0), 100);

  if (daysLeft <= 0) {
    return {
      label: "Review sell plan now",
      detail: `${trade.plannedHoldingDays}-day swing window has arrived.`,
      progress: 100,
      urgency: "high",
    };
  }

  if (daysLeft <= 2) {
    return {
      label: `${daysLeft} day${daysLeft === 1 ? "" : "s"} to review`,
      detail: "Prepare to review the target, stop, news, and current trend.",
      progress,
      urgency: "watch",
    };
  }

  return {
    label: `${daysLeft} days left`,
    detail: `${trade.daysHeld} of ${trade.plannedHoldingDays} planned swing days complete.`,
    progress,
    urgency: "calm",
  };
}

function countdownTone(urgency: string) {
  if (urgency === "high") return "border-coral/25 bg-coral/10 text-coral";
  if (urgency === "watch") return "border-amber/25 bg-amber/15 text-ink";
  return "border-pine/15 bg-mint text-pine";
}

function isEntryPriceEstimate(value: unknown): value is EntryPriceEstimate {
  const estimate = value as Partial<EntryPriceEstimate>;

  return (
    typeof estimate.estimatedPrice === "number" &&
    typeof estimate.message === "string" &&
    (estimate.source === "fmp_intraday" || estimate.source === "fmp_daily_estimate")
  );
}

function isExitPlan(value: unknown): value is ExitPlan {
  const plan = value as Partial<ExitPlan>;

  return (
    typeof plan.targetPrice === "number" &&
    typeof plan.stopLoss === "number" &&
    typeof plan.holdingPeriodDays === "number" &&
    typeof plan.explanation === "string" &&
    (plan.source === "swingfi_daily_analysis" || plan.source === "market_structure_estimate")
  );
}

function PortfolioSessionReconnect() {
  return (
    <section className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
      <div className="grid lg:grid-cols-[1fr_360px]">
        <div className="p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Secure portfolio session
          </p>
          <h2 className="mt-3 text-3xl font-black text-ink">
            Log in again to save and track trades
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ink/62">
            Your SwingFi profile is still saved in this browser, but portfolio
            tracking needs a verified account session before we can load, save,
            close, or update your trade plans.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-2xl bg-ink px-5 py-3 text-center text-sm font-black text-white hover:bg-pine"
            >
              Log in again
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-ink hover:border-pine"
            >
              Review dashboard
            </Link>
          </div>
        </div>
        <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white lg:border-l lg:border-t-0">
          <p className="text-xs font-black uppercase tracking-normal text-lime">
            Why this matters
          </p>
          <p className="mt-4 text-sm font-semibold leading-7 text-white/68">
            Portfolio entries can include position size, notes, targets, stops,
            and outcomes. Re-authentication keeps that information private and
            tied to the right account.
          </p>
        </div>
      </div>
    </section>
  );
}

function getSessionToken() {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return Promise.resolve("");

  return supabase.auth.getSession().then(({ data }) => data.session?.access_token ?? "");
}

export function SwingPortfolioPanel({ initialTrade }: { initialTrade?: InitialTrade }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [form, setForm] = useState<FormState>(() => formFromInitialTrade(initialTrade));
  const [trades, setTrades] = useState<PortfolioTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [requiresSessionReconnect, setRequiresSessionReconnect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(Boolean(initialTrade?.symbol));
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingTradeIds, setDeletingTradeIds] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(
    initialTrade?.symbol
      ? { tone: "info", text: `${initialTrade.symbol.toUpperCase()} is ready to save to your Swing Portfolio.` }
      : null,
  );
  const [closePrices, setClosePrices] = useState<Record<string, string>>({});
  const [tickerSuggestions, setTickerSuggestions] = useState<TickerSuggestion[]>([]);
  const [tickerSearchLoading, setTickerSearchLoading] = useState(false);
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const [entryEstimate, setEntryEstimate] = useState<EntryPriceEstimate | null>(null);
  const [estimatingEntryPrice, setEstimatingEntryPrice] = useState(false);
  const [exitPlan, setExitPlan] = useState<ExitPlan | null>(null);
  const [buildingExitPlan, setBuildingExitPlan] = useState(false);

  const openTrades = useMemo(
    () => trades.filter((trade) => trade.status === "open" || trade.status === "planned"),
    [trades],
  );
  const closedTrades = useMemo(
    () => trades.filter((trade) => trade.status === "closed" || trade.status === "cancelled"),
    [trades],
  );

  const portfolioStats = useMemo(() => {
    const invested = openTrades.reduce(
      (total, trade) => total + Number(trade.entry_price) * Number(trade.quantity),
      0,
    );
    const openReturn = openTrades.reduce((total, trade) => {
      if (!trade.currentPrice) return total;
      return total + (trade.currentPrice - Number(trade.entry_price)) * Number(trade.quantity);
    }, 0);
    const needsReview = openTrades.filter((trade) =>
      ["Below stop", "Near stop", "At or above target", "Review time window"].includes(trade.planStatus),
    ).length;

    return { invested, needsReview, openReturn };
  }, [openTrades]);
  const draftPlanMath = useMemo(() => {
    const entryPrice = toNumber(form.entryPrice);
    const targetPrice = toNumber(form.targetPrice);
    const stopLoss = toNumber(form.stopLoss);
    const quantity = toNumber(form.quantity) ?? 1;

    if (!entryPrice || !targetPrice || !stopLoss) {
      return null;
    }

    const plannedUpside = ((targetPrice - entryPrice) / entryPrice) * 100;
    const plannedDownside = ((entryPrice - stopLoss) / entryPrice) * 100;
    const dollarsAtTarget = (targetPrice - entryPrice) * quantity;
    const dollarsAtStop = (entryPrice - stopLoss) * quantity;
    const rewardRisk = dollarsAtStop > 0 ? dollarsAtTarget / dollarsAtStop : null;
    const isValidLongPlan = plannedUpside > 0 && plannedDownside > 0;

    return {
      dollarsAtStop,
      dollarsAtTarget,
      isValidLongPlan,
      plannedDownside,
      plannedUpside,
      rewardRisk,
    };
  }, [form.entryPrice, form.quantity, form.stopLoss, form.targetPrice]);

  useEffect(() => {
    const query = form.symbol.trim();
    let active = true;

    if (query.length < 1 || initialTrade?.symbol) {
      setTickerSuggestions([]);
      setTickerSearchLoading(false);
      return;
    }

    setTickerSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const token = await getSessionToken();
        if (!token) {
          if (active) {
            setTickerSuggestions([]);
            setTickerSearchLoading(false);
          }
          return;
        }

        const response = await fetch(`/api/portfolio/symbol-search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json().catch(() => ({}))) as {
          results?: TickerSuggestion[];
        };

        if (!active) return;
        setTickerSuggestions(response.ok ? payload.results ?? [] : []);
      } catch {
        if (active) setTickerSuggestions([]);
      } finally {
        if (active) setTickerSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.symbol, initialTrade?.symbol]);

  function selectTickerSuggestion(suggestion: TickerSuggestion) {
    setForm((current) => ({
      ...current,
      assetType: suggestion.exchange.toUpperCase().includes("ETF") ? "etf" : "stock",
      symbol: suggestion.symbol,
    }));
    setEntryEstimate(null);
    setExitPlan(null);
    setShowTickerSuggestions(false);
  }

  async function estimateEntryPrice() {
    const symbol = form.symbol.trim();
    if (!symbol) {
      setMessage({ tone: "error", text: "Choose the ticker before estimating the entry price." });
      return;
    }

    setEstimatingEntryPrice(true);
    setEntryEstimate(null);
    setMessage(null);

    try {
      const token = await getSessionToken();
      if (!token) {
        setRequiresSessionReconnect(true);
        return;
      }

      const response = await fetch("/api/portfolio/entry-price", {
        body: JSON.stringify({
          date: form.entryDate,
          symbol,
          timeWindow: form.entryTimeWindow,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as
        | EntryPriceEstimate
        | { error?: string };

      if (!response.ok || !isEntryPriceEstimate(payload)) {
        setMessage({
          tone: "error",
          text:
            "error" in payload && payload.error
              ? payload.error
              : "SwingFi could not estimate the entry price.",
        });
        return;
      }

      setEntryEstimate(payload);
      setExitPlan(null);
      setForm((current) => ({
        ...current,
        entryPrice: payload.estimatedPrice.toFixed(2),
      }));
      setMessage({
        tone: "info",
        text: `Entry price estimated at ${formatCurrency(payload.estimatedPrice)}. Check your broker fill and edit if needed.`,
      });
    } finally {
      setEstimatingEntryPrice(false);
    }
  }

  useEffect(() => {
    const symbol = form.symbol.trim();
    const entryPrice = toNumber(form.entryPrice);
    let active = true;

    if (!symbol || !entryPrice) {
      setExitPlan(null);
      setBuildingExitPlan(false);
      return;
    }

    setBuildingExitPlan(true);
    const timer = window.setTimeout(async () => {
      try {
        const token = await getSessionToken();
        if (!token) {
          if (active) setBuildingExitPlan(false);
          return;
        }

        const response = await fetch("/api/portfolio/exit-plan", {
          body: JSON.stringify({
            entryPrice,
            symbol,
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = (await response.json().catch(() => ({}))) as ExitPlan | { error?: string };

        if (!active) return;

        if (response.ok && isExitPlan(payload)) {
          setExitPlan(payload);
          setForm((current) => ({
            ...current,
            holdingPeriodDays: String(payload.holdingPeriodDays),
            stopLoss: payload.stopLoss.toFixed(2),
            targetPrice: payload.targetPrice.toFixed(2),
          }));
        } else {
          setExitPlan(null);
        }
      } catch {
        if (active) setExitPlan(null);
      } finally {
        if (active) setBuildingExitPlan(false);
      }
    }, 650);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.entryPrice, form.symbol]);

  async function loadPortfolio(options: { quiet?: boolean } = {}) {
    if (options.quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setMessage((current) => current?.tone === "info" ? current : null);

    try {
      const restored = await restoreAuthenticatedCustomerSession();
      setCustomer(restored ?? getCurrentCustomer());
      const token = await getSessionToken();

      if (!token) {
        if (!options.quiet) setTrades([]);
        setMessage(null);
        setRequiresSessionReconnect(true);
        return;
      }

      setRequiresSessionReconnect(false);
      const response = await fetch("/api/portfolio", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; refreshedAt?: string; trades?: PortfolioTrade[] }
        | null;

      if (!response.ok) {
        if (!options.quiet) {
          setTrades([]);
          setMessage({ tone: "error", text: payload?.error ?? "Portfolio could not be loaded." });
        }
        return;
      }

      setTrades(payload?.trades ?? []);
      setLastUpdatedAt(payload?.refreshedAt ?? new Date().toISOString());
    } catch {
      if (!options.quiet) {
        setTrades([]);
        setMessage({ tone: "error", text: "Portfolio could not be loaded. Try again shortly." });
      }
    } finally {
      if (options.quiet) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadPortfolio();
  }, []);

  useEffect(() => {
    if (!customer || requiresSessionReconnect) return;

    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void loadPortfolio({ quiet: true });
    };
    const interval = window.setInterval(refresh, 5 * 60 * 1000);

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [customer, requiresSessionReconnect]);

  async function saveTrade() {
    const validation = validateTradePlan(form);
    if (validation) {
      setMessage({ tone: "error", text: validation });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const token = await getSessionToken();
      if (!token) {
        setRequiresSessionReconnect(true);
        setMessage(null);
        return;
      }

      const holdWindow = toNumber(form.holdingPeriodDays);
      const hasCompleteEnteredPlan = Boolean(toNumber(form.targetPrice) && toNumber(form.stopLoss));
      const shouldSendHoldWindow = Boolean(
        holdWindow && (exitPlan || hasCompleteEnteredPlan || form.holdingPeriodDays !== initialForm.holdingPeriodDays),
      );
      const planNotes = [
        shouldSendHoldWindow ? `Planned hold: ${holdWindow} days.` : "",
        form.notes,
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await fetch("/api/portfolio", {
        body: JSON.stringify({
          assetType: form.assetType,
          entryPrice: form.entryPrice,
          notes: planNotes,
          openedAt: buildOpenedAt(form.entryDate, form.entryTimeWindow),
          opportunityId: form.opportunityId || null,
          quantity: form.quantity || "1",
          status: "open",
          stopLoss: form.stopLoss,
          symbol: form.symbol,
          targetPrice: form.targetPrice,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; trade?: PortfolioTrade }
        | null;

      if (!response.ok || !payload?.trade) {
        setMessage({ tone: "error", text: payload?.error ?? "Trade could not be saved." });
        return;
      }

      setTrades((current) => [payload.trade as PortfolioTrade, ...current]);
      setForm(initialForm);
      setEntryEstimate(null);
      setExitPlan(null);
      setShowAddTrade(false);
      setMessage({ tone: "success", text: `${payload.trade.symbol} was added to your Swing Portfolio.` });
    } finally {
      setSaving(false);
    }
  }

  async function closeTrade(trade: PortfolioTrade) {
    const exitPrice = closePrices[trade.id];
    if (!toNumber(exitPrice)) {
      setMessage({ tone: "error", text: `Add a valid exit price before closing ${trade.symbol}.` });
      return;
    }

    const token = await getSessionToken();

    if (!token) {
      setRequiresSessionReconnect(true);
      setMessage(null);
      return;
    }

    const response = await fetch(`/api/portfolio/${trade.id}`, {
      body: JSON.stringify({
        exitPrice,
        status: "closed",
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; trade?: PortfolioTrade }
      | null;

    if (!response.ok || !payload?.trade) {
      setMessage({ tone: "error", text: payload?.error ?? "Trade could not be closed." });
      return;
    }

    setTrades((current) => current.map((item) => (item.id === trade.id ? payload.trade as PortfolioTrade : item)));
    setClosePrices((current) => ({ ...current, [trade.id]: "" }));
    setMessage({ tone: "success", text: `${trade.symbol} was moved to closed trades.` });
  }

  async function deleteTrade(trade: PortfolioTrade) {
    if (pendingDeleteId !== trade.id) {
      setPendingDeleteId(trade.id);
      setMessage({ tone: "info", text: `Confirm remove ${trade.symbol} if you no longer want to track it.` });
      return;
    }

    const token = await getSessionToken();

    if (!token) {
      setRequiresSessionReconnect(true);
      setMessage(null);
      return;
    }

    setDeletingTradeIds((current) => ({ ...current, [trade.id]: true }));

    try {
      const response = await fetch(`/api/portfolio/${trade.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Trade could not be removed." });
        return;
      }

      setTrades((current) => current.filter((item) => item.id !== trade.id));
      setClosePrices((current) => {
        const next = { ...current };
        delete next[trade.id];
        return next;
      });
      setPendingDeleteId(null);
      setMessage({ tone: "success", text: `${trade.symbol} was removed from your portfolio.` });
    } finally {
      setDeletingTradeIds((current) => {
        const next = { ...current };
        delete next[trade.id];
        return next;
      });
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
        <div className="skeleton h-4 w-36 rounded-full" />
        <div className="skeleton mt-5 h-12 max-w-lg rounded-2xl" />
        <div className="skeleton mt-6 h-64 rounded-3xl" />
      </section>
    );
  }

  if (!customer) {
    return (
      <section className="overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
        <div className="grid lg:grid-cols-[1fr_360px]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              Swing Portfolio
            </p>
            <h2 className="mt-3 text-3xl font-black text-ink">
              Log in to track trades you decide to make
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ink/62">
              Save the entry, target, stop, and timing you used so your plan does not disappear
              when the next rankings refresh.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white hover:bg-pine"
            >
              Log in
            </Link>
          </div>
          <div className="border-t border-line bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white lg:border-l lg:border-t-0">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Why it matters
            </p>
            <p className="mt-4 text-sm font-semibold leading-7 text-white/68">
              Swing trades need follow-through. Portfolio tracking keeps your target, stop,
              news, and current status in one place.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (requiresSessionReconnect) {
    return <PortfolioSessionReconnect />;
  }

  return (
    <section className="grid gap-6">
      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            message.tone === "success"
              ? "border-pine/20 bg-mint text-pine"
              : message.tone === "info"
                ? "border-line bg-sky text-ink/70"
                : "border-coral/25 bg-coral/10 text-coral"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {!showAddTrade ? (
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
          <p className="text-xs font-black uppercase tracking-normal text-pine">Open trades</p>
          <p className="mt-2 text-4xl font-black text-ink">{openTrades.length}</p>
          <p className="mt-2 text-sm font-semibold text-ink/55">
            Current swing plans saved from SwingFi rankings or added manually.
          </p>
        </div>
        <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
          <p className="text-xs font-black uppercase tracking-normal text-pine">Open P/L estimate</p>
          <p className={`mt-2 text-4xl font-black ${portfolioStats.openReturn >= 0 ? "text-pine" : "text-coral"}`}>
            {formatCurrency(portfolioStats.openReturn)}
          </p>
          <p className="mt-2 text-sm font-semibold text-ink/55">
            Refreshes every 5 minutes while this page is open; broker balances remain separate.
          </p>
        </div>
        <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
          <p className="text-xs font-black uppercase tracking-normal text-pine">Needs review</p>
          <p className="mt-2 text-4xl font-black text-ink">{portfolioStats.needsReview}</p>
          <p className="mt-2 text-sm font-semibold text-ink/55">
            Near target, near stop, below stop, or past the review window.
          </p>
        </div>
      </div>
      ) : null}

      <div className={showAddTrade ? "mx-auto grid w-full max-w-3xl gap-6" : "grid gap-6"}>
        {showAddTrade ? (
        <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-normal text-pine">
                Add trade
              </p>
              <h2 className="mt-2 text-3xl font-black text-ink">
                Add a position to track
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAddTrade(false)}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-black text-ink/58 transition hover:border-pine hover:text-pine"
            >
              Back
            </button>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-ink/58">
            Add what you bought and roughly when you bought it. SwingFi automatically
            builds the target, stop, and sell-review countdown before the trade is saved.
          </p>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-normal text-ink/44">
                Ticker or company
              </span>
              <input
                value={form.symbol}
                onChange={(event) => {
                  setForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }));
                  setEntryEstimate(null);
                  setExitPlan(null);
                  setShowTickerSuggestions(true);
                }}
                onFocus={() => setShowTickerSuggestions(true)}
                placeholder="AAPL or Apple"
                className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
              />
              <span className="text-xs font-semibold leading-5 text-ink/45">
                Start typing and choose the matching ticker. You can add a trade from
                today&apos;s rankings or one you bought on your own.
              </span>
            </label>

            {showTickerSuggestions && (tickerSuggestions.length > 0 || tickerSearchLoading) ? (
              <div className="rounded-3xl border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-3 px-1">
                  <p className="text-xs font-black uppercase tracking-normal text-pine">
                    Ticker matches
                  </p>
                  {tickerSearchLoading ? (
                    <p className="text-xs font-bold text-ink/45">Searching...</p>
                  ) : null}
                </div>
                <div className="mt-2 grid gap-2">
                  {tickerSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.symbol}-${suggestion.exchange}`}
                      type="button"
                      onClick={() => selectTickerSuggestion(suggestion)}
                      className="rounded-2xl border border-line bg-white p-3 text-left transition hover:border-pine/35 hover:bg-mint/60"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-sm font-black text-ink">
                            {suggestion.symbol}
                          </span>
                          <span className="mt-1 block text-xs font-semibold leading-5 text-ink/56">
                            {suggestion.name}
                          </span>
                        </span>
                        <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-black text-ink/48 ring-1 ring-line">
                          {suggestion.exchange}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              {(["stock", "etf", "crypto"] as AssetType[]).map((assetType) => (
                <button
                  key={assetType}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, assetType }))}
                  className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                    form.assetType === assetType
                      ? "border-pine bg-mint text-pine"
                      : "border-line bg-surface text-ink/58 hover:border-pine/35"
                  }`}
                >
                  {assetLabels[assetType]}
                </button>
              ))}
            </div>

            <div className="rounded-3xl border border-line bg-surface p-4">
              <p className="text-xs font-black uppercase tracking-normal text-pine">
                When did you buy?
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-ink/55">
                Choose the date and rough time of day, then SwingFi can estimate the entry
                price from FMP market data. You can still edit the price before saving.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-normal text-ink/44">Buy date</span>
                  <input
                    type="date"
                    value={form.entryDate}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, entryDate: event.target.value }));
                      setEntryEstimate(null);
                    }}
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
                  />
                </label>
                <div className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-normal text-ink/44">Approx. time</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(timeWindowLabels) as Array<FormState["entryTimeWindow"]>).map((window) => (
                      <button
                        key={window}
                        type="button"
                        onClick={() => {
                          setForm((current) => ({ ...current, entryTimeWindow: window }));
                          setEntryEstimate(null);
                        }}
                        className={`rounded-xl border px-2 py-2 text-xs font-black transition ${
                          form.entryTimeWindow === window
                            ? "border-pine bg-mint text-pine"
                            : "border-line bg-white text-ink/56 hover:border-pine/35"
                        }`}
                      >
                        {timeWindowLabels[window]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void estimateEntryPrice()}
                disabled={estimatingEntryPrice || !form.symbol.trim()}
                className="mt-4 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.14)] transition hover:bg-pine disabled:cursor-not-allowed disabled:opacity-55"
              >
                {estimatingEntryPrice ? "Estimating price..." : "Estimate entry price from buy time"}
              </button>
              {entryEstimate ? (
                <p className="mt-3 rounded-2xl border border-pine/15 bg-mint px-4 py-3 text-xs font-bold leading-5 text-pine">
                  {entryEstimate.message} Source time: {entryEstimate.sourceTime ?? "not available"}.
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-ink/44">Entry price</span>
                <input
                  inputMode="decimal"
                  value={form.entryPrice}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, entryPrice: event.target.value }));
                    setExitPlan(null);
                  }}
                  placeholder="125.50"
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
                />
                <span className="text-xs font-semibold leading-5 text-ink/45">
                  Use the estimate or replace it with your exact broker fill.
                </span>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-ink/44">Shares/units</span>
                <input
                  inputMode="decimal"
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                  placeholder="1"
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
                />
              </label>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-4">
              <div>
                <div>
                  <p className="text-xs font-black uppercase tracking-normal text-pine">
                    SwingFi sell plan
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-ink/55">
                    Generated automatically from the latest daily analysis when available.
                    For manual trades, SwingFi estimates from recent price structure.
                  </p>
                </div>
              </div>
              {exitPlan ? (
                <div className="mt-4 rounded-2xl border border-pine/15 bg-mint p-4">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <MiniStat label="Review target" value={formatCurrency(exitPlan.targetPrice)} tone="text-pine" />
                    <MiniStat label="Risk stop" value={formatCurrency(exitPlan.stopLoss)} tone="text-coral" />
                    <MiniStat label="Review window" value={`${exitPlan.holdingPeriodDays} days`} />
                  </div>
                  <p className="mt-3 text-xs font-bold leading-5 text-pine">
                    {exitPlan.explanation}
                  </p>
                </div>
              ) : buildingExitPlan ? (
                <div className="mt-4 rounded-2xl border border-line bg-white p-4">
                  <div className="skeleton h-4 w-32 rounded-full" />
                  <div className="skeleton mt-3 h-12 rounded-2xl" />
                  <p className="mt-3 text-xs font-bold leading-5 text-ink/50">
                    SwingFi is building the sell plan from your ticker and entry price.
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-line bg-white px-4 py-3 text-xs font-bold leading-5 text-ink/50">
                  Enter a ticker and entry price. SwingFi will generate the target, stop,
                  and countdown automatically.
                </p>
              )}
            </div>

            {draftPlanMath ? (
              <div
                className={`rounded-3xl border p-4 ${
                  draftPlanMath.isValidLongPlan
                    ? "border-pine/20 bg-mint"
                    : "border-coral/25 bg-coral/10"
                }`}
              >
                <p
                  className={`text-xs font-black uppercase tracking-normal ${
                    draftPlanMath.isValidLongPlan ? "text-pine" : "text-coral"
                  }`}
                >
                  Plan preview
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniStat
                    label="Upside"
                    value={`${draftPlanMath.plannedUpside >= 0 ? "+" : ""}${draftPlanMath.plannedUpside.toFixed(1)}%`}
                    tone={draftPlanMath.plannedUpside > 0 ? "text-pine" : "text-coral"}
                  />
                  <MiniStat
                    label="Downside"
                    value={`-${Math.abs(draftPlanMath.plannedDownside).toFixed(1)}%`}
                    tone={draftPlanMath.plannedDownside > 0 ? "text-coral" : "text-ink"}
                  />
                  <MiniStat
                    label="Reward/risk"
                    value={
                      draftPlanMath.rewardRisk && Number.isFinite(draftPlanMath.rewardRisk)
                        ? `${draftPlanMath.rewardRisk.toFixed(1)}R`
                        : "Check plan"
                    }
                    tone={
                      draftPlanMath.rewardRisk && draftPlanMath.rewardRisk >= 2
                        ? "text-pine"
                        : "text-ink"
                    }
                  />
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-ink/60">
                  {draftPlanMath.isValidLongPlan
                    ? `At your entered size, this plan risks about ${formatCurrency(draftPlanMath.dollarsAtStop)} to pursue about ${formatCurrency(draftPlanMath.dollarsAtTarget)}.`
                    : "For a long swing trade, the target should be above entry and the stop should be below entry."}
                </p>
              </div>
            ) : null}

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-normal text-ink/44">Plan notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                rows={4}
                placeholder="Why did you take this trade? What would make you exit early?"
                className="resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold leading-6 text-ink outline-none transition focus:border-pine focus:bg-white"
              />
            </label>

            <button
              type="button"
              onClick={saveTrade}
              disabled={saving}
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-[0_18px_42px_rgba(7,20,24,0.18)] transition hover:bg-pine disabled:cursor-not-allowed disabled:opacity-55"
            >
              {saving ? "Saving trade..." : "Add to Swing Portfolio"}
            </button>
          </div>
        </section>
        ) : null}

        {!showAddTrade ? (
        <section className="order-1 grid gap-5">
          <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-pine">Current positions</p>
                <h2 className="mt-2 text-2xl font-black text-ink">Your open swing plans</h2>
                <p className="mt-2 text-xs font-bold leading-5 text-ink/48">
                  Current price, status, latest headlines, and countdown refresh every 5 minutes while the page is open.
                  Last updated {formatTime(lastUpdatedAt)}.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowAddTrade((current) => !current)}
                  className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white shadow-[0_12px_30px_rgba(7,20,24,0.14)] transition hover:bg-pine"
                >
                  {showAddTrade ? "Hide add trade" : "Add trade"}
                </button>
                <button
                  type="button"
                  onClick={() => void loadPortfolio({ quiet: true })}
                  disabled={refreshing}
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-center text-sm font-black text-ink transition hover:border-pine disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {refreshing ? "Refreshing..." : "Refresh now"}
                </button>
                <Link
                  href="/dashboard"
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-black text-ink hover:border-pine"
                >
                  Review rankings
                </Link>
              </div>
            </div>

            {openTrades.length ? (
              <div className="mt-5 grid gap-4">
                {openTrades.map((trade) => {
                  const countdown = reviewCountdown(trade);

                  return (
                  <article key={trade.id} className="rounded-3xl border border-line bg-surface p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-ink px-3 py-1 text-xs font-black text-white">
                            {trade.symbol}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(trade.planStatus)}`}>
                            {trade.planStatus}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink/55 ring-1 ring-line">
                            {trade.daysHeld} days held
                          </span>
                          {trade.plannedHoldingDays ? (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink/55 ring-1 ring-line">
                              {trade.plannedHoldingDays}-day plan
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm font-semibold leading-6 text-ink/60">
                          Bought around {formatCurrency(Number(trade.entry_price))}. Target is {formatCurrency(Number(trade.target_price))}; stop is {formatCurrency(Number(trade.stop_loss))}.
                        </p>
                        <div className={`mt-4 rounded-2xl border p-4 ${countdownTone(countdown.urgency)}`}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-black uppercase tracking-normal">
                                Sell-plan countdown
                              </p>
                              <p className="mt-1 text-lg font-black">
                                {countdown.label}
                              </p>
                              <p className="mt-1 text-xs font-bold leading-5 opacity-75">
                                {countdown.detail}
                              </p>
                            </div>
                            <div className="min-w-28 rounded-2xl bg-white/70 px-4 py-3 text-center ring-1 ring-line">
                              <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                                Plan used
                              </p>
                              <p className="mt-1 text-sm font-black text-ink">
                                {trade.plannedHoldingDays ? `${trade.plannedHoldingDays} days` : "Active"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
                            <div
                              className="h-full rounded-full bg-current transition-all"
                              style={{ width: `${countdown.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[420px]">
                        <MiniStat label="Current" value={formatCurrency(trade.currentPrice)} />
                        <MiniStat label="Open P/L" value={formatPercent(trade.unrealizedReturnPct)} />
                        <MiniStat label="Target" value={formatCurrency(Number(trade.target_price))} tone="text-pine" />
                        <MiniStat label="Stop" value={formatCurrency(Number(trade.stop_loss))} tone="text-coral" />
                      </div>
                    </div>

                    {trade.notes ? (
                      <p className="mt-4 rounded-2xl border border-line bg-white p-3 text-sm font-semibold leading-6 text-ink/62">
                        {trade.notes}
                      </p>
                    ) : null}

                    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_280px]">
                      <div className="grid gap-2">
                        <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                          Latest context
                        </p>
                        {trade.latestNews.length ? (
                          trade.latestNews.map((item) => (
                            <a
                              key={`${trade.id}-${item.title}`}
                              href={item.url ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-line bg-white p-3 text-sm font-bold leading-6 text-ink transition hover:border-pine"
                            >
                              {item.title}
                              {item.site ? (
                                <span className="mt-1 block text-xs font-semibold text-ink/45">
                                  {item.site}
                                </span>
                              ) : null}
                            </a>
                          ))
                        ) : (
                          <p className="rounded-2xl border border-line bg-white p-3 text-sm font-semibold text-ink/55">
                            No fresh headlines were available from FMP for this ticker.
                          </p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-line bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                          Close trade
                        </p>
                        <input
                          inputMode="decimal"
                          value={closePrices[trade.id] ?? ""}
                          onChange={(event) =>
                            setClosePrices((current) => ({ ...current, [trade.id]: event.target.value }))
                          }
                          placeholder="Exit price"
                          className="mt-3 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink outline-none focus:border-pine focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => closeTrade(trade)}
                          className="mt-3 w-full rounded-xl bg-ink px-4 py-2 text-sm font-black text-white hover:bg-pine"
                        >
                          Mark closed
                        </button>
                        <p className="mt-3 text-xs font-semibold leading-5 text-ink/45">
                          SwingFi records the result for your review. It does not place trades.
                        </p>
                        <div className="mt-4 border-t border-line pt-3">
                          <p className="text-xs font-black uppercase tracking-normal text-ink/42">
                            Remove position
                          </p>
                          <button
                            type="button"
                            onClick={() => void deleteTrade(trade)}
                            disabled={Boolean(deletingTradeIds[trade.id])}
                            className={`mt-3 w-full rounded-xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${
                              pendingDeleteId === trade.id
                                ? "border-coral/30 bg-coral/10 text-coral hover:bg-coral/15"
                                : "border-line bg-surface text-ink/62 hover:border-coral/30 hover:text-coral"
                            }`}
                          >
                            {deletingTradeIds[trade.id]
                              ? "Removing..."
                              : pendingDeleteId === trade.id
                                ? "Confirm remove"
                                : "Remove from portfolio"}
                          </button>
                          {pendingDeleteId === trade.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingDeleteId(null);
                                setMessage(null);
                              }}
                              className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm font-black text-ink/55 transition hover:border-pine hover:text-pine"
                            >
                              Keep tracking
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-line bg-surface p-6">
                <p className="text-sm font-black uppercase tracking-normal text-pine">
                  Portfolio is ready
                </p>
                <h3 className="mt-2 text-xl font-black text-ink">
                  Save only trades you actually decide to make
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/56">
                  When you act on a ranked idea, save it here so the plan, target, stop,
                  and follow-up context stay visible after the daily rankings refresh.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    "Record entry and size",
                    "Keep target and stop visible",
                    "Review status after the time window",
                  ].map((item) => (
                    <p
                      key={item}
                      className="rounded-2xl border border-line bg-white px-3 py-2 text-xs font-black text-ink/62"
                    >
                      {item}
                    </p>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setShowAddTrade(true)}
                    className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white hover:bg-pine"
                  >
                    Add your first trade
                  </button>
                  <Link
                    href="/dashboard"
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:border-pine"
                  >
                    Review today&apos;s rankings
                  </Link>
                </div>
              </div>
            )}
          </div>

          {closedTrades.length ? (
            <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)] sm:p-6">
              <p className="text-xs font-black uppercase tracking-normal text-pine">Closed history</p>
              <div className="mt-4 grid gap-3">
                {closedTrades.slice(0, 8).map((trade) => (
                  <div key={trade.id} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div>
                      <p className="text-base font-black text-ink">{trade.symbol}</p>
                      <p className="text-sm font-semibold text-ink/52">
                        Entry {formatCurrency(Number(trade.entry_price))} to exit {formatCurrency(trade.exit_price)}
                      </p>
                    </div>
                    <p className="text-sm font-black text-pine">
                      Gain {formatCurrency(trade.realized_gain)}
                    </p>
                    <p className="text-sm font-black text-coral">
                      Loss {formatCurrency(trade.realized_loss)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        ) : null}
      </div>
    </section>
  );
}

function MiniStat({
  label,
  tone = "text-ink",
  value,
}: {
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <p className="text-xs font-black uppercase tracking-normal text-ink/42">{label}</p>
      <p className={`mt-1 text-sm font-black ${tone}`}>{value}</p>
    </div>
  );
}
