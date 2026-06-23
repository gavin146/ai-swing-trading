type ScoreMeterProps = {
  label: string;
  score: number;
  sublabel?: string;
  tone?: "opportunity" | "confidence" | "risk";
};

function meterColor(tone: ScoreMeterProps["tone"]) {
  if (tone === "risk") return "#ff7a70";
  if (tone === "confidence") return "#68d8ff";
  return "#b7f34b";
}

export function ScoreMeter({ label, score, sublabel, tone = "opportunity" }: ScoreMeterProps) {
  const value = Math.max(0, Math.min(100, score));
  const color = meterColor(tone);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line/80 bg-white/80 p-3 shadow-[0_10px_30px_rgba(7,20,24,0.04)]">
      <div
        className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${color} ${value * 3.6}deg, #e8eef2 0deg)`,
        }}
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-sm font-black text-ink">
          {value}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-normal text-ink/45">{label}</p>
        {sublabel ? (
          <p className="mt-1 text-sm font-bold leading-5 text-ink">{sublabel}</p>
        ) : null}
      </div>
    </div>
  );
}
