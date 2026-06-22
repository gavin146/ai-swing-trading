import { AppHeader } from "@/components/AppHeader";
import { SettingsForm } from "@/components/SettingsForm";

export default function SettingsPage() {
  return (
    <main className="min-h-screen">
      <AppHeader active="settings" />
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            Account settings
          </p>
          <h1 className="mt-3 text-4xl font-bold text-ink">Trading preferences</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-ink/65">
            Manage your profile, daily pick filters, and morning alert preferences.
          </p>
        </div>
        <SettingsForm />
      </section>
    </main>
  );
}
