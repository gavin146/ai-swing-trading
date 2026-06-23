import { AgentRunnerPanel } from "@/components/AgentRunnerPanel";
import { AppShell } from "@/components/AppShell";

export default function AgentPage() {
  return (
    <AppShell
      active="agent"
      eyebrow="Ranking engine"
      title="Agent runner"
      subtitle="Run, inspect, and explain the daily market analysis pipeline before customer alerts go out."
    >
      <AgentRunnerPanel />
    </AppShell>
  );
}
