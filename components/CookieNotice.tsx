"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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

  useEffect(() => {
    if (!isCookieNoticePublicPage(pathname)) {
      setVisible(false);
      return;
    }
    setVisible(window.localStorage.getItem(COOKIE_NOTICE_KEY) !== "true");
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 px-4 py-3 shadow-2xl shadow-black/50">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-6">
          LiberiaLearn uses session cookies only for authentication. No tracking or advertising cookies are used.
        </p>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(COOKIE_NOTICE_KEY, "true");
            setVisible(false);
          }}
          className="min-h-11 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
