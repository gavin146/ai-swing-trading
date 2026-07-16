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
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {hidden ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

export function PasswordField({ className = "", label, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? `Hide ${label ?? "password"}` : `Show ${label ?? "password"}`;
  const toggleVisibility = () => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    setVisible((current) => !current);

    const restoreScroll = () => window.scrollTo(scrollX, scrollY);
    window.requestAnimationFrame(restoreScroll);
    window.setTimeout(restoreScroll, 0);
  };

  return (
    <div className="relative w-full">
      <input
        {...props}
        data-static-control="true"
        type={visible ? "text" : "password"}
        className={`${className} block w-full pr-12`}
      />
      <button
        type="button"
        data-static-control="true"
        aria-label={toggleLabel}
        title={toggleLabel}
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault();
          toggleVisibility();
        }}
        className="absolute bottom-0 right-2 top-0 z-10 my-auto inline-flex h-10 w-10 touch-manipulation items-center justify-center rounded-full text-ink/48 transition hover:bg-white hover:text-ink focus:outline-none focus:ring-2 focus:ring-pine/30"
      >
        <EyeIcon hidden={!visible} />
      </button>
    </div>
  );
}
