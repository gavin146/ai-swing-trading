"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  isAdminCustomer,
  loginCustomer,
  rememberAuthenticatedCustomer,
} from "@/lib/customer-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    const query = window.location.search;
    setRecoveryMode(hash.includes("type=recovery") || query.includes("reset=1"));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = createSupabaseBrowserClient();
      let customer;

      if (supabase) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError || !data.user) {
          customer = loginCustomer(email, password);
        } else {
          customer = rememberAuthenticatedCustomer({
            authUserId: data.user.id,
            createdAt: data.user.created_at,
            email: data.user.email ?? email,
            fullName:
              typeof data.user.user_metadata?.full_name === "string"
                ? data.user.user_metadata.full_name
                : email,
            password,
          });
        }
      } else {
        customer = loginCustomer(email, password);
      }

      router.push(isAdminCustomer(customer) ? "/admin" : "/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
    const email = emailInput?.value.trim() ?? "";

    if (!email) {
      setError("Enter your email first, then request a reset link.");
      return;
    }

    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setLoading(false);

    if (!response.ok || payload.error) {
      setError(payload.error ?? "Password reset email could not be sent.");
      return;
    }

    setError("Password reset email sent from SwingFi. Check your inbox and spam folder.");
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setError("Create a password with at least 8 characters.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Password reset is not configured yet.");
      return;
    }

    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    window.history.replaceState({}, "", "/login");
    setRecoveryMode(false);
    setNewPassword("");
    setError("Password updated. Log in with your new password.");
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-line/70 bg-white p-6 shadow-[0_24px_80px_rgba(7,20,24,0.08)] sm:p-8">
      <div>
        <p className="text-xs font-black uppercase tracking-normal text-pine">
          {recoveryMode ? "Password recovery" : "Secure sign in"}
        </p>
        <h1 className="mt-3 text-3xl font-black text-ink">
          {recoveryMode ? "Choose a new password" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          {recoveryMode
            ? "Enter a fresh password, then return to sign in."
            : "Sign in to review today’s ranked opportunities, saved preferences, and morning email settings."}
        </p>
      </div>

      {recoveryMode ? (
        <form onSubmit={handlePasswordUpdate} className="mt-8 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-ink">
            New password
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
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
            className="mt-2 rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      ) : (
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
          className="mt-2 rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Opening dashboard..." : "Log in"}
        </button>
        <button
          type="button"
          onClick={handlePasswordReset}
          disabled={loading}
          className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm font-bold text-ink hover:border-pine hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-70"
        >
          Send password reset
        </button>
      </form>
      )}

      <p className="mt-6 text-center text-sm text-ink/65">
        New to SwingFi?{" "}
        <Link href="/signup" className="font-bold text-pine">
          Create an account
        </Link>
      </p>
    </section>
  );
}
