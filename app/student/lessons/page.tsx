"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type LessonItem = {
  contentId: string;
  title?: string | null;
  displayTitle: string;
  grade: number;
  subject: string;
  contentType: string;
  status: string;
  thumbnailUrl?: string | null;
  thumbnailStatus?: string | null;
};

type SubjectCompletion = {
  subject: string;
  total: number;
  completed: number;
  completionRate: number;
};

export default function StudentLessonsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [subjectCompletion, setSubjectCompletion] = useState<SubjectCompletion[]>([]);
  const [generatingSubject, setGeneratingSubject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/lessons")
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("Failed to load lessons");
        return res.json();
      })
      .then((data) => {
        if (data) {
          setLessons(data.items ?? []);
          setStudentId(data.studentId ?? null);
          setSubjectCompletion(data.subjectCompletion ?? []);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  async function generateCertificate(subject: string) {
    if (!studentId) return;
    setGeneratingSubject(subject);
    setError(null);
    try {
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subject }),
      });
      const data = await res.json();
      if (!res.ok || !data?.certificateUrl) {
        throw new Error(data?.error ?? "Certificate generation failed");
      }
      window.open(data.certificateUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setError(err?.message ?? "Certificate generation failed");
    } finally {
      setGeneratingSubject(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-[var(--ll-surface)]" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/dashboard" className="inline-block text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          &larr; Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-[var(--ll-text)]">My Lessons</h1>

        {subjectCompletion.some((item) => item.completionRate >= 80) && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--ll-text)]">Subject Certificates</h2>
                <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                  Generate certificates for subjects with at least 80% completion.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {subjectCompletion
                  .filter((item) => item.completionRate >= 80)
                  .map((item) => (
                    <button
                      key={item.subject}
                      type="button"
                      onClick={() => generateCertificate(item.subject)}
                      disabled={generatingSubject === item.subject}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--ll-yellow)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90 disabled:opacity-60"
                    >
                      <span aria-hidden="true">🎓</span>
                      {generatingSubject === item.subject ? "Generating..." : `${item.subject} Certificate`}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {!error && lessons.length === 0 && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center">
            <p className="text-sm text-[var(--ll-text-muted)]">No lessons available yet.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {lessons.map((lesson) => (
            <Link
              key={lesson.contentId}
              href={`/student/lesson/${lesson.contentId}`}
              className="group overflow-hidden rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 hover:border-emerald-400/30 transition-colors"
            >
              {lesson.thumbnailUrl ? (
                <img src={lesson.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
              ) : (
                <div className="aspect-video w-full bg-[var(--ll-surface)]">
                  <div className={lesson.thumbnailStatus === "processing" ? "h-full w-full animate-pulse bg-white/10" : "h-full w-full bg-[linear-gradient(135deg,rgba(34,197,94,0.18),rgba(250,204,21,0.14))]"} />
                </div>
              )}
              <div className="space-y-3 p-5">
                <h2 className="text-sm font-semibold text-[var(--ll-text)] group-hover:text-[var(--ll-yellow)] transition-colors">
                  {lesson.displayTitle}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[var(--ll-yellow)]/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-medium text-[var(--ll-yellow)]">
                    Grade {lesson.grade}
                  </span>
                  <span className="rounded-full bg-[var(--ll-yellow)]/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-medium text-[var(--ll-yellow)]">
                    {lesson.subject}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
