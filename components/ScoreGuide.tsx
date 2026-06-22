export function ScoreGuide() {
  return (
    <section className="rounded-xl border border-line bg-panel p-5 shadow-soft">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-pine">
            Score guide
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink">How to read today&apos;s picks</h2>
          <p className="mt-3 text-sm leading-6 text-ink/65">
            TradePilot scores are meant to help you compare setups quickly. They are
            decision support, not a command to buy.
          </p>
          <div className="mt-4 grid gap-2 text-sm font-semibold text-ink/70">
            <p>80-100: Strong setup worth deeper review.</p>
            <p>65-79: Watchlist setup that needs good entry discipline.</p>
            <p>Below 65: Cautious idea; wait for more confirmation.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-mint px-4 py-3 ring-1 ring-pine/10">
            <p className="text-xs font-black uppercase tracking-normal text-pine/70">
              Opportunity
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink">
              Higher means stronger trend, fundamentals, catalyst tone, macro fit, and
              reward/risk.
            </p>
          </div>
          <div className="rounded-lg bg-sky px-4 py-3 ring-1 ring-ink/5">
            <p className="text-xs font-black uppercase tracking-normal text-ink/55">
              Confidence
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink">
              Higher means the ranking has cleaner supporting data and fewer missing
              inputs.
            </p>
          </div>
          <div className="rounded-lg bg-coral/20 px-4 py-3 ring-1 ring-coral/20">
            <p className="text-xs font-black uppercase tracking-normal text-ink/55">
              Risk
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink">
              Lower is better. Higher means more volatility, wider stops, or more event
              risk.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
