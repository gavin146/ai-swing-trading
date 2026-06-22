import { AppHeader } from "@/components/AppHeader";
import { DashboardOpportunities } from "@/components/DashboardOpportunities";
import { opportunities } from "@/lib/opportunities";

export default function DashboardPage() {
  return (
    <main className="min-h-screen">
      <AppHeader active="dashboard" />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-pine">
              Opportunity dashboard
            </p>
            <h1 className="mt-3 text-4xl font-bold text-ink">Top 30 trade ideas</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-ink/65">
              Morning agent rankings combine trend strength, financial quality,
              macro context, news tone, technical setup, and beginner-friendly risk levels.
            </p>
          </div>
        </div>

        <DashboardOpportunities initialOpportunities={opportunities} />
      </section>
    </main>
  );
}
