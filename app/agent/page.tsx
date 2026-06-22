import { AgentRunnerPanel } from "@/components/AgentRunnerPanel";
import { AppHeader } from "@/components/AppHeader";

export default function AgentPage() {
  return (
    <main className="min-h-screen">
      <AppHeader active="agent" />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AgentRunnerPanel />
      </section>
    </main>
  );
}
