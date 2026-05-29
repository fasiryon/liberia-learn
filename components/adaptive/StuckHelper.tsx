"use client";

/**
 * components/adaptive/StuckHelper.tsx  — NR-14B Phase 4 (updated NR-14B-ii)
 *
 * Tracks wrong answers, response timing, and repeat attempts during a quiz.
 * When a stuck signal fires, polls /api/adaptive/stuck and presents an
 * encouraging intervention card.
 *
 * Scaffold routing: fetches the LessonVariant body from
 * /api/adaptive/scaffold/[variantId] and renders it inline using
 * renderSimpleMarkdown (same renderer as the main lesson).
 *
 * Offline-safe: uses submitWithQueue so events queue to IndexedDB when
 * the device is offline and flush on reconnect.
 *
 * Usage:
 *   <StuckHelper
 *     lessonId={scheduledWorkId}
 *     lessonTitle="Fractions"
 *     subject="MATH"
 *     strandKey="fractions"
 *     grade={5}
 *     gradeBand="upper"
 *     lessonBody={lesson.body}
 *     onPrerequisite={(prereqLessonId) => ...}
 *     onAiTutor={(context) => ...}
 *   />
 *
 * Call `helpers.recordAnswer(correct, responseMs)` and
 * `helpers.recordAttempt()` from the quiz component after each interaction.
 */

import { useCallback, useRef, useState } from "react";
import { submitWithQueue } from "@/lib/offline/submitWithQueue";
import { renderSimpleMarkdown } from "@/lib/lessons";

export type GradeBand = "lower" | "upper";

export type StuckHelperHandlers = {
  /** Call after each question answer */
  recordAnswer: (correct: boolean, responseMs?: number) => void;
  /** Call when student reattempts the same question */
  recordAttempt: () => void;
  /** Reset all counters (e.g. on new question or lesson) */
  reset: () => void;
};

export type StuckRoute =
  | { to: "scaffold"; variantId: string }
  | { to: "prerequisite"; lessonId: string }
  | { to: "ai_tutor" };

type StuckHelperProps = {
  lessonId: string;
  lessonTitle: string;
  subject: string;
  strandKey: string;
  grade: number;
  gradeBand?: GradeBand;
  lessonBody?: string;
  onPrerequisite?: (prereqLessonId: string) => void;
  onAiTutor?: (context: {
    lessonTitle: string;
    lessonBody: string;
    subject: string;
    strandKey: string;
    grade: number;
  }) => void;
  /** Optional render-prop for consuming handlers from parent */
  children?: (helpers: StuckHelperHandlers) => React.ReactNode;
};

type DismissedKey = string;

/**
 * StuckHelper component.
 * - Shows nothing normally.
 * - On stuck signal: shows encouragement banner.
 * - Scaffold route: fetches body from API and renders inline.
 * - Exposes `children` as render-prop to pass handlers up.
 */
export function StuckHelper({
  lessonId,
  lessonTitle,
  subject,
  strandKey,
  grade,
  gradeBand = "upper",
  lessonBody = "",
  onPrerequisite,
  onAiTutor,
  children,
}: StuckHelperProps) {
  const wrongCountRef = useRef(0);
  const attemptCountRef = useRef(0);
  const lastResponseMsRef = useRef(0);
  const questionStartRef = useRef<number>(Date.now());

  const [route, setRoute] = useState<StuckRoute | null>(null);
  const [dismissed, setDismissed] = useState<Set<DismissedKey>>(new Set());
  const [checking, setChecking] = useState(false);
  const [scaffoldBody, setScaffoldBody] = useState<string | null>(null);
  const [scaffoldLoading, setScaffoldLoading] = useState(false);
  const [scaffoldOpen, setScaffoldOpen] = useState(false);

  const dismissKey = route ? `${lessonId}:${route.to}` : null;
  const isDismissed = dismissKey ? dismissed.has(dismissKey) : false;
  const showBanner = route !== null && !isDismissed && !scaffoldOpen;

  const checkIfStuck = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await submitWithQueue({
        type: "tutor-interaction",
        endpoint: "/api/adaptive/stuck",
        body: {
          lessonId,
          wrongCount: wrongCountRef.current,
          lastResponseMs: lastResponseMsRef.current,
          attemptCount: attemptCountRef.current,
          gradeBand,
        },
      });
      if (result.status === "submitted" && result.data) {
        const data = result.data as { isStuck: boolean; route?: StuckRoute };
        if (data.isStuck && data.route) {
          setRoute(data.route);
        }
      }
    } catch {
      // Non-critical — never interrupt quiz flow
    } finally {
      setChecking(false);
    }
  }, [checking, lessonId, gradeBand]);

  const recordAnswer = useCallback(
    (correct: boolean, responseMs?: number) => {
      const elapsed = responseMs ?? Date.now() - questionStartRef.current;
      lastResponseMsRef.current = elapsed;
      questionStartRef.current = Date.now(); // reset for next question
      attemptCountRef.current = 0; // reset attempt counter per question

      if (!correct) {
        wrongCountRef.current += 1;
      }

      void checkIfStuck();
    },
    [checkIfStuck]
  );

  const recordAttempt = useCallback(() => {
    attemptCountRef.current += 1;
    questionStartRef.current = Date.now(); // restart clock on reattempt
    void checkIfStuck();
  }, [checkIfStuck]);

  const reset = useCallback(() => {
    wrongCountRef.current = 0;
    attemptCountRef.current = 0;
    lastResponseMsRef.current = 0;
    questionStartRef.current = Date.now();
    setRoute(null);
    setScaffoldBody(null);
    setScaffoldOpen(false);
  }, []);

  const handleDismiss = useCallback(() => {
    if (dismissKey) setDismissed((prev) => new Set([...prev, dismissKey]));
  }, [dismissKey]);

  // Fetch and show scaffold body inline
  const handleShowScaffold = useCallback(
    async (variantId: string) => {
      setScaffoldLoading(true);
      try {
        const res = await fetch(`/api/adaptive/scaffold/${variantId}`);
        if (res.ok) {
          const data = (await res.json()) as { body: string };
          setScaffoldBody(data.body);
          setScaffoldOpen(true);
        } else {
          // Scaffold fetch failed — fall back to AI tutor if available
          if (onAiTutor) {
            onAiTutor({ lessonTitle, lessonBody, subject, strandKey, grade });
          }
          handleDismiss();
        }
      } catch {
        if (onAiTutor) {
          onAiTutor({ lessonTitle, lessonBody, subject, strandKey, grade });
        }
        handleDismiss();
      } finally {
        setScaffoldLoading(false);
      }
    },
    [onAiTutor, handleDismiss, lessonTitle, lessonBody, subject, strandKey, grade]
  );

  const handleAction = useCallback(() => {
    if (!route) return;
    if (route.to === "scaffold") {
      void handleShowScaffold(route.variantId);
    } else if (route.to === "prerequisite" && onPrerequisite) {
      handleDismiss();
      onPrerequisite(route.lessonId);
    } else if (route.to === "ai_tutor" && onAiTutor) {
      handleDismiss();
      onAiTutor({ lessonTitle, lessonBody, subject, strandKey, grade });
    }
  }, [
    route,
    handleShowScaffold,
    handleDismiss,
    onPrerequisite,
    onAiTutor,
    lessonTitle,
    lessonBody,
    subject,
    strandKey,
    grade,
  ]);

  const helpers: StuckHelperHandlers = { recordAnswer, recordAttempt, reset };

  return (
    <>
      {children?.(helpers)}

      {/* Encouragement banner (shown before scaffold is opened) */}
      {showBanner && route && (
        <div
          role="alert"
          aria-live="polite"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
        >
          <p className="font-semibold text-amber-800">
            Looks like this one&apos;s tricky — let&apos;s break it down together.
          </p>
          <p className="mt-1 text-amber-700">
            {route.to === "scaffold" &&
              "We have a simpler explanation that might help."}
            {route.to === "prerequisite" &&
              "Reviewing an earlier lesson might fill in the gap."}
            {route.to === "ai_tutor" &&
              "Our AI tutor can walk you through this step by step."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(route.to === "scaffold" ||
              (route.to === "prerequisite" && onPrerequisite) ||
              (route.to === "ai_tutor" && onAiTutor)) ? (
              <button
                onClick={handleAction}
                disabled={scaffoldLoading}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
              >
                {scaffoldLoading
                  ? "Loading…"
                  : route.to === "scaffold"
                  ? "Show simpler explanation"
                  : route.to === "prerequisite"
                  ? "Review earlier lesson"
                  : "Ask the AI tutor"}
              </button>
            ) : null}
            <button
              onClick={handleDismiss}
              className="rounded-lg px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              Keep trying
            </button>
          </div>
        </div>
      )}

      {/* Scaffold body panel — rendered inline with the same markdown as main lesson */}
      {scaffoldOpen && scaffoldBody && (
        <div
          role="region"
          aria-label="Simplified explanation"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50"
        >
          <div className="flex items-center justify-between border-b border-emerald-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Let&apos;s take this more slowly
              </p>
              <p className="text-xs text-emerald-600">
                A simpler version of this lesson — same goal, gentler steps.
              </p>
            </div>
            <button
              onClick={() => setScaffoldOpen(false)}
              aria-label="Close simplified explanation"
              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
          <div
            className="prose prose-sm max-w-none px-4 py-4 text-emerald-900 [&_h2]:text-base [&_h3]:text-sm [&_p]:text-sm [&_li]:text-sm"
            dangerouslySetInnerHTML={{
              __html: renderSimpleMarkdown(scaffoldBody),
            }}
          />
          {onAiTutor && (
            <div className="border-t border-emerald-200 px-4 py-3">
              <p className="text-xs text-emerald-600">
                Still unsure? Our AI tutor can answer your specific question.
              </p>
              <button
                onClick={() => {
                  setScaffoldOpen(false);
                  onAiTutor({ lessonTitle, lessonBody, subject, strandKey, grade });
                }}
                className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                Ask the AI tutor
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
