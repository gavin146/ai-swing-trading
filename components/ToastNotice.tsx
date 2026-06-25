"use client";

import { ReactNode } from "react";

export type ToastTone = "success" | "info" | "warning" | "error";

type ToastNoticeProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  tone: ToastTone;
};

function NoticeIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  if (tone === "error") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4">
        <path d="M12 8v5" />
        <path d="M12 17h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }

  if (tone === "warning") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4">
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function ToastNotice({ children, className = "", title, tone }: ToastNoticeProps) {
  const toneClasses = {
    error: "border-coral/30 bg-coral/[0.10] text-ink",
    info: "border-sky bg-sky/80 text-ink",
    success: "border-pine/20 bg-mint text-pine",
    warning: "border-amber/40 bg-amber/[0.16] text-ink",
  };
  const iconClasses = {
    error: "bg-coral/20 text-coral",
    info: "bg-white/70 text-pine",
    success: "bg-white/70 text-pine",
    warning: "bg-white/70 text-ink",
  };

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`toast-notice rounded-2xl border px-4 py-3 shadow-[0_18px_54px_rgba(7,20,24,0.08)] ${toneClasses[tone]} ${className}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${iconClasses[tone]}`}>
          <NoticeIcon tone={tone} />
        </span>
        <span className="min-w-0">
          {title ? <span className="block text-sm font-black">{title}</span> : null}
          <span className="block text-sm font-bold leading-6 text-current/78">{children}</span>
        </span>
      </div>
    </div>
  );
}
