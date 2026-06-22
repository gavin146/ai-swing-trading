"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
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
    <section className="premium-panel w-full max-w-xl rounded-xl p-6">
      <BrandMark />

      <div className="mt-8">
        <h1 className="text-3xl font-bold text-ink">Create your account</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          Set up your profile for pre-market stock ideas, email alerts, and
          beginner-friendly trade explanations.
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
          Phone
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
          className="rounded-lg bg-ink px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine sm:col-span-2"
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
