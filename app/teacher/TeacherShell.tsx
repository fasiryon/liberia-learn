"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { GuidedOnboarding } from "@/components/GuidedOnboarding";
import { AccessibilityToggle } from "@/components/AccessibilityToggle";
import { LegalFooter } from "@/components/LegalFooter";
import { TeacherWelcomeGate } from "@/app/teacher/TeacherWelcomeGate";
import { safeLogout } from "@/lib/safe-logout";

// Flags are inlined at build time by Next.js for client bundles.
const ONBOARDING_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING === "true";
const A11Y_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE === "true";

/**
 * TeacherShell — client wrapper injected by app/teacher/layout.tsx.
 *
 * Adds the floating help toolbar (Help button + Accessibility toggle) and
 * the GuidedOnboarding modal overlay to every teacher-facing page.
 * The server-rendered page content is passed as children unchanged.
 */
export function TeacherShell({
  children,
  needsWelcome,
}: {
  children: React.ReactNode;
  needsWelcome: boolean;
}) {
  // Incrementing reopenKey triggers the guide to reset and reopen
  const [reopenKey, setReopenKey] = useState(0);

  return (
    <>
      <TeacherWelcomeGate needsWelcome={needsWelcome} />
      <div className="pointer-events-none fixed right-4 top-4 z-40">
        <button
          type="button"
          onClick={async () => {
            await safeLogout();
            await signOut({ callbackUrl: "/login" });
          }}
          className="pointer-events-auto rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-red-950/30 transition-colors hover:bg-red-400"
        >
          Log out
        </button>
      </div>
      {children}
      <LegalFooter />

      {/* ── Floating toolbar (bottom-right) ─────────────────────────── */}
      {(ONBOARDING_ENABLED || A11Y_ENABLED) && (
        <div
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2"
          aria-label="Accessibility and help toolbar"
        >
          {A11Y_ENABLED && <AccessibilityToggle />}

          {ONBOARDING_ENABLED && (
            <button
              type="button"
              onClick={() => setReopenKey((k) => k + 1)}
              aria-label="Open step-by-step guide"
              title="Open step-by-step guide"
              className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
            >
              ? Help
            </button>
          )}
        </div>
      )}

      {/* ── Guided onboarding overlay ────────────────────────────────── */}
      {ONBOARDING_ENABLED && (
        <GuidedOnboarding
          reopenKey={reopenKey}
          onClose={() => {}} // toolbar stays visible; no extra action needed
        />
      )}
    </>
  );
}
