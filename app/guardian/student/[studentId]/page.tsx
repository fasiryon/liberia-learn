"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type StudentDetail = {
  student: {
    id: string;
    name: string | null;
    email: string | null;
    currentGrade: number | null;
    relation: string | null;
  };
  placementTests: {
    id: string;
    band: string;
    estimatedGrade: number;
    teacherDecision: string | null;
    teacherGrade: number | null;
    teacherReason: string | null;
    levelLabel: string;
    rawScore: number;
    totalQuestions: number;
    createdAt: string;
    status: "pending" | "confirmed" | "overridden";
    summary: string;
  }[];
  homeworkSubmissions: {
    id: string;
    title: string;
    submittedAt: string;
    aiScore: number | null;
    teacherScore: number | null;
    aiReviewed: boolean;
  }[];
  attendance: { present: number; absent: number; late: number };
  lessonViews: number;
};

export default function GuardianStudentDetail() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;

  const [data, setData] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/guardian/student/${studentId}`)
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("Failed to load student data");
        return res.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [studentId, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-6 w-1/3 animate-pulse rounded bg-[var(--ll-surface)]" />
          <div className="h-40 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
          <div className="h-60 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <p className="text-sm text-red-400">{error || "Student not found"}</p>
          <Link href="/guardian" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { student, placementTests, homeworkSubmissions, attendance, lessonViews } = data;
  const latestPlacement = placementTests[0] ?? null;

  function scoreLabel(hw: StudentDetail["homeworkSubmissions"][number]) {
    if (hw.teacherScore !== null) return `${hw.teacherScore}%`;
    if (hw.aiReviewed && hw.aiScore !== null) return `${Math.round(hw.aiScore)}% (AI)`;
    return "Pending";
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/guardian" className="inline-block text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          &larr; Back to Dashboard
        </Link>

        {/* Student Header */}
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <h1 className="text-xl font-bold text-[var(--ll-text)]">
            {student.name || "Student"}
          </h1>
          <p className="text-xs text-[var(--ll-text-faint)] mt-1">
            {student.email} · {student.currentGrade ? `Grade ${student.currentGrade}` : "Grade not set"}
            {student.relation ? ` · ${student.relation}` : ""}
          </p>
          {latestPlacement && (
            <div className="mt-3 flex gap-2">
              <span className="rounded-full bg-[var(--ll-yellow)]/20 border border-emerald-400/30 px-3 py-0.5 text-xs font-medium text-[var(--ll-yellow)]">
                {latestPlacement.levelLabel}
              </span>
              <span className="rounded-full bg-sky-500/20 border border-sky-400/30 px-3 py-0.5 text-xs text-sky-300">
                Placement: {latestPlacement.rawScore}/{latestPlacement.totalQuestions}
              </span>
            </div>
          )}
        </div>

        {/* Attendance + Activity Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-center">
            <p className="text-2xl font-bold text-[var(--ll-yellow)]">{attendance.present}</p>
            <p className="text-xs text-[var(--ll-text-faint)]">Present</p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{attendance.absent}</p>
            <p className="text-xs text-[var(--ll-text-faint)]">Absent</p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-center">
            <p className="text-2xl font-bold text-[var(--ll-yellow)]">{attendance.late}</p>
            <p className="text-xs text-[var(--ll-text-faint)]">Late</p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-center">
            <p className="text-2xl font-bold text-sky-400">{lessonViews}</p>
            <p className="text-xs text-[var(--ll-text-faint)]">Lessons (30d)</p>
          </div>
        </div>

        {/* Homework History */}
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)] mb-4">
            Homework History
          </h2>
          {homeworkSubmissions.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-faint)]">No homework submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
                    <th className="pb-2 pr-4">Title</th>
                    <th className="pb-2 pr-4">Submitted</th>
                    <th className="pb-2">Score</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--ll-text)]">
                  {homeworkSubmissions.map((hw) => (
                    <tr key={hw.id} className="border-b border-white/5">
                      <td className="py-2.5 pr-4 font-medium">{hw.title}</td>
                      <td className="py-2.5 pr-4 text-xs text-[var(--ll-text-faint)]">
                        {new Date(hw.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={
                            hw.teacherScore !== null || (hw.aiReviewed && hw.aiScore !== null)
                              ? "text-[var(--ll-yellow)]"
                              : "text-[var(--ll-yellow)]"
                          }
                        >
                          {scoreLabel(hw)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Placement History */}
        {placementTests.length > 0 && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)] mb-4">
              Placement Tests
            </h2>
            <div className="space-y-2">
              {placementTests.map((pt, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-[var(--ll-bg)]/60 border border-white/5 px-4 py-3 text-sm"
                >
                  <div>
                    <span className="text-[var(--ll-text)] font-medium">{pt.levelLabel}</span>
                    <span className="text-[var(--ll-text-faint)] ml-2 text-xs">
                      Est. Grade {pt.estimatedGrade}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--ll-text)]">{pt.summary}</p>
                    <p className="text-[11px] text-[var(--ll-text-faint)]">
                      {pt.rawScore}/{pt.totalQuestions} · {new Date(pt.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
