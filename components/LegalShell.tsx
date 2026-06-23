import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { brand } from "@/lib/brand";

type LegalShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
};

export function LegalShell({ children, eyebrow, title }: LegalShellProps) {
  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <section className="mx-auto max-w-4xl rounded-xl border border-line bg-panel p-6 shadow-soft sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <BrandMark />
          <Link
            href="/"
            className="rounded-lg border border-line bg-surface px-4 py-3 text-center text-sm font-bold text-ink hover:border-pine"
          >
            Back home
          </Link>
        </div>
        <p className="mt-8 text-sm font-bold uppercase tracking-normal text-pine">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-bold text-ink">{title}</h1>
        <p className="mt-3 text-sm font-semibold text-ink/55">
          Last updated: {brand.legalLastUpdated}
        </p>
        <div className="mt-8 grid gap-6 text-sm leading-7 text-ink/70">{children}</div>
        <div className="mt-8 rounded-lg border border-line bg-surface p-4 text-sm leading-6 text-ink/65">
          Questions about these policies can be sent to{" "}
          <a href={`mailto:${brand.contactEmail}`} className="font-bold text-pine">
            {brand.contactEmail}
          </a>
          .
        </div>
      </section>
    </main>
  );
}

export function LegalSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <h2 className="text-xl font-black text-ink">{title}</h2>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}
