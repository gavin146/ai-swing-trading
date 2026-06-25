import { BrandMark } from "@/components/BrandMark";
import { LoginForm } from "@/components/LoginForm";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#071418_0%,#0b3d3f_42%,#f5f7fb_42%,#f5f7fb_100%)] px-4 py-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-3xl border border-white/30 bg-white shadow-[0_30px_90px_rgba(7,20,24,0.16)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-8 text-white sm:p-10">
          <BrandMark href="/" inverse />
          <div className="mt-16 max-w-md">
            <p className="text-xs font-black uppercase tracking-normal text-lime">
              Account security
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight">
              Set a new password for your SwingFi account
            </h1>
            <p className="mt-5 text-sm font-semibold leading-7 text-white/72">
              Use the secure link from your email to choose a fresh password, then
              return to your dashboard with your saved preferences intact.
            </p>
          </div>
        </div>
        <div className="grid place-items-center p-5 sm:p-8">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
