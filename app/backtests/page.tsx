import { AppHeader } from "@/components/AppHeader";
import { BacktestPanel } from "@/components/BacktestPanel";

export default function BacktestsPage() {
  return (
    <main className="min-h-screen">
      <AppHeader active="backtests" />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <BacktestPanel />
      </section>
    </main>
  );
}
