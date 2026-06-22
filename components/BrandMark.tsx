import Link from "next/link";

type BrandMarkProps = {
  compact?: boolean;
  href?: string;
};

function Mark() {
  return (
    <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/20 bg-[linear-gradient(135deg,#061c1f,#0c4a4d_58%,#b7f34b)] shadow-[0_18px_45px_rgba(6,28,31,0.22)]">
      <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-white/80" />
      <span className="absolute bottom-2 right-2 h-1.5 w-5 rounded-full bg-white/45" />
      <span className="relative text-sm font-black tracking-normal text-white">TP</span>
    </span>
  );
}

export function BrandMark({ compact = false, href = "/" }: BrandMarkProps) {
  return (
    <Link href={href} className="group inline-flex items-center gap-3">
      <Mark />
      {compact ? null : (
        <span className="leading-none">
          <span className="flex items-center gap-2">
            <span className="text-lg font-black tracking-normal text-ink">TradePilot</span>
            <span className="rounded-md bg-lime px-1.5 py-1 text-[10px] font-black leading-none text-ink">
              AI
            </span>
          </span>
          <span className="mt-1 block text-xs font-semibold text-ink/55">
            Swing intelligence platform
          </span>
        </span>
      )}
    </Link>
  );
}
