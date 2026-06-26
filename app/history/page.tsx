import { AppShell } from "@/components/AppShell";
import { PickHistoryPanel } from "@/components/PickHistoryPanel";

export default function HistoryPage() {
  return (
    <AppShell
      active="history"
      eyebrow="Performance center"
      title="Tracked picks and outcomes"
      subtitle="Review saved SwingFi lists, measured outcomes, benchmark context, and the proof points behind the ranking system."
    >
      <PickHistoryPanel />
    </AppShell>
  );
}
