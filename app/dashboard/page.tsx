import { AppShell } from "@/components/AppShell";
import { DashboardOpportunities } from "@/components/DashboardOpportunities";
import { opportunityFromRow } from "@/lib/opportunities";
import { listLatestOpportunities } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const opportunityResult = await listLatestOpportunities(90);
  const opportunities = opportunityResult.rows.map(opportunityFromRow);

  return (
    <AppShell
      active="dashboard"
      eyebrow="Today's pre-market brief"
      title="Your ranked swing trade desk"
      subtitle="Review the day's strongest setups with entry, target, stop, confidence, risk, and a plain-English reason for each ranking."
    >
      <DashboardOpportunities
        dataSource={opportunityResult.source}
        fallbackReason={opportunityResult.reason}
        initialOpportunities={opportunities}
      />
    </AppShell>
  );
}
