import { AppShell } from "@/components/AppShell";
import { DashboardOpportunities } from "@/components/DashboardOpportunities";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return (
    <AppShell
      active="dashboard"
      eyebrow="Today's pre-market brief"
      title="Today's ranked trade ideas"
      subtitle="Start with the calm first list, open one to three setups, then check entry, target, stop, confidence, and risk before doing deeper research."
    >
      <DashboardOpportunities
        dataSource="empty"
        fallbackReason="Sign in with an active trial or subscription to load rankings."
        initialOpportunities={[]}
      />
    </AppShell>
  );
}
