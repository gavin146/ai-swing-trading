"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getAdminHeaders } from "@/lib/admin-client";
import {
  getAdminAccessRecords,
  getCurrentCustomer,
  grantAdminAccess,
  revokeAdminAccess,
  TRADEPILOT_ADMIN_EMAIL,
  type AdminAccessRecord,
} from "@/lib/customer-store";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminAccessPanel() {
  const [records, setRecords] = useState<AdminAccessRecord[]>([]);
  const [message, setMessage] = useState("Add an email before that person creates an account.");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function refreshRecords() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/access", {
        headers: getAdminHeaders(),
      });
      const payload = (await response.json()) as {
        error?: string;
        records?: AdminAccessRecord[];
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Admin access could not be loaded.");
      }

      setRecords(payload.records ?? []);
    } catch {
      setRecords(getAdminAccessRecords());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshRecords();
    const refresh = () => void refreshRecords();
    window.addEventListener("tradepilot-customer-updated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("tradepilot-admin-token-updated", refresh);

    return () => {
      window.removeEventListener("tradepilot-customer-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("tradepilot-admin-token-updated", refresh);
    };
  }, []);

  async function handleGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");

    try {
      const current = getCurrentCustomer();
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          createdByEmail: current?.email,
          email,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        records?: AdminAccessRecord[];
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Admin access could not be updated.");
      }

      setRecords(payload.records ?? grantAdminAccess(email));
      setMessage(`${email.trim().toLowerCase()} can now create an admin account.`);
      event.currentTarget.reset();
    } catch (caught) {
      try {
        setRecords(grantAdminAccess(email));
        setMessage(`${email.trim().toLowerCase()} can now create an admin account locally.`);
      } catch (fallbackError) {
        setError(
          fallbackError instanceof Error
            ? fallbackError.message
            : caught instanceof Error
              ? caught.message
              : "Admin access could not be updated.",
        );
      }
    }
  }

  async function handleRevoke(email: string) {
    setError("");

    try {
      const response = await fetch(`/api/admin/access?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      const payload = (await response.json()) as {
        error?: string;
        records?: AdminAccessRecord[];
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Admin access could not be removed.");
      }

      setRecords(payload.records ?? revokeAdminAccess(email));
      setMessage(`${email} no longer has admin access.`);
    } catch (caught) {
      try {
        setRecords(revokeAdminAccess(email));
        setMessage(`${email} no longer has admin access locally.`);
      } catch (fallbackError) {
        setError(
          fallbackError instanceof Error
            ? fallbackError.message
            : caught instanceof Error
              ? caught.message
              : "Admin access could not be removed.",
        );
      }
    }
  }

  return (
    <section className="premium-panel mb-6 rounded-xl p-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            Admin access
          </p>
          <h2 className="mt-3 text-3xl font-black text-ink">Approved admin emails</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">
            Give trusted team members admin access by email. They can then sign up with
            that same email, choose their own password, and automatically unlock the
            admin workspace.
          </p>
        </div>
        <Link
          href="/signup"
          className="rounded-lg border border-line bg-surface px-4 py-3 text-center text-sm font-bold text-ink hover:border-pine"
        >
          Account signup
        </Link>
      </div>
      {loading ? (
        <p className="mt-4 rounded-md bg-surface px-3 py-2 text-sm font-bold text-ink/60">
          Loading admin access records...
        </p>
      ) : null}

      <form onSubmit={handleGrant} className="mt-6 grid gap-3 rounded-lg bg-surface p-4 md:grid-cols-[1fr_auto]">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Admin email
          <input
            name="email"
            type="email"
            required
            placeholder="teammate@example.com"
            className="rounded-md border border-line bg-panel px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-white"
          />
        </label>
        <button
          type="submit"
          className="self-end rounded-lg bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine"
        >
          Grant access
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-md bg-coral/20 px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      ) : (
        <p className="mt-4 rounded-md bg-mint px-3 py-2 text-sm font-bold text-pine">
          {message}
        </p>
      )}

      <div className="mt-6 w-full max-w-full overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-normal text-ink/55">
              <th className="py-3 pr-4">Email</th>
              <th className="py-3 pr-4">Type</th>
              <th className="py-3 pr-4">Account status</th>
              <th className="py-3 pr-4">Granted</th>
              <th className="py-3 pr-4">Granted by</th>
              <th className="py-3 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.email} className="border-b border-line last:border-b-0">
                <td className="py-4 pr-4">
                  <p className="font-bold text-ink">{record.email}</p>
                  {record.email === TRADEPILOT_ADMIN_EMAIL ? (
                    <p className="mt-1 text-xs font-semibold text-ink/50">Primary owner</p>
                  ) : null}
                </td>
                <td className="py-4 pr-4 capitalize">{record.source}</td>
                <td className="py-4 pr-4">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-black ${
                      record.hasAccount ? "bg-mint text-pine" : "bg-sky text-ink"
                    }`}
                  >
                    {record.hasAccount ? "Account created" : "Waiting for signup"}
                  </span>
                </td>
                <td className="py-4 pr-4">{formatDate(record.createdAt)}</td>
                <td className="py-4 pr-4">{record.createdBy ?? "--"}</td>
                <td className="py-4 pr-4">
                  {record.source === "owner" ? (
                    <span className="text-xs font-bold text-ink/50">Cannot remove</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRevoke(record.email)}
                      className="rounded-md border border-line bg-panel px-3 py-2 text-xs font-black text-ink hover:border-coral"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 rounded-md bg-surface px-3 py-2 text-sm font-semibold leading-6 text-ink/65">
        Future subscription rule: admin accounts should always bypass plan limits and
        receive full product access, even after paid tiers are added.
      </p>
    </section>
  );
}
