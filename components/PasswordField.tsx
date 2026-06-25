"use client";

import { type InputHTMLAttributes, useState } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
};

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      {hidden ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 9 5 9 8a9.4 9.4 0 0 1-2.2 3.8" />
          <path d="M6.6 6.6C4.4 8 3 10.2 3 12c0 3 4 8 9 8a10.8 10.8 0 0 0 4.2-.9" />
        </>
      ) : (
        <>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export function PasswordField({ className = "", label, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? `Hide ${label ?? "password"}` : `Show ${label ?? "password"}`;

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink/48 transition hover:bg-white hover:text-ink focus:outline-none focus:ring-2 focus:ring-pine/30"
      >
        <EyeIcon hidden={!visible} />
      </button>
    </div>
  );
}
