"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useFixedBandHeight } from "./useFixedBandHeight";

export const COOKIE_NOTICE_KEY = "liberialearn_session_cookie_notice_dismissed";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/moe/login",
  "/pilot-preview",
  "/legal",
  "/privacy",
  "/terms",
  "/data-policy",
  "/contact",
  "/register",
  "/guardian/register",
  "/forgot-password",
  "/reset-password",
  "/onboard",
];

const PRIVATE_PREFIXES = [
  "/admin",
  "/teacher",
  "/student",
  "/guardian",
  "/dashboard",
  "/moe/dashboard",
  "/moe/districts",
  "/moe/compliance",
  "/moe/alerts",
  "/moe/exports",
  "/platform",
  "/api",
];

export function isCookieNoticePublicPage(pathname: string) {
  if (PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function CookieNotice() {
  const pathname = usePathname() ?? "/";
  const [visible, setVisible] = useState(false);
  // Reserved by globals.css like the PWA notice, which stacks above it (issue #199).
  const bandRef = useFixedBandHeight<HTMLDivElement>("--ll-cookie-notice");

  useEffect(() => {
    if (!isCookieNoticePublicPage(pathname)) {
      setVisible(false);
      return;
    }
    setVisible(window.localStorage.getItem(COOKIE_NOTICE_KEY) !== "true");
  }, [pathname]);

  if (!visible) return null;

  return (
    <div ref={bandRef} role="region" aria-label="Cookie notice" data-cookie-notice="" className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 text-sm text-[var(--ll-text)] sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-6">
          LiberiaLearn uses session cookies only for authentication. No tracking or advertising cookies are used.
        </p>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(COOKIE_NOTICE_KEY, "true");
            setVisible(false);
          }}
          className="min-h-11 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ll-accent)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
