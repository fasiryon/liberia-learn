"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ll_teacher_sentiment_at";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type Rating = "good" | "okay" | "struggling";

const OPTIONS: Array<{ rating: Rating; emoji: string; label: string }> = [
  { rating: "good", emoji: "👍", label: "Good" },
  { rating: "okay", emoji: "😐", label: "Okay" },
  { rating: "struggling", emoji: "👎", label: "Struggling" },
];

export function WeeklySentiment() {
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const last = localStorage.getItem(STORAGE_KEY);
    if (!last || Date.now() - Number(last) > SEVEN_DAYS_MS) {
      setVisible(true);
    }
  }, []);

  async function handleSelect(rating: Rating) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/teacher/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="ll-section p-4">
      {submitted ? (
        <p className="text-center text-sm text-[var(--ll-text-muted)]">
          Thanks for the feedback.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--ll-text)]">
            How is this week going?
          </p>
          <div className="flex items-center gap-2">
            {OPTIONS.map(({ rating, emoji, label }) => (
              <button
                key={rating}
                type="button"
                disabled={submitting}
                onClick={() => handleSelect(rating)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-sm text-[var(--ll-text-muted)] transition-colors hover:border-[var(--ll-border-strong)] hover:text-[var(--ll-text)] disabled:opacity-60"
              >
                <span>{emoji}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
