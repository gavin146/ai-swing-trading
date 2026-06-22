import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradePilot AI",
  description:
    "A SaaS foundation for discovering swing trading opportunities across stocks, ETFs, and crypto.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
