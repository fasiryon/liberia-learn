"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { stepsForRole, type TourRole } from "@/lib/tours/roleTours";

async function markComplete() {
  try {
    await fetch("/api/user/tour-complete", { method: "PATCH" });
  } catch {
    /* best-effort */
  }
}

/**
 * Single-page guided tour for a non-student role. Only drives steps whose
 * anchor is actually present in the DOM, so a missing nav item never blanks the
 * whole tour (the failure mode of the old direct-driver.js tours). Activates on
 * first login (autoStart) or any time via ?tour=true, and is re-triggerable.
 */
export function RoleTour({
  role,
  autoStart = false,
}: {
  role: TourRole;
  autoStart?: boolean;
}) {
  const pathname = usePathname();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    const tourParam =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("tour")
        : null;
    const active = autoStart || tourParam === "true" || tourParam === "1";
    if (!active) return;
    if (ranRef.current) return;

    const steps = stepsForRole(role);
    if (steps.length === 0) return;

    let cancelled = false;
    let attempts = 0;

    const dropParam = () => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (url.searchParams.has("tour")) {
        url.searchParams.delete("tour");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    };

    const tryStart = () => {
      if (cancelled) return;
      // Wait briefly for nav anchors to mount (client nav fetches badges async).
      const present = steps.filter((s) => document.querySelector(s.selector));
      if (present.length === 0) {
        if (attempts < 20) {
          attempts += 1;
          window.setTimeout(tryStart, 250);
          return;
        }
        // No anchors on this page — nothing to show; don't mark complete so the
        // tour can still run on a page where the nav is present.
        return;
      }
      ranRef.current = true;

      const finish = () => {
        void markComplete();
        dropParam();
      };

      const d = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayColor: "rgba(0,0,0,0.6)",
        steps: present.map((s) => ({
          element: s.selector,
          popover: {
            title: s.title,
            description: s.body,
            side: s.side,
            align: "start" as const,
          },
        })),
        onDestroyed: () => finish(),
      });
      driverRef.current = d;
      d.drive();
    };

    tryStart();

    return () => {
      cancelled = true;
      try {
        driverRef.current?.destroy();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, autoStart, pathname]);

  return null;
}
