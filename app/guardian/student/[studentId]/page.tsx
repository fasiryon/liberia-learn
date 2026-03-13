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
      <main className="min-h-screen bg-slate-950 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-6 w-1/3 animate-pulse rounded bg-slate-800" />
          <div className="h-40 animate-pulse rounded-2xl bg-slate-800" />
          <div className="h-60 animate-pulse rounded-2xl bg-slate-800" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <p className="text-sm text-red-400">{error || "Student not found"}</p>
          <Link href="/guardian" className="text-sm text-emerald-300 hover:text-emerald-200">
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
    <main className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/guardian" className="inline-block text-sm text-emerald-300 hover:text-emerald-200">
          &larr; Back to Dashboard
        </Link>

        {/* Student Header */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <h1 className="text-xl font-bold text-slate-50">
            {student.name || "Student"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {student.email} · {student.currentGrade ? `Grade ${student.currentGrade}` : "Grade not set"}
            {student.relation ? ` · ${student.relation}` : ""}
          </p>
          {latestPlacement && (
            <div className="mt-3 flex gap-2">
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-0.5 text-xs font-medium text-emerald-300">
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
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{attendance.present}</p>
            <p className="text-xs text-slate-500">Present</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{attendance.absent}</p>
            <p className="text-xs text-slate-500">Absent</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{attendance.late}</p>
            <p className="text-xs text-slate-500">Late</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
            <p className="text-2xl font-bold text-sky-400">{lessonViews}</p>
            <p className="text-xs text-slate-500">Lessons (30d)</p>
          </div>
        </div>

        {/* Homework History */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
            Homework History
          </h2>
          {homeworkSubmissions.length === 0 ? (
            <p className="text-sm text-slate-500">No homework submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                    <th className="pb-2 pr-4">Title</th>
                    <th className="pb-2 pr-4">Submitted</th>
                    <th className="pb-2">Score</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {homeworkSubmissions.map((hw) => (
                    <tr key={hw.id} className="border-b border-white/5">
                      <td className="py-2.5 pr-4 font-medium">{hw.title}</td>
                      <td className="py-2.5 pr-4 text-xs text-slate-500">
                        {new Date(hw.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={
                            hw.teacherScore !== null || (hw.aiReviewed && hw.aiScore !== null)
                              ? "text-emerald-300"
                              : "text-amber-300"
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
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
              Placement Tests
            </h2>
            <div className="space-y-2">
              {placementTests.map((pt, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-slate-950/60 border border-white/5 px-4 py-3 text-sm"
                >
                  <div>
                    <span className="text-slate-200 font-medium">{pt.levelLabel}</span>
                    <span className="text-slate-500 ml-2 text-xs">
                      Est. Grade {pt.estimatedGrade}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-300">{pt.summary}</p>
                    <p className="text-[11px] text-slate-500">
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
