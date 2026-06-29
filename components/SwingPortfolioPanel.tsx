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

function toNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(
    initialTrade?.symbol
      ? { tone: "info", text: `${initialTrade.symbol.toUpperCase()} is ready to save to your Swing Portfolio.` }
      : null,
  );
  const [closePrices, setClosePrices] = useState<Record<string, string>>({});

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

  async function loadPortfolio() {
    setLoading(true);
    setMessage((current) => current?.tone === "info" ? current : null);

    try {
      const restored = await restoreAuthenticatedCustomerSession();
      setCustomer(restored ?? getCurrentCustomer());
      const token = await getSessionToken();

      if (!token) {
        setTrades([]);
        setMessage({ tone: "error", text: "Log in to save and track your SwingFi trades." });
        return;
      }

      const response = await fetch("/api/portfolio", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; trades?: PortfolioTrade[] }
        | null;

      if (!response.ok) {
        setTrades([]);
        setMessage({ tone: "error", text: payload?.error ?? "Portfolio could not be loaded." });
        return;
      }

      setTrades(payload?.trades ?? []);
    } catch {
      setTrades([]);
      setMessage({ tone: "error", text: "Portfolio could not be loaded. Try again shortly." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPortfolio();
  }, []);

  async function saveTrade() {
    setSaving(true);
    setMessage(null);

    try {
      const token = await getSessionToken();
      if (!token) {
        setMessage({ tone: "error", text: "Log in before saving a trade." });
        return;
      }

      const holdWindow = toNumber(form.holdingPeriodDays);
      const planNotes = [
        holdWindow ? `Planned hold: ${holdWindow} days.` : "",
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
      setMessage({ tone: "success", text: `${payload.trade.symbol} was added to your Swing Portfolio.` });
    } finally {
      setSaving(false);
    }
  }

  async function closeTrade(trade: PortfolioTrade) {
    const exitPrice = closePrices[trade.id];
    const token = await getSessionToken();

    if (!token) {
      setMessage({ tone: "error", text: "Log in before updating a trade." });
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
            Uses live FMP price when available; broker balances remain separate.
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

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)] sm:p-6">
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Add trade
          </p>
          <h2 className="mt-2 text-2xl font-black text-ink">
            Save the plan you actually used
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-ink/58">
            Add the rough time and price you bought. SwingFi will keep the target, stop,
            current price, and decision status visible after the daily list changes.
          </p>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-normal text-ink/44">Ticker</span>
              <input
                value={form.symbol}
                onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
                placeholder="AAPL"
                className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
              />
            </label>

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

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-ink/44">Entry price</span>
                <input
                  inputMode="decimal"
                  value={form.entryPrice}
                  onChange={(event) => setForm((current) => ({ ...current, entryPrice: event.target.value }))}
                  placeholder="125.50"
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
                />
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

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-normal text-ink/44">
                Planned holding window
              </span>
              <input
                inputMode="numeric"
                value={form.holdingPeriodDays}
                onChange={(event) => setForm((current) => ({ ...current, holdingPeriodDays: event.target.value }))}
                placeholder="10"
                className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
              />
              <span className="text-xs font-semibold leading-5 text-ink/45">
                Use trading days. SwingFi will flag the position when it reaches this review window.
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-ink/44">Target</span>
                <input
                  inputMode="decimal"
                  value={form.targetPrice}
                  onChange={(event) => setForm((current) => ({ ...current, targetPrice: event.target.value }))}
                  placeholder="136.00"
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-ink/44">Stop loss</span>
                <input
                  inputMode="decimal"
                  value={form.stopLoss}
                  onChange={(event) => setForm((current) => ({ ...current, stopLoss: event.target.value }))}
                  placeholder="119.00"
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-ink/44">Buy date</span>
                <input
                  type="date"
                  value={form.entryDate}
                  onChange={(event) => setForm((current) => ({ ...current, entryDate: event.target.value }))}
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:bg-white"
                />
              </label>
              <div className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-ink/44">Approx. time</span>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(timeWindowLabels) as Array<FormState["entryTimeWindow"]>).map((window) => (
                    <button
                      key={window}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, entryTimeWindow: window }))}
                      className={`rounded-xl border px-2 py-2 text-xs font-black transition ${
                        form.entryTimeWindow === window
                          ? "border-pine bg-mint text-pine"
                          : "border-line bg-surface text-ink/56 hover:border-pine/35"
                      }`}
                    >
                      {timeWindowLabels[window]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

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

        <section className="grid gap-5">
          <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-pine">Current positions</p>
                <h2 className="mt-2 text-2xl font-black text-ink">Your open swing plans</h2>
              </div>
              <Link
                href="/dashboard"
                className="rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-black text-ink hover:border-pine"
              >
                Review current rankings
              </Link>
            </div>

            {openTrades.length ? (
              <div className="mt-5 grid gap-4">
                {openTrades.map((trade) => (
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
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-line bg-surface p-6">
                <p className="text-lg font-black text-ink">No open trades yet</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/56">
                  When you act on a ranked idea, save it here so the plan, target, stop,
                  and follow-up context stay visible after the daily rankings refresh.
                </p>
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
