import { AppHeader } from "@/components/AppHeader";
import { ThemeShowcase } from "@/components/ThemeShowcase";

export default function ThemesPage() {
  return (
    <main className="min-h-screen">
      <AppHeader active="themes" />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            Product design
          </p>
          <h1 className="mt-3 text-4xl font-bold text-ink">Theme directions</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-ink/65">
            My recommendation is Clarity Terminal: professional enough for trust,
            calm enough for beginners, and not so dark or intense that risk feels
            like a game.
          </p>
        </div>
        <ThemeShowcase />
      </section>
    </main>
  );
}
