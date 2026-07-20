"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ToastNotice } from "@/components/ToastNotice";
import { formatCopilotMoney } from "@/lib/copilot/formatting";
import type { CopilotUiViewModel, CopilotSeverity } from "@/lib/copilot/ui-view-model";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type CopilotPanelProps = {
  fixtureMode?: boolean;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; payload: CopilotUiViewModel }
  | { status: "signin"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

function formatMoney(value: number | null | undefined) {
  return formatCopilotMoney(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function severityCopy(severity: CopilotSeverity) {
  if (severity === "high") {
    return {
      label: "Review first",
      style: "border-coral/35 bg-coral/[0.08] text-coral",
    };
  }

  if (severity === "attention") {
    return {
      label: "Needs attention",
      style: "border-amber/45 bg-amber/[0.16] text-ink",
    };
  }

  return {
    label: "For awareness",
    style: "border-pine/20 bg-mint/70 text-pine",
  };
}

function freshnessCopy(status: string) {
  if (status === "fresh") return "Fresh";
  if (status === "stale") return "Stale";
  if (status === "error") return "Error";
  return "Missing";
}

function sourceCopy(source: string) {
  return source.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactNarrative(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 7);
}

function CopilotSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="premium-panel rounded-3xl p-5 sm:p-7">
        <div className="skeleton h-4 w-36 rounded-full" />
        <div className="skeleton mt-5 h-10 w-72 max-w-full rounded-2xl" />
        <div className="skeleton mt-4 h-20 rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-3xl border border-line bg-white p-5">
            <div className="skeleton h-4 w-24 rounded-full" />
            <div className="skeleton mt-4 h-8 w-32 rounded-xl" />
            <div className="skeleton mt-4 h-16 rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="premium-panel rounded-3xl p-6 sm:p-8" aria-labelledby="copilot-empty-title">
      <p className="text-xs font-black uppercase tracking-normal text-pine">No tracked positions yet</p>
      <h2 id="copilot-empty-title" className="mt-3 text-2xl font-black text-ink sm:text-3xl">
        Track a SwingFi plan to unlock Copilot reviews
      </h2>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ink/62">
        Copilot compares positions you saved in SwingFi against their original entry,
        target, stop, holding window, and data freshness. Add a tracked trade from the
        portfolio page when you want SwingFi to monitor the plan.
      </p>
      <Link
        href="/portfolio"
        className="mt-6 inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] transition hover:bg-pine focus:outline-none focus:ring-4 focus:ring-pine/20"
      >
        Open portfolio tracker
      </Link>
    </section>
  );
}

function SignInState({ message }: { message: string }) {
  return (
    <section className="premium-panel rounded-3xl p-6 sm:p-8" aria-labelledby="copilot-signin-title">
      <p className="text-xs font-black uppercase tracking-normal text-pine">Login required</p>
      <h2 id="copilot-signin-title" className="mt-3 text-2xl font-black text-ink sm:text-3xl">
        Sign in to open your portfolio research copilot
      </h2>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ink/62">
        {message}
      </p>
      <Link
        href="/login?next=/copilot"
        className="mt-6 inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] transition hover:bg-pine focus:outline-none focus:ring-4 focus:ring-pine/20"
      >
        Sign in to continue
      </Link>
    </section>
  );
}

function UnavailableState({ message }: { message: string }) {
  return (
    <section className="premium-panel rounded-3xl p-6 sm:p-8" aria-labelledby="copilot-unavailable-title">
      <p className="text-xs font-black uppercase tracking-normal text-pine">Preview unavailable</p>
      <h2 id="copilot-unavailable-title" className="mt-3 text-2xl font-black text-ink sm:text-3xl">
        Copilot is in a private owner preview
      </h2>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ink/62">
        {message}
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] transition hover:bg-pine focus:outline-none focus:ring-4 focus:ring-pine/20"
      >
        Return to dashboard
      </Link>
    </section>
  );
}

function FindingsList({
  emptyLabel,
  findings,
  title,
}: {
  emptyLabel: string;
  findings: CopilotUiViewModel["findings"];
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_16px_46px_rgba(7,20,24,0.055)] sm:p-5">
      <h2 className="text-lg font-black text-ink">{title}</h2>
      <div className="mt-4 grid gap-3">
        {findings.length ? (
          findings.map((finding) => {
            const tone = severityCopy(finding.severity);

            return (
              <article
                key={finding.id}
                className="rounded-2xl border border-line/80 bg-surface/70 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${tone.style}`}>
                    {tone.label}
                  </span>
                  {finding.symbol ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-ink ring-1 ring-line/80">
                      {finding.symbol}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-base font-black text-ink">{finding.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/64">
                  {finding.message}
                </p>
                {finding.evidence.length ? (
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    {finding.evidence.slice(0, 4).map((item, index) => (
                      <div key={`${finding.id}-${item.metric}-${index}`} className="rounded-xl bg-white p-3 ring-1 ring-line/70">
                        <dt className="text-[11px] font-black uppercase tracking-normal text-ink/42">
                          {item.metric.replace(/_/g, " ")}
                        </dt>
                        <dd className="mt-1 text-sm font-black text-ink">{String(item.value ?? "Unknown")}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </article>
            );
          })
        ) : (
          <p className="rounded-2xl bg-surface p-4 text-sm font-semibold leading-6 text-ink/62">
            {emptyLabel}
          </p>
        )}
      </div>
    </section>
  );
}

function PositionCards({ positions }: { positions: CopilotUiViewModel["positions"] }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_16px_46px_rgba(7,20,24,0.055)] sm:p-5" aria-labelledby="copilot-positions-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-pine">Tracked plans</p>
          <h2 id="copilot-positions-title" className="mt-1 text-xl font-black text-ink">
            Positions Copilot reviewed
          </h2>
        </div>
        <p className="text-sm font-semibold text-ink/58">
          Source labels show whether each row used a fresh, stale, or missing quote.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        {positions.map((position) => (
          <article key={position.id} className="rounded-2xl border border-line/80 bg-surface/65 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-2xl font-black text-ink">{position.symbol}</p>
                <p className="mt-1 text-sm font-bold text-ink/62">{position.planStatus}</p>
              </div>
              <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-ink ring-1 ring-line/80">
                {freshnessCopy(position.freshness)} data
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[
                ["Current", formatMoney(position.currentPrice)],
                ["Entry", formatMoney(position.entryPrice)],
                ["Target", formatMoney(position.targetPrice)],
                ["Stop", formatMoney(position.stopLoss)],
                ["Days held", position.daysHeld ?? "Unknown"],
                ["Window left", position.remainingWindowDays ?? "Unknown"],
                ["Plan source", sourceCopy(position.source)],
                ["Data as of", formatDate(position.dataAsOf)],
              ].map(([label, value]) => (
                <div key={`${position.symbol}-${label}`} className="rounded-xl bg-white p-3 ring-1 ring-line/70">
                  <dt className="text-[11px] font-black uppercase tracking-normal text-ink/42">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-black text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResearchOpportunities({ opportunities }: { opportunities: CopilotUiViewModel["researchOpportunities"] }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_16px_46px_rgba(7,20,24,0.055)] sm:p-5">
      <h2 className="text-lg font-black text-ink">Research opportunities to review</h2>
      <div className="mt-4 grid gap-3">
        {opportunities.length ? (
          opportunities.map((item) => (
            <Link
              key={item.symbol}
              href={`/opportunities/${encodeURIComponent(item.symbol)}`}
              className="rounded-2xl border border-line/80 bg-surface/70 p-4 transition hover:border-pine hover:bg-mint/40 focus:outline-none focus:ring-4 focus:ring-pine/20"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-ink">{item.symbol}</p>
                  <p className="mt-1 text-sm font-bold text-ink/58">
                    Score {item.score ?? "unknown"} · Confidence {item.confidence ?? "unknown"}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-pine ring-1 ring-pine/15">
                  Review plan
                </span>
              </div>
              {item.summary ? (
                <p className="mt-3 text-sm font-semibold leading-6 text-ink/62">{item.summary}</p>
              ) : null}
            </Link>
          ))
        ) : (
          <p className="rounded-2xl bg-surface p-4 text-sm font-semibold leading-6 text-ink/62">
            No ranked research ideas were supplied to this Copilot preview.
          </p>
        )}
      </div>
    </section>
  );
}

function DataHealth({ items }: { items: CopilotUiViewModel["dataHealth"] }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_16px_46px_rgba(7,20,24,0.055)] sm:p-5">
      <h2 className="text-lg font-black text-ink">Data health</h2>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={item.source} className="rounded-2xl bg-surface p-4 ring-1 ring-line/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-black text-ink">{item.label ?? sourceCopy(item.source)}</p>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-ink ring-1 ring-line/80">
                {freshnessCopy(item.status)}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/62">
              Data as of {formatDate(item.dataAsOf)}.
            </p>
            {item.message ? (
              <p className="mt-2 text-xs font-bold leading-5 text-ink/48">{item.message}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function CopilotContent({ payload }: { payload: CopilotUiViewModel }) {
  const attention = useMemo(
    () => payload.findings.filter((finding) => finding.severity === "high" || finding.severity === "attention"),
    [payload.findings],
  );
  const insidePlan = useMemo(
    () => payload.findings.filter((finding) => finding.type === "INSIDE_ORIGINAL_PLAN"),
    [payload.findings],
  );
  const changed = useMemo(
    () =>
      payload.findings.filter((finding) =>
        [
          "DATA_STALE",
          "QUOTE_UNAVAILABLE",
          "TREND_WEAKENING",
          "MOMENTUM_IMPROVING",
          "EARNINGS_OR_EVENT_RISK",
          "FILING_OR_HEADLINE_RISK",
        ].includes(finding.type),
      ),
    [payload.findings],
  );
  const narrativeLines = compactNarrative(payload.narrative);

  if (payload.empty) return <EmptyState />;

  return (
    <div className="grid gap-4">
      {payload.mode === "fixture" ? (
        <ToastNotice tone="warning" title="Demo fixture">
          This Copilot view is using deterministic demo data because live manual portfolio data is not connected in this environment.
        </ToastNotice>
      ) : null}

      {payload.warnings.length ? (
        <ToastNotice tone="warning" title="Data note">
          {payload.warnings[0]}
        </ToastNotice>
      ) : null}

      <section className="premium-panel overflow-hidden rounded-3xl p-5 sm:p-7" aria-labelledby="copilot-overview-title">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-pine">
              {payload.sourceLabel}
            </p>
            <h2 id="copilot-overview-title" className="mt-2 text-2xl font-black leading-tight text-ink sm:text-4xl">
              Your portfolio research copilot
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-ink/64">
              Copilot reviews the SwingFi plans you chose to track, highlights what
              needs attention first, and explains data gaps before you rely on the report.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-line/80">
              <dt className="text-[11px] font-black uppercase tracking-normal text-ink/42">Positions</dt>
              <dd className="mt-1 text-2xl font-black text-ink">{payload.positions.length}</dd>
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-line/80">
              <dt className="text-[11px] font-black uppercase tracking-normal text-ink/42">Attention</dt>
              <dd className="mt-1 text-2xl font-black text-ink">{attention.length}</dd>
            </div>
            <div className="col-span-2 rounded-2xl bg-white p-4 ring-1 ring-line/80">
              <dt className="text-[11px] font-black uppercase tracking-normal text-ink/42">Data as of</dt>
              <dd className="mt-1 text-sm font-black text-ink">{formatDate(payload.report.portfolioDataAsOf)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <FindingsList
          emptyLabel="No urgent findings were produced from the supplied portfolio evidence."
          findings={attention}
          title="Needs attention"
        />
        <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_16px_46px_rgba(7,20,24,0.055)] sm:p-5">
          <h2 className="text-lg font-black text-ink">Daily summary preview</h2>
          <div className="mt-4 grid gap-3">
            {narrativeLines.map((line, index) => (
              <p key={`${index}-${line.slice(0, 18)}`} className="rounded-2xl bg-surface p-3 text-sm font-semibold leading-6 text-ink/64">
                {line.replace(/^[-•]\s*/, "")}
              </p>
            ))}
          </div>
        </section>
      </div>

      <PositionCards positions={payload.positions} />

      <div className="grid gap-4 xl:grid-cols-2">
        <FindingsList
          emptyLabel="No changed-data findings were supplied. Review data health before relying on this status."
          findings={changed}
          title="What changed"
        />
        <FindingsList
          emptyLabel="No positions were confirmed as comfortably inside their saved plan from supplied evidence."
          findings={insidePlan}
          title="Still inside plan"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <DataHealth items={payload.dataHealth} />
        <ResearchOpportunities opportunities={payload.researchOpportunities} />
      </div>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_16px_46px_rgba(7,20,24,0.055)]">
        <p className="text-xs font-black uppercase tracking-normal text-pine">Future connection</p>
        <h2 className="mt-2 text-lg font-black text-ink">{payload.brokeragePlaceholder.title}</h2>
        <p className="mt-2 text-sm font-semibold leading-7 text-ink/62">
          {payload.brokeragePlaceholder.body}
        </p>
      </section>
    </div>
  );
}

export function CopilotPanel({ fixtureMode = false }: CopilotPanelProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (fixtureMode) {
        const response = await fetch("/api/copilot/report", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as CopilotUiViewModel & { error?: string };

        if (!mounted) return;
        if (!response.ok || payload.error) {
          setState({ message: payload.error ?? "Copilot demo could not load.", status: "error" });
          return;
        }
        setState({ payload, status: "ready" });
        return;
      }

      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setState({
          message: "SwingFi login is not configured in this browser session.",
          status: "signin",
        });
        return;
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setState({
          message: "Copilot uses your saved SwingFi tracker data, so it opens after login.",
          status: "signin",
        });
        return;
      }

      const response = await fetch("/api/copilot/report", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as CopilotUiViewModel & { error?: string };

      if (!mounted) return;
      if (response.status === 401) {
        setState({ message: payload.error ?? "Sign in again to open Copilot.", status: "signin" });
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setState({
          message: payload.error ?? "Copilot preview is not available for this account yet.",
          status: "unavailable",
        });
        return;
      }
      if (!response.ok || payload.error) {
        setState({ message: payload.error ?? "Copilot could not load right now.", status: "error" });
        return;
      }

      setState({ payload, status: "ready" });
    }

    load().catch((error) => {
      if (!mounted) return;
      setState({
        message: error instanceof Error ? error.message : "Copilot could not load right now.",
        status: "error",
      });
    });

    return () => {
      mounted = false;
    };
  }, [fixtureMode]);

  if (state.status === "loading") return <CopilotSkeleton />;
  if (state.status === "signin") return <SignInState message={state.message} />;
  if (state.status === "unavailable") return <UnavailableState message={state.message} />;
  if (state.status === "error") {
    return (
      <ToastNotice tone="error" title="Copilot unavailable">
        {state.message}
      </ToastNotice>
    );
  }

  return <CopilotContent payload={state.payload} />;
}
