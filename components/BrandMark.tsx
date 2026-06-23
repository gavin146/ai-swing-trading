import Link from "next/link";
import { brand } from "@/lib/brand";

type BrandMarkProps = {
  compact?: boolean;
  href?: string;
};

function Mark() {
  return (
    <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/25 bg-[radial-gradient(circle_at_25%_18%,rgba(255,255,255,0.42),transparent_28%),linear-gradient(135deg,#061c1f,#0b3d3f_56%,#b7f34b)] shadow-[0_18px_45px_rgba(6,28,31,0.22)]">
      <svg
        aria-hidden="true"
        viewBox="0 0 44 44"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d="M8 29.5C14.8 18 23.3 31.2 36 14"
          fill="none"
          stroke="rgba(255,255,255,0.78)"
          strokeLinecap="round"
          strokeWidth="2.4"
        />
        <path
          d="M31 14h5v5"
          fill="none"
          stroke="rgba(183,243,75,0.96)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
      </svg>
      <span className="relative text-sm font-black tracking-normal text-white">SF</span>
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
            <span className="text-lg font-black tracking-normal text-ink">{brand.appName}</span>
            <span className="rounded-md bg-lime px-1.5 py-1 text-[10px] font-black leading-none text-ink">
              {brand.badge}
            </span>
          </span>
          <span className="mt-1 block text-xs font-semibold text-ink/55">
            {brand.tagline}
          </span>
        </span>
      )}
    </Link>
  );
}
