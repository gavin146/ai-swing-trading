import type { Metadata } from "next";
import Link from "next/link";
import { AppMotionShell } from "@/components/AppMotionShell";
import { brand, getPublicAppUrl } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  applicationName: brand.appName,
  title: {
    default: brand.appName,
    template: `%s | ${brand.appName}`,
  },
  description:
    "AI-ranked swing trade opportunities with beginner-friendly risk, confidence, entry, target, and stop-loss analysis.",
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
    url: getPublicAppUrl(),
  },
  twitter: {
    card: "summary",
    description:
      "AI-ranked swing trade opportunities with beginner-friendly risk, confidence, entry, target, and stop-loss analysis.",
    title: brand.appName,
  },
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
