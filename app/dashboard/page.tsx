import { AppShell } from "@/components/AppShell";
import { DashboardOpportunities } from "@/components/DashboardOpportunities";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return (
    <AppShell
      active="dashboard"
      eyebrow="Today's pre-market brief"
      title="Today's ranked trade ideas"
      subtitle="Start with the verdict, check the buy-under price, then open the full plan only when the setup fits your risk."
    >
      <DashboardOpportunities
        dataSource="empty"
        fallbackReason="Sign in with an active trial or subscription to load rankings."
        initialOpportunities={[]}
      />
    </AppShell>
  );
}
