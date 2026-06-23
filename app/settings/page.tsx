import { AppShell } from "@/components/AppShell";
import { SettingsForm } from "@/components/SettingsForm";

export default function SettingsPage() {
  return (
    <AppShell
      active="settings"
      eyebrow="Account settings"
      title="Trading preferences"
      subtitle="Manage your profile, daily pick filters, and morning alert preferences."
    >
      <SettingsForm />
    </AppShell>
  );
}
