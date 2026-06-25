"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

type AppMotionShellProps = {
  children: ReactNode;
};

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function AppMotionShell({ children }: AppMotionShellProps) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (isModifiedClick(event)) return;

      const target = event.target;

      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href);

      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      setIsNavigating(true);
    }

    window.addEventListener("click", handleClick, { capture: true });

    return () => window.removeEventListener("click", handleClick, { capture: true });
  }, []);

  useEffect(() => {
    if (!isNavigating) return;

    const timeout = window.setTimeout(() => setIsNavigating(false), 1800);

    return () => window.clearTimeout(timeout);
  }, [isNavigating]);

  return (
    <>
      <div
        aria-hidden="true"
        className={`navigation-veil ${isNavigating ? "navigation-veil-active" : ""}`}
      />
      <div
        aria-hidden="true"
        className={`fixed left-0 top-0 z-[90] h-1 bg-[linear-gradient(90deg,#b7f34b,#68d8ff,#0b3d3f)] shadow-[0_0_22px_rgba(183,243,75,0.42)] transition-all duration-500 ease-out ${
          isNavigating ? "w-full opacity-100" : "w-0 opacity-0"
        }`}
      />
      <div key={pathname} className="page-transition">
        {children}
      </div>
    </>
  );
}
