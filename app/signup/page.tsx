import { SignupForm } from "@/components/SignupForm";
import { BrandMark } from "@/components/BrandMark";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#071418_0%,#0b3d3f_42%,#f5f7fb_42%,#f5f7fb_100%)] px-4 py-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl overflow-hidden rounded-3xl border border-white/30 bg-white shadow-[0_30px_90px_rgba(7,20,24,0.16)] lg:grid-cols-[0.8fr_1.2fr]">
        <div className="bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-8 text-white sm:p-10">
          <BrandMark href="/" inverse />
          <div className="mt-16 max-w-md">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Investor onboarding
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight">
              Build your SwingFi profile in under two minutes
            </h1>
            <p className="mt-5 text-sm font-semibold leading-7 text-white/68">
              Your answers tune the daily list around risk comfort, confidence needs,
              budget range, and setup style.
            </p>
          </div>
        </div>
        <div className="grid place-items-center p-5 sm:p-8">
          <SignupForm />
        </div>
      </section>
    </main>
  );
}
