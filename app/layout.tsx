import type { Metadata } from "next";
import Link from "next/link";
import { AppMotionShell } from "@/components/AppMotionShell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SwingFi",
    template: "%s | SwingFi",
  },
  description:
    "AI-ranked swing trade opportunities with beginner-friendly risk, confidence, entry, target, and stop-loss analysis.",
  icons: {
    icon: "/icon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppMotionShell>{children}</AppMotionShell>
        <footer className="border-t border-line bg-surface px-4 py-6 text-sm text-ink/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>SwingFi is research software, not financial advice.</p>
            <nav className="flex flex-wrap gap-4 font-bold text-ink/70">
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
