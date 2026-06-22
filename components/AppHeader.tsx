import Link from "next/link";
import { CustomerStatus } from "./CustomerStatus";

type AppHeaderProps = {
  active?: "admin" | "agent" | "backtests" | "dashboard" | "settings" | "themes";
};

export function AppHeader({ active }: AppHeaderProps) {
  return (
    <header className="border-b border-line bg-panel/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-pine text-sm font-bold text-white">
            TP
          </span>
          <span>
            <span className="block text-base font-bold text-ink">TradePilot AI</span>
            <span className="block text-xs font-medium text-ink/55">
              Swing trade discovery
            </span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink/70">
          <Link
            href="/dashboard"
            className={`rounded-md px-3 py-2 transition hover:bg-mint hover:text-ink ${
              active === "dashboard" ? "bg-mint text-ink" : ""
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/settings"
            className={`rounded-md px-3 py-2 transition hover:bg-mint hover:text-ink ${
              active === "settings" ? "bg-mint text-ink" : ""
            }`}
          >
            Settings
          </Link>
          <Link
            href="/agent"
            className={`rounded-md px-3 py-2 transition hover:bg-mint hover:text-ink ${
              active === "agent" ? "bg-mint text-ink" : ""
            }`}
          >
            Agent
          </Link>
          <Link
            href="/backtests"
            className={`rounded-md px-3 py-2 transition hover:bg-mint hover:text-ink ${
              active === "backtests" ? "bg-mint text-ink" : ""
            }`}
          >
            Backtests
          </Link>
          <Link
            href="/themes"
            className={`rounded-md px-3 py-2 transition hover:bg-mint hover:text-ink ${
              active === "themes" ? "bg-mint text-ink" : ""
            }`}
          >
            Themes
          </Link>
          <Link
            href="/admin"
            className={`rounded-md px-3 py-2 transition hover:bg-mint hover:text-ink ${
              active === "admin" ? "bg-mint text-ink" : ""
            }`}
          >
            Admin
          </Link>
          <CustomerStatus />
        </nav>
      </div>
    </header>
  );
}
