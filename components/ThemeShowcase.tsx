const themes = [
  {
    name: "Clarity Terminal",
    recommendation: "Recommended",
    palette: ["#12211f", "#f6f7f4", "#d8f4e4", "#dcefff", "#f28b82"],
    description:
      "A calm, professional investing interface with high readability, clear risk colors, and a beginner-friendly feel.",
    bestFor: "Main SaaS product",
  },
  {
    name: "Research Desk",
    recommendation: "Strong alternative",
    palette: ["#1f2933", "#ffffff", "#e7edf3", "#2f80ed", "#f2c94c"],
    description:
      "More analytical and institution-like, with denser tables and cooler information hierarchy.",
    bestFor: "Power users and research-heavy screens",
  },
  {
    name: "Market Calm",
    recommendation: "Friendly",
    palette: ["#243b36", "#fafaf7", "#d7eee5", "#b7d6f2", "#ffb199"],
    description:
      "Softer and more approachable, good for new investors who may feel intimidated by trading tools.",
    bestFor: "Onboarding and education",
  },
  {
    name: "Signal Pro",
    recommendation: "Advanced",
    palette: ["#101820", "#f4f7fb", "#00a86b", "#335c81", "#d64545"],
    description:
      "Sharper contrast and stronger signal colors for active-trader workflows and faster scanning.",
    bestFor: "Future pro tier",
  },
];

export function ThemeShowcase() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {themes.map((theme) => (
        <article key={theme.name} className="rounded-lg border border-line bg-panel p-6 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-normal text-pine">
                {theme.recommendation}
              </p>
              <h2 className="mt-3 text-2xl font-bold text-ink">{theme.name}</h2>
            </div>
            <div className="flex gap-2">
              {theme.palette.map((color) => (
                <span
                  key={color}
                  className="h-8 w-8 rounded-md border border-line"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
          <p className="mt-5 leading-7 text-ink/65">{theme.description}</p>
          <div className="mt-5 rounded-md bg-surface px-3 py-2 text-sm font-bold text-ink/70">
            Best for: {theme.bestFor}
          </div>
        </article>
      ))}
    </div>
  );
}
