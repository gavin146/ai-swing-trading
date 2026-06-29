"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { ToastNotice, type ToastTone } from "@/components/ToastNotice";
import {
  isAdminCustomer,
  loginCustomer,
  rememberAuthenticatedCustomer,
} from "@/lib/customer-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SessionProfileResponse = {
  customer?: Parameters<typeof rememberAuthenticatedCustomer>[0];
  error?: string;
};

type AuthNotice = {
  message: string;
  title?: string;
  tone: ToastTone;
};

function friendlyLoginError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("no swingfi account")) return message;
  if (lower.includes("password does not match")) return message;
  if (lower.includes("invalid login credentials")) {
    return "That email or password is not correct. Check the email spelling or reset your password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email before logging in. Use the verification link we sent, or request a new one.";
  }
  if (lower.includes("too many")) {
    return "Too many login attempts. Wait a few minutes, then try again.";
  }

  return message || "Login failed.";
}

export function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  function showNotice(tone: ToastTone, message: string, title?: string) {
    setNotice({ message, title, tone });
  }

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const tokenHash = params.get("token_hash");
      const isRecovery =
        pathname === "/reset-password" ||
        params.get("reset") === "1" ||
        params.has("code") ||
        (params.get("type") === "recovery" && Boolean(tokenHash)) ||
        hashParams.get("type") === "recovery";

      setRecoveryMode(isRecovery);
      if (!isRecovery) {
        if (params.get("updated") === "1") {
          showNotice("success", "Password updated. Log in with your new password.", "Password updated");
          window.history.replaceState({}, "", "/login");
        }
        return;
      }

      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        if (mounted) {
          showNotice("error", "Password reset is not configured yet.", "Reset unavailable");
          setRecoveryReady(false);
        }
        return;
      }

      const code = params.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (mounted) {
            showNotice(
              "warning",
              "This password reset link is expired or invalid. Request a fresh reset email.",
              "Reset link expired",
            );
            setRecoveryReady(false);
          }
          return;
        }

        window.history.replaceState({}, "", `${pathname}?reset=1`);
      } else if (tokenHash && params.get("type") === "recovery") {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (verifyError) {
          if (mounted) {
            showNotice(
              "warning",
              "This password reset link is expired or invalid. Request a fresh reset email.",
              "Reset link expired",
            );
            setRecoveryReady(false);
          }
          return;
        }

        window.history.replaceState({}, "", `${pathname}?reset=1`);
      }

      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setRecoveryReady(Boolean(data.session));
        if (!data.session) {
          showNotice(
            "warning",
            "This password reset link is expired or invalid. Request a fresh reset email.",
            "Reset link expired",
          );
        }
      }
    }

    void prepareRecoverySession();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email.includes("@")) {
      showNotice("warning", "Enter the email address you used to create your SwingFi account.", "Email needed");
      setLoading(false);
      return;
    }

    if (!password) {
      showNotice("warning", "Enter your password, or use password reset if you forgot it.", "Password needed");
      setLoading(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      let customer;

      if (supabase) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          throw authError;
        }

        if (!data.user) {
          throw new Error(
            "That email or password is not correct. Check the email spelling or reset your password.",
          );
        } else {
          const profileResponse = await fetch("/api/customers/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session?.access_token ?? ""}`,
            },
            body: JSON.stringify({ accessToken: data.session?.access_token }),
          });
          const profilePayload = (await profileResponse.json().catch(() => ({}))) as SessionProfileResponse;

          if (!profileResponse.ok || profilePayload.error || !profilePayload.customer) {
            throw new Error(profilePayload.error ?? "Could not load your saved SwingFi profile.");
          }

          customer = rememberAuthenticatedCustomer({
            ...profilePayload.customer,
            password,
          });
        }
      } else {
        customer = loginCustomer(email, password);
      }

      router.push(isAdminCustomer(customer) ? "/admin" : "/dashboard");
    } catch (caught) {
      showNotice("error", friendlyLoginError(caught), "Could not log in");
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
    const email = emailInput?.value.trim() ?? "";

    if (!email) {
      showNotice("warning", "Enter your email first, then request a reset link.", "Email needed");
      return;
    }

    setLoading(true);
    setNotice(null);

    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setLoading(false);

    if (!response.ok || payload.error) {
      showNotice(
        "error",
        payload.error ?? "Password reset email could not be sent. Check the email and try again.",
        "Reset email failed",
      );
      return;
    }

    showNotice(
      "success",
      "If a SwingFi account exists for that email, a reset link is on the way. Check your inbox and spam folder.",
      "Check your inbox",
    );
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      showNotice("warning", "Create a password with at least 8 characters.", "Password too short");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      showNotice("error", "Password reset is not configured yet.", "Reset unavailable");
      return;
    }

    setLoading(true);
    setNotice(null);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      showNotice(
        "warning",
        "This password reset link is expired or invalid. Request a fresh reset email.",
        "Reset link expired",
      );
      setLoading(false);
      setRecoveryReady(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateError) {
      showNotice("error", friendlyLoginError(updateError), "Password update failed");
      return;
    }

    setNewPassword("");
    router.push("/login?updated=1");
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
            ? recoveryReady
              ? "Enter a fresh password, then return to sign in."
              : "Checking your secure password reset link."
            : "Sign in to review today’s ranked opportunities, saved preferences, and morning email settings."}
        </p>
      </div>

      {recoveryMode ? (
        <form onSubmit={handlePasswordUpdate} className="mt-8 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-ink">
            New password
            <PasswordField
              label="new password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
            />
          </label>
          {notice ? (
            <ToastNotice tone={notice.tone} title={notice.title}>
              {notice.message}
            </ToastNotice>
          ) : null}
          {!recoveryReady ? (
            <div className="rounded-2xl border border-line bg-surface p-4 text-sm font-semibold leading-6 text-ink/62">
              <p>
                This page needs a valid reset email link. If the link expired, go
                back to login, enter your email, and send yourself a fresh reset email.
              </p>
              <Link
                href="/login"
                className="mt-3 inline-flex rounded-xl border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:border-pine"
              >
                Request a fresh link
              </Link>
            </div>
          ) : null}
          <button
            type="submit"
            disabled={loading || !recoveryReady}
            className="mt-2 rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Updating..." : recoveryReady ? "Update password" : "Reset link not ready"}
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
          <PasswordField
            label="password"
            name="password"
            autoComplete="current-password"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        {notice ? (
          <ToastNotice tone={notice.tone} title={notice.title}>
            {notice.message}
          </ToastNotice>
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
