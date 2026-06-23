import { AppHeader } from "@/components/AppHeader";
import { AdminWorkspace } from "@/components/AdminWorkspace";

export default function AdminPage() {
  return (
    <main className="min-h-screen">
      <AppHeader active="admin" />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminWorkspace />
      </section>
    </main>
  );
}
