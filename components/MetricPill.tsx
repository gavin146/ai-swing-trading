type MetricPillProps = {
  label: string;
  value: string | number;
  tone?: "positive" | "neutral" | "caution" | "risk";
};

const toneStyles = {
  positive: "bg-mint text-pine",
  neutral: "bg-sky text-ink",
  caution: "bg-amber/35 text-ink",
  risk: "bg-coral/20 text-ink",
};

export function MetricPill({ label, value, tone = "neutral" }: MetricPillProps) {
  return (
    <div className={`rounded-md px-3 py-2 ${toneStyles[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-normal opacity-70">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}
