import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsScripts } from "@/components/AnalyticsScripts";
import { AppMotionShell } from "@/components/AppMotionShell";
import { brand, getPublicAppUrl } from "@/lib/brand";
import "./globals.css";

const appUrl = getPublicAppUrl();
const googleVerificationTokens = [
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_GETSWINGFI,
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_SWINGFI_TRADE,
].filter((token): token is string => Boolean(token));

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: brand.appName,
  title: {
    default: brand.appName,
    template: `%s | ${brand.appName}`,
  },
  description:
    "AI-ranked swing trade opportunities with beginner-friendly risk, confidence, entry, target, and stop-loss analysis.",
  keywords: [
    "AI swing trading",
    "swing trade alerts",
    "stock analysis software",
    "beginner trading research",
    "AI stock rankings",
    "trade entry target stop loss",
    "SwingFi",
  ],
  icons: {
    icon: "/icon.svg",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    description:
      "AI-ranked swing trade opportunities with beginner-friendly risk, confidence, entry, target, and stop-loss analysis.",
    siteName: brand.appName,
    title: brand.appName,
    type: "website",
    url: appUrl,
  },
  twitter: {
    card: "summary",
    description:
      "AI-ranked swing trade opportunities with beginner-friendly risk, confidence, entry, target, and stop-loss analysis.",
    title: brand.appName,
  },
  verification: googleVerificationTokens.length
    ? {
        google:
          googleVerificationTokens.length === 1
            ? googleVerificationTokens[0]
            : googleVerificationTokens,
      }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppMotionShell>{children}</AppMotionShell>
        <AnalyticsScripts />
        <footer className="border-t border-line bg-surface px-4 py-6 text-sm text-ink/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p>
              {brand.appName} is research software, not financial advice, and does not
              place trades or manage brokerage accounts.
            </p>
            <nav className="flex flex-wrap gap-4 font-bold text-ink/70">
              <Link href="/legal" className="hover:text-pine">
                Legal
              </Link>
              <Link href="/legal/disclaimer" className="hover:text-pine">
                Disclaimer
              </Link>
              <Link href="/legal/privacy" className="hover:text-pine">
                Privacy
              </Link>
              <Link href="/legal/terms" className="hover:text-pine">
                Terms
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
