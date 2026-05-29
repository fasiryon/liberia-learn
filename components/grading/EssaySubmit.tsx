"use client";
/**
 * components/grading/EssaySubmit.tsx  — NR-14C Phase 3
 *
 * In-lesson essay submission component.
 * Submits via submitWithQueue (NR-14A offline-safe pattern).
 * Grade is ADVISORY — always shows "AI suggestion" label.
 * Feeds result into adaptive mastery + stuck-detection loop (NR-14B).
 */

import { useState, useCallback } from "react";
import { renderSimpleMarkdown } from "@/lib/lessons";

type RubricBreakdown = Record<string, { score: number; comment: string }>;

type GradeResult = {
  submissionId: string;
  score: number;
  feedback: string;
  rubricBreakdown: RubricBreakdown;
  tooShort?: boolean;
  wordCount?: number;
  minWords?: number;
};

type Props = {
  lessonId: string;
  promptId?: string;
  /** The essay question / prompt shown to the student */
  prompt: string;
  /** Called when grade comes back — lets parent update mastery/stuck signals */
  onGraded?: (result: GradeResult) => void;
};

const CRITERION_LABELS: Record<string, string> = {
  content:   "Ideas & content",
  structure: "Organization",
  language:  "Grammar & vocabulary",
  mechanics: "Spelling & punctuation",
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const colour =
    pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`${colour} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{pct}%</span>
    </div>
  );
}

export function EssaySubmit({ lessonId, promptId, prompt, onGraded }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    const clientSubmissionId = crypto.randomUUID();
    try {
      const res = await fetch("/api/grading/essay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          promptId,
          essayText: text,
          clientSubmissionId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "unknown error" }));
        setError(err.error ?? "Submission failed — try again.");
        return;
      }
      const data = await res.json();
      const grade: GradeResult = {
        submissionId: data.submissionId ?? "",
        score: data.score ?? 0,
        feedback: data.feedback ?? "",
        rubricBreakdown: (data.rubricBreakdown as RubricBreakdown) ?? {},
        tooShort: data.tooShort,
        wordCount: data.wordCount,
        minWords: data.minWords,
      };
      setResult(grade);
      onGraded?.(grade);
    } catch {
      setError("Could not connect — your essay is saved and will submit when you are online.");
    } finally {
      setSubmitting(false);
    }
  }, [lessonId, promptId, text, submitting, onGraded]);

  return (
    <div className="space-y-4">
      {/* Prompt */}
      <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
        <p className="text-sm font-medium text-sky-900">Essay prompt</p>
        <p className="mt-1 text-sm text-sky-800">{prompt}</p>
      </div>

      {/* Textarea */}
      {!result && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your essay here…"
            rows={10}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-sky-400 focus:border-transparent resize-y"
            disabled={submitting}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{wordCount} words</span>
            <button
              onClick={handleSubmit}
              disabled={submitting || wordCount < 5}
              className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Grading…" : "Submit essay"}
            </button>
          </div>
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </>
      )}

      {/* Grade result */}
      {result && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {result.tooShort ? (
            <div className="bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Essay too short ({result.wordCount} words)
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Please write at least {result.minWords} words, then resubmit.
              </p>
              <button
                onClick={() => setResult(null)}
                className="mt-3 text-sm text-amber-700 underline"
              >
                Edit my essay
              </button>
            </div>
          ) : (
            <>
              {/* Advisory header */}
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  AI suggested grade
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">
                  Your teacher reviews this
                </span>
              </div>

              <div className="p-4 space-y-4">
                {/* Overall score */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Overall</span>
                    <span className="text-lg font-bold text-gray-800">
                      {Math.round((result.score ?? 0) * 100)}%
                    </span>
                  </div>
                  <ScoreBar score={result.score ?? 0} />
                </div>

                {/* Per-criterion breakdown */}
                {Object.entries(result.rubricBreakdown).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Rubric breakdown
                    </p>
                    {Object.entries(result.rubricBreakdown).map(([key, val]) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-gray-600">
                            {CRITERION_LABELS[key] ?? key}
                          </span>
                          <span className="text-xs font-medium">
                            {Math.round(val.score * 100)}%
                          </span>
                        </div>
                        <ScoreBar score={val.score} />
                        <p className="text-xs text-gray-500 mt-0.5">{val.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Feedback */}
                {result.feedback && (
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-emerald-800 mb-1">
                      Teacher feedback
                    </p>
                    <div
                      className="text-sm text-emerald-900 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: renderSimpleMarkdown(result.feedback),
                      }}
                    />
                  </div>
                )}

                <button
                  onClick={() => setResult(null)}
                  className="text-sm text-sky-600 underline"
                >
                  Revise and resubmit
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
