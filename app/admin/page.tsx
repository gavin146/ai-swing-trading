import { AdminOpportunityPanel } from "@/components/AdminOpportunityPanel";
import { AdminOperationsPanel } from "@/components/AdminOperationsPanel";
import { AppHeader } from "@/components/AppHeader";

export default function AdminPage() {
  return (
    <main className="min-h-screen">
      <AppHeader active="admin" />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminOperationsPanel />
        <AdminOpportunityPanel />
      </section>
    </main>
  );
}
