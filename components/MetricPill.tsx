type MetricPillProps = {
  label: string;
  value: string | number;
  tone?: "positive" | "neutral" | "caution" | "risk";
};

const toneStyles = {
  positive: "bg-mint text-pine ring-1 ring-pine/10",
  neutral: "bg-sky text-ink ring-1 ring-ink/5",
  caution: "bg-amber/35 text-ink",
  risk: "bg-coral/20 text-ink",
};

export function MetricPill({ label, value, tone = "neutral" }: MetricPillProps) {
  return (
    <div className={`rounded-2xl px-3 py-3 ${toneStyles[tone]}`}>
      <p className="text-[11px] font-black uppercase tracking-normal opacity-70">
        {label}
      </p>
      <p className="mt-1 text-sm font-black leading-5">{value}</p>
    </div>
  );
}
