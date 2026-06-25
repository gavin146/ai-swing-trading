import { SignupForm } from "@/components/SignupForm";
import { BrandMark } from "@/components/BrandMark";

export default function SignupPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,#071418_0%,#0b3d3f_38%,#f5f7fb_38%,#f5f7fb_100%)] px-4 py-6 sm:py-8">
      <section className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-2">
        <BrandMark href="/" inverse />
        <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-normal text-lime">
          30 days free
        </div>
      </section>
      <section className="mx-auto mt-6 grid min-h-[calc(100vh-7rem)] max-w-7xl place-items-center">
        <div className="w-full">
          <SignupForm />
        </div>
      </section>
    </main>
  );
}
