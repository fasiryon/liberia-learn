"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const DISMISSED_KEY = "teacher_onboarding_checklist_dismissed";
const VIEWED_LESSON_KEY = "teacher_has_viewed_lesson";
const VISITED_INTELLIGENCE_KEY = "teacher_has_seen_intelligence";

type ChecklistItem = {
  id: string;
  href: string;
  label: string;
  done: boolean;
};

export default function OnboardingChecklist({
  isOnboarded,
  profileReady,
  hasRoster,
  hasAssignment,
}: {
  isOnboarded: boolean;
  profileReady: boolean;
  hasRoster: boolean;
  hasAssignment: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [hasViewedLesson, setHasViewedLesson] = useState(false);
  const [hasVisitedIntelligence, setHasVisitedIntelligence] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "true");
    setHasViewedLesson(window.localStorage.getItem(VIEWED_LESSON_KEY) === "true");
    setHasVisitedIntelligence(
      window.localStorage.getItem(VISITED_INTELLIGENCE_KEY) === "true"
    );
  }, []);

  const items = useMemo<ChecklistItem[]>(
    () => [
      { id: "profile", href: "/teacher/profile", label: "Set up your profile", done: profileReady },
      { id: "roster", href: "/teacher/students", label: "View your class roster", done: hasRoster },
      { id: "lessons", href: "/teacher/curriculum", label: "Explore your lessons", done: hasViewedLesson },
      { id: "assignment", href: "/teacher/assignments/new", label: "Create your first assignment", done: hasAssignment },
      { id: "progress", href: "/teacher/intelligence", label: "Check student progress", done: hasVisitedIntelligence },
    ],
    [hasAssignment, hasRoster, hasViewedLesson, hasVisitedIntelligence, profileReady]
  );

  const completedCount = items.filter((item) => item.done).length;
  const allComplete = completedCount === items.length;

  async function markComplete() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/teacher/onboarding/complete", {
        method: "PATCH",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to complete onboarding");
      }
      setMessage("Onboarding marked complete.");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DISMISSED_KEY);
      }
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to complete onboarding");
    } finally {
      setSaving(false);
    }
  }

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISSED_KEY, "true");
    }
  }

  if (isOnboarded || dismissed) {
    return null;
  }

  return (
    <section className="mb-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            New Teacher Checklist
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">
            Start with these five steps
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Complete the basics so your classes, assignments, and student support tools are ready.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900/60"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={item.href}
            className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition-colors hover:border-emerald-400/40 hover:bg-slate-900"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Step {index + 1}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{item.label}</p>
            <p className={`mt-3 text-xs font-semibold ${item.done ? "text-emerald-300" : "text-slate-400"}`}>
              {item.done ? "Complete" : "Open"}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-300">
          {allComplete
            ? "Congratulations. Your teacher setup is ready."
            : `${completedCount} of ${items.length} steps complete.`}
        </p>
        {allComplete ? (
          <button
            type="button"
            onClick={markComplete}
            disabled={saving}
            className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Mark as complete"}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="mt-3 text-sm text-emerald-200">{message}</p>
      ) : null}
    </section>
  );
}
