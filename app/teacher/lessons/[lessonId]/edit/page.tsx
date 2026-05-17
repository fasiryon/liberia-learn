"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { LessonEditor } from "@/components/editor/LessonEditor";
import { VersionHistory } from "@/components/editor/VersionHistory";

type Lesson = {
  id: string;
  contentId: string;
  title: string | null;
  bodyHtml: string;
  editReviewStatus: string | null;
};

export default function LessonEditPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch(`/api/teacher/lessons/${lessonId}/detail`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setLesson(data);
        setTitle(data.title ?? "");
        setBodyHtml(data.bodyHtml ?? "");
      })
      .catch(() => setError("Failed to load lesson"))
      .finally(() => setLoading(false));
  }, [lessonId]);

  useEffect(() => {
    function handleUnload(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [dirty]);

  const handleBodyChange = useCallback((html: string) => {
    setBodyHtml(html);
    setDirty(true);
  }, []);

  async function save(reviewStatus?: "PENDING") {
    if (reviewStatus) setSubmitting(true); else setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/lessons/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          bodyHtml,
          ...(reviewStatus ? { editReviewStatus: reviewStatus } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setDirty(false);
      setToast(reviewStatus ? "Submitted for review" : "Draft saved");
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }

  function handleRestore(html: string) {
    setBodyHtml(html);
    setDirty(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <p className="text-sm text-[var(--ll-text-muted)]">Loading lesson...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/teacher/curriculum" className="text-sm text-[var(--ll-yellow)]">
              Back to curriculum
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Edit Lesson</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => save()}
              disabled={saving || submitting}
              className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => save("PENDING")}
              disabled={saving || submitting}
              className="rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit for Review"}
            </button>
          </div>
        </div>

        {toast && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {toast}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5 space-y-4">
          <div>
            <label className="block text-xs text-[var(--ll-text-muted)]">Title</label>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--ll-text-muted)]">Lesson content</label>
            <div className="mt-1">
              <LessonEditor
                key={lesson?.id}
                initialContent={bodyHtml}
                onChange={handleBodyChange}
              />
            </div>
          </div>
        </div>

        {lesson && (
          <VersionHistory lessonId={lessonId} onRestore={handleRestore} />
        )}
      </div>
    </main>
  );
}
