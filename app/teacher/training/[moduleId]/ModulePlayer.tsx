"use client";

/**
 * app/teacher/training/[moduleId]/ModulePlayer.tsx  (Client Component)
 *
 * Interactive step-by-step module reader.
 *
 * Flow:
 *   1. On mount → fires training.module_opened telemetry + calls /api/teacher/training/open.
 *   2. "Next Step" → fires training.module_step_completed telemetry + advances step counter.
 *   3. Last step "Mark Complete" → calls /api/teacher/training/complete → shows celebration screen.
 *
 * Design principles (Low-Literacy UX Standard):
 *   • Big, full-width buttons with large text.
 *   • "Exit Training" escape hatch always visible.
 *   • Short, bold step text.  Screenshot placeholder shown when no image.
 *   • Completion screen confirms the achievement clearly.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { trackEvent, EVENTS } from "@/lib/trackEvent";
import type { TrainingModuleDef } from "@/lib/training/modules";
import type { Badge } from "@/lib/training/badges";

interface Props {
  module: TrainingModuleDef;
}

export function ModulePlayer({ module }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [badgesEarned, setBadgesEarned] = useState<Badge[]>([]);
  const [error, setError] = useState<string | null>(null);

  const steps = module.steps;
  const isLastStep = stepIndex === steps.length - 1;
  const currentStep = steps[stepIndex];

  // ── Track module opened + mark in-progress on mount ──────────────────────
  useEffect(() => {
    trackEvent(EVENTS.TRAINING_MODULE_OPENED, {
      moduleId: module.id,
      level: module.level,
    });

    fetch("/api/teacher/training/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId: module.id }),
    }).catch(() => {}); // Silently fail — telemetry must not break UX
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step advance ──────────────────────────────────────────────────────────
  function handleNext() {
    trackEvent(EVENTS.TRAINING_MODULE_STEP_COMPLETED, {
      moduleId: module.id,
      stepIndex,
      level: module.level,
    });
    setStepIndex((i) => i + 1);
  }

  // ── Module completion ─────────────────────────────────────────────────────
  async function handleMarkComplete() {
    setCompleting(true);
    setError(null);

    try {
      const res = await fetch("/api/teacher/training/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: module.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not save completion. Please try again.");
      }

      const data = await res.json();

      trackEvent(EVENTS.TRAINING_MODULE_COMPLETED, {
        moduleId: module.id,
        level: module.level,
      });

      if (data.levelComplete) {
        trackEvent(EVENTS.TRAINING_LEVEL_COMPLETED, { level: module.level });
        setLevelComplete(true);
      }

      if (Array.isArray(data.badges) && data.badges.length > 0) {
        for (const badge of data.badges as Badge[]) {
          trackEvent(EVENTS.TRAINING_BADGE_AWARDED, { badgeName: badge.name });
        }
        setBadgesEarned(data.badges);
      }

      setCompleted(true);
    } catch (err: any) {
      setError(err?.message ?? "An error occurred. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  // ── Celebration screen ────────────────────────────────────────────────────
  if (completed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-emerald-500/30 bg-slate-900 p-8 text-center">
          <div className="mb-4 text-5xl">✅</div>
          <h2 className="mb-2 text-2xl font-bold text-emerald-400">Module Complete!</h2>
          <p className="mb-6 text-base text-slate-300">{module.title}</p>

          {levelComplete && (
            <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <p className="text-lg font-bold text-emerald-300">
                🏅 Level {module.level} Complete!
              </p>
              <p className="mt-1 text-sm text-slate-400">You have earned a new certification badge.</p>
            </div>
          )}

          {badgesEarned.length > 0 && (
            <div className="mb-6 flex flex-col gap-2">
              {badgesEarned.map((badge) => (
                <span
                  key={badge.name}
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-300"
                >
                  {badge.emoji} {badge.label}
                </span>
              ))}
            </div>
          )}

          <Link
            href="/teacher/training"
            className="block rounded-2xl bg-emerald-500 px-5 py-4 text-base font-bold text-slate-950 hover:bg-emerald-400 transition-colors"
          >
            Back to Training Center →
          </Link>
        </div>
      </div>
    );
  }

  // ── Module player ─────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/teacher/training"
          className="rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold hover:bg-slate-900 transition-colors"
        >
          ← Exit Training
        </Link>
        <span className="text-sm text-slate-400">~{module.estimatedMinutes} min</span>
      </div>

      {/* ── Module title ─────────────────────────────────────────────────── */}
      <h1 className="mb-6 text-2xl font-bold leading-snug">{module.title}</h1>

      {/* ── Step progress bar ─────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-1.5" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full transition-all ${
              i <= stepIndex ? "bg-emerald-400" : "bg-slate-700"
            }`}
          />
        ))}
      </div>

      {/* ── Step card ────────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Step {stepIndex + 1} of {steps.length}
        </p>

        {currentStep.screenshotPlaceholder && (
          <div className="mb-5 flex items-center justify-center rounded-xl bg-slate-800 px-4 py-8 text-center text-sm text-slate-500">
            <span className="mr-2 text-xl">📸</span>
            <span>{currentStep.screenshotPlaceholder}</span>
          </div>
        )}

        <p className="text-lg font-medium leading-relaxed text-slate-100">
          {currentStep.text}
        </p>
      </div>

      {/* ── Error message ────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Action button ────────────────────────────────────────────────── */}
      {isLastStep ? (
        <button
          onClick={handleMarkComplete}
          disabled={completing}
          className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-base font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {completing ? "Saving…" : "✅ Mark as Complete"}
        </button>
      ) : (
        <button
          onClick={handleNext}
          className="w-full rounded-2xl bg-blue-500 px-5 py-4 text-base font-bold text-white hover:bg-blue-400 transition-colors"
        >
          Next Step →
        </button>
      )}

      {/* ── Secondary exit ───────────────────────────────────────────────── */}
      <div className="mt-4 text-center">
        <Link
          href="/teacher/training"
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Exit without completing
        </Link>
      </div>
    </div>
  );
}
