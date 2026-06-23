import { AppShell } from "@/components/AppShell";
import { PickHistoryPanel } from "@/components/PickHistoryPanel";

export default function HistoryPage() {
  return (
    <AppShell
      active="history"
      eyebrow="Pick history"
      title="Saved daily picks"
      subtitle="Review the personalized SwingFi lists saved from morning agent runs."
    >
      <PickHistoryPanel />
    </AppShell>
  );
}
