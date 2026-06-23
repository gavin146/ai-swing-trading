import { AppHeader } from "@/components/AppHeader";
import { PickHistoryPanel } from "@/components/PickHistoryPanel";

export default function HistoryPage() {
  return (
    <main className="min-h-screen">
      <AppHeader active="history" />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            Pick history
          </p>
          <h1 className="mt-3 text-4xl font-bold text-ink">Saved daily picks</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-ink/65">
            Review the personalized SwingFi lists saved from morning agent runs.
          </p>
        </div>
        <PickHistoryPanel />
      </section>
    </main>
  );
}
