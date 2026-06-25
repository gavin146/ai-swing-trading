import { NextRequest, NextResponse } from "next/server";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ActivityStatus = "good" | "warn" | "bad" | "neutral";
type ActivityType = "agent" | "email" | "click" | "backtest" | "error";

type ActivityItem = {
  description: string;
  id: string;
  meta?: string;
  status: ActivityStatus;
  timestamp: string;
  title: string;
  type: ActivityType;
};

type SourceRow = Record<string, unknown>;

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function latestTimestamp(row: SourceRow, ...keys: string[]) {
  return keys.map((key) => asString(row[key])).find(Boolean) ?? new Date(0).toISOString();
}

function formatPct(value: unknown) {
  return `${Math.round(asNumber(value))}%`;
}

function agentStatus(row: SourceRow): ActivityStatus {
  const status = asString(row.status).toLowerCase();

  if (status === "completed") return "good";
  if (status === "failed") return "bad";
  if (status === "running" || status === "queued") return "warn";
  return "neutral";
}

function emailStatus(row: SourceRow): ActivityStatus {
  const status = asString(row.status).toLowerCase();

  if (status === "sent" || status === "queued") return "good";
  if (status === "failed") return "bad";
  return "warn";
}

function safeId(prefix: string, row: SourceRow, timestamp: string, index: number) {
  return `${prefix}-${asString(row.id, `${timestamp}-${index}`)}`;
}

export async function GET(request: NextRequest) {
  if (!isAdminApiRequest(request)) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({
      items: [],
      reason: "Supabase service role is not configured.",
      source: "empty",
    });
  }

  const [agentRuns, alertLogs, linkEvents, backtestRuns, appEvents] = await Promise.all([
    supabase
      .from("agent_runs")
      .select("id,status,source,universe_count,selected_count,market_regime,summary,error_message,started_at,completed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("alert_logs")
      .select("id,channel,status,recipient,error_message,sent_at,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("email_link_events")
      .select("id,symbol,source,clicked_at,created_at")
      .order("clicked_at", { ascending: false })
      .limit(8),
    supabase
      .from("backtest_runs")
      .select("id,generated_at,trades_tested,target_hit_rate,stop_hit_rate,average_return_pct,learning_summary,created_at")
      .order("generated_at", { ascending: false })
      .limit(8),
    supabase
      .from("app_event_logs")
      .select("id,level,source,message,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const items: ActivityItem[] = [];

  if (agentRuns.error) {
    items.push({
      description: agentRuns.error.message,
      id: "agent-query-error",
      status: "bad",
      timestamp: new Date().toISOString(),
      title: "Agent run log failed to load",
      type: "error",
    });
  } else {
    (agentRuns.data ?? []).forEach((row: SourceRow, index: number) => {
      const timestamp = latestTimestamp(row, "completed_at", "started_at", "created_at");
      const selected = asNumber(row.selected_count);
      const universe = asNumber(row.universe_count);
      const status = asString(row.status, "recorded");

      items.push({
        description:
          asString(row.error_message) ||
          asString(row.summary) ||
          `${selected} picks selected from ${universe} candidates.`,
        id: safeId("agent", row, timestamp, index),
        meta: `${asString(row.source, "agent")} · ${asString(row.market_regime, "market regime pending")}`,
        status: agentStatus(row),
        timestamp,
        title: `Agent ${status}`,
        type: "agent",
      });
    });
  }

  if (alertLogs.error) {
    items.push({
      description: alertLogs.error.message,
      id: "alert-query-error",
      status: "bad",
      timestamp: new Date().toISOString(),
      title: "Email and SMS log failed to load",
      type: "error",
    });
  } else {
    (alertLogs.data ?? []).forEach((row: SourceRow, index: number) => {
      const timestamp = latestTimestamp(row, "sent_at", "created_at");
      const channel = asString(row.channel, "alert");
      const status = asString(row.status, "recorded");

      items.push({
        description: asString(row.error_message) || `Morning ${channel} ${status}.`,
        id: safeId("alert", row, timestamp, index),
        meta: asString(row.recipient, "recipient saved"),
        status: emailStatus(row),
        timestamp,
        title: `${channel.toUpperCase()} ${status}`,
        type: "email",
      });
    });
  }

  if (linkEvents.error) {
    items.push({
      description: linkEvents.error.message,
      id: "click-query-error",
      status: "bad",
      timestamp: new Date().toISOString(),
      title: "Customer click log failed to load",
      type: "error",
    });
  } else {
    (linkEvents.data ?? []).forEach((row: SourceRow, index: number) => {
      const timestamp = latestTimestamp(row, "clicked_at", "created_at");
      const symbol = asString(row.symbol, "dashboard");

      items.push({
        description: `A customer opened the ${symbol} analysis link.`,
        id: safeId("click", row, timestamp, index),
        meta: asString(row.source, "morning_email"),
        status: "good",
        timestamp,
        title: `${symbol} link clicked`,
        type: "click",
      });
    });
  }

  if (backtestRuns.error) {
    items.push({
      description: backtestRuns.error.message,
      id: "backtest-query-error",
      status: "bad",
      timestamp: new Date().toISOString(),
      title: "Backtest log failed to load",
      type: "error",
    });
  } else {
    (backtestRuns.data ?? []).forEach((row: SourceRow, index: number) => {
      const timestamp = latestTimestamp(row, "generated_at", "created_at");
      const targetRate = formatPct(row.target_hit_rate);
      const stopRate = formatPct(row.stop_hit_rate);

      items.push({
        description:
          asString(row.learning_summary) ||
          `${asNumber(row.trades_tested)} trades tested. Target hit ${targetRate}; stop hit ${stopRate}.`,
        id: safeId("backtest", row, timestamp, index),
        meta: `${asNumber(row.trades_tested)} trades · ${formatPct(row.average_return_pct)} avg return`,
        status: asNumber(row.target_hit_rate) >= asNumber(row.stop_hit_rate) ? "good" : "warn",
        timestamp,
        title: "Backtest feedback updated",
        type: "backtest",
      });
    });
  }

  if (appEvents.error) {
    items.push({
      description: appEvents.error.message,
      id: "app-event-query-error",
      status: "bad",
      timestamp: new Date().toISOString(),
      title: "System event log failed to load",
      type: "error",
    });
  } else {
    (appEvents.data ?? []).forEach((row: SourceRow, index: number) => {
      const timestamp = latestTimestamp(row, "created_at");
      const level = asString(row.level, "info");

      items.push({
        description: asString(row.message, "System event recorded."),
        id: safeId("event", row, timestamp, index),
        meta: asString(row.source, "system"),
        status: level === "error" ? "bad" : level === "warning" ? "warn" : "neutral",
        timestamp,
        title: `${level.toUpperCase()} event`,
        type: level === "error" ? "error" : "agent",
      });
    });
  }

  return NextResponse.json({
    items: items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 24),
    source: "supabase",
  });
}
