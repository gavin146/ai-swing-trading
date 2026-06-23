import { AppHeader } from "@/components/AppHeader";
import { DashboardOpportunities } from "@/components/DashboardOpportunities";
import { ScoreGuide } from "@/components/ScoreGuide";
import { opportunityFromRow } from "@/lib/opportunities";
import { listLatestOpportunities } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const opportunityResult = await listLatestOpportunities(90);
  const opportunities = opportunityResult.rows.map(opportunityFromRow);

  return (
    <main className="min-h-screen">
      <AppHeader active="dashboard" />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="premium-panel rounded-xl p-6">
          <div className="signal-line mb-5 h-1.5 max-w-48 rounded-full" />
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-pine">
              Today&apos;s pre-market brief
            </p>
            <h1 className="mt-3 text-4xl font-black text-ink">
              Swing trade ideas, ranked for clarity
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-ink/65">
              The system runs before the market opens, filters opportunities to your
              profile, and emails a link to the day&apos;s stock analysis. Use the cards
              below to compare setup quality, confidence, risk, entry, target, and stop.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <ScoreGuide />
        </div>

        <DashboardOpportunities
          dataSource={opportunityResult.source}
          fallbackReason={opportunityResult.reason}
          initialOpportunities={opportunities}
        />
      </section>
    </main>
  );
}
