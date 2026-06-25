"use client";

import Link from "next/link";
import { useState } from "react";

type VerifyEmailPanelProps = {
  email?: string;
  initialMode: "sent" | "expired" | "invalid" | "unconfigured";
};

export function VerifyEmailPanel({ email = "", initialMode }: VerifyEmailPanelProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailValue, setEmailValue] = useState(email);

  async function handleResend() {
    if (!emailValue.trim()) {
      setError("Enter the email address you used to create your account.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailValue }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      alreadyVerified?: boolean;
      error?: string;
      sent?: boolean;
    };

    setLoading(false);

    if (!response.ok || payload.error) {
      setError(payload.error ?? "Could not send a new verification email.");
      return;
    }

    setMessage(
      payload.alreadyVerified
        ? "That email is already verified. You can log in now."
        : "New verification email sent. Check your inbox and spam folder.",
    );
  }

  const copy =
    initialMode === "sent"
      ? {
          eyebrow: "Check your inbox",
          title: "Confirm your email to unlock SwingFi",
          body: "We sent a branded confirmation link to your email. Open it to finish signup and unlock today’s stock analysis.",
        }
      : initialMode === "expired"
        ? {
            eyebrow: "Link expired",
            title: "Send yourself a fresh confirmation link",
            body: "Verification links expire for security. Request a new one below and use the latest email you receive.",
          }
        : initialMode === "unconfigured"
          ? {
              eyebrow: "Setup required",
              title: "Email verification needs Supabase configuration",
              body: "The app could not verify this link because the server auth configuration is missing.",
            }
          : {
              eyebrow: "Invalid link",
              title: "This confirmation link is not valid",
              body: "The link may have already been used or copied incorrectly. Send yourself a new confirmation email below.",
            };

  return (
    <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-line/70 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
      <div className="bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-normal text-lime">
          {copy.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-4 text-sm font-semibold leading-7 text-white/66">
          {copy.body}
        </p>
      </div>
      <div className="grid gap-4 p-6 sm:p-8">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Email address
          <input
            value={emailValue}
            onChange={(event) => setEmailValue(event.target.value)}
            type="email"
            autoComplete="email"
            className="rounded-2xl border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            placeholder="you@example.com"
          />
        </label>
        {message ? (
          <p className="rounded-2xl bg-mint px-4 py-3 text-sm font-bold text-pine">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-2xl bg-coral/20 px-4 py-3 text-sm font-bold text-ink">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          className="rounded-2xl bg-ink px-5 py-3 text-center text-sm font-black text-white shadow-[0_18px_42px_rgba(7,20,24,0.18)] transition hover:bg-pine disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Sending..." : "Send confirmation email"}
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/login"
            className="rounded-2xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-ink transition hover:border-pine"
          >
            Go to login
          </Link>
          <Link
            href="/"
            className="rounded-2xl border border-line bg-white px-5 py-3 text-center text-sm font-bold text-ink/60 transition hover:border-pine hover:text-ink"
          >
            Back home
          </Link>
        </div>
      </div>
    </section>
  );
}
