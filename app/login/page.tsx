import { LoginForm } from "@/components/LoginForm";
import { BrandMark } from "@/components/BrandMark";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,#071418_0%,#0b3d3f_42%,#f5f7fb_42%,#f5f7fb_100%)] px-3 py-6 sm:px-4 sm:py-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/30 bg-white shadow-[0_30px_90px_rgba(7,20,24,0.16)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="min-w-0 bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-6 text-white sm:p-10">
          <BrandMark href="/" inverse />
          <div className="mt-16 max-w-md">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Welcome back
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight">
              Open today&apos;s brief and review your ranked setups
            </h1>
            <p className="mt-5 text-sm font-semibold leading-7 text-white/68">
              The dashboard keeps the trade plan visible: confidence, risk, entry,
              target, stop, and the reason each ticker ranked.
            </p>
          </div>
        </div>
        <div className="grid min-w-0 place-items-center p-4 sm:p-8">
          <Suspense
            fallback={
              <section className="w-full max-w-md rounded-3xl border border-line/70 bg-white p-6 shadow-[0_24px_80px_rgba(7,20,24,0.08)] sm:p-8">
                <div className="skeleton h-4 w-32 rounded-full" />
                <div className="skeleton mt-5 h-10 w-52 rounded-2xl" />
                <div className="skeleton mt-8 h-12 rounded-2xl" />
                <div className="skeleton mt-4 h-12 rounded-2xl" />
              </section>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
