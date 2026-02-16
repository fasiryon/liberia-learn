"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type StudentSummary = {
  studentId: string;
  name: string | null;
  email: string | null;
  currentGrade: number | null;
  relation: string | null;
  lastHomework: {
    title: string;
    submittedAt: string;
    aiScore: number | null;
    teacherScore: number | null;
    aiReviewed: boolean;
  } | null;
  placement: {
    band: string;
    estimatedGrade: number;
    levelLabel: string;
  } | null;
  lessonViewsThisWeek: number;
};

export default function GuardianDashboard() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/guardian/students")
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("Failed to load students");
        return res.json();
      })
      .then((data) => {
        if (data) setStudents(data.students);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  function formatBand(band: string) {
    return band.replace("_", "-").replace("G", "Grade ");
  }

  function scoreDisplay(hw: StudentSummary["lastHomework"]) {
    if (!hw) return null;
    if (hw.teacherScore !== null) return `${hw.teacherScore}%`;
    if (hw.aiReviewed && hw.aiScore !== null) return `${Math.round(hw.aiScore)}% (AI)`;
    return "Pending review";
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Guardian Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor your child's learning progress.
          </p>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-3"
              >
                <div className="h-5 w-1/3 animate-pulse rounded bg-slate-800" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-800" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && students.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center">
            <p className="text-sm text-slate-400">
              No students linked to your account yet. Contact your school admin.
            </p>
          </div>
        )}

        {students.map((s) => (
          <div
            key={s.studentId}
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">
                  {s.name || "Unnamed Student"}
                </h2>
                <p className="text-xs text-slate-500">
                  {s.relation ? `${s.relation} · ` : ""}
                  {s.currentGrade ? `Grade ${s.currentGrade}` : "Grade not set"}
                </p>
              </div>
              {s.placement && (
                <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-0.5 text-xs font-medium text-emerald-300">
                  {formatBand(s.placement.band)} · {s.placement.levelLabel}
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Last homework */}
              <div className="rounded-xl bg-slate-950/60 border border-white/5 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Last Homework</p>
                {s.lastHomework ? (
                  <>
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {s.lastHomework.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Score: {scoreDisplay(s.lastHomework)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No submissions yet</p>
                )}
              </div>

              {/* Lesson activity */}
              <div className="rounded-xl bg-slate-950/60 border border-white/5 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">This Week</p>
                <p className="text-sm font-medium text-slate-200">
                  {s.lessonViewsThisWeek} lesson{s.lessonViewsThisWeek !== 1 ? "s" : ""} viewed
                </p>
              </div>
            </div>

            <Link
              href={`/guardian/student/${s.studentId}`}
              className="inline-block rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              View Details
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
