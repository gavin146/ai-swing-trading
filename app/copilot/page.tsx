import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CopilotPanel } from "@/components/CopilotPanel";
import { getCopilotFeatureConfig } from "@/lib/copilot/config";

export const dynamic = "force-dynamic";

export default function CopilotPage() {
  if (!getCopilotFeatureConfig().copilotEnabled) {
    notFound();
  }

  return (
    <AppShell
      active="copilot"
      eyebrow="SwingFi Copilot"
      showCopilot
      title="Your portfolio research copilot"
      subtitle="Review tracked SwingFi plans, data freshness, and plain-English findings without connecting a brokerage account."
    >
      <CopilotPanel
        fixtureMode={process.env.COPILOT_FIXTURE_MODE === "true" && process.env.NODE_ENV !== "production"}
      />
    </AppShell>
  );
}
