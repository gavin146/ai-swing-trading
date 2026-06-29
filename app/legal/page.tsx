import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/LegalShell";

const legalLinks = [
  {
    href: "/legal/disclaimer",
    title: "Not Financial Advice",
    text: "Risk language for market research, AI explanations, scores, trade plans, and backtests.",
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    text: "How account, alert, usage, market-analysis, and vendor data is handled.",
  },
  {
    href: "/legal/terms",
    title: "Terms of Use",
    text: "Customer responsibilities, service limitations, availability, and future billing terms.",
  },
];

const launchRules = [
  "Use SwingFi as research software, not an order instruction.",
  "Review risk, entry range, target, stop loss, data freshness, and event risk together.",
  "Do not trade money you cannot afford to lose.",
  "Past results, backtests, and AI explanations do not guarantee future returns.",
];

export default function LegalPage() {
  return (
    <LegalShell eyebrow="Legal center" title="SwingFi Legal">
      <LegalSection title="Before You Use SwingFi">
        <p>
          SwingFi is research software for reviewing market opportunities. It is not a
          broker, investment adviser, trading signal guarantee, or substitute for your own
          risk review.
        </p>
      </LegalSection>

      <LegalSection title="Customer Safety Rules">
        <div className="grid gap-2">
          {launchRules.map((rule) => (
            <p key={rule} className="rounded-xl border border-line bg-surface px-4 py-3 font-semibold">
              {rule}
            </p>
          ))}
        </div>
      </LegalSection>

      <div className="grid gap-4 sm:grid-cols-3">
        {legalLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-line bg-surface p-4 hover:border-pine hover:shadow-soft"
          >
            <h2 className="text-lg font-black text-ink">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">{item.text}</p>
          </Link>
        ))}
      </div>
    </LegalShell>
  );
}
