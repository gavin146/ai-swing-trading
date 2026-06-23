"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { isAdminCustomer, loginCustomer } from "@/lib/customer-store";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(event.currentTarget);

    try {
      const customer = loginCustomer(
        String(formData.get("email") ?? ""),
        String(formData.get("password") ?? ""),
      );
      router.push(isAdminCustomer(customer) ? "/admin" : "/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
      setLoading(false);
    }
  }

  return (
    <section className="premium-panel w-full max-w-md rounded-xl p-6">
      <BrandMark />

      <div className="mt-8">
        <h1 className="text-3xl font-bold text-ink">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          Sign in to review today&apos;s ranked opportunities, saved preferences, and
          morning email settings.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        {error ? (
          <p className="rounded-md bg-coral/20 px-3 py-2 text-sm font-bold text-ink">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Opening dashboard..." : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/65">
        New to TradePilot AI?{" "}
        <Link href="/signup" className="font-bold text-pine">
          Create an account
        </Link>
      </p>
    </section>
  );
}
