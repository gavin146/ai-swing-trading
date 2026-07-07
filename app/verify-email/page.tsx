import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { VerifyEmailPanel } from "@/components/VerifyEmailPanel";
import { verifyEmailToken } from "@/lib/auth/email-verification";
import { customerDestinationLabel, loginHref, normalizeCustomerNextPath } from "@/lib/customer-flow";

type VerifyEmailPageProps = {
  searchParams: Promise<{
    email?: string;
    next?: string;
    sent?: string;
    token?: string;
  }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;
  const token = params.token?.trim();
  const nextPath = normalizeCustomerNextPath(params.next, "/dashboard") ?? "/dashboard";
  const destinationLabel = customerDestinationLabel(nextPath);

  if (!token) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,#071418_0%,#0b3d3f_38%,#f5f7fb_38%,#f5f7fb_100%)] px-4 py-6 sm:py-8">
        <section className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-2">
          <BrandMark href="/" inverse />
          <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-normal text-lime">
            Secure signup
          </div>
        </section>
        <section className="mx-auto mt-8 grid max-w-7xl place-items-center">
          <VerifyEmailPanel email={params.email} initialMode="sent" nextPath={nextPath} />
        </section>
      </main>
    );
  }

  const result = await verifyEmailToken(token);

  if (result.status !== "verified") {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,#071418_0%,#0b3d3f_38%,#f5f7fb_38%,#f5f7fb_100%)] px-4 py-6 sm:py-8">
        <section className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-2">
          <BrandMark href="/" inverse />
          <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-normal text-lime">
            Secure signup
          </div>
        </section>
        <section className="mx-auto mt-8 grid max-w-7xl place-items-center">
          <VerifyEmailPanel
            email={"email" in result ? result.email ?? params.email : params.email}
            initialMode={result.status}
            nextPath={nextPath}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,#071418_0%,#0b3d3f_38%,#f5f7fb_38%,#f5f7fb_100%)] px-4 py-6 sm:py-8">
      <section className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-2">
        <BrandMark href="/" inverse />
        <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-normal text-lime">
          Verified
        </div>
      </section>
      <section className="mx-auto mt-8 grid max-w-7xl place-items-center">
        <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-line/70 bg-white shadow-[0_24px_80px_rgba(7,20,24,0.08)]">
          <div className="bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Email confirmed
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Your SwingFi account is ready
            </h1>
            <p className="mt-4 text-sm font-semibold leading-7 text-white/66">
              You can now log in and continue to {destinationLabel}.
            </p>
          </div>
          <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
            <Link
              href={loginHref(nextPath)}
              className="rounded-2xl bg-ink px-5 py-3 text-center text-sm font-black text-white shadow-[0_18px_42px_rgba(7,20,24,0.18)] transition hover:bg-pine"
            >
              Continue to {destinationLabel}
            </Link>
            <Link
              href={nextPath}
              className="rounded-2xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-ink transition hover:border-pine"
            >
              Preview {destinationLabel}
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
