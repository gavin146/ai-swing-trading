"use client";

import type { AssetType, OpportunityRow } from "./database.types";
import { mockOpportunities } from "./mock-data";
import { opportunityFromRow } from "./opportunities";

const storageKey = "swingfi-opportunities";
const storageVersionKey = "swingfi-opportunities-version";
const legacyStorageKey = "tradepilot-opportunities";
const legacyStorageVersionKey = "tradepilot-opportunities-version";
const currentStorageVersion = "agent-ranking-v1";

function readStorageValue(key: string, legacyKey: string) {
  const current = window.localStorage.getItem(key);
  if (current) return current;

  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy) {
    window.localStorage.setItem(key, legacy);
    window.localStorage.removeItem(legacyKey);
  }

  return legacy;
}

export type OpportunityFormValues = {
  symbol: string;
  asset_type: AssetType;
  score: number;
  confidence: number;
  risk_score: number;
  entry_low: number;
  entry_high: number;
  target_price: number;
  stop_loss: number;
  explanation: string;
};

export function getStoredOpportunityRows(): OpportunityRow[] {
  if (typeof window === "undefined") {
    return mockOpportunities;
  }

  const stored = readStorageValue(storageKey, legacyStorageKey);
  const storedVersion = readStorageValue(storageVersionKey, legacyStorageVersionKey);

  if (!stored || storedVersion !== currentStorageVersion) {
    window.localStorage.setItem(storageKey, JSON.stringify(mockOpportunities));
    window.localStorage.setItem(storageVersionKey, currentStorageVersion);
    return mockOpportunities;
  }

  try {
    const parsed = JSON.parse(stored) as OpportunityRow[];
    return parsed.sort((a, b) => b.score - a.score);
  } catch {
    window.localStorage.setItem(storageKey, JSON.stringify(mockOpportunities));
    window.localStorage.setItem(storageVersionKey, currentStorageVersion);
    return mockOpportunities;
  }
}

export function setStoredOpportunityRows(rows: OpportunityRow[]) {
  const sortedRows = [...rows].sort((a, b) => b.score - a.score);
  window.localStorage.setItem(storageKey, JSON.stringify(sortedRows));
  window.localStorage.setItem(storageVersionKey, currentStorageVersion);
  window.dispatchEvent(new Event("swingfi-opportunities-updated"));
  return sortedRows;
}

export function getStoredOpportunities() {
  return getStoredOpportunityRows().map(opportunityFromRow);
}

export function upsertOpportunity(values: OpportunityFormValues, id?: string) {
  const rows = getStoredOpportunityRows();
  const now = new Date().toISOString();
  const existing = id ? rows.find((row) => row.id === id) : undefined;
  const expectedGain = ((values.target_price - values.entry_low) / values.entry_low) * 100;
  const expectedLoss = ((values.entry_low - values.stop_loss) / values.entry_low) * 100;
  const nextRow: OpportunityRow = {
    id: existing?.id ?? crypto.randomUUID(),
    symbol: values.symbol.trim().toUpperCase(),
    asset_type: values.asset_type,
    score: values.score,
    confidence: values.confidence,
    risk_score: values.risk_score,
    entry_low: values.entry_low,
    entry_high: values.entry_high,
    target_price: values.target_price,
    stop_loss: values.stop_loss,
    expected_gain: Number(expectedGain.toFixed(1)),
    expected_loss: Number(Math.max(expectedLoss, 0).toFixed(1)),
    holding_period_days: existing?.holding_period_days ?? 14,
    explanation: values.explanation.trim(),
    created_at: existing?.created_at ?? now,
  };

  const nextRows = existing
    ? rows.map((row) => (row.id === existing.id ? nextRow : row))
    : [nextRow, ...rows];

  return setStoredOpportunityRows(nextRows);
}

export function deleteStoredOpportunity(id: string) {
  return setStoredOpportunityRows(
    getStoredOpportunityRows().filter((row) => row.id !== id),
  );
}

export function resetStoredOpportunities() {
  return setStoredOpportunityRows(mockOpportunities);
}
