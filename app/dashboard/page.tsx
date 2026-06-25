import { AppShell } from "@/components/AppShell";
import { DashboardOpportunities } from "@/components/DashboardOpportunities";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return (
    <AppShell
      active="dashboard"
      eyebrow="Today's pre-market brief"
      title="Your ranked swing trade desk"
      subtitle="Review the day's strongest setups with entry, target, stop, confidence, risk, and a plain-English reason for each ranking."
    >
      <DashboardOpportunities
        dataSource="empty"
        fallbackReason="Sign in with an active trial or subscription to load rankings."
        initialOpportunities={[]}
      />
    </AppShell>
  );
}
