import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: "cover",
  width: "device-width",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppMotionShell />
        <div className="page-transition">{children}</div>
        <AnalyticsScripts />
        <footer className="border-t border-line bg-surface px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 text-xs text-ink/60 sm:pt-6 sm:text-sm md:pb-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="max-w-3xl leading-5 sm:leading-6">
              {brand.appName} is research software, not financial advice, and does not
              place trades or manage brokerage accounts.
            </p>
            <nav className="flex flex-wrap gap-1.5 font-bold text-ink/70 sm:gap-2" aria-label="Legal links">
              <Link href="/legal" className="rounded-xl px-2.5 py-1.5 hover:bg-white hover:text-pine sm:px-3 sm:py-2">
                Legal
              </Link>
              <Link href="/legal/disclaimer" className="rounded-xl px-2.5 py-1.5 hover:bg-white hover:text-pine sm:px-3 sm:py-2">
                Disclaimer
              </Link>
              <Link href="/legal/privacy" className="rounded-xl px-2.5 py-1.5 hover:bg-white hover:text-pine sm:px-3 sm:py-2">
                Privacy
              </Link>
              <Link href="/legal/terms" className="rounded-xl px-2.5 py-1.5 hover:bg-white hover:text-pine sm:px-3 sm:py-2">
                Terms
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
