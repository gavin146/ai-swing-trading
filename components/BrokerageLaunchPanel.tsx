"use client";

import { useMemo, useState } from "react";
import { getBrokerageLabel, type PreferredBrokerage } from "@/lib/brokerages";
import type { Opportunity } from "@/lib/opportunities";

type BrokerageLaunchPanelProps = {
  opportunity: Opportunity;
  preferredBrokerage?: PreferredBrokerage;
};

type BrokerLink = {
  brokerage: PreferredBrokerage;
  description: string;
  href: string;
  label: string;
};

function normalizeSymbol(symbol: string) {
  return symbol.trim().replace(/^\$/, "").toUpperCase();
}

function getBrokerLinks(symbol: string, assetType: Opportunity["assetType"]): BrokerLink[] {
  if (assetType === "Crypto") {
    return [];
  }

  const ticker = encodeURIComponent(normalizeSymbol(symbol));
  const lowerTicker = encodeURIComponent(normalizeSymbol(symbol).toLowerCase());

  return [
    {
      brokerage: "schwab",
      label: "Schwab",
      description: "Open research quote",
      href: `https://www.schwab.com/research/stocks/quotes/summary/${lowerTicker}`,
    },
    {
      brokerage: "fidelity",
      label: "Fidelity",
      description: "Open research quote",
      href: `https://digital.fidelity.com/prgw/digital/research/quote/dashboard/summary?symbol=${ticker}`,
    },
    {
      brokerage: "robinhood",
      label: "Robinhood",
      description: "Open stock page",
      href: `https://robinhood.com/us/en/stocks/${ticker}/`,
    },
    {
      brokerage: "etrade",
      label: "E*TRADE",
      description: "Open brokerage login",
      href: "https://us.etrade.com/home/welcome-back",
    },
    {
      brokerage: "interactive_brokers",
      label: "Interactive Brokers",
      description: "Open brokerage login",
      href: "https://www.interactivebrokers.com/sso/Login",
    },
  ];
}

function buildClipboardText(opportunity: Opportunity) {
  return [
    `${opportunity.symbol} SwingFi research plan`,
    `Entry range: ${opportunity.entryRange}`,
    `Target: ${opportunity.targetPrice}`,
    `Stop loss: ${opportunity.stopLoss}`,
    `Estimated hold: ${opportunity.timeHorizon}`,
    `Score: ${opportunity.opportunityScore}/100`,
    "Review inside your brokerage before placing any order.",
  ].join("\n");
}

export function BrokerageLaunchPanel({
  opportunity,
  preferredBrokerage = "none",
}: BrokerageLaunchPanelProps) {
  const [copied, setCopied] = useState(false);
  const brokerLinks = useMemo(
    () => {
      const links = getBrokerLinks(opportunity.symbol, opportunity.assetType);

      if (preferredBrokerage === "none" || preferredBrokerage === "other") {
        return links;
      }

      return [...links].sort((a, b) => {
        if (a.brokerage === preferredBrokerage) return -1;
        if (b.brokerage === preferredBrokerage) return 1;
        return 0;
      });
    },
    [opportunity.assetType, opportunity.symbol, preferredBrokerage],
  );
  const primaryBroker = brokerLinks.find((broker) => broker.brokerage === preferredBrokerage);

  async function copyPlan() {
    try {
      await navigator.clipboard.writeText(buildClipboardText(opportunity));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
      <p className="text-xs font-black uppercase tracking-normal text-pine">
        Brokerage handoff
      </p>
      <h2 className="mt-2 text-xl font-black text-ink">Open this symbol where you trade</h2>
      <p className="mt-3 text-sm font-medium leading-6 text-ink/64">
        SwingFi does not place orders. These links open a quote or login page so you
        can review the symbol, confirm your own position size, and decide inside
        your brokerage account.
      </p>

      {preferredBrokerage !== "none" && preferredBrokerage !== "other" ? (
        <div className="mt-4 rounded-2xl border border-pine/20 bg-mint p-4">
          <p className="text-xs font-black uppercase tracking-normal text-pine/70">
            Preferred institution
          </p>
          <p className="mt-1 text-sm font-black text-ink">
            {primaryBroker?.label ?? getBrokerageLabel(preferredBrokerage)}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-ink/58">
            We will open this option first. Your brokerage login stays between you,
            the institution, and your password manager.
          </p>
        </div>
      ) : null}

      {brokerLinks.length ? (
        <div className="mt-4 grid gap-2">
          {brokerLinks.map((broker) => (
            <a
              key={broker.label}
              href={broker.href}
              target="_blank"
              rel="noreferrer"
              className={`group flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-black text-ink hover:border-pine/35 hover:bg-white hover:shadow-soft ${
                broker.brokerage === preferredBrokerage
                  ? "border-pine/30 bg-white shadow-[0_14px_36px_rgba(7,20,24,0.08)]"
                  : "border-line bg-surface"
              }`}
            >
              <span>
                {broker.brokerage === preferredBrokerage ? "Open in " : ""}
                {broker.label}
              </span>
              <span className="text-xs font-bold text-ink/46 group-hover:text-pine">
                {broker.description}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-amber/35 bg-amber/10 p-4">
          <p className="text-sm font-bold leading-6 text-ink/70">
            Broker handoff links are currently focused on US stocks and ETFs. Crypto
            exchange links can be added later as a separate opt-in workflow.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={copyPlan}
        className="mt-3 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-black text-ink/68 hover:border-pine/35 hover:text-ink hover:shadow-soft"
      >
        {copied ? "Plan copied" : "Copy ticker and trade plan"}
      </button>

      <p className="mt-3 text-xs font-semibold leading-5 text-ink/46">
        Orders, account eligibility, prices, and execution are controlled by your
        brokerage, not SwingFi.
      </p>
    </section>
  );
}
