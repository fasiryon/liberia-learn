"use client";

/**
 * components/adaptive/StuckHelper.tsx  — NR-14B Phase 4
 *
 * Tracks wrong answers, response timing, and repeat attempts during a quiz.
 * When a stuck signal fires, polls /api/adaptive/stuck and presents an
 * encouraging intervention card.
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
 *     onScaffold={(variantId) => ...}
 *     onPrerequisite={(prereqLessonId) => ...}
 *     onAiTutor={(context) => ...}
 *   />
 *
 * Call `helpers.recordAnswer(correct, responseMs)` and
 * `helpers.recordAttempt()` from the quiz component after each interaction.
 */

import { useCallback, useRef, useState } from "react";
import { submitWithQueue } from "@/lib/offline/submitWithQueue";

export type GradeBand = "lower" | "upper";

export type StuckHelperHandlers = {
  /** Call after each question answer */
  recordAnswer: (correct: boolean, responseMs: number) => void;
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
  onScaffold?: (variantId: string) => void;
  onPrerequisite?: (prereqLessonId: string) => void;
  onAiTutor?: (context: { lessonTitle: string; lessonBody: string; subject: string; strandKey: string; grade: number }) => void;
  /** Optional render-prop for consuming handlers from parent */
  children?: (helpers: StuckHelperHandlers) => React.ReactNode;
};

type DismissedKey = string;

/**
 * StuckHelper component — renders nothing visible normally.
 * Shows an encouragement banner when stuck is detected.
 * Exposes `children` as render-prop to pass handlers up.
 */
export function StuckHelper({
  lessonId,
  lessonTitle,
  subject,
  strandKey,
  grade,
  gradeBand = "upper",
  lessonBody = "",
  onScaffold,
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

  const dismissKey = route ? `${lessonId}:${route.to}` : null;
  const isDismissed = dismissKey ? dismissed.has(dismissKey) : false;
  const showBanner = route !== null && !isDismissed;

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
  }, []);

  const handleDismiss = useCallback(() => {
    if (dismissKey) setDismissed((prev) => new Set([...prev, dismissKey]));
  }, [dismissKey]);

  const handleAction = useCallback(() => {
    if (!route) return;
    handleDismiss();
    if (route.to === "scaffold" && onScaffold) {
      onScaffold(route.variantId);
    } else if (route.to === "prerequisite" && onPrerequisite) {
      onPrerequisite(route.lessonId);
    } else if (route.to === "ai_tutor" && onAiTutor) {
      onAiTutor({ lessonTitle, lessonBody, subject, strandKey, grade });
    }
  }, [route, handleDismiss, onScaffold, onPrerequisite, onAiTutor, lessonTitle, lessonBody, subject, strandKey, grade]);

  const helpers: StuckHelperHandlers = { recordAnswer, recordAttempt, reset };

  return (
    <>
      {children?.(helpers)}

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
              "We&apos;ve got a simpler explanation that might help."}
            {route.to === "prerequisite" &&
              "Reviewing an earlier lesson might fill in the gap."}
            {route.to === "ai_tutor" &&
              "Our AI tutor can walk you through this step by step."}
          </p>
          <div className="mt-3 flex gap-2">
            {(route.to === "scaffold" && onScaffold) ||
            (route.to === "prerequisite" && onPrerequisite) ||
            (route.to === "ai_tutor" && onAiTutor) ? (
              <button
                onClick={handleAction}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {route.to === "scaffold" && "Show simpler explanation"}
                {route.to === "prerequisite" && "Review earlier lesson"}
                {route.to === "ai_tutor" && "Ask the AI tutor"}
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
    </>
  );
}
