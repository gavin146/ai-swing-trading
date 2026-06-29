export function ScoreGuide() {
  return (
    <section className="rounded-3xl border border-line/80 bg-white p-6 shadow-[0_18px_60px_rgba(7,20,24,0.06)]">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-pine">
            Score guide
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-normal text-ink">
            How to read today&apos;s picks
          </h2>
          <p className="mt-3 text-sm font-medium leading-7 text-ink/62">
            SwingFi scores help you compare setups quickly. Use them as a research
            checklist: review the rank, check the entry range, confirm the downside,
            then decide whether to watch, skip, or research further.
          </p>
          <div className="mt-4 rounded-2xl border border-amber/30 bg-amber/10 p-4 text-sm font-bold leading-6 text-ink/68">
            A high score is not a buy signal. It means “review this first.” The setup
            still needs the right price, acceptable risk, fresh data, and your own
            decision before any trade.
          </div>
          <div className="mt-5 grid gap-2 text-sm font-semibold text-ink/70">
            {[
              ["80-100", "High-priority review. Only consider it if the price is still near the entry range and the stop fits your risk."],
              ["65-79", "Watchlist setup. Useful to monitor, but patience and entry discipline matter."],
              ["Below 65", "Lower-priority idea. Usually better to wait for a cleaner setup."],
            ].map(([range, text]) => (
              <p key={range} className="rounded-xl bg-surface px-3 py-2">
                <span className="font-black text-ink">{range}:</span> {text}
              </p>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-mint px-4 py-4 ring-1 ring-pine/10">
            <p className="text-xs font-black uppercase tracking-normal text-pine/70">
              Opportunity
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink">
              The main ranking score. Higher means the setup looks stronger across
              trend, catalysts, company quality, market backdrop, and reward/risk.
            </p>
          </div>
          <div className="rounded-2xl bg-sky px-4 py-4 ring-1 ring-ink/5">
            <p className="text-xs font-black uppercase tracking-normal text-ink/55">
              Confidence
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink">
              Higher means more signals agree. It means cleaner data support, not a
              guaranteed outcome.
            </p>
          </div>
          <div className="rounded-2xl bg-coral/20 px-4 py-4 ring-1 ring-coral/20">
            <p className="text-xs font-black uppercase tracking-normal text-ink/55">
              Risk
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink">
              Lower is better. Higher can mean more volatility, a wider stop, event
              risk, or fragile price action.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
