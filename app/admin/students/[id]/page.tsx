"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GenerateResetCodeButton } from "@/components/admin/GenerateResetCodeButton";

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
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-6xl space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-[var(--ll-bg)]/70" />
          ))}
        </div>
      </main>
    );
  }

  if (error || !student) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            {error ?? "Student not found."}
          </div>
          <Link href="/admin/students" className="inline-flex rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-surface)]">
            Back to students
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">Admin Student Detail</p>
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              {student.email} {student.school ? `• ${student.school.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <GenerateResetCodeButton studentId={params.id} />
            <Link href="/admin/students" className="inline-flex rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-surface)]">
              Back to students
            </Link>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Grade</p>
            <p className="mt-2 text-2xl font-bold">Grade {student.grade ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Classes</p>
            <p className="mt-2 text-sm font-semibold text-[var(--ll-text)]">
              {student.classes.length ? student.classes.map((item) => item.name).join(", ") : "-"}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Placement band</p>
            <p className="mt-2 text-2xl font-bold">{student.latestPlacement?.levelLabel ?? "No placement"}</p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Recommended grade</p>
            <p className="mt-2 text-2xl font-bold">
              {student.latestPlacement ? `Grade ${student.latestPlacement.estimatedGrade}` : "-"}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="text-lg font-semibold">Recent lesson completions</h2>
            <div className="mt-4 space-y-3">
              {student.recentLessonCompletions.length ? student.recentLessonCompletions.map((lesson) => (
                <div key={lesson.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--ll-text)]">{lesson.lessonTitle}</p>
                    <p className="text-xs text-[var(--ll-text-muted)]">
                      {lesson.completedAt ? new Date(lesson.completedAt).toLocaleDateString("en-LR") : "In progress"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
                    {lesson.className} • {lesson.subject} • Score: {lesson.exitTicketScore ?? "-"}
                  </p>
                </div>
              )) : <p className="text-sm text-[var(--ll-text-muted)]">No lesson completions recorded yet.</p>}
            </div>
          </article>

          <article className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="text-lg font-semibold">Exam attempts</h2>
            <div className="mt-4 space-y-3">
              {student.examAttempts.length ? student.examAttempts.map((attempt) => (
                <div key={attempt.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--ll-text)]">{attempt.title}</p>
                    <p className="text-xs text-[var(--ll-text-muted)]">
                      {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString("en-LR") : "In progress"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
                    {attempt.subject} • Score: {attempt.score ?? "-"}
                  </p>
                </div>
              )) : <p className="text-sm text-[var(--ll-text-muted)]">No exam attempts recorded yet.</p>}
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="text-lg font-semibold">Assignment submissions</h2>
            <div className="mt-4 space-y-3">
              {student.assignmentSubmissions.length ? student.assignmentSubmissions.map((submission) => (
                <div key={submission.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--ll-text)]">{submission.title}</p>
                    <p className="text-xs text-[var(--ll-text-muted)]">
                      {submission.turnedInAt ? new Date(submission.turnedInAt).toLocaleDateString("en-LR") : "Not submitted"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
                    {submission.className} • {submission.subject} • Score: {submission.score ?? "-"}
                  </p>
                </div>
              )) : <p className="text-sm text-[var(--ll-text-muted)]">No assignment submissions recorded yet.</p>}
            </div>
          </article>

          <article className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="text-lg font-semibold">Guardian link status</h2>
            <div className="mt-4 space-y-3">
              {student.guardians.length ? student.guardians.map((guardian) => (
                <div key={guardian.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                  <p className="font-semibold text-[var(--ll-text)]">{guardian.name}</p>
                  <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                    {guardian.relation ?? "Guardian"} {guardian.phone ? `• ${guardian.phone}` : ""}
                  </p>
                </div>
              )) : <p className="text-sm text-[var(--ll-text-muted)]">No guardian linked yet.</p>}
            </div>
          </article>
        </section>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
          <h2 className="text-lg font-semibold">Intervention flags</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {student.interventionFlags.length ? student.interventionFlags.map((flag) => (
              <span key={flag.id} className="rounded-full border border-amber-500/30 bg-[var(--ll-yellow-soft)] px-3 py-1 text-xs font-semibold text-[var(--ll-yellow)]">
                {flag.type}: {flag.reason}
              </span>
            )) : <p className="text-sm text-[var(--ll-text-muted)]">No intervention flags recorded.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
