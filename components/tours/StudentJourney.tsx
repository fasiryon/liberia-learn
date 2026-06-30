"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
  STUDENT_JOURNEY,
  STATIC_PAGE_PATHS,
  stepsForPage,
  type JourneyPage,
} from "@/lib/tours/studentJourney";

function pathnameToPage(pathname: string): JourneyPage | null {
  if (pathname.startsWith("/student/lessons/")) return "lesson";
  if (pathname === STATIC_PAGE_PATHS.today) return "today";
  if (pathname.startsWith(STATIC_PAGE_PATHS.homework)) return "homework";
  if (pathname.startsWith(STATIC_PAGE_PATHS.certificates)) return "certificates";
  return null;
}

async function markComplete() {
  try {
    await fetch("/api/user/tour-complete", { method: "PATCH" });
  } catch {
    /* best-effort */
  }
}

/** Resolve a delivery-page lesson URL for the demo student, or null. */
async function resolveLessonHref(): Promise<string | null> {
  try {
    const res = await fetch("/api/student/today", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const fromItems = (data?.items ?? [])
      .map((i: any) => i?.lessonHref)
      .find((h: string | undefined) => typeof h === "string" && h.startsWith("/student/lessons/"));
    if (fromItems) return fromItems;
    const fromDay = (data?.schoolDay?.items ?? [])
      .map((i: any) => i?.primaryAction?.href)
      .find((h: string | undefined) => typeof h === "string" && h.startsWith("/student/lessons/"));
    return fromDay ?? null;
  } catch {
    return null;
  }
}

/**
 * Multi-page student demo journey. Drives the steps for the current page with
 * driver.js, then navigates to the next page (carrying ?tour=true) until the
 * journey finishes. Lesson steps are skipped gracefully when the student has no
 * scheduled lesson to open.
 */
export function StudentJourney({ autoStart = false }: { autoStart?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const ranForKey = useRef<string | null>(null);

  useEffect(() => {
    // Read the trigger from the URL on the client to avoid forcing a Suspense
    // boundary / dynamic de-opt that useSearchParams would impose on the layout.
    const tourParam =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("tour")
        : null;
    const active = autoStart || tourParam === "true" || tourParam === "1";
    if (!active) return;
    const page = pathnameToPage(pathname);
    if (!page) return;

    const pageSteps = stepsForPage(page);
    if (pageSteps.length === 0) return;

    // Guard against re-running for the same page within one visit.
    const runKey = `${pathname}`;
    if (ranForKey.current === runKey) return;

    let cancelled = false;
    let attempts = 0;

    // Wait briefly for the first anchor to exist (pages load async).
    const tryStart = () => {
      if (cancelled) return;
      const firstAnchor = document.querySelector(pageSteps[0].selector);
      if (!firstAnchor && attempts < 20) {
        attempts += 1;
        window.setTimeout(tryStart, 250);
        return;
      }
      // Only drive steps whose anchor is actually present (skip missing ones).
      const present = pageSteps.filter((s) => document.querySelector(s.selector));
      if (present.length === 0) {
        // Nothing to show here — advance to the next page so the journey isn't stuck.
        void goToNextPage(page);
        return;
      }
      ranForKey.current = runKey;

      const d = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayColor: "rgba(0,0,0,0.6)",
        steps: present.map((s) => ({
          element: s.selector,
          popover: { title: s.title, description: s.body, side: s.side, align: "start" as const },
        })),
        onNextClick: () => {
          if (d.isLastStep()) {
            d.destroy();
            void goToNextPage(page);
          } else {
            d.moveNext();
          }
        },
        onCloseClick: () => {
          d.destroy();
          finish();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    const goToNextPage = async (currentPage: JourneyPage) => {
      if (cancelled) return;
      if (currentPage === "today") {
        const lessonHref = await resolveLessonHref();
        if (lessonHref) {
          router.push(withTour(lessonHref));
        } else {
          router.push(withTour(STATIC_PAGE_PATHS.homework));
        }
        return;
      }
      if (currentPage === "lesson") {
        router.push(withTour(STATIC_PAGE_PATHS.homework));
        return;
      }
      if (currentPage === "homework") {
        router.push(withTour(STATIC_PAGE_PATHS.certificates));
        return;
      }
      // certificates is the final page
      finish();
    };

    const finish = () => {
      if (cancelled) return;
      void markComplete();
      // Drop the tour params so a refresh doesn't restart it.
      router.replace(pathname);
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
  }, [autoStart, pathname]);

  return null;
}

function withTour(href: string): string {
  return href.includes("?") ? `${href}&tour=true` : `${href}?tour=true`;
}

/** Total journey length, exported for callers that want to show progress. */
export const STUDENT_JOURNEY_LENGTH = STUDENT_JOURNEY.length;
