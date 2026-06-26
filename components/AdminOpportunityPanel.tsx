"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AssetType, OpportunityRow } from "@/lib/database.types";
import type { OpportunityDataSource } from "@/lib/repositories/opportunities";
import { getAdminHeaders } from "@/lib/admin-client";

type OpportunityFormValues = {
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

const emptyForm: OpportunityFormValues = {
  symbol: "",
  asset_type: "stock",
  score: 75,
  confidence: 70,
  risk_score: 40,
  entry_low: 100,
  entry_high: 105,
  target_price: 115,
  stop_loss: 95,
  explanation: "",
};

function rowToForm(row: OpportunityRow): OpportunityFormValues {
  return {
    symbol: row.symbol,
    asset_type: row.asset_type,
    score: row.score,
    confidence: row.confidence,
    risk_score: row.risk_score,
    entry_low: row.entry_low,
    entry_high: row.entry_high,
    target_price: row.target_price,
    stop_loss: row.stop_loss,
    explanation: row.explanation,
  };
}

function inputNumber(value: FormDataEntryValue | null) {
  return Number(value ?? 0);
}

export function AdminOpportunityPanel() {
  const [rows, setRows] = useState<OpportunityRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OpportunityFormValues>(emptyForm);
  const [dataSource, setDataSource] = useState<OpportunityDataSource>("empty");
  const [message, setMessage] = useState("Loading opportunities...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refreshFromServer();
  }, []);

  const editingRow = useMemo(
    () => rows.find((row) => row.id === editingId),
    [editingId, rows],
  );

  async function refreshFromServer() {
    try {
      const response = await fetch("/api/admin/opportunities", {
        headers: getAdminHeaders(),
      });
      const payload = (await response.json()) as {
        error?: string;
        reason?: string;
        rows?: OpportunityRow[];
        source?: OpportunityDataSource;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load opportunities.");
      }

      setRows(payload.rows ?? []);
      setDataSource(payload.source ?? "empty");
      setMessage(
        payload.source === "supabase"
          ? "Editing live Supabase opportunities."
          : `No live opportunity data is available${payload.reason ? `: ${payload.reason}` : "."}`,
      );
    } catch (error) {
      setRows([]);
      setDataSource("empty");
      setMessage(error instanceof Error ? error.message : "Live opportunity data is unavailable.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    const values: OpportunityFormValues = {
      symbol: String(formData.get("symbol") ?? ""),
      asset_type: String(formData.get("asset_type") ?? "stock") as AssetType,
      score: inputNumber(formData.get("score")),
      confidence: inputNumber(formData.get("confidence")),
      risk_score: inputNumber(formData.get("risk_score")),
      entry_low: inputNumber(formData.get("entry_low")),
      entry_high: inputNumber(formData.get("entry_high")),
      target_price: inputNumber(formData.get("target_price")),
      stop_loss: inputNumber(formData.get("stop_loss")),
      explanation: String(formData.get("explanation") ?? ""),
    };

    try {
      const response = await fetch(
        editingId ? `/api/admin/opportunities/${editingId}` : "/api/admin/opportunities",
        {
          method: editingId ? "PUT" : "POST",
          headers: getAdminHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(values),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Opportunity save failed.");
      }

      await refreshFromServer();
      window.dispatchEvent(new Event("swingfi-opportunities-updated"));
      setEditingId(null);
      setForm(emptyForm);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opportunity save failed.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: OpportunityRow) {
    setEditingId(row.id);
    setForm(rowToForm(row));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function removeRow(row: OpportunityRow) {
    try {
      const response = await fetch(`/api/admin/opportunities/${row.id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Opportunity delete failed.");
      }

      await refreshFromServer();
      window.dispatchEvent(new Event("swingfi-opportunities-updated"));
      if (editingId === row.id) {
        cancelEdit();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opportunity delete failed.");
    }
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[420px_1fr]">
      <section className="min-w-0 rounded-lg border border-line bg-panel p-6 shadow-soft">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            {editingRow ? "Edit opportunity" : "Add opportunity"}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-ink">Admin panel</h1>
          <p
            className={`mt-3 rounded-md px-3 py-2 text-sm font-bold ${
              dataSource === "supabase" ? "bg-mint text-pine" : "bg-coral/15 text-ink/70"
            }`}
          >
            {message}
          </p>
        </div>

        <form key={editingId ?? "new"} onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-ink">
            Symbol
            <input
              name="symbol"
              required
              defaultValue={form.symbol}
              placeholder="AAPL"
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium uppercase outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink">
            Asset Type
            <select
              name="asset_type"
              defaultValue={form.asset_type}
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            >
              <option value="stock">US Stock</option>
              <option value="etf">ETF</option>
              <option value="crypto">Crypto</option>
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Score
              <input
                name="score"
                type="number"
                min="0"
                max="100"
                required
                defaultValue={form.score}
                className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Confidence
              <input
                name="confidence"
                type="number"
                min="0"
                max="100"
                required
                defaultValue={form.confidence}
                className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Risk Score
              <input
                name="risk_score"
                type="number"
                min="0"
                max="100"
                required
                defaultValue={form.risk_score}
                className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Entry Low
              <input
                name="entry_low"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={form.entry_low}
                className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Entry High
              <input
                name="entry_high"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={form.entry_high}
                className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Target
              <input
                name="target_price"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={form.target_price}
                className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Stop Loss
              <input
                name="stop_loss"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={form.stop_loss}
                className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-bold text-ink">
            Explanation
            <textarea
              name="explanation"
              required
              rows={5}
              defaultValue={form.explanation}
              placeholder="Why this opportunity is worth reviewing..."
              className="resize-none rounded-md border border-line bg-surface px-4 py-3 font-medium leading-6 outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-pine px-4 py-3 text-sm font-bold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : editingRow ? "Save changes" : "Add opportunity"}
            </button>
            {editingRow ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-md border border-line bg-panel px-4 py-3 text-sm font-bold text-ink transition hover:border-pine"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="min-w-0 rounded-lg border border-line bg-panel p-6 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-pine">
              {dataSource === "supabase" ? "Current live data" : "Live data setup needed"}
            </p>
            <h2 className="mt-3 text-2xl font-bold text-ink">
              {rows.length} opportunities
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              void refreshFromServer();
              cancelEdit();
            }}
            className="rounded-md border border-line bg-surface px-4 py-3 text-sm font-bold text-ink transition hover:border-pine"
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-normal text-ink/55">
                <th className="py-3 pr-4">Symbol</th>
                <th className="py-3 pr-4">Asset</th>
                <th className="py-3 pr-4">Score</th>
                <th className="py-3 pr-4">Confidence</th>
                <th className="py-3 pr-4">Risk</th>
                <th className="py-3 pr-4">Entry Range</th>
                <th className="py-3 pr-4">Target</th>
                <th className="py-3 pr-4">Stop</th>
                <th className="py-3 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => (
                <tr
                  key={row.id}
                  data-testid={`admin-row-${row.symbol}`}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="py-4 pr-4 font-bold text-ink">{row.symbol}</td>
                  <td className="py-4 pr-4 font-semibold capitalize text-ink/70">
                    {row.asset_type}
                  </td>
                  <td className="py-4 pr-4 font-bold text-pine">{row.score}</td>
                  <td className="py-4 pr-4">{row.confidence}</td>
                  <td className="py-4 pr-4">{row.risk_score}</td>
                  <td className="py-4 pr-4">
                    ${row.entry_low.toLocaleString()} - ${row.entry_high.toLocaleString()}
                  </td>
                  <td className="py-4 pr-4 font-semibold text-pine">
                    ${row.target_price.toLocaleString()}
                  </td>
                  <td className="py-4 pr-4 font-semibold text-coral">
                    ${row.stop_loss.toLocaleString()}
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        data-testid={`edit-${row.symbol}`}
                        onClick={() => startEdit(row)}
                        className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-bold text-ink transition hover:border-pine"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-${row.symbol}`}
                        onClick={() => removeRow(row)}
                        className="rounded-md bg-coral/20 px-3 py-2 text-xs font-bold text-ink transition hover:bg-coral/30"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="py-8 pr-4">
                    <div className="rounded-lg border border-line bg-surface p-5">
                      <p className="text-sm font-black uppercase tracking-normal text-pine">
                        No saved opportunities
                      </p>
                      <p className="mt-2 text-sm leading-6 text-ink/60">
                        Run the live ranking agent after Supabase is configured, or add a
                        real opportunity using the form. Seed rows are no longer displayed
                        in the admin table.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
