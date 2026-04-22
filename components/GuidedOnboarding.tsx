"use client";

import { useState, useEffect } from "react";
import {
  ONBOARDING_STEPS,
  readOnboardingState,
  writeOnboardingStep,
  writeOnboardingDismissed,
  resetOnboarding,
  isLastStep,
} from "@/lib/onboarding";
import { trackEvent } from "@/lib/trackEvent";

interface GuidedOnboardingProps {
  /** Increment this value to reopen the guide from step 0 (e.g. Help button click). */
  reopenKey?: number;
  onClose?: () => void;
}

/**
 * GuidedOnboarding — step-by-step modal overlay for low-literacy teachers.
 *
 * Feature-flagged via NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING.
 * State is persisted to localStorage so the guide resumes where it was left.
 * Fires onboarding.step_completed + onboarding.completed telemetry events.
 */
export function GuidedOnboarding({ reopenKey = 0, onClose }: GuidedOnboardingProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  // On mount: show guide if not yet dismissed
  useEffect(() => {
    const { dismissed, step: saved } = readOnboardingState();
    if (!dismissed) {
      setStep(saved);
      setVisible(true);
    }
  }, []);

  // When Help button increments reopenKey: reset and reopen
  useEffect(() => {
    if (reopenKey > 0) {
      resetOnboarding();
      setStep(0);
      setVisible(true);
    }
  }, [reopenKey]);

  if (!visible) return null;

  const current = ONBOARDING_STEPS[step];
  const last = isLastStep(step);
  const total = ONBOARDING_STEPS.length;

  function handleNext() {
    trackEvent("onboarding.step_completed", {
      step,
      stepId: current.id,
      totalSteps: total,
    });

    if (last) {
      writeOnboardingDismissed();
      setVisible(false);
      trackEvent("onboarding.completed", { totalSteps: total });
      onClose?.();
    } else {
      const next = step + 1;
      writeOnboardingStep(next);
      setStep(next);
    }
  }

  function handleDismiss() {
    writeOnboardingDismissed();
    setVisible(false);
    onClose?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Step-by-step guide"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ll-bg)]/80 backdrop-blur-sm"
    >
      <div className="relative mx-4 w-full max-w-md rounded-xl border border-emerald-500/40 bg-[var(--ll-bg)] p-7 shadow-none">
        {/* Progress bar */}
        <div className="mb-5 flex items-center gap-1.5" aria-hidden="true">
          {ONBOARDING_STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-[var(--ll-yellow-soft)]" : "bg-[var(--ll-surface-muted)]"
              }`}
            />
          ))}
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          aria-label="Close guide"
          className="absolute right-4 top-4 rounded-full p-2 text-[var(--ll-text-muted)] hover:bg-[var(--ll-surface)] hover:text-[var(--ll-text)] transition-colors"
        >
          ✕
        </button>

        {/* Step counter */}
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--ll-yellow)]">
          Step {step + 1} of {total}
        </p>

        {/* Content */}
        <h2 className="mb-3 text-xl font-bold text-[var(--ll-text)]">{current.title}</h2>
        <p className="mb-7 text-sm leading-relaxed text-[var(--ll-text)]">{current.body}</p>

        {/* Action */}
        <button
          onClick={handleNext}
          className="w-full rounded-xl bg-[var(--ll-yellow)] px-5 py-3.5 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] active:scale-[0.98] transition-all"
        >
          {last ? "Got it — let's go!" : "Next →"}
        </button>
      </div>
    </div>
  );
}
