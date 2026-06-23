type SummaryTileProps = {
  description: string;
  label: string;
  tone?: "neutral" | "positive" | "risk";
  value: string | number;
};

const tones = {
  neutral: "from-white to-sky/50 text-ink",
  positive: "from-white to-mint text-pine",
  risk: "from-white to-coral/18 text-coral",
};

export function SummaryTile({ description, label, tone = "neutral", value }: SummaryTileProps) {
  return (
    <div
      className={`rounded-2xl border border-line/80 bg-gradient-to-br ${tones[tone]} p-4 shadow-[0_14px_40px_rgba(7,20,24,0.055)]`}
    >
      <p className="text-xs font-black uppercase tracking-normal text-ink/45">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-normal">{value}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-ink/58">{description}</p>
    </div>
  );
}
