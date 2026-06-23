"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminHeaders } from "@/lib/admin-client";
import type { OpportunityRow } from "@/lib/database.types";
import { buildBrandedMorningEmail } from "@/lib/email-branding";
import type { OpportunityDataSource } from "@/lib/repositories/opportunities";

type Channel = "email" | "sms";

function currency(value: number) {
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    minimumFractionDigits: value >= 1000 ? 0 : 2,
  })}`;
}

function analysisUrl(symbol: string, customerId: string) {
  const params = new URLSearchParams({ symbol, customerId });
  const trackingId = `${customerId}-${symbol}-${new Date().toISOString().slice(0, 10)}`;

  return `/e/${encodeURIComponent(trackingId)}?${params.toString()}`;
}

function buildSmsTemplate(args: {
  customerId: string;
  customerName: string;
  marketRegime: string;
  opportunities: OpportunityRow[];
}) {
  const top = args.opportunities.slice(0, 3);
  const picks = top
    .map(
      (item, index) =>
        `${index + 1}) ${item.symbol} score ${item.score}, conf ${item.confidence}, risk ${item.risk_score}, entry ${currency(item.entry_low)}-${currency(item.entry_high)}, target ${currency(item.target_price)}, stop ${currency(item.stop_loss)}. ${analysisUrl(item.symbol, args.customerId)}`,
    )
    .join(" | ") || "No live ranked opportunities have been saved yet.";
  const recipient = args.customerName.trim()
    ? ` for ${args.customerName.trim().split(/\s+/)[0]}`
    : "";

  return `TradePilot AI${recipient}: market ${args.marketRegime}. ${picks}. Review risk before trading.`;
}

export function AdminCommunicationsPanel() {
  const [channel, setChannel] = useState<Channel>("email");
  const [confirmed, setConfirmed] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [subject, setSubject] = useState("TradePilot AI morning picks are ready");
  const [intro, setIntro] = useState(
    "Your daily stock analysis is ready before the market opens.",
  );
  const [signoff, setSignoff] = useState(
    "Review risk, position size, and your own plan before trading.",
  );
  const [marketRegime, setMarketRegime] = useState("balanced");
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [status, setStatus] = useState("Ready to preview");
  const [emailConfig, setEmailConfig] = useState({
    emailFrom: "",
    emailProvider: "resend",
    emailReady: false,
    emailReason: "Loading email status...",
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function loadOpportunities() {
      try {
        const response = await fetch("/api/opportunities");
        const payload = (await response.json()) as {
          reason?: string;
          rows?: OpportunityRow[];
          source?: OpportunityDataSource;
        };

        if (!response.ok || !payload.rows?.length) {
          throw new Error(payload.reason ?? "No ranked opportunities are available.");
        }

        setOpportunities(payload.rows.slice(0, 30));
        setStatus(
          payload.source === "supabase"
            ? "Previewing latest saved opportunity data."
            : `No live opportunity data is available${payload.reason ? `: ${payload.reason}` : "."}`,
        );
      } catch (error) {
        setOpportunities([]);
        setStatus(
          error instanceof Error
            ? `No live opportunity data is available: ${error.message}`
            : "No live opportunity data is available.",
        );
      }
    }

    async function loadEmailStatus() {
      try {
        const response = await fetch("/api/admin/status");
        const payload = (await response.json()) as {
          emailFrom?: string;
          emailProvider?: string;
          emailReady?: boolean;
          emailReason?: string | null;
        };

        setEmailConfig({
          emailFrom: payload.emailFrom ?? "",
          emailProvider: payload.emailProvider ?? "resend",
          emailReady: Boolean(payload.emailReady),
          emailReason: payload.emailReason ?? "",
        });
      } catch {
        setEmailConfig((current) => ({
          ...current,
          emailReady: false,
          emailReason: "Could not load email status.",
        }));
      }
    }

    void loadOpportunities();
    void loadEmailStatus();
  }, []);

  const customerId = "admin-preview";
  const emailTemplate = useMemo(
    () =>
      buildBrandedMorningEmail({
        analysisUrl: (symbol) => analysisUrl(symbol, customerId),
        customerName,
        intro,
        marketRegime,
        opportunities,
        signoff,
        subject,
      }),
    [customerName, customerId, intro, marketRegime, opportunities, signoff, subject],
  );
  const smsTemplate = useMemo(
    () =>
      buildSmsTemplate({
        customerId,
        customerName,
        marketRegime,
        opportunities,
      }),
    [customerName, marketRegime, opportunities],
  );
  const smsSegments = Math.max(1, Math.ceil(smsTemplate.length / 160));
  const topSymbols = opportunities.slice(0, 5).map((item) => item.symbol);

  async function sendTest() {
    setSending(true);
    setStatus("Sending test...");

    try {
      const response = await fetch("/api/admin/communications/test", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(
          channel === "email"
            ? {
                channel,
                email: testEmail,
                subject,
                text: emailTemplate.text,
                html: emailTemplate.html,
              }
            : {
                channel,
                phone: testPhone,
                sms: smsTemplate,
              },
        ),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        delivery?: { mode?: string; status?: string };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Test send failed");
      }

      setStatus(
        `Test ${channel} ${payload.delivery?.status ?? "queued"} via ${payload.delivery?.mode ?? "provider"}.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Test send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="premium-panel mb-6 rounded-xl p-6">
      <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            Communications studio
          </p>
          <h2 className="mt-3 text-3xl font-black text-ink">Preview and approve alerts</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">
            Design the morning email and SMS templates, inspect exactly what customers
            will see, then send a test before enabling scheduled delivery.
          </p>
        </div>
        <div className="rounded-lg bg-surface px-3 py-2 text-sm font-bold text-ink/70">
          Top symbols: {topSymbols.join(", ") || "None"}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="grid gap-4 rounded-xl border border-line bg-panel p-4">
          <div className="grid grid-cols-2 rounded-lg bg-surface p-1 text-sm font-bold">
            <button
              type="button"
              onClick={() => setChannel("email")}
              className={`rounded-md px-3 py-2 ${channel === "email" ? "bg-ink text-white" : "text-ink/65"}`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setChannel("sms")}
              className={`rounded-md px-3 py-2 ${channel === "sms" ? "bg-ink text-white" : "text-ink/65"}`}
            >
              SMS
            </button>
          </div>

          <label className="grid gap-2 text-sm font-bold text-ink">
            Greeting name
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Optional, uses first name only"
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none focus:border-pine focus:bg-panel"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink">
            Market regime label
            <select
              value={marketRegime}
              onChange={(event) => setMarketRegime(event.target.value)}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none focus:border-pine focus:bg-panel"
            >
              <option value="risk-on">risk-on</option>
              <option value="balanced">balanced</option>
              <option value="defensive">defensive</option>
            </select>
          </label>

          {channel === "email" ? (
            <>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Test email
                <input
                  type="email"
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                  className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none focus:border-pine focus:bg-panel"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Subject
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none focus:border-pine focus:bg-panel"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Intro copy
                <textarea
                  rows={3}
                  value={intro}
                  onChange={(event) => setIntro(event.target.value)}
                  className="resize-none rounded-md border border-line bg-surface px-4 py-3 font-medium leading-6 outline-none focus:border-pine focus:bg-panel"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-ink">
                Risk signoff
                <textarea
                  rows={3}
                  value={signoff}
                  onChange={(event) => setSignoff(event.target.value)}
                  className="resize-none rounded-md border border-line bg-surface px-4 py-3 font-medium leading-6 outline-none focus:border-pine focus:bg-panel"
                />
              </label>
            </>
          ) : (
            <label className="grid gap-2 text-sm font-bold text-ink">
              Test phone
              <input
                type="tel"
                value={testPhone}
                onChange={(event) => setTestPhone(event.target.value)}
                placeholder="+15551234567"
                className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none focus:border-pine focus:bg-panel"
              />
            </label>
          )}

          <label className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3 text-sm font-semibold leading-6 text-ink/70">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            I reviewed the preview and understand this is a test send only.
          </label>

          <button
            type="button"
            disabled={
              sending ||
              !confirmed ||
              (channel === "email" ? !testEmail : !testPhone)
            }
            onClick={() => void sendTest()}
            className="rounded-lg bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending..." : `Send test ${channel}`}
          </button>

          <p className="rounded-md bg-surface px-3 py-2 text-sm font-bold text-ink/70">
            {status}
          </p>
          <div
            className={`rounded-md px-3 py-2 text-sm font-bold ${
              emailConfig.emailReady ? "bg-mint text-pine" : "bg-coral/15 text-ink/70"
            }`}
          >
            Email: {emailConfig.emailReady ? "Ready" : emailConfig.emailReason || "Missing"}
            {emailConfig.emailFrom ? ` from ${emailConfig.emailFrom}` : ""}
          </div>
        </div>

        <div className="grid min-w-0 gap-4">
          {channel === "email" ? (
            <>
              <div className="rounded-xl border border-line bg-panel p-4 shadow-soft">
                <p className="text-xs font-black uppercase tracking-normal text-ink/55">
                  Email subject
                </p>
                <p className="mt-2 text-lg font-bold text-ink">{subject}</p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-xl border border-line bg-white shadow-soft">
                <div
                  className="max-h-[640px] overflow-auto p-5"
                  dangerouslySetInnerHTML={{ __html: emailTemplate.html }}
                />
              </div>
              <div className="rounded-xl border border-line bg-panel p-4">
                <p className="text-xs font-black uppercase tracking-normal text-ink/55">
                  Plain text fallback
                </p>
                <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/70">
                  {emailTemplate.text}
                </pre>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-line bg-panel p-5 shadow-soft">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-normal text-ink/55">
                    SMS preview
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-ink">Morning text alert</h3>
                </div>
                <div className="rounded-lg bg-surface px-3 py-2 text-sm font-bold text-ink/70">
                  {smsTemplate.length} chars / {smsSegments} segment{smsSegments === 1 ? "" : "s"}
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-ink p-4 text-white shadow-[0_18px_44px_rgba(7,20,24,0.18)]">
                <p className="whitespace-pre-wrap text-sm leading-6">{smsTemplate}</p>
              </div>
              {smsSegments > 3 ? (
                <p className="mt-4 rounded-md bg-coral/20 px-3 py-2 text-sm font-bold text-ink">
                  This SMS is long. Consider email-first for full trade details and keep SMS
                  to a short link alert.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
