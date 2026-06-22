"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { loginCustomer } from "@/lib/customer-store";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      loginCustomer(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    }
  }

  return (
    <section className="w-full max-w-md rounded-lg border border-line bg-panel p-6 shadow-soft">
      <Link href="/" className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-pine text-sm font-bold text-white">
          TP
        </span>
        <span className="text-lg font-bold text-ink">TradePilot AI</span>
      </Link>

      <div className="mt-8">
        <h1 className="text-3xl font-bold text-ink">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          Sign in to review today&apos;s ranked opportunities, saved preferences, and
          morning email settings.
        </p>
      </div>

      <div className="mt-5 rounded-md bg-sky px-3 py-2 text-sm font-semibold text-ink">
        Demo access: avery@example.com / demo1234
      </div>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Email
          <input
            name="email"
            type="email"
            defaultValue="avery@example.com"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Password
          <input
            name="password"
            type="password"
            defaultValue="demo1234"
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
          className="mt-2 rounded-md bg-pine px-4 py-3 text-sm font-bold text-white hover:bg-ink"
        >
          Log in
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
