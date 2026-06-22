"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signupCustomer } from "@/lib/customer-store";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      signupCustomer({
        firstName: String(formData.get("firstName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        phone: String(formData.get("phone") ?? ""),
      });
      router.push("/settings");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Signup failed.");
    }
  }

  return (
    <section className="w-full max-w-xl rounded-lg border border-line bg-panel p-6 shadow-soft">
      <Link href="/" className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-pine text-sm font-bold text-white">
          TP
        </span>
        <span className="text-lg font-bold text-ink">TradePilot AI</span>
      </Link>

      <div className="mt-8">
        <h1 className="text-3xl font-bold text-ink">Create your account</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          Create a local demo profile now. Supabase auth can replace this store later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-ink">
          First name
          <input
            name="firstName"
            type="text"
            required
            placeholder="Avery"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink">
          Last name
          <input
            name="lastName"
            type="text"
            required
            placeholder="Chen"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
          Email
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
          Phone for SMS alerts
          <input
            name="phone"
            type="tel"
            placeholder="+15551234567"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Create a password"
            className="rounded-md border border-line bg-surface px-4 py-3 font-medium outline-none transition focus:border-pine focus:bg-panel"
          />
        </label>
        {error ? (
          <p className="rounded-md bg-coral/20 px-3 py-2 text-sm font-bold text-ink sm:col-span-2">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="rounded-md bg-pine px-4 py-3 text-sm font-bold text-white transition hover:bg-ink sm:col-span-2"
        >
          Sign up
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/65">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-pine">
          Log in
        </Link>
      </p>
    </section>
  );
}
