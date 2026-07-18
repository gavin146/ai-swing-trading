import type { DataFreshness, PortfolioSnapshot } from "./types";

const statusRank: Record<DataFreshness["status"], number> = {
  error: 0,
  missing: 1,
  stale: 2,
  fresh: 3,
};

function sourceLabel(source: string) {
  if (source === "fmp_profile" || source === "fmp_quotes") return "FMP prices";
  if (source === "manual_tracker" || source === "manual_trade_history") return "SwingFi tracker";
  if (source === "fixture_quote") return "Fixture quotes";
  return source.replace(/_/g, " ");
}

export type PortfolioSourceFreshness = DataFreshness & {
  label: string;
};

export class DataFreshnessService {
  fromPortfolioSnapshot(snapshot: PortfolioSnapshot): PortfolioSourceFreshness[] {
    const sources = new Map<string, PortfolioSourceFreshness>();

    snapshot.positions.forEach((position) => {
      const source = position.quote?.source ?? "manual_tracker";
      const status = position.quote?.status ?? "missing";
      const existing = sources.get(source);
      const nextStatus =
        !existing || statusRank[status] < statusRank[existing.status]
          ? status
          : existing.status;

      sources.set(source, {
        dataAsOf: position.quote?.dataAsOf ?? position.dataAsOf,
        fetchedAt: position.quote?.fetchedAt ?? position.fetchedAt,
        label: sourceLabel(source),
        message: position.quote?.message,
        source,
        status: nextStatus,
      });
    });

    if (!sources.size) {
      sources.set("manual_tracker", {
        dataAsOf: snapshot.dataAsOf,
        fetchedAt: snapshot.fetchedAt,
        label: sourceLabel("manual_tracker"),
        message: "No tracked positions were found for this report.",
        source: "manual_tracker",
        status: "missing",
      });
    }

    return Array.from(sources.values()).sort((a, b) => a.source.localeCompare(b.source));
  }
}

