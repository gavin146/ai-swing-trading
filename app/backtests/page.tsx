import { AppShell } from "@/components/AppShell";
import { BacktestPanel } from "@/components/BacktestPanel";

export default function BacktestsPage() {
  return (
    <AppShell
      active="admin"
      eyebrow="Model verification"
      title="Backtesting and calibration"
      subtitle="Measure how rankings performed, surface mistakes, and feed those results back into scoring weights."
    >
      <BacktestPanel />
    </AppShell>
  );
}
