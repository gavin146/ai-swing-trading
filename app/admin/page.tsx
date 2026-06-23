import { AppShell } from "@/components/AppShell";
import { AdminWorkspace } from "@/components/AdminWorkspace";

export default function AdminPage() {
  return (
    <AppShell
      active="admin"
      eyebrow="Operations center"
      title="Admin workspace"
      subtitle="Run the daily agent, review model feedback, manage users, and edit customer-facing alerts from one controlled workspace."
    >
      <AdminWorkspace />
    </AppShell>
  );
}
