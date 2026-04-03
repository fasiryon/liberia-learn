"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type StudentDetail = {
  id: string;
  userId: string;
  name: string;
  email: string;
  grade: number | null;
  school: {
    id: string;
    name: string;
  } | null;
  classes: Array<{
    id: string;
    name: string;
    subject: string;
  }>;
  latestPlacement: {
    id: string;
    estimatedGrade: number;
    teacherGrade: number | null;
    teacherDecision: string | null;
    levelLabel: string;
    rawScore: number;
    totalQuestions: number;
    createdAt: string;
  } | null;
  recentLessonCompletions: Array<{
    id: string;
    completedAt: string | null;
    exitTicketScore: number | null;
    className: string;
    subject: string;
    lessonTitle: string;
  }>;
  examAttempts: Array<{
    id: string;
    title: string;
    subject: string;
    score: number | null;
    passed: boolean | null;
    startedAt: string;
    submittedAt: string | null;
  }>;
  assignmentSubmissions: Array<{
    id: string;
    title: string;
    className: string;
    subject: string;
    score: number | null;
    turnedInAt: string | null;
    gradedAt: string | null;
  }>;
  guardians: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    relation: string | null;
  }>;
  interventionFlags: Array<{
    id: string;
    type: string;
    reason: string;
    confidenceScore: number | null;
    status: string;
    createdAt: string;
  }>;
};

export default function AdminStudentDetailPage({ params }: { params: { id: string } }) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch(`/api/admin/students/${params.id}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.student) {
          throw new Error(payload?.error ?? "Failed to load student");
        }
        if (active) {
          setStudent(payload.student);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-6xl space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-900/70" />
          ))}
        </div>
      </main>
    );
  }

  if (error || !student) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            {error ?? "Student not found."}
          </div>
          <Link href="/admin/students" className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Back to students
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Admin Student Detail</p>
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {student.email} {student.school ? `• ${student.school.name}` : ""}
            </p>
          </div>
          <Link href="/admin/students" className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Back to students
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Grade</p>
            <p className="mt-2 text-2xl font-bold">Grade {student.grade ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Classes</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">
              {student.classes.length ? student.classes.map((item) => item.name).join(", ") : "-"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Placement band</p>
            <p className="mt-2 text-2xl font-bold">{student.latestPlacement?.levelLabel ?? "No placement"}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Recommended grade</p>
            <p className="mt-2 text-2xl font-bold">
              {student.latestPlacement ? `Grade ${student.latestPlacement.estimatedGrade}` : "-"}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">Recent lesson completions</h2>
            <div className="mt-4 space-y-3">
              {student.recentLessonCompletions.length ? student.recentLessonCompletions.map((lesson) => (
                <div key={lesson.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">{lesson.lessonTitle}</p>
                    <p className="text-xs text-slate-400">
                      {lesson.completedAt ? new Date(lesson.completedAt).toLocaleDateString("en-LR") : "In progress"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {lesson.className} • {lesson.subject} • Score: {lesson.exitTicketScore ?? "-"}
                  </p>
                </div>
              )) : <p className="text-sm text-slate-400">No lesson completions recorded yet.</p>}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">Exam attempts</h2>
            <div className="mt-4 space-y-3">
              {student.examAttempts.length ? student.examAttempts.map((attempt) => (
                <div key={attempt.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">{attempt.title}</p>
                    <p className="text-xs text-slate-400">
                      {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString("en-LR") : "In progress"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {attempt.subject} • Score: {attempt.score ?? "-"}
                  </p>
                </div>
              )) : <p className="text-sm text-slate-400">No exam attempts recorded yet.</p>}
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">Assignment submissions</h2>
            <div className="mt-4 space-y-3">
              {student.assignmentSubmissions.length ? student.assignmentSubmissions.map((submission) => (
                <div key={submission.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">{submission.title}</p>
                    <p className="text-xs text-slate-400">
                      {submission.turnedInAt ? new Date(submission.turnedInAt).toLocaleDateString("en-LR") : "Not submitted"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {submission.className} • {submission.subject} • Score: {submission.score ?? "-"}
                  </p>
                </div>
              )) : <p className="text-sm text-slate-400">No assignment submissions recorded yet.</p>}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">Guardian link status</h2>
            <div className="mt-4 space-y-3">
              {student.guardians.length ? student.guardians.map((guardian) => (
                <div key={guardian.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="font-semibold text-slate-100">{guardian.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {guardian.relation ?? "Guardian"} {guardian.phone ? `• ${guardian.phone}` : ""}
                  </p>
                </div>
              )) : <p className="text-sm text-slate-400">No guardian linked yet.</p>}
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">Intervention flags</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {student.interventionFlags.length ? student.interventionFlags.map((flag) => (
              <span key={flag.id} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                {flag.type}: {flag.reason}
              </span>
            )) : <p className="text-sm text-slate-400">No intervention flags recorded.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
